import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { isDate, validationError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

// SIGERGROW — penilaian memakai tabel growth_standards di DB (WHO 2006 via Permenkes 2/2020).
// Interpolasi linear antar titik jangkar; di luar cakupan tabel, sistem menyatakan tidak dapat menilai (tidak menebak).
export const growRoutes = new Hono<{ Bindings: Env }>();
growRoutes.use("*", requireAuth);

async function childProfile(db: D1Database, userId: string, profileId: string) {
  const p = await db.prepare("SELECT * FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, userId).first<Record<string, unknown>>();
  if (!p) throw notFound();
  if (p.relation !== "child") throw new ApiError(422, "validation_error", "Modul Tumbuh Kembang hanya untuk profil anak.");
  if (!p.guardian_consent_at) throw new ApiError(422, "consent_required", "Profil anak ini belum memiliki persetujuan orang tua/wali tercatat.");
  return p;
}
export function ageInMonths(birthDate: string, atDate: string): number {
  const days = Math.floor((new Date(`${atDate}T00:00:00Z`).getTime() - new Date(`${birthDate}T00:00:00Z`).getTime()) / 86400_000);
  return Math.floor(days / 30.4375);
}
interface StdRow { age_value: number; median: number; sd_neg2: number; sd_pos2: number; standard_version: string; source_ref: string }
function interpolate(rows: StdRow[], age: number): { median: number; sd_neg2: number; sd_pos2: number } | null {
  if (!rows.length || age < rows[0].age_value || age > rows[rows.length - 1].age_value) return null;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].age_value === age) return rows[i];
    if (i + 1 < rows.length && age > rows[i].age_value && age < rows[i + 1].age_value) {
      const t = (age - rows[i].age_value) / (rows[i + 1].age_value - rows[i].age_value);
      const lerp = (a: number, b: number) => a + (b - a) * t;
      return { median: lerp(rows[i].median, rows[i + 1].median), sd_neg2: lerp(rows[i].sd_neg2, rows[i + 1].sd_neg2), sd_pos2: lerp(rows[i].sd_pos2, rows[i + 1].sd_pos2) };
    }
  }
  return rows[rows.length - 1];
}
export function zScore(value: number, std: { median: number; sd_neg2: number; sd_pos2: number }): number {
  const sd = value >= std.median ? (std.sd_pos2 - std.median) / 2 : (std.median - std.sd_neg2) / 2;
  return Math.round(((value - std.median) / sd) * 100) / 100;
}
export function classifyWfa(z: number): string {
  if (z < -3) return "Berat badan sangat kurang";
  if (z < -2) return "Berat badan kurang";
  if (z <= 1) return "Berat badan baik";
  return "Risiko berat badan lebih";
}
export function classifyHfa(z: number): string {
  if (z < -3) return "Sangat pendek";
  if (z < -2) return "Pendek";
  if (z <= 3) return "Normal";
  return "Tinggi";
}

