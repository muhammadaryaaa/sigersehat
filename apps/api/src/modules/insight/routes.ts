import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import type { Env } from "../auth/service";

// SIGERINSIGHT — agregat anonim saja: tanpa nama, tanpa baris individu, tanpa drill-down.
// Penekanan sel kecil: kelompok dengan jumlah < 5 ditampilkan sebagai "<5" (suppressed) agar tidak dapat
// dipakai menebak individu (praktik k-anonimitas sederhana).
export const insightRoutes = new Hono<{ Bindings: Env }>();
insightRoutes.use("*", requireAuth, requireRole("admin", "super_admin", "nakes"));

export const MIN_CELL = 5;
export function suppress(n: number): number | string {
  return n > 0 && n < MIN_CELL ? "<5" : n;
}

insightRoutes.get("/statistics", async (c) => {
  const db = c.env.DB;
  const days = Math.min(365, Math.max(1, Number(c.req.query("days") ?? 30)));
  const regionId = c.req.query("regionId") ?? "";
  const regionFilter = regionId ? "AND p.region_id = ?" : "";
  const regionBind = regionId ? [regionId] : [];
  const one = async (sql: string, binds: unknown[] = []) => (await db.prepare(sql).bind(...binds).first<{ n: number }>())?.n ?? 0;

  const usersByRole = (await db.prepare("SELECT role, COUNT(*) AS n FROM users WHERE status = 'active' GROUP BY role").all<{ role: string; n: number }>()).results;
  const screeningsTotal = await one(`SELECT COUNT(*) AS n FROM screening_sessions s JOIN health_profiles p ON p.id = s.profile_id WHERE s.status = 'completed' AND s.completed_at >= datetime('now', ?) ${regionFilter}`, [`-${days} days`, ...regionBind]);
  const riskDist = (await db.prepare(`SELECT s.risk_category AS category, COUNT(*) AS n FROM screening_sessions s JOIN health_profiles p ON p.id = s.profile_id WHERE s.status = 'completed' AND s.completed_at >= datetime('now', ?) ${regionFilter} GROUP BY s.risk_category`)
    .bind(`-${days} days`, ...regionBind).all<{ category: string; n: number }>()).results;
  const measurementsTotal = await one(`SELECT COUNT(*) AS n FROM measurements m JOIN health_profiles p ON p.id = m.profile_id WHERE m.measured_at >= datetime('now', ?) ${regionFilter}`, [`-${days} days`, ...regionBind]);
  const regionDist = (await db.prepare(
    `SELECT r.name AS region, COUNT(DISTINCT p.id) AS profiles FROM regions r LEFT JOIN health_profiles p ON p.region_id = r.id GROUP BY r.id ORDER BY profiles DESC`).all<{ region: string; profiles: number }>()).results;
  const monthly = (await db.prepare(
    `SELECT substr(s.completed_at, 1, 7) AS month, COUNT(*) AS n FROM screening_sessions s WHERE s.status = 'completed' GROUP BY month ORDER BY month DESC LIMIT 12`).all<{ month: string; n: number }>()).results.reverse();

  return c.json({ data: {
    period_days: days, region_filter: regionId || null,
    users_by_role: usersByRole.map((r) => ({ role: r.role, count: suppress(r.n) })),
    screenings_completed: screeningsTotal,
    risk_distribution: riskDist.map((r) => ({ category: r.category, count: suppress(r.n) })),
    measurements_recorded: measurementsTotal,
    profiles_by_region: regionDist.map((r) => ({ region: r.region, profiles: suppress(r.profiles) })),
    screenings_by_month: monthly.map((r) => ({ month: r.month, count: r.n })),
    privacy_note: `Agregat anonim tanpa data individu. Kelompok berisi kurang dari ${MIN_CELL} ditampilkan sebagai "<5".`,
  } });
});
