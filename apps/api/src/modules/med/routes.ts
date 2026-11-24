import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { logAudit } from "../../lib/audit";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

// SIGERMED — gerbang ganda: nakes TERVERIFIKASI + consent aktif pasien per cakupan (Tahap 2 Bab 9).
// Tanpa salah satu, data pasien tidak pernah keluar. Setiap akses pasien dicatat di audit log.
export const medRoutes = new Hono<{ Bindings: Env }>();
medRoutes.use("*", requireAuth, requireRole("nakes"));

async function worker(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM health_worker_profiles WHERE user_id = ?").bind(userId).first<Record<string, unknown>>();
}
async function requireVerified(db: D1Database, userId: string) {
  const w = await worker(db, userId);
  if (!w || w.verification_status !== "verified")
    throw new ApiError(403, "forbidden", "Akses pasien memerlukan status tenaga kesehatan terverifikasi oleh administrator.");
  return w;
}
async function consentedProfile(db: D1Database, nakesId: string, profileId: string, needAdd = false) {
  const row = await db.prepare(
    `SELECT p.*, cs.can_view, cs.can_add_record FROM consents cn
     JOIN consent_scopes cs ON cs.consent_id = cn.id AND cs.module_code = 'med'
     JOIN health_profiles p ON p.id = cn.profile_id
     WHERE cn.grantee_user_id = ? AND cn.profile_id = ? AND cn.status = 'active' AND (cn.expires_at IS NULL OR cn.expires_at > datetime('now'))`)
    .bind(nakesId, profileId).first<Record<string, unknown>>();
  if (!row || row.can_view !== 1) throw notFound();
  if (needAdd && row.can_add_record !== 1) throw new ApiError(403, "forbidden", "Persetujuan pasien untuk profil ini tidak mencakup penambahan catatan.");
  return row;
}

medRoutes.get("/overview", async (c) => {
  const actor = c.get("actor");
  const w = await worker(c.env.DB, actor.id);
  const consented = await c.env.DB.prepare("SELECT COUNT(DISTINCT profile_id) AS n FROM consents WHERE grantee_user_id = ? AND status = 'active'").bind(actor.id).first<{ n: number }>();
  const due = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM follow_up_tasks WHERE created_by_user_id = ? AND status = 'open' AND due_date <= date('now')").bind(actor.id).first<{ n: number }>();
  return c.json({ data: { verification_status: w?.verification_status ?? "none", profession: w?.profession ?? null, workplace: w?.workplace_name ?? null, consented_patients: consented?.n ?? 0, follow_up_due_today: due?.n ?? 0 } });
});

medRoutes.get("/patients", async (c) => {
  const actor = c.get("actor");
  await requireVerified(c.env.DB, actor.id);
  const { results } = await c.env.DB.prepare(
    `SELECT DISTINCT p.id, p.full_name, p.birth_date, p.sex, p.relation, cn.id AS consent_id, cn.granted_at
     FROM consents cn JOIN consent_scopes cs ON cs.consent_id = cn.id AND cs.module_code = 'med' AND cs.can_view = 1
     JOIN health_profiles p ON p.id = cn.profile_id
     WHERE cn.grantee_user_id = ? AND cn.status = 'active' ORDER BY p.full_name`).bind(actor.id).all();
  return c.json({ data: results });
});

medRoutes.get("/patients/:profileId", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  await requireVerified(db, actor.id);
  const profile = await consentedProfile(db, actor.id, c.req.param("profileId"));
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "med.patient_history_viewed", objectType: "health_profile", objectId: String(profile.id), profileId: String(profile.id) });
  const measurements = (await db.prepare("SELECT * FROM measurements WHERE profile_id = ? ORDER BY measured_at DESC LIMIT 50").bind(profile.id).all()).results;
  const screenings = (await db.prepare("SELECT id, risk_category, findings_json, recommendations_json, completed_at, status FROM screening_sessions WHERE profile_id = ? ORDER BY started_at DESC LIMIT 20").bind(profile.id).all()).results;
  const notes = (await db.prepare("SELECT n.*, hp.full_name AS author_name FROM clinical_notes n LEFT JOIN health_profiles hp ON hp.linked_user_id = n.author_user_id AND hp.relation = 'self'  WHERE n.profile_id = ? ORDER BY n.created_at DESC LIMIT 50").bind(profile.id).all()).results;
  const tasks = (await db.prepare("SELECT * FROM follow_up_tasks WHERE profile_id = ? ORDER BY due_date").bind(profile.id).all()).results;
  return c.json({ data: { profile, measurements, screenings, clinical_notes: notes, follow_up_tasks: tasks } });
});