growRoutes.get("/:profileId/status", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const profile = await childProfile(db, actor.id, c.req.param("profileId") ?? "");
  const today = nowSql().slice(0, 10);
  const months = ageInMonths(String(profile.birth_date), today);
  const latest = await db.prepare("SELECT * FROM measurements WHERE profile_id = ? AND (weight_kg IS NOT NULL OR height_cm IS NOT NULL) ORDER BY measured_at DESC LIMIT 1").bind(profile.id).first<Record<string, unknown>>();
  const out: Record<string, unknown> = { profile: { id: profile.id, full_name: profile.full_name, birth_date: profile.birth_date, sex: profile.sex }, age_months: months, latest_measurement: latest };
  if (!latest) { out.assessment = null; out.note = "Belum ada pengukuran berat/tinggi untuk anak ini. Catat melalui SIGERMONITOR."; return c.json({ data: out }); }
  const assess = async (indicator: "wfa" | "hfa", value: number | null) => {
    if (value === null) return null;
    const rows = (await db.prepare("SELECT age_value, median, sd_neg2, sd_pos2, standard_version, source_ref FROM growth_standards WHERE indicator = ? AND sex = ? AND age_unit = 'month' ORDER BY age_value").bind(indicator, profile.sex).all<StdRow>()).results;
    const std = interpolate(rows, months);
    if (!std) return { indicator, value, status: "Di luar cakupan tabel standar yang dimuat (0-24 bulan). Penilaian memerlukan tabel resmi Permenkes 2/2020 lengkap." };
    const z = zScore(value, std);
    return { indicator, value, z_score: z, category: indicator === "wfa" ? classifyWfa(z) : classifyHfa(z), standard_version: rows[0].standard_version, source_ref: rows[0].source_ref };
  };
  out.assessment = { weight_for_age: await assess("wfa", latest.weight_kg as number | null), height_for_age: await assess("hfa", latest.height_cm as number | null) };
  out.disclaimer = "Penilaian tumbuh kembang adalah skrining awal dari tabel standar yang dimuat sistem (subset jangkar WHO 2006, diinterpolasi). Penilaian klinis memakai tabel/grafik resmi Permenkes 2/2020 oleh tenaga kesehatan.";
  return c.json({ data: out });
});

growRoutes.get("/:profileId/immunizations", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const profile = await childProfile(db, actor.id, c.req.param("profileId") ?? "");
  const months = ageInMonths(String(profile.birth_date), nowSql().slice(0, 10));
  const schedule = (await db.prepare("SELECT * FROM immunization_schedules ORDER BY due_age_unit DESC, due_age_value, vaccine_code, dose_number").all<Record<string, unknown>>()).results;
  const records = (await db.prepare("SELECT * FROM immunization_records WHERE profile_id = ? ORDER BY given_date").bind(profile.id).all<Record<string, unknown>>()).results;
  const items = schedule.map((s) => {
    const dueMonths = s.due_age_unit === "day" ? 0 : Number(s.due_age_value);
    const record = records.find((r) => r.vaccine_code === s.vaccine_code && Number(r.dose_number) === Number(s.dose_number));
    let status: string;
    if (record) status = "done";
    else if (months < dueMonths) status = "upcoming";
    else if (months <= dueMonths + 2) status = "due";
    else status = "overdue";
    return { vaccine_code: s.vaccine_code, vaccine_name: s.vaccine_name, dose_number: s.dose_number, due_age_value: s.due_age_value, due_age_unit: s.due_age_unit, schedule_version: s.schedule_version, status, record: record ?? null };
  });
  items.sort((a, b) => (a.due_age_unit === "day" ? 0 : Number(a.due_age_value)) - (b.due_age_unit === "day" ? 0 : Number(b.due_age_value)));
  return c.json({ data: { age_months: months, items } });
});

growRoutes.post("/:profileId/immunizations", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const profile = await childProfile(db, actor.id, c.req.param("profileId") ?? "");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const vaccineCode = String(body.vaccineCode ?? "").toUpperCase();
  const dose = Number(body.doseNumber);
  const given = String(body.givenDate ?? "");
  const sched = await db.prepare("SELECT id FROM immunization_schedules WHERE vaccine_code = ? AND dose_number = ?").bind(vaccineCode, dose).first();
  if (!sched || !isDate(given)) throw validationError([{ field: "vaccineCode", message: "Vaksin/dosis tidak ada pada jadwal yang dimuat, atau tanggal pemberian tidak valid.", code: "format" }]);
  const id = newId("imz");
  await db.prepare("INSERT INTO immunization_records (id, profile_id, schedule_id, vaccine_code, dose_number, given_date, facility_name, recorded_by_user_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, profile.id, sched.id, vaccineCode, dose, given, typeof body.facilityName === "string" ? body.facilityName : null, actor.id).run();
  return c.json({ data: { record_id: id } }, 201);
});
