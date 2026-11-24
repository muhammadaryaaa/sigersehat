import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { isDate, requireString, validationError, type FieldError } from "../../lib/validate";
import { logAudit } from "../../lib/audit";
import { newId } from "../../lib/crypto";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

export const profilesRoutes = new Hono<{ Bindings: Env }>();
profilesRoutes.use("*", requireAuth);

async function selfProfile(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM health_profiles WHERE linked_user_id = ? AND relation = 'self'").bind(userId).first<Record<string, unknown>>();
}

profilesRoutes.get("/me", async (c) => {
  const actor = c.get("actor") as { id: string };
  const profile = await selfProfile(c.env.DB, actor.id);
  if (!profile) throw notFound();
  const preferences = await c.env.DB.prepare("SELECT * FROM profile_preferences WHERE profile_id = ?").bind(profile.id).first();
  return c.json({ data: { profile, preferences } });
});

profilesRoutes.put("/me", async (c) => {
  const actor = c.get("actor") as { id: string; role: string };
  const profile = await selfProfile(c.env.DB, actor.id);
  if (!profile) throw notFound();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const fullName = requireString(body, "fullName", "Nama lengkap", errors, { min: 3, max: 120 });
  const birthDate = requireString(body, "birthDate", "Tanggal lahir", errors);
  if (birthDate && !isDate(birthDate)) errors.push({ field: "birthDate", message: "Tanggal lahir tidak valid.", code: "format" });
  if (errors.length) throw validationError(errors);
  const sex = body.sex === "female" || body.sex === "male" ? body.sex : profile.sex;
  const regionId = typeof body.regionId === "string" ? body.regionId : profile.region_id;
  const bloodType = typeof body.bloodType === "string" && ["A", "B", "AB", "O"].includes(body.bloodType) ? body.bloodType : null;
  await c.env.DB.prepare("UPDATE health_profiles SET full_name = ?, birth_date = ?, sex = ?, region_id = ?, blood_type = ?, allergies = ?, chronic_conditions = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(fullName, birthDate, sex, regionId, bloodType, typeof body.allergies === "string" ? body.allergies : null, typeof body.chronicConditions === "string" ? body.chronicConditions : null, profile.id).run();
  if (typeof body.phone === "string") {
    await c.env.DB.prepare("UPDATE users SET phone = ?, updated_at = datetime('now') WHERE id = ?").bind(body.phone || null, actor.id).run();
  }
  const pref = body.preferences as Record<string, unknown> | undefined;
  if (pref) {
    await c.env.DB.prepare("UPDATE profile_preferences SET large_text = ?, high_contrast = ?, updated_at = datetime('now') WHERE profile_id = ?")
      .bind(pref.largeText ? 1 : 0, pref.highContrast ? 1 : 0, profile.id).run();
  }
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "profile.update", objectType: "health_profile", objectId: String(profile.id), profileId: String(profile.id) });
  return c.json({ data: { updated: true } });
});

// Daftar profil keluarga yang dikelola pemilik (nyata dari DB; kosong = keadaan kosong yang jujur).
profilesRoutes.get("/family", async (c) => {
  const actor = c.get("actor") as { id: string };
  const { results } = await c.env.DB.prepare("SELECT id, relation, full_name, birth_date, sex FROM health_profiles WHERE owner_user_id = ? AND is_active = 1 ORDER BY relation, full_name").bind(actor.id).all();
  return c.json({ data: results });
});

// Dashboard masyarakat (Tahap 3 Bab 8): agregasi nyata — pengukuran terakhir, pengingat terdekat, keluarga.
export const dashboardRoutes = new Hono<{ Bindings: Env }>();
dashboardRoutes.get("/masyarakat", requireAuth, requireRole("masyarakat", "nakes"), async (c) => {
  const actor = c.get("actor") as { id: string };
  const profile = await selfProfile(c.env.DB, actor.id);
  if (!profile) throw notFound();
  const pid = String(profile.id);
  const latest = await c.env.DB.prepare("SELECT * FROM measurements WHERE profile_id = ? ORDER BY measured_at DESC LIMIT 1").bind(pid).first();
  const recentMeasurements = (await c.env.DB.prepare("SELECT id, measured_at, systolic, diastolic, weight_kg, blood_sugar_mgdl, bmi, source FROM measurements WHERE profile_id = ? ORDER BY measured_at DESC LIMIT 5").bind(pid).all()).results;
  const nextReminders = (await c.env.DB.prepare("SELECT id, title, scheduled_at, reminder_type FROM reminders WHERE profile_id = ? AND status = 'scheduled' AND scheduled_at >= datetime('now') ORDER BY scheduled_at ASC LIMIT 3").bind(pid).all()).results;
  const unread = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0").bind(actor.id).first<{ n: number }>();
  const family = (await c.env.DB.prepare("SELECT id, relation, full_name FROM health_profiles WHERE owner_user_id = ? AND is_active = 1").bind(actor.id).all()).results;
  const lastScreening = await c.env.DB.prepare("SELECT id, risk_category, completed_at FROM screening_sessions WHERE profile_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1").bind(pid).first();
  return c.json({ data: { profile: { id: pid, full_name: profile.full_name }, latest_measurement: latest, recent_measurements: recentMeasurements, next_reminders: nextReminders, unread_notifications: unread?.n ?? 0, family_profiles: family, last_screening: lastScreening } });
});

