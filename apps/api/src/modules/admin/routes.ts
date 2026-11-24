import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { logAudit } from "../../lib/audit";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

export const adminRoutes = new Hono<{ Bindings: Env }>();
// Dashboard admin (Tahap 3 Bab 10): antrean pengelolaan — TANPA data kesehatan individu.
adminRoutes.get("/overview", requireAuth, requireRole("admin", "super_admin"), async (c) => {
  const actor = c.get("actor") as { id: string; role: string };
  const db = c.env.DB;
  const count = async (sql: string) => (await db.prepare(sql).first<{ n: number }>())?.n ?? 0;
  const data: Record<string, unknown> = {
    pending_verifications: await count("SELECT COUNT(*) AS n FROM health_worker_profiles WHERE verification_status = 'pending'"),
    open_correction_reports: await count("SELECT COUNT(*) AS n FROM facility_correction_reports WHERE status = 'open'"),
    open_ai_reports: await count("SELECT COUNT(*) AS n FROM ai_answer_reports WHERE status = 'open'"),
    open_reports: await count("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'"),
    facilities_verified: await count("SELECT COUNT(*) AS n FROM facilities WHERE verification_status = 'verified'"),
    facilities_total: await count("SELECT COUNT(*) AS n FROM facilities"),
    users_total: await count("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'"),
    edu_published: await count("SELECT COUNT(*) AS n FROM edu_contents WHERE status = 'published'"),
  };
  if (actor.role === "super_admin") {
    data.audit_entries = await count("SELECT COUNT(*) AS n FROM audit_logs");
    data.admins_total = await count("SELECT COUNT(*) AS n FROM users WHERE role IN ('admin','super_admin')");
    const settings = (await db.prepare("SELECT key, value FROM system_settings ORDER BY key").all()).results;
    data.system_settings = settings;
  }
  return c.json({ data });
});

adminRoutes.use("*", requireAuth, requireRole("admin", "super_admin"));

// ---- Manajemen pengguna ----
adminRoutes.get("/users", async (c) => {
  const q = c.req.query("q") ?? "";
  const { results } = await c.env.DB.prepare(
    `SELECT u.id, u.email, hp.full_name, u.role, u.status, u.created_at, u.last_login_at, hw.verification_status
     FROM users u LEFT JOIN health_worker_profiles hw ON hw.user_id = u.id
     LEFT JOIN health_profiles hp ON hp.linked_user_id = u.id AND hp.relation = 'self'
     WHERE hp.full_name LIKE ? OR u.email LIKE ? ORDER BY u.created_at DESC LIMIT 200`).bind(`%${q}%`, `%${q}%`).all();
  return c.json({ data: results });
});

adminRoutes.post("/users/:id/status", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = body.status === "suspended" || body.status === "active" ? body.status : null;
  if (!status) throw validationError([{ field: "status", message: "Status harus active atau suspended.", code: "format" }]);
  const target = await c.env.DB.prepare("SELECT id, role FROM users WHERE id = ?").bind(c.req.param("id")).first<{ id: string; role: string }>();
  if (!target) throw notFound();
  if (target.role === "super_admin") throw new ApiError(403, "forbidden", "Akun super administrator tidak dapat diubah dari sini.");
  await c.env.DB.prepare("UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, target.id).run();
  if (status === "suspended") await c.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").bind(target.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: `admin.user_${status}`, objectType: "user", objectId: target.id });
  return c.json({ data: { updated: true } });
});

adminRoutes.post("/users/:id/role", async (c) => {
  const actor = c.get("actor");
  if (actor.role !== "super_admin") throw new ApiError(403, "forbidden", "Perubahan role hanya oleh Super Administrator.");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const role = ["masyarakat", "nakes", "admin"].includes(String(body.role)) ? String(body.role) : null;
  if (!role) throw validationError([{ field: "role", message: "Role tujuan tidak valid (super_admin tidak diberikan lewat jalur ini).", code: "format" }]);
  const target = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?").bind(c.req.param("id")).first();
  if (!target) throw notFound();
  await c.env.DB.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").bind(role, target.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "admin.user_role_changed", objectType: "user", objectId: c.req.param("id") });
  return c.json({ data: { updated: true } });
});

