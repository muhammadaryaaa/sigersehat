import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { isDate, requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { logAudit } from "../../lib/audit";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

// SIGERWOMEN — data reproduksi privat: hanya pemilik profil perempuan; tidak tampil di ringkasan keluarga mana pun.
export const womenRoutes = new Hono<{ Bindings: Env }>();
womenRoutes.use("*", requireAuth);

async function femaleProfile(db: D1Database, userId: string, profileId: string) {
  const p = await db.prepare("SELECT * FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, userId).first<Record<string, unknown>>();
  if (!p) throw notFound();
  if (p.sex !== "female") throw new ApiError(422, "validation_error", "Modul Perempuan hanya untuk profil perempuan.");
  return p;
}
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function dayDiff(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86400_000);
}

womenRoutes.post("/cycles", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = await femaleProfile(c.env.DB, actor.id, String(body.profileId ?? ""));
  const errors: FieldError[] = [];
  const start = requireString(body, "periodStartDate", "Tanggal mulai haid", errors);
  if (start && !isDate(start)) errors.push({ field: "periodStartDate", message: "Format tanggal tidak valid.", code: "format" });
  const end = typeof body.periodEndDate === "string" && body.periodEndDate ? body.periodEndDate : null;
  if (end && !isDate(end)) errors.push({ field: "periodEndDate", message: "Format tanggal tidak valid.", code: "format" });
  if (errors.length) throw validationError(errors);
  // Panjang siklus = jarak dari mulai haid sebelumnya (dihitung server, bukan ditebak).
  const prev = await c.env.DB.prepare("SELECT period_start_date FROM cycle_records WHERE profile_id = ? ORDER BY period_start_date DESC LIMIT 1").bind(profile.id).first<{ period_start_date: string }>();
  const cycleLength = prev ? dayDiff(prev.period_start_date, start) : null;
  if (cycleLength !== null && (cycleLength < 15 || cycleLength > 90)) throw validationError([{ field: "periodStartDate", message: "Jarak dari haid sebelumnya di luar rentang wajar (15-90 hari). Periksa tanggalnya.", code: "range" }]);
  const id = newId("cyc");
  await c.env.DB.prepare("INSERT INTO cycle_records (id, profile_id, period_start_date, period_end_date, cycle_length_days, symptoms, note, created_by_user_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, profile.id, start, end, cycleLength, typeof body.symptoms === "string" ? body.symptoms : null, typeof body.note === "string" ? body.note : null, actor.id).run();
  return c.json({ data: { cycle_id: id, cycle_length_days: cycleLength } }, 201);
});

womenRoutes.get("/cycles", async (c) => {
  const actor = c.get("actor");
  const profile = await femaleProfile(c.env.DB, actor.id, c.req.query("profileId") ?? "");
  const { results } = await c.env.DB.prepare("SELECT * FROM cycle_records WHERE profile_id = ? ORDER BY period_start_date DESC LIMIT 24").bind(profile.id).all<Record<string, unknown>>();
  const lengths = results.map((r) => r.cycle_length_days).filter((x): x is number => typeof x === "number");
  const avgCycle = lengths.length ? Math.round(lengths.reduce((a, b) => a + b, 0) / lengths.length) : null;
  const lastStart = results.length ? String(results[0].period_start_date) : null;
  const basis = avgCycle !== null ? `rata-rata ${lengths.length} siklus tercatat Anda` : "asumsi umum 28 hari (belum ada riwayat siklus tercatat)";
  const usedCycle = avgCycle ?? 28;
  const predictedNext = lastStart ? addDays(lastStart, usedCycle) : null;
  const ovulation = predictedNext ? addDays(predictedNext, -14) : null;
  const fertileStart = ovulation ? addDays(ovulation, -5) : null;
  return c.json({ data: { records: results, summary: {
    average_cycle_days: avgCycle, last_period_start: lastStart, predicted_next_period: predictedNext,
    estimated_ovulation: ovulation, estimated_fertile_window: fertileStart && ovulation ? { from: fertileStart, to: addDays(ovulation, 1) } : null,
    basis, note: "Prediksi adalah perkiraan dari riwayat yang Anda catat, bukan kepastian medis dan bukan alat kontrasepsi.",
  } } });
});

womenRoutes.post("/pregnancies", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = await femaleProfile(c.env.DB, actor.id, String(body.profileId ?? ""));
  const hpht = typeof body.hphtDate === "string" ? body.hphtDate : "";
  if (!isDate(hpht)) throw validationError([{ field: "hphtDate", message: "Tanggal HPHT (hari pertama haid terakhir) wajib valid.", code: "format" }]);
  const edd = addDays(hpht, 280); // Aturan Naegele: HPHT + 280 hari.
  const id = newId("prg");
  await c.env.DB.prepare("INSERT INTO pregnancies (id, profile_id, hpht_date, estimated_due_date, current_facility) VALUES (?,?,?,?,?)")
    .bind(id, profile.id, hpht, edd, typeof body.currentFacility === "string" ? body.currentFacility : null).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "women.pregnancy_created", objectType: "pregnancy", objectId: id, profileId: String(profile.id) });
  return c.json({ data: { pregnancy_id: id, estimated_due_date: edd, rule: "HPHT + 280 hari (aturan Naegele); perkiraan — tanggal pasti dikonfirmasi lewat pemeriksaan/USG." } }, 201);
});

