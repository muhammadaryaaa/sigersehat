import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
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
