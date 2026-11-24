import { Hono, type Context } from "hono";
import { requireAuth } from "../../middleware/auth";
import { notFound } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { toSqlTime } from "../../lib/time";
import type { Env } from "../auth/service";

export const reminderRoutes = new Hono<{ Bindings: Env }>();
reminderRoutes.use("*", requireAuth);
const TYPES = ["medication", "measurement", "follow_up", "immunization", "anc", "custom"];

async function ownedReminder(db: D1Database, userId: string, id: string) {
  const r = await db.prepare("SELECT * FROM reminders WHERE id = ? AND user_id = ?").bind(id, userId).first<Record<string, unknown>>();
  if (!r) throw notFound();
  return r;
}

reminderRoutes.post("/", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const title = requireString(body, "title", "Judul pengingat", errors, { min: 3, max: 160 });
  const scheduledAt = requireString(body, "scheduledAt", "Waktu pengingat", errors);
  const profileId = String(body.profileId ?? "");
  const profile = await c.env.DB.prepare("SELECT id FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, actor.id).first();
  if (!profile) throw notFound();
  const type = TYPES.includes(String(body.reminderType)) ? String(body.reminderType) : "custom";
  if (scheduledAt && Number.isNaN(Date.parse(scheduledAt))) errors.push({ field: "scheduledAt", message: "Format waktu tidak valid.", code: "format" });
  if (errors.length) throw validationError(errors);
  const id = newId("rem");
  await c.env.DB.prepare("INSERT INTO reminders (id, profile_id, user_id, reminder_type, title, scheduled_at, related_type, related_id) VALUES (?,?,?,?,?,?,?,?)")
    .bind(id, profileId, actor.id, type, title, toSqlTime(scheduledAt), typeof body.relatedType === "string" ? body.relatedType : null, typeof body.relatedId === "string" ? body.relatedId : null).run();
  return c.json({ data: { reminder_id: id } }, 201);
});

reminderRoutes.get("/", async (c) => {
  const actor = c.get("actor");
  const status = c.req.query("status");
  const sql = status
    ? "SELECT * FROM reminders WHERE user_id = ? AND status = ? ORDER BY scheduled_at ASC LIMIT 100"
    : "SELECT * FROM reminders WHERE user_id = ? ORDER BY scheduled_at ASC LIMIT 100";
  const stmt = status ? c.env.DB.prepare(sql).bind(actor.id, status) : c.env.DB.prepare(sql).bind(actor.id);
  const { results } = await stmt.all();
  return c.json({ data: results });
});

reminderRoutes.put("/:id", async (c) => {
  const actor = c.get("actor");
  const r = await ownedReminder(c.env.DB, actor.id, c.req.param("id") ?? "");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : r.title;
  let scheduledAt = String(r.scheduled_at);
  if (typeof body.scheduledAt === "string") {
    if (Number.isNaN(Date.parse(body.scheduledAt))) throw validationError([{ field: "scheduledAt", message: "Format waktu tidak valid.", code: "format" }]);
    scheduledAt = toSqlTime(body.scheduledAt);
  }
  await c.env.DB.prepare("UPDATE reminders SET title = ?, scheduled_at = ?, status = 'scheduled', updated_at = datetime('now') WHERE id = ?").bind(title, scheduledAt, r.id).run();
  return c.json({ data: { updated: true } });
});

async function setStatus(c: Context<{ Bindings: Env }>, status: string) {
  const actor = c.get("actor");
  const r = await ownedReminder(c.env.DB, actor.id, c.req.param("id") ?? "");
  if (status === "snoozed") {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const until = typeof body.until === "string" && !Number.isNaN(Date.parse(body.until)) ? toSqlTime(body.until) : toSqlTime(Date.now() + 86400_000);
    await c.env.DB.prepare("UPDATE reminders SET status = 'snoozed', scheduled_at = ?, updated_at = datetime('now') WHERE id = ?").bind(until, r.id).run();
    return c.json({ data: { status: "snoozed", scheduled_at: until } });
  }
  await c.env.DB.prepare("UPDATE reminders SET status = ?, updated_at = datetime('now') WHERE id = ?").bind(status, r.id).run();
  return c.json({ data: { status } });
}
reminderRoutes.post("/:id/done", (c) => setStatus(c, "done"));
reminderRoutes.post("/:id/cancel", (c) => setStatus(c, "cancelled"));
reminderRoutes.post("/:id/snooze", (c) => setStatus(c, "snoozed"));

// Notifikasi dalam website (dibuat cron untuk pengingat jatuh tempo).
export const notificationRoutes = new Hono<{ Bindings: Env }>();
notificationRoutes.use("*", requireAuth);
notificationRoutes.get("/", async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(actor.id).all();
  return c.json({ data: results });
});
notificationRoutes.post("/:id/read", async (c) => {
  const actor = c.get("actor");
  const n = await c.env.DB.prepare("SELECT id FROM notifications WHERE id = ? AND user_id = ?").bind(c.req.param("id"), actor.id).first();
  if (!n) throw notFound();
  await c.env.DB.prepare("UPDATE notifications SET is_read = 1, read_at = datetime('now') WHERE id = ?").bind(n.id).run();
  return c.json({ data: { read: true } });
});

// Pembuatan notifikasi dari pengingat jatuh tempo — dipanggil handler scheduled Worker.
export async function generateDueNotifications(db: D1Database): Promise<number> {
  const due = (await db.prepare("SELECT * FROM reminders WHERE status IN ('scheduled','snoozed') AND scheduled_at <= datetime('now') LIMIT 200").all<Record<string, unknown>>()).results;
  let made = 0;
  for (const r of due) {
    await db.batch([
      db.prepare("INSERT INTO notifications (id, user_id, title, body, link_path, reminder_id) VALUES (?,?,?,?,?,?)")
        .bind(newId("ntf"), r.user_id, String(r.title), "Pengingat ini sudah jatuh tempo. Buka SIGERREMINDER untuk menandai selesai atau menunda.", "/pengingat", r.id),
      db.prepare("UPDATE reminders SET status = 'sent', updated_at = datetime('now') WHERE id = ?").bind(r.id),
    ]);
    made++;
  }
  return made;
}