womenRoutes.get("/pregnancies", async (c) => {
  const actor = c.get("actor");
  const profile = await femaleProfile(c.env.DB, actor.id, c.req.query("profileId") ?? "");
  const { results } = await c.env.DB.prepare("SELECT * FROM pregnancies WHERE profile_id = ? ORDER BY created_at DESC").bind(profile.id).all<Record<string, unknown>>();
  const today = nowSql().slice(0, 10);
  return c.json({ data: results.map((p) => ({ ...p, gestational_age_weeks: p.hpht_date && p.status === "ongoing" ? Math.max(0, Math.floor(dayDiff(String(p.hpht_date), today) / 7)) : null })) });
});

womenRoutes.post("/pregnancies/:id/visits", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const pregnancy = await db.prepare("SELECT * FROM pregnancies WHERE id = ?").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!pregnancy) throw notFound();
  await femaleProfile(db, actor.id, String(pregnancy.profile_id));
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const visitNumber = Number(body.visitNumber);
  if (!Number.isInteger(visitNumber) || visitNumber < 1 || visitNumber > 6) throw validationError([{ field: "visitNumber", message: "Nomor kunjungan ANC 1-6 (standar minimal 6 kali, Permenkes 21/2021).", code: "range" }]);
  const scheduled = typeof body.scheduledDate === "string" && isDate(body.scheduledDate) ? body.scheduledDate : null;
  const id = newId("anc");
  const stmts = [db.prepare("INSERT INTO anc_visits (id, pregnancy_id, visit_number, scheduled_date, facility_name, note) VALUES (?,?,?,?,?,?)")
    .bind(id, pregnancy.id, visitNumber, scheduled, typeof body.facilityName === "string" ? body.facilityName : null, typeof body.note === "string" ? body.note : null)];
  let reminderId: string | null = null;
  if (scheduled) {
    reminderId = newId("rem");
    stmts.push(db.prepare("INSERT INTO reminders (id, profile_id, user_id, reminder_type, title, scheduled_at, related_type, related_id) VALUES (?,?,?,?,?,?, 'anc_visit', ?)")
      .bind(reminderId, pregnancy.profile_id, actor.id, "anc", `Kunjungan ANC ke-${visitNumber}`, `${scheduled} 08:00:00`, id));
  }
  await db.batch(stmts);
  return c.json({ data: { visit_id: id, reminder_id: reminderId } }, 201);
});

womenRoutes.post("/pregnancies/:id/visits/:visitId/complete", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const visit = await db.prepare("SELECT v.*, p.profile_id FROM anc_visits v JOIN pregnancies p ON p.id = v.pregnancy_id WHERE v.id = ? AND v.pregnancy_id = ?").bind(c.req.param("visitId"), c.req.param("id")).first<Record<string, unknown>>();
  if (!visit) throw notFound();
  await femaleProfile(db, actor.id, String(visit.profile_id));
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const actual = typeof body.actualDate === "string" && isDate(body.actualDate) ? body.actualDate : nowSql().slice(0, 10);
  let measurementId: string | null = null;
  const stmts = [];
  if (typeof body.systolic === "number" || typeof body.weightKg === "number") {
    measurementId = newId("msr");
    stmts.push(db.prepare(`INSERT INTO measurements (id, profile_id, measured_at, weight_kg, systolic, diastolic, source, recorded_by_user_id, recorded_by_role)
      VALUES (?,?,?,?,?,?, 'anc', ?, ?)`)
      .bind(measurementId, visit.profile_id, `${actual} 08:00:00`, typeof body.weightKg === "number" ? body.weightKg : null, typeof body.systolic === "number" ? body.systolic : null, typeof body.diastolic === "number" ? body.diastolic : null, actor.id, actor.role));
  }
  stmts.push(db.prepare("UPDATE anc_visits SET actual_date = ?, measurement_id = COALESCE(?, measurement_id), facility_name = COALESCE(?, facility_name) WHERE id = ?")
    .bind(actual, measurementId, typeof body.facilityName === "string" ? body.facilityName : null, visit.id));
  await db.batch(stmts);
  return c.json({ data: { completed: true, measurement_id: measurementId } });
});

womenRoutes.get("/pregnancies/:id/visits", async (c) => {
  const actor = c.get("actor");
  const pregnancy = await c.env.DB.prepare("SELECT * FROM pregnancies WHERE id = ?").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!pregnancy) throw notFound();
  await femaleProfile(c.env.DB, actor.id, String(pregnancy.profile_id));
  const { results } = await c.env.DB.prepare("SELECT * FROM anc_visits WHERE pregnancy_id = ? ORDER BY visit_number").bind(pregnancy.id).all();
  return c.json({ data: results });
});