medRoutes.post("/patients/:profileId/notes", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  await requireVerified(db, actor.id);
  const profile = await consentedProfile(db, actor.id, c.req.param("profileId"), true);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const text = requireString(body, "noteText", "Catatan", errors, { min: 3, max: 4000 });
  if (errors.length) throw validationError(errors);
  const id = newId("note");
  await db.prepare("INSERT INTO clinical_notes (id, profile_id, author_user_id, author_role, measurement_id, note_text) VALUES (?,?,?,'nakes',?,?)")
    .bind(id, profile.id, actor.id, typeof body.measurementId === "string" ? body.measurementId : null, text).run();
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "med.clinical_note_created", objectType: "clinical_note", objectId: id, profileId: String(profile.id) });
  return c.json({ data: { note_id: id } }, 201);
});

medRoutes.post("/patients/:profileId/measurements", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  await requireVerified(db, actor.id);
  const profile = await consentedProfile(db, actor.id, c.req.param("profileId"), true);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const num = (k: string) => (typeof body[k] === "number" ? (body[k] as number) : null);
  const sys = num("systolic"), dia = num("diastolic");
  if (sys !== null && dia !== null && sys <= dia) throw validationError([{ field: "systolic", message: "Sistolik harus lebih besar dari diastolik.", code: "range" }]);
  const id = newId("msr");
  await db.prepare(`INSERT INTO measurements (id, profile_id, measured_at, weight_kg, height_cm, systolic, diastolic, blood_sugar_mgdl, temperature_c, spo2_percent, heart_rate_bpm, source, recorded_by_user_id, recorded_by_role, note)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,'nakes',?, 'nakes', ?)`)
    .bind(id, profile.id, nowSql(), num("weightKg"), num("heightCm"), sys, dia, num("bloodSugarMgdl"), num("temperatureC"), num("spo2Percent"), num("heartRateBpm"), actor.id, typeof body.note === "string" ? body.note : null).run();
  return c.json({ data: { measurement_id: id } }, 201);
});

medRoutes.post("/patients/:profileId/tasks", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  await requireVerified(db, actor.id);
  const profile = await consentedProfile(db, actor.id, c.req.param("profileId"), true);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const due = String(body.dueDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw validationError([{ field: "dueDate", message: "Tanggal tindak lanjut wajib valid.", code: "format" }]);
  const id = newId("fut");
  const stmts = [db.prepare("INSERT INTO follow_up_tasks (id, profile_id, created_by_user_id, assigned_to_user_id, task_type, due_date, note) VALUES (?,?,?,?,?,?,?)")
    .bind(id, profile.id, actor.id, actor.id, String(body.taskType ?? "kontrol"), due, typeof body.note === "string" ? body.note : null)];
  // Edukasi pasien & tindak lanjut juga muncul sebagai pengingat di akun pasien.
  const owner = await db.prepare("SELECT owner_user_id FROM health_profiles WHERE id = ?").bind(profile.id).first<{ owner_user_id: string }>();
  if (owner) stmts.push(db.prepare("INSERT INTO reminders (id, profile_id, user_id, reminder_type, title, scheduled_at, related_type, related_id) VALUES (?,?,?,?,?,?, 'follow_up_task', ?)")
    .bind(newId("rem"), profile.id, owner.owner_user_id, "follow_up", String(body.title ?? "Tindak lanjut dari tenaga kesehatan"), `${due} 08:00:00`, id));
  if (typeof body.articleSlug === "string" && body.articleSlug) {
    if (owner) stmts.push(db.prepare("INSERT INTO notifications (id, user_id, title, body, link_path) VALUES (?,?,?,?,?)")
      .bind(newId("ntf"), owner.owner_user_id, "Rekomendasi bacaan dari tenaga kesehatan Anda", "Tenaga kesehatan yang Anda beri persetujuan merekomendasikan artikel ini untuk Anda.", `/edukasi/${body.articleSlug}`));
  }
  await db.batch(stmts);
  return c.json({ data: { task_id: id } }, 201);
});