// ---- Verifikasi tenaga kesehatan ----
adminRoutes.get("/verifications", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT hw.*, hp.full_name, u.email FROM health_worker_profiles hw JOIN users u ON u.id = hw.user_id
     LEFT JOIN health_profiles hp ON hp.linked_user_id = u.id AND hp.relation = 'self' WHERE hw.verification_status = 'pending' ORDER BY hw.created_at`).all();
  return c.json({ data: results });
});

adminRoutes.post("/verifications/:userId", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const decision = body.decision === "verified" || body.decision === "rejected" ? body.decision : null;
  if (!decision) throw validationError([{ field: "decision", message: "Keputusan harus verified atau rejected.", code: "format" }]);
  if (decision === "rejected" && !(typeof body.reason === "string" && body.reason.length >= 5))
    throw validationError([{ field: "reason", message: "Penolakan wajib disertai alasan yang jelas.", code: "required" }]);
  const hw = await c.env.DB.prepare("SELECT user_id FROM health_worker_profiles WHERE user_id = ? AND verification_status = 'pending'").bind(c.req.param("userId")).first();
  if (!hw) throw notFound();
  await c.env.DB.prepare("UPDATE health_worker_profiles SET verification_status = ?, verified_by_user_id = ?, verified_at = datetime('now'), rejection_reason = ?, updated_at = datetime('now') WHERE user_id = ?")
    .bind(decision, actor.id, decision === "rejected" ? body.reason : null, c.req.param("userId")).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: `admin.nakes_${decision}`, objectType: "health_worker", objectId: c.req.param("userId") });
  return c.json({ data: { decided: decision } });
});

// ---- Manajemen fasilitas (satu-satunya penulis data faskes) ----
adminRoutes.get("/facilities", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT f.*, r.name AS region_name FROM facilities f JOIN regions r ON r.id = f.region_id ORDER BY f.verification_status, f.name").all();
  return c.json({ data: results });
});

adminRoutes.post("/facilities", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const name = requireString(body, "name", "Nama fasilitas", errors, { min: 3, max: 160 });
  const address = requireString(body, "address", "Alamat", errors, { min: 8, max: 300 });
  const sourceName = requireString(body, "sourceName", "Nama sumber data", errors, { min: 3, max: 120 });
  const lat = Number(body.latitude), lng = Number(body.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push({ field: "latitude", message: "Lintang tidak valid.", code: "range" });
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push({ field: "longitude", message: "Bujur tidak valid.", code: "range" });
  const type = ["rumah_sakit", "puskesmas", "klinik", "laboratorium", "apotek", "pustu", "posyandu"].includes(String(body.facilityType)) ? String(body.facilityType) : null;
  if (!type) errors.push({ field: "facilityType", message: "Jenis fasilitas tidak valid.", code: "format" });
  const region = await c.env.DB.prepare("SELECT id FROM regions WHERE id = ?").bind(String(body.regionId ?? "")).first();
  if (!region) errors.push({ field: "regionId", message: "Wilayah tidak ditemukan.", code: "format" });
  if (errors.length) throw validationError(errors);
  const id = newId("fac");
  await c.env.DB.prepare(`INSERT INTO facilities (id, name, facility_type, address, region_id, latitude, longitude, phone, emergency_phone, has_igd, services, source_name, source_url, verification_status, verified_at, verified_by_user_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'pending', NULL, NULL)`)
    .bind(id, name, type, address, body.regionId, lat, lng, typeof body.phone === "string" ? body.phone : null, typeof body.emergencyPhone === "string" ? body.emergencyPhone : null,
      body.hasIgd === true ? 1 : body.hasIgd === false ? 0 : null, typeof body.services === "string" ? body.services : null, sourceName, typeof body.sourceUrl === "string" ? body.sourceUrl : null).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "admin.facility_created", objectType: "facility", objectId: id });
  return c.json({ data: { facility_id: id, note: "Fasilitas dibuat berstatus pending dan belum tampil publik sampai diverifikasi." } }, 201);
});

adminRoutes.post("/facilities/:id/verify", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = ["verified", "needs_correction", "pending"].includes(String(body.status)) ? String(body.status) : null;
  if (!status) throw validationError([{ field: "status", message: "Status verifikasi tidak valid.", code: "format" }]);
  const fac = await c.env.DB.prepare("SELECT id FROM facilities WHERE id = ?").bind(c.req.param("id")).first();
  if (!fac) throw notFound();
  await c.env.DB.prepare("UPDATE facilities SET verification_status = ?, verified_at = CASE WHEN ? = 'verified' THEN date('now') ELSE verified_at END, verified_by_user_id = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, status, actor.id, fac.id).run();
  return c.json({ data: { updated: true } });
});

// ---- Instrumen skrining ----
adminRoutes.get("/screening-instruments", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, code, name, category, rules_version, is_active FROM screening_instruments ORDER BY category").all();
  return c.json({ data: results });
});
adminRoutes.post("/screening-instruments/:id/active", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const ins = await c.env.DB.prepare("SELECT id FROM screening_instruments WHERE id = ?").bind(c.req.param("id")).first();
  if (!ins) throw notFound();
  await c.env.DB.prepare("UPDATE screening_instruments SET is_active = ? WHERE id = ?").bind(body.active === true ? 1 : 0, ins.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "admin.instrument_toggled", objectType: "screening_instrument", objectId: String(ins.id) });
  return c.json({ data: { updated: true } });
});

// ---- Sumber pengetahuan AI ----
adminRoutes.get("/ai-sources", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, title, publisher, url, topic_tags, status, reviewed_at FROM ai_sources ORDER BY status, title").all();
  return c.json({ data: results });
});
adminRoutes.post("/ai-sources", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const title = requireString(body, "title", "Judul sumber", errors, { min: 5, max: 200 });
  const publisher = requireString(body, "publisher", "Penerbit", errors, { min: 3, max: 120 });
  const content = requireString(body, "contentText", "Isi sumber", errors, { min: 50, max: 20000 });
  if (errors.length) throw validationError(errors);
  const id = newId("src");
  await c.env.DB.prepare("INSERT INTO ai_sources (id, title, publisher, url, content_text, topic_tags, reviewer_user_id, reviewed_at, status) VALUES (?,?,?,?,?,?,?,?, 'draft')")
    .bind(id, title, publisher, typeof body.url === "string" ? body.url : null, content, typeof body.topicTags === "string" ? body.topicTags : null, actor.id, nowSql()).run();
  return c.json({ data: { source_id: id, note: "Sumber dibuat sebagai draft (dengan penelaah tercatat). Aktifkan hanya setelah isi dipastikan benar." } }, 201);
});
adminRoutes.post("/ai-sources/:id/status", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const status = ["active", "inactive", "draft"].includes(String(body.status)) ? String(body.status) : null;
  if (!status) throw validationError([{ field: "status", message: "Status sumber tidak valid.", code: "format" }]);
  const src = await c.env.DB.prepare("SELECT id FROM ai_sources WHERE id = ?").bind(c.req.param("id")).first();
  if (!src) throw notFound();
  await c.env.DB.prepare("UPDATE ai_sources SET status = ? WHERE id = ?").bind(status, src.id).run();
  return c.json({ data: { updated: true } });
});

// ---- Laporan (gabungan tiga antrean) ----
adminRoutes.get("/reports", async (c) => {
  const ai = (await c.env.DB.prepare("SELECT id, 'ai_answer' AS kind, message_id AS target_ref, reason AS description, status, created_at FROM ai_answer_reports WHERE status = 'open'").all()).results;
  const fac = (await c.env.DB.prepare("SELECT id, 'facility_correction' AS kind, facility_id AS target_ref, note AS description, status, created_at FROM facility_correction_reports WHERE status = 'open'").all()).results;
  const gen = (await c.env.DB.prepare("SELECT id, report_type AS kind, target_ref, description, status, created_at FROM reports WHERE status = 'open'").all()).results;
  return c.json({ data: [...ai, ...fac, ...gen].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))) });
});
adminRoutes.post("/reports/:kind/:id/resolve", async (c) => {
  const actor = c.get("actor");
  const kind = c.req.param("kind"); const id = c.req.param("id");
  const table = kind === "ai_answer" ? "ai_answer_reports" : kind === "facility_correction" ? "facility_correction_reports" : kind === "general" ? "reports" : null;
  if (!table) throw notFound();
  const row = await c.env.DB.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(id).first();
  if (!row) throw notFound();
  if (table === "ai_answer_reports") await c.env.DB.prepare("UPDATE ai_answer_reports SET status = 'reviewed_ok', reviewed_by_user_id = ?, reviewed_at = datetime('now') WHERE id = ?").bind(actor.id, id).run();
  else if (table === "facility_correction_reports") await c.env.DB.prepare("UPDATE facility_correction_reports SET status = 'applied', resolved_at = datetime('now') WHERE id = ?").bind(id).run();
  else await c.env.DB.prepare("UPDATE reports SET status = 'resolved', handled_by_user_id = ?, resolved_at = datetime('now') WHERE id = ?").bind(actor.id, id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "admin.report_resolved", objectType: kind, objectId: id });
  return c.json({ data: { resolved: true } });
});

// ---- Audit log (metadata saja; rantai hash dapat diverifikasi) ----
adminRoutes.get("/audit", async (c) => {
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50)));
  const { results } = await c.env.DB.prepare(
    `SELECT a.id, a.actor_role, a.action, a.object_type, a.object_id, a.created_at, hp.full_name AS actor_name
     FROM audit_logs a LEFT JOIN health_profiles hp ON hp.linked_user_id = a.actor_user_id AND hp.relation = 'self' ORDER BY a.id DESC LIMIT ?`).bind(limit).all();
  return c.json({ data: results });
});

// ---- Pengaturan sistem (super admin) ----
adminRoutes.get("/settings", async (c) => {
  if (c.get("actor").role !== "super_admin") throw new ApiError(403, "forbidden", "Pengaturan sistem hanya untuk Super Administrator.");
  const { results } = await c.env.DB.prepare("SELECT key, value, updated_at FROM system_settings ORDER BY key").all();
  return c.json({ data: results });
});
adminRoutes.post("/settings", async (c) => {
  const actor = c.get("actor");
  if (actor.role !== "super_admin") throw new ApiError(403, "forbidden", "Pengaturan sistem hanya untuk Super Administrator.");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const key = String(body.key ?? "");
  if (!["ai_daily_limit", "ai_emergency_number"].includes(key)) throw validationError([{ field: "key", message: "Kunci pengaturan tidak diizinkan diubah dari sini.", code: "format" }]);
  await c.env.DB.prepare("INSERT INTO system_settings (key, value, updated_by_user_id) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by_user_id = excluded.updated_by_user_id, updated_at = datetime('now')")
    .bind(key, String(body.value ?? ""), actor.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "admin.setting_changed", objectType: "system_setting", objectId: key });
  return c.json({ data: { updated: true } });
});
