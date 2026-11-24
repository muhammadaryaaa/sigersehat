import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { notFound } from "../../domain/errors";
import { validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { toSqlTime, nowSql } from "../../lib/time";
import { logAudit } from "../../lib/audit";
import { calcBmi } from "../../domain/rules/screening";
import type { Env } from "../auth/service";

export const monitorRoutes = new Hono<{ Bindings: Env }>();
monitorRoutes.use("*", requireAuth);

async function ownedProfile(db: D1Database, userId: string, profileId: string) {
  const p = await db.prepare("SELECT id FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, userId).first();
  if (!p) throw notFound();
}
const FIELDS: [string, string, [number, number]][] = [
  ["heightCm", "height_cm", [30, 272]], ["weightKg", "weight_kg", [1, 635]],
  ["systolic", "systolic", [40, 300]], ["diastolic", "diastolic", [20, 200]],
  ["bloodSugarMgdl", "blood_sugar_mgdl", [10, 1000]], ["temperatureC", "temperature_c", [30, 45]],
  ["heartRateBpm", "heart_rate_bpm", [20, 250]], ["spo2Percent", "spo2_percent", [50, 100]], ["waistCm", "waist_cm", [30, 300]],
];
function parseValues(body: Record<string, unknown>, errors: FieldError[]) {
  const values: Record<string, number | null> = {};
  for (const [api, , range] of FIELDS) {
    const v = body[api];
    if (v === undefined || v === null || v === "") { values[api] = null; continue; }
    const n = Number(v);
    if (!Number.isFinite(n) || n < range[0] || n > range[1]) { errors.push({ field: api, message: `Nilai di luar rentang wajar (${range[0]}-${range[1]}).`, code: "range" }); values[api] = null; }
    else values[api] = n;
  }
  return values;
}

monitorRoutes.post("/", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = String(body.profileId ?? "");
  await ownedProfile(c.env.DB, actor.id, profileId);
  const errors: FieldError[] = [];
  const v = parseValues(body, errors);
  if (v.systolic !== null && v.diastolic !== null && v.systolic <= v.diastolic) errors.push({ field: "systolic", message: "Sistolik harus lebih besar dari diastolik.", code: "range" });
  if (!Object.values(v).some((x) => x !== null)) errors.push({ field: "measurements", message: "Isi minimal satu nilai pengukuran.", code: "required" });
  if (errors.length) throw validationError(errors);
  const bmi = v.weightKg !== null && v.heightCm !== null ? calcBmi(v.weightKg, v.heightCm) : null;
  const id = newId("msr");
  const measuredAt = typeof body.measuredAt === "string" && body.measuredAt ? toSqlTime(body.measuredAt) : nowSql();
  const idem = c.req.header("Idempotency-Key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
  if (idem) {
    const dup = await c.env.DB.prepare("SELECT id FROM measurements WHERE idempotency_key = ?").bind(idem).first<{ id: string }>();
    if (dup) return c.json({ data: { measurement_id: dup.id, duplicated: true } });
  }
  await c.env.DB.prepare(`INSERT INTO measurements (id, profile_id, measured_at, height_cm, weight_kg, bmi, systolic, diastolic, blood_sugar_mgdl, sugar_context, temperature_c, heart_rate_bpm, spo2_percent, waist_cm, source, recorded_by_user_id, recorded_by_role, note, idempotency_key)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, profileId, measuredAt, v.heightCm, v.weightKg, bmi, v.systolic, v.diastolic, v.bloodSugarMgdl, typeof body.sugarContext === "string" ? body.sugarContext : null, v.temperatureC, v.heartRateBpm, v.spo2Percent, v.waistCm, "manual", actor.id, actor.role, typeof body.note === "string" ? body.note : null, idem).run();
  return c.json({ data: { measurement_id: id, bmi } }, 201);
});

monitorRoutes.get("/", async (c) => {
  const actor = c.get("actor");
  const profileId = c.req.query("profileId") ?? "";
  await ownedProfile(c.env.DB, actor.id, profileId);
  const limit = Math.min(100, Math.max(1, Number(c.req.query("limit") ?? 30)));
  const { results } = await c.env.DB.prepare("SELECT * FROM measurements WHERE profile_id = ? ORDER BY measured_at DESC LIMIT ?").bind(profileId, limit).all();
  return c.json({ data: results });
});

const METRICS: Record<string, string> = { systolic: "systolic", diastolic: "diastolic", weight: "weight_kg", bmi: "bmi", sugar: "blood_sugar_mgdl", heart_rate: "heart_rate_bpm", spo2: "spo2_percent", temperature: "temperature_c", waist: "waist_cm" };
monitorRoutes.get("/trends", async (c) => {
  const actor = c.get("actor");
  const profileId = c.req.query("profileId") ?? "";
  await ownedProfile(c.env.DB, actor.id, profileId);
  const metric = c.req.query("metric") ?? "systolic";
  const column = METRICS[metric];
  if (!column) throw validationError([{ field: "metric", message: "Metrik tidak dikenal.", code: "format" }]);
  const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 90)));
  const { results } = await c.env.DB.prepare(
    `SELECT measured_at, ${column} AS value FROM measurements WHERE profile_id = ? AND ${column} IS NOT NULL AND measured_at >= datetime('now', ?) ORDER BY measured_at ASC`
  ).bind(profileId, `-${days} days`).all<{ measured_at: string; value: number }>();
  const values = results.map((r) => r.value);
  const summary = values.length ? {
    count: values.length, first: values[0], last: values[values.length - 1],
    min: Math.min(...values), max: Math.max(...values),
    avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
    change: Math.round((values[values.length - 1] - values[0]) * 10) / 10,
  } : null;
  return c.json({ data: { metric, days, points: results, summary } });
});

monitorRoutes.put("/:id", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const row = await db.prepare("SELECT * FROM measurements WHERE id = ?").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!row) throw notFound();
  await ownedProfile(db, actor.id, String(row.profile_id));
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const v = parseValues(body, errors);
  if (errors.length) throw validationError(errors);
  const reason = typeof body.reason === "string" ? body.reason : null;
  const revisions = [];
  const updates: string[] = [];
  const binds: unknown[] = [];
  for (const [api, col] of FIELDS) {
    if (body[api] === undefined) continue;
    const newVal = v[api];
    const oldVal = row[col];
    if (newVal !== oldVal) {
      revisions.push(db.prepare("INSERT INTO measurement_revisions (id, measurement_id, changed_by_user_id, field_name, old_value, new_value, reason) VALUES (?,?,?,?,?,?,?)")
        .bind(newId("rev"), row.id, actor.id, col, oldVal === null ? null : String(oldVal), newVal === null ? null : String(newVal), reason));
      updates.push(`${col} = ?`); binds.push(newVal);
    }
  }
  if (!updates.length) return c.json({ data: { updated: false } });
  const weight = v.weightKg ?? (row.weight_kg as number | null);
  const height = v.heightCm ?? (row.height_cm as number | null);
  if (weight !== null && height !== null && weight !== undefined && height !== undefined) { updates.push("bmi = ?"); binds.push(calcBmi(Number(weight), Number(height))); }
  updates.push("updated_at = datetime('now')"); binds.push(row.id);
  await db.batch([db.prepare(`UPDATE measurements SET ${updates.join(", ")} WHERE id = ?`).bind(...binds), ...revisions]);
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "measurement.correct", objectType: "measurement", objectId: String(row.id), profileId: String(row.profile_id) });
  return c.json({ data: { updated: true, revisions: revisions.length } });
});