medRoutes.post("/tasks/:taskId/complete", async (c) => {
  const actor = c.get("actor");
  const task = await c.env.DB.prepare("SELECT * FROM follow_up_tasks WHERE id = ? AND created_by_user_id = ?").bind(c.req.param("taskId"), actor.id).first<Record<string, unknown>>();
  if (!task) throw notFound();
  await c.env.DB.prepare("UPDATE follow_up_tasks SET status = 'done', completed_at = datetime('now') WHERE id = ?").bind(task.id).run();
  return c.json({ data: { completed: true } });
});

// ---- Sisi pasien: direktori nakes terverifikasi & pengelolaan persetujuan ----
export const consentRoutes = new Hono<{ Bindings: Env }>();
consentRoutes.use("*", requireAuth);

consentRoutes.get("/nakes-directory", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT u.id AS user_id, hp.full_name, hw.profession, hw.workplace_name FROM health_worker_profiles hw JOIN users u ON u.id = hw.user_id
     LEFT JOIN health_profiles hp ON hp.linked_user_id = u.id AND hp.relation = 'self'
     WHERE hw.verification_status = 'verified' AND u.status = 'active' ORDER BY hp.full_name`).all();
  return c.json({ data: results });
});

consentRoutes.post("/consents", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = await db.prepare("SELECT * FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(String(body.profileId ?? ""), actor.id).first<Record<string, unknown>>();
  if (!profile) throw notFound();
  const grantee = await db.prepare("SELECT hw.user_id FROM health_worker_profiles hw JOIN users u ON u.id = hw.user_id WHERE hw.user_id = ? AND hw.verification_status = 'verified' AND u.status = 'active'").bind(String(body.granteeUserId ?? "")).first();
  if (!grantee) throw validationError([{ field: "granteeUserId", message: "Tenaga kesehatan tidak ditemukan atau belum terverifikasi.", code: "format" }]);
  const canAdd = body.canAddRecord === true;
  const id = newId("cns");
  await db.batch([
    db.prepare("INSERT INTO consents (id, profile_id, granted_by_user_id, grantee_user_id, expires_at, note) VALUES (?,?,?,?,?,?)")
      .bind(id, profile.id, actor.id, grantee.user_id, typeof body.expiresAt === "string" ? body.expiresAt : null, typeof body.note === "string" ? body.note : null),
    db.prepare("INSERT INTO consent_scopes (consent_id, module_code, can_view, can_add_record) VALUES (?, 'med', 1, ?)").bind(id, canAdd ? 1 : 0),
    db.prepare("INSERT INTO consent_scopes (consent_id, module_code, can_view, can_add_record) VALUES (?, 'monitor', 1, 0)").bind(id),
    db.prepare("INSERT INTO consent_scopes (consent_id, module_code, can_view, can_add_record) VALUES (?, 'check', 1, 0)").bind(id),
  ]);
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "consent.granted", objectType: "consent", objectId: id, profileId: String(profile.id) });
  return c.json({ data: { consent_id: id } }, 201);
});

consentRoutes.get("/consents", async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare(
    `SELECT cn.*, p.full_name AS profile_name, hp.full_name AS grantee_name FROM consents cn
     JOIN health_profiles p ON p.id = cn.profile_id
     LEFT JOIN health_profiles hp ON hp.linked_user_id = cn.grantee_user_id AND hp.relation = 'self'
     WHERE cn.granted_by_user_id = ? ORDER BY cn.granted_at DESC`).bind(actor.id).all();
  return c.json({ data: results });
});

consentRoutes.post("/consents/:id/revoke", async (c) => {
  const actor = c.get("actor");
  const row = await c.env.DB.prepare("SELECT * FROM consents WHERE id = ? AND granted_by_user_id = ?").bind(c.req.param("id"), actor.id).first<Record<string, unknown>>();
  if (!row) throw notFound();
  await c.env.DB.prepare("UPDATE consents SET status = 'revoked', revoked_at = datetime('now'), revoked_by_user_id = ? WHERE id = ?").bind(actor.id, row.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "consent.revoked", objectType: "consent", objectId: String(row.id), profileId: String(row.profile_id) });
  return c.json({ data: { revoked: true } });
});
