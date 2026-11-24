import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorMiddleware, handleError } from "./middleware/error";
import { csrfMiddleware } from "./middleware/csrf";
import { authRoutes } from "./modules/auth/routes";
import { profilesRoutes, dashboardRoutes } from "./modules/profiles/routes";
import { checkRoutes } from "./modules/check/routes";
import { monitorRoutes } from "./modules/monitor/routes";
import { aiRoutes } from "./modules/ai/routes";
import { eduPublicRoutes, eduUserRoutes, eduAdminRoutes } from "./modules/edu/routes";
import { womenRoutes } from "./modules/women/routes";
import { growRoutes } from "./modules/grow/routes";
import { elderRoutes } from "./modules/elder/routes";
import { nutriRoutes } from "./modules/nutri/routes";
import { reminderRoutes, notificationRoutes, generateDueNotifications } from "./modules/reminder/routes";
import { mapPublicRoutes } from "./modules/map/routes";
import { medRoutes, consentRoutes } from "./modules/med/routes";
import { insightRoutes } from "./modules/insight/routes";
import { adminRoutes } from "./modules/admin/routes";
import { iotRoutes } from "./modules/iot/routes";

type Bindings = { DB: D1Database; FILES: R2Bucket; APP_ORIGIN: string; APP_ENV: string };
const app = new Hono<{ Bindings: Bindings }>();

app.use("*", errorMiddleware);
app.use("/api/*", csrfMiddleware);
app.use("/api/*", cors({ origin: (origin, c) => (origin === c.env.APP_ORIGIN ? origin : null), credentials: true }));

// Halaman akar API: informasi layanan agar alamat dasar tidak tampil sebagai galat.
app.get("/", (c) => c.json({ data: { service: "SIGERSEHAT API", status: "online", website: "https://sigersehat.pages.dev", health: "/health", api_base: "/api/v1", documentation: "https://github.com/muhammadaryaaa/sigersehat/blob/main/docs/API.md" } }));
app.get("/api/v1", (c) => c.json({ data: { service: "SIGERSEHAT API", version: "v1", modules: ["auth", "profiles", "dashboard", "screening", "measurements", "reminders", "notifications", "edu", "ai", "women", "grow", "elder", "nutri", "facilities", "med", "consents", "insights", "admin", "iot", "regions"] } }));

// REC-03: health check publik — hanya status, tanpa data.
app.get("/health", async (c) => {
  try { await c.env.DB.prepare("SELECT 1").first(); return c.json({ data: { status: "ok", db: "ok", env: c.env.APP_ENV } }); }
  catch { return c.json({ error: { code: "service_unavailable", message: "Database tidak tersedia." } }, 503); }
});

app.get("/api/v1/regions", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, code, name, type FROM regions WHERE is_active = 1 ORDER BY code").all();
  return c.json({ data: results });
});

const api = new Hono<{ Bindings: Bindings }>();
api.route("/auth", authRoutes); api.route("/profiles", profilesRoutes);
api.route("/screening", checkRoutes); api.route("/measurements", monitorRoutes);
api.route("/ai", aiRoutes); api.route("/edu", eduPublicRoutes); api.route("/edu", eduUserRoutes); api.route("/edu/admin", eduAdminRoutes);
api.route("/women", womenRoutes); api.route("/grow", growRoutes);
api.route("/elder", elderRoutes); api.route("/nutri", nutriRoutes);
api.route("/reminders", reminderRoutes); api.route("/notifications", notificationRoutes); api.route("/facilities", mapPublicRoutes);
api.route("/med", medRoutes); api.route("/", consentRoutes); api.route("/insights", insightRoutes);
api.route("/admin", adminRoutes); api.route("/dashboard", dashboardRoutes); api.route("/iot", iotRoutes);
app.route("/api/v1", api);

app.onError(handleError);
api.onError(handleError);
app.notFound((c) => c.json({ error: { code: "not_found", message: "Rute tidak ditemukan." } }, 404));

export default {
  fetch: app.fetch,
  // Cron: notifikasi pengingat & snapshot INSIGHT (diimplementasikan pada tahap modulnya).
  async scheduled(_event: ScheduledEvent, env: Bindings, _ctx: ExecutionContext) {
    await generateDueNotifications(env.DB);
  },
};
