import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import type { Env } from "../auth/service";

export const medRoutes = new Hono<{ Bindings: Env }>();
// Dashboard nakes (Tahap 3 Bab 9): status verifikasi + daftar kerja dari data nyata.
medRoutes.get("/overview", requireAuth, requireRole("nakes"), async (c) => {
  const actor = c.get("actor") as { id: string };
  const hw = await c.env.DB.prepare("SELECT profession, credential_type, verification_status, rejection_reason FROM health_worker_profiles WHERE user_id = ?").bind(actor.id).first();
  const patients = await c.env.DB.prepare("SELECT COUNT(DISTINCT profile_id) AS n FROM consents WHERE grantee_user_id = ? AND status = 'active'").bind(actor.id).first<{ n: number }>();
  const due = (await c.env.DB.prepare(
    `SELECT f.id, f.task_type, f.due_date, p.full_name FROM follow_up_tasks f JOIN health_profiles p ON p.id = f.profile_id
     WHERE f.status = 'open' AND f.due_date <= date('now') AND EXISTS (SELECT 1 FROM consents cs WHERE cs.profile_id = f.profile_id AND cs.grantee_user_id = ? AND cs.status = 'active')
     ORDER BY f.due_date ASC LIMIT 20`).bind(actor.id).all()).results;
  return c.json({ data: { health_worker: hw, active_patients: patients?.n ?? 0, follow_ups_due: due } });
});
