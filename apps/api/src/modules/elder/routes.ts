import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import type { Env } from "../auth/service";

// SIGERELDER — tanpa tabel sendiri (keputusan Tahap 2): merangkai profil lansia, pengukuran bersama,
// jadwal obat (medication_schedules), target kesehatan (health_targets), pengingat, dan skrining terakhir.
export const elderRoutes = new Hono<{ Bindings: Env }>();
elderRoutes.use("*", requireAuth);

async function elderProfile(db: D1Database, userId: string, profileId: string) {
  const p = await db.prepare("SELECT * FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, userId).first<Record<string, unknown>>();
  if (!p) throw notFound();
  if (p.relation !== "elderly") throw new ApiError(422, "validation_error", "Modul Lansia hanya untuk profil lansia.");
  return p;
}

elderRoutes.get("/:profileId/overview", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const profile = await elderProfile(db, actor.id, c.req.param("profileId") ?? "");
  const latest = await db.prepare("SELECT * FROM measurements WHERE profile_id = ? ORDER BY measured_at DESC LIMIT 1").bind(profile.id).first();
  const medications = (await db.prepare("SELECT * FROM medication_schedules WHERE profile_id = ? AND status = 'active' ORDER BY created_at").bind(profile.id).all()).results;
  const targets = (await db.prepare("SELECT * FROM health_targets WHERE profile_id = ? AND status = 'active' ORDER BY created_at").bind(profile.id).all()).results;
  const reminders = (await db.prepare("SELECT * FROM reminders WHERE profile_id = ? AND status IN ('scheduled','snoozed','sent') ORDER BY scheduled_at LIMIT 10").bind(profile.id).all()).results;
  const screening = await db.prepare("SELECT id, risk_category, completed_at FROM screening_sessions WHERE profile_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1").bind(profile.id).first();
  return c.json({ data: { profile, latest_measurement: latest, medications, targets, upcoming_reminders: reminders, last_screening: screening } });
});

elderRoutes.post("/:profileId/medications", async (c) => {
  const actor = c.get("actor");
  const profile = await elderProfile(c.env.DB, actor.id, c.req.param("profileId") ?? "");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const name = requireString(body, "medicineName", "Nama obat", errors, { min: 2, max: 120 });
  const dosage = requireString(body, "dosageText", "Dosis (sesuai resep dokter)", errors, { min: 1, max: 80 });
  const freq = requireString(body, "frequencyText", "Frekuensi", errors, { min: 1, max: 80 });
  const times = Array.isArray(body.times) ? (body.times as string[]).filter((t) => /^\d{2}:\d{2}$/.test(t)) : [];
  if (!times.length) errors.push({ field: "times", message: "Isi minimal satu jam minum (format JJ:MM).", code: "required" });
  const start = typeof body.startDate === "string" ? body.startDate : "";
  if (!start) errors.push({ field: "startDate", message: "Tanggal mulai wajib diisi.", code: "required" });
  if (errors.length) throw validationError(errors);
  const id = newId("med");
  await c.env.DB.prepare("INSERT INTO medication_schedules (id, profile_id, medicine_name, dosage_text, frequency_text, times_json, start_date, end_date, created_by_user_id) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(id, profile.id, name, dosage, freq, JSON.stringify(times), start, typeof body.endDate === "string" ? body.endDate : null, actor.id).run();
  return c.json({ data: { medication_id: id, note: "Jadwal obat dicatat sesuai resep/instruksi dokter yang Anda masukkan; SIGERSEHAT tidak mengubah dosis." } }, 201);
});

elderRoutes.post("/:profileId/medications/:medId/stop", async (c) => {
  const actor = c.get("actor");
  const profile = await elderProfile(c.env.DB, actor.id, c.req.param("profileId") ?? "");
  const med = await c.env.DB.prepare("SELECT id FROM medication_schedules WHERE id = ? AND profile_id = ?").bind(c.req.param("medId"), profile.id).first();
  if (!med) throw notFound();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  await c.env.DB.prepare("UPDATE medication_schedules SET status = 'stopped', stopped_reason = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(typeof body.reason === "string" ? body.reason : null, med.id).run();
  return c.json({ data: { stopped: true } });
});

elderRoutes.post("/:profileId/targets", async (c) => {
  const actor = c.get("actor");
  const profile = await elderProfile(c.env.DB, actor.id, c.req.param("profileId") ?? "");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const metric = String(body.metric ?? "");
  const direction = ["at_least", "at_most", "reach"].includes(String(body.direction)) ? String(body.direction) : null;
  const value = Number(body.targetValue);
  if (!metric || !direction || !Number.isFinite(value)) throw validationError([{ field: "target", message: "Target memerlukan metrik, arah, dan nilai angka.", code: "format" }]);
  const id = newId("tgt");
  await c.env.DB.prepare("INSERT INTO health_targets (id, profile_id, metric, direction, target_value, unit, start_date, end_date, created_by_user_id) VALUES (?,?,?,?,?,?, date('now'), ?, ?)")
    .bind(id, profile.id, metric, direction, value, typeof body.unit === "string" ? body.unit : "", typeof body.endDate === "string" ? body.endDate : null, actor.id).run();
  return c.json({ data: { target_id: id } }, 201);
});