// Riwayat kesehatan gabungan (butir 4 Tahap 6): pengukuran + skrining + imunisasi + kunjungan ANC,
// digabung kronologis dari tabel nyata; jenis lain menyusul pada tahap modulnya.
profilesRoutes.get("/history", async (c) => {
  const actor = c.get("actor");
  const profileId = c.req.query("profileId") ?? "";
  const profile = await c.env.DB.prepare("SELECT id FROM health_profiles WHERE id = ? AND owner_user_id = ?").bind(profileId, actor.id).first();
  if (!profile) throw notFound();
  const db = c.env.DB;
  const measurements = (await db.prepare("SELECT id, measured_at AS at, systolic, diastolic, weight_kg, blood_sugar_mgdl, bmi, source FROM measurements WHERE profile_id = ? ORDER BY measured_at DESC LIMIT 100").bind(profileId).all<Record<string, unknown>>()).results
    .map((m) => ({ kind: "measurement", at: m.at, title: "Pengukuran", detail: m, id: m.id }));
  const screenings = (await db.prepare("SELECT id, completed_at AS at, risk_category, has_danger_sign FROM screening_sessions WHERE profile_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 50").bind(profileId).all<Record<string, unknown>>()).results
    .map((s) => ({ kind: "screening", at: s.at, title: "Skrining", detail: s, id: s.id }));
  const immunizations = (await db.prepare("SELECT id, given_date AS at, vaccine_code, dose_number, facility_name FROM immunization_records WHERE profile_id = ? ORDER BY given_date DESC LIMIT 50").bind(profileId).all<Record<string, unknown>>()).results
    .map((i) => ({ kind: "immunization", at: i.at, title: "Imunisasi", detail: i, id: i.id }));
  const timeline = [...measurements, ...screenings, ...immunizations].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  return c.json({ data: timeline });
});

// ---- Profil keluarga (manajemen dibuat HANYA di sini — putusan Bab 8 Tahap 1) ----
profilesRoutes.post("/family", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const fullName = requireString(body, "fullName", "Nama", errors, { min: 2, max: 120 });
  const birthDate = requireString(body, "birthDate", "Tanggal lahir", errors);
  if (birthDate && !isDate(birthDate)) errors.push({ field: "birthDate", message: "Format tanggal lahir tidak valid.", code: "format" });
  const sex = body.sex === "male" || body.sex === "female" ? body.sex : null;
  if (!sex) errors.push({ field: "sex", message: "Jenis kelamin wajib dipilih.", code: "required" });
  const relation = ["child", "elderly", "other_family"].includes(String(body.relation)) ? String(body.relation) : null;
  if (!relation) errors.push({ field: "relation", message: "Hubungan keluarga wajib dipilih.", code: "required" });
  if (relation === "child" && body.guardianConsent !== true)
    errors.push({ field: "guardianConsent", message: "Data anak hanya dapat dibuat dengan persetujuan Anda sebagai orang tua/wali.", code: "required" });
  if (errors.length) throw validationError(errors);
  const id = newId("prf");
  await c.env.DB.prepare(`INSERT INTO health_profiles (id, owner_user_id, relation, full_name, birth_date, sex, region_id, blood_type, allergies, chronic_conditions, guardian_consent_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, actor.id, relation, fullName, birthDate, sex, typeof body.regionId === "string" ? body.regionId : null,
      typeof body.bloodType === "string" ? body.bloodType : null, typeof body.allergies === "string" ? body.allergies : null,
      typeof body.chronicConditions === "string" ? body.chronicConditions : null, relation === "child" ? nowSql() : null).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: relation === "child" ? "family.child_profile_created_with_guardian_consent" : "family.profile_created", objectType: "health_profile", objectId: id, profileId: id });
  return c.json({ data: { profile_id: id } }, 201);
});

profilesRoutes.delete("/family/:id", async (c) => {
  const actor = c.get("actor");
  const p = await c.env.DB.prepare("SELECT id, relation FROM health_profiles WHERE id = ? AND owner_user_id = ?").bind(c.req.param("id"), actor.id).first<{ id: string; relation: string }>();
  if (!p) throw notFound();
  if (p.relation === "self") throw new ApiError(422, "conflict", "Profil diri tidak dapat dinonaktifkan dari sini.");
  await c.env.DB.prepare("UPDATE health_profiles SET is_active = 0, updated_at = datetime('now') WHERE id = ?").bind(p.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "family.profile_deactivated", objectType: "health_profile", objectId: p.id, profileId: p.id });
  return c.json({ data: { deactivated: true } });
});
