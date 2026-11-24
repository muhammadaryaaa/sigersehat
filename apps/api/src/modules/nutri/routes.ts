import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { notFound } from "../../domain/errors";
import { isDate, validationError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

// SIGERNUTRI — target perilaku terukur dari aturan resmi (bukan toko artikel kedua, putusan Bab 8):
// garam <= 5 g (Kemenkes), gula <= 50 g (4 sdm, Kemenkes), sayur+buah >= 400 g (WHO), air >= 2000 ml.
export const nutriRoutes = new Hono<{ Bindings: Env }>();
nutriRoutes.use("*", requireAuth);

const DEFAULT_TARGETS = [
  { target_type: "salt_g", target_value: 5, unit: "g/hari", label: "Garam (maksimal)", source_ref: "Kemenkes RI: garam tidak lebih dari 1 sendok teh (±5 gram) per hari" },
  { target_type: "sugar_g", target_value: 50, unit: "g/hari", label: "Gula (maksimal)", source_ref: "Kemenkes RI: gula maksimal 4 sendok makan (±50 gram) per hari" },
  { target_type: "vegfruit_g", target_value: 400, unit: "g/hari", label: "Sayur & buah (minimal)", source_ref: "WHO: konsumsi sayur dan buah minimal 400 gram per hari" },
  { target_type: "water_ml", target_value: 2000, unit: "ml/hari", label: "Air putih (minimal)", source_ref: "Kemenkes RI (Isi Piringku): air putih 8 gelas (±2 liter) per hari" },
] as const;

async function ownedProfile(db: D1Database, userId: string, profileId: string) {
  const p = await db.prepare("SELECT * FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, userId).first<Record<string, unknown>>();
  if (!p) throw notFound();
  return p;
}
async function ensureTargets(db: D1Database, profileId: string) {
  const existing = await db.prepare("SELECT COUNT(*) AS n FROM nutrition_targets WHERE profile_id = ? AND effective_to IS NULL").bind(profileId).first<{ n: number }>();
  if ((existing?.n ?? 0) === 0) {
    await db.batch(DEFAULT_TARGETS.map((t) => db.prepare("INSERT INTO nutrition_targets (id, profile_id, target_type, target_value, unit, effective_from, set_by, source_ref) VALUES (?,?,?,?,?, date('now'), 'system_rule', ?)")
      .bind(newId("ntr"), profileId, t.target_type, t.target_value, t.unit, t.source_ref)));
  }
}

nutriRoutes.get("/foods", async (c) => {
  const q = c.req.query("q") ?? "";
  const { results } = await c.env.DB.prepare("SELECT * FROM food_nutrition WHERE food_name LIKE ? ORDER BY food_name LIMIT 50").bind(`%${q}%`).all();
  return c.json({ data: results });
});

nutriRoutes.get("/:profileId/today", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const profile = await ownedProfile(db, actor.id, c.req.param("profileId") ?? "");
  await ensureTargets(db, String(profile.id));
  const today = nowSql().slice(0, 10);
  const targets = (await db.prepare("SELECT * FROM nutrition_targets WHERE profile_id = ? AND effective_to IS NULL").bind(profile.id).all<Record<string, unknown>>()).results;
  const logs = (await db.prepare("SELECT * FROM nutrition_logs WHERE profile_id = ? AND log_date = ?").bind(profile.id, today).all<Record<string, unknown>>()).results;
  const items = targets.map((t) => {
    const meta = DEFAULT_TARGETS.find((d) => d.target_type === t.target_type);
    const log = logs.find((l) => l.target_type === t.target_type);
    const achieved = log ? Number(log.achieved_value) : 0;
    const isMax = t.target_type === "salt_g" || t.target_type === "sugar_g";
    return { ...t, label: meta?.label ?? String(t.target_type), achieved_today: achieved, progress_percent: Math.min(100, Math.round((achieved / Number(t.target_value)) * 100)), within_target: isMax ? achieved <= Number(t.target_value) : achieved >= Number(t.target_value) };
  });
  return c.json({ data: { date: today, items } });
});

nutriRoutes.post("/logs", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = await ownedProfile(db, actor.id, String(body.profileId ?? ""));
  await ensureTargets(db, String(profile.id));
  const targetType = String(body.targetType ?? "");
  if (!DEFAULT_TARGETS.some((t) => t.target_type === targetType)) throw validationError([{ field: "targetType", message: "Jenis target tidak dikenal.", code: "format" }]);
  const logDate = typeof body.logDate === "string" && isDate(body.logDate) ? body.logDate : nowSql().slice(0, 10);
  const value = Number(body.achievedValue);
  if (!Number.isFinite(value) || value < 0) throw validationError([{ field: "achievedValue", message: "Nilai capaian harus angka 0 atau lebih.", code: "range" }]);
  await db.prepare("INSERT INTO nutrition_logs (id, profile_id, log_date, target_type, achieved_value, created_by_user_id) VALUES (?,?,?,?,?,?) ON CONFLICT(profile_id, log_date, target_type) DO UPDATE SET achieved_value = excluded.achieved_value")
    .bind(newId("nlg"), profile.id, logDate, targetType, value, actor.id).run();
  return c.json({ data: { saved: true } });
});

nutriRoutes.get("/:profileId/summary", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const profile = await ownedProfile(db, actor.id, c.req.param("profileId") ?? "");
  const days = Math.min(30, Math.max(1, Number(c.req.query("days") ?? 7)));
  const { results } = await db.prepare(
    `SELECT target_type, COUNT(*) AS days_logged, ROUND(AVG(achieved_value), 1) AS avg_value, MAX(log_date) AS last_date
     FROM nutrition_logs WHERE profile_id = ? AND log_date >= date('now', ?) GROUP BY target_type`).bind(profile.id, `-${days} days`).all();
  return c.json({ data: { days, averages: results } });
});
