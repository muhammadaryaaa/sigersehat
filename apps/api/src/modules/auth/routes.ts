import { Hono } from "hono";
import { createSession, sessionCookies, clearCookies, registerUser, loginUser, type Env } from "./service";
import { verifyPassword } from "../../lib/crypto";
import { requireAuth } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { isEmail, isDate, passwordProblem, requireString, validationError, type FieldError } from "../../lib/validate";
import { hashPassword, newId, randomToken, sha256Hex } from "../../lib/crypto";
import { logAudit } from "../../lib/audit";
import { nowSql } from "../../lib/time";

export const authRoutes = new Hono<{ Bindings: Env }>();

function meta(c: { req: { header: (n: string) => string | undefined } }) {
  return { ip: c.req.header("CF-Connecting-IP") ?? null, userAgent: c.req.header("User-Agent") ?? null };
}

authRoutes.post("/register", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const email = requireString(body, "email", "Email", errors, { max: 190 }).toLowerCase();
  if (email && !isEmail(email)) errors.push({ field: "email", message: "Format email tidak valid.", code: "format" });
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) errors.push({ field: "password", message: "Kata sandi wajib diisi.", code: "required" });
  else { const p = passwordProblem(password); if (p) errors.push({ field: "password", message: p, code: "weak" }); }
  const fullName = requireString(body, "fullName", "Nama lengkap", errors, { min: 3, max: 120 });
  const birthDate = requireString(body, "birthDate", "Tanggal lahir", errors);
  if (birthDate && !isDate(birthDate)) errors.push({ field: "birthDate", message: "Tanggal lahir tidak valid.", code: "format" });
  const sex = body.sex === "female" ? "female" : body.sex === "male" ? "male" : "";
  if (!sex) errors.push({ field: "sex", message: "Jenis kelamin wajib dipilih.", code: "required" });
  if (body.healthConsent !== true) errors.push({ field: "healthConsent", message: "Persetujuan penyimpanan data kesehatan wajib diberikan untuk membuat akun.", code: "required" });
  const accountType = body.accountType === "nakes" ? "nakes" : "masyarakat";
  let profession = "", credentialType = "", credentialNumber = "";
  if (accountType === "nakes") {
    profession = requireString(body, "profession", "Profesi", errors);
    credentialType = requireString(body, "credentialType", "Jenis kredensial", errors);
    credentialNumber = requireString(body, "credentialNumber", "Nomor kredensial (STR/SIP)", errors, { min: 4 });
  }
  if (errors.length) throw validationError(errors);
  const regionId = typeof body.regionId === "string" ? body.regionId : null;
  if (regionId) {
    const region = await c.env.DB.prepare("SELECT id FROM regions WHERE id = ?").bind(regionId).first();
    if (!region) throw validationError([{ field: "regionId", message: "Wilayah tidak ditemukan.", code: "not_found" }]);
  }
  const result = await registerUser(c.env.DB, { email, password, fullName, birthDate, sex, regionId, accountType, profession, credentialType, credentialNumber, workplaceName: typeof body.workplaceName === "string" ? body.workplaceName : undefined });
  const session = await createSession(c.env.DB, result.userId, meta(c));
  for (const cookie of sessionCookies(c.env, session.token, session.csrf)) c.header("Set-Cookie", cookie, { append: true });
  return c.json({ data: { user_id: result.userId, role: result.role, profile_id: result.profileId, csrf_token: session.csrf } }, 201);
});

authRoutes.post("/login", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) throw validationError([{ field: "email", message: "Email dan kata sandi wajib diisi.", code: "required" }]);
  const user = await loginUser(c.env.DB, email, password, meta(c));
  const session = await createSession(c.env.DB, user.id, meta(c));
  for (const cookie of sessionCookies(c.env, session.token, session.csrf)) c.header("Set-Cookie", cookie, { append: true });
  return c.json({ data: { user_id: user.id, role: user.role, csrf_token: session.csrf } });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const actor = c.get("actor") as { id: string; role: string };
  const cookie = c.req.header("Cookie") ?? "";
  const token = cookie.match(/siger_session=([^;]+)/)?.[1];
  if (token) {
    const tokenHash = await sha256Hex(token);
    await c.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE token_hash = ?").bind(tokenHash).run();
  }
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "auth.logout", objectType: "user", objectId: actor.id });
  for (const cookieStr of clearCookies(c.env)) c.header("Set-Cookie", cookieStr, { append: true });
  return c.json({ data: { logged_out: true } });
});

authRoutes.get("/me", requireAuth, async (c) => {
  const actor = c.get("actor") as { id: string; role: string };
  const user = await c.env.DB.prepare("SELECT id, email, phone, role, status, created_at FROM users WHERE id = ?").bind(actor.id).first();
  const profile = await c.env.DB.prepare("SELECT id, full_name, birth_date, sex, region_id, relation FROM health_profiles WHERE linked_user_id = ? AND relation = 'self'").bind(actor.id).first();
  const hw = actor.role === "nakes"
    ? await c.env.DB.prepare("SELECT profession, verification_status FROM health_worker_profiles WHERE user_id = ?").bind(actor.id).first()
    : null;
  // Token CSRF digaungkan dari cookie permintaan: halaman web berjalan di domain
  // berbeda dari API sehingga tidak dapat membaca cookie API lewat document.cookie;
  // token disimpan frontend di memori saja (bukan localStorage).
  const csrfToken = (c.req.header("Cookie") ?? "").match(/csrf_token=([^;]+)/)?.[1] ?? null;
  return c.json({ data: { user, profile, health_worker: hw, csrf_token: csrfToken } });
});

authRoutes.get("/sessions", requireAuth, async (c) => {
  const actor = c.get("actor") as { id: string };
  const cookie = c.req.header("Cookie") ?? "";
  const currentHash = await sha256Hex(cookie.match(/siger_session=([^;]+)/)?.[1] ?? "");
  const { results } = await c.env.DB.prepare(
    "SELECT id, device_label, ip_address, created_at, last_seen_at, expires_at, revoked_at, token_hash FROM sessions WHERE user_id = ? ORDER BY created_at DESC"
  ).bind(actor.id).all<Record<string, unknown>>();
  return c.json({ data: results.map((r) => ({ ...r, token_hash: undefined, is_current: r.token_hash === currentHash, is_active: !r.revoked_at && String(r.expires_at) > nowSql() })) });
});

authRoutes.delete("/sessions/:id", requireAuth, async (c) => {
  const actor = c.get("actor") as { id: string; role: string };
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT id FROM sessions WHERE id = ? AND user_id = ?").bind(id, actor.id).first();
  if (!row) throw notFound();
  await c.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE id = ?").bind(id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "auth.session_revoke", objectType: "session", objectId: id });
  return c.json({ data: { revoked: true } });
});

// Reset kata sandi: token sekali pakai berlaku 1 jam, tersimpan ter-hash.
// Pengiriman token memakai kanal email — BELUM ada penyedia email terhubung; pada APP_ENV=local
// token dikembalikan di respons agar alur dapat diuji penuh secara lokal (tidak pernah di production).
authRoutes.get("/export", requireAuth, async (c) => {
  const actor = c.get("actor"); const db = c.env.DB;
  const profiles = (await db.prepare("SELECT * FROM health_profiles WHERE owner_user_id = ?").bind(actor.id).all()).results;
  const pids = profiles.map((p) => String(p.id));
  const grab = async (sql: string, ...binds: unknown[]) => (await db.prepare(sql).bind(...binds).all()).results;
  const data: Record<string, unknown> = { exported_at: new Date().toISOString(), account: await db.prepare("SELECT id, email, role, status, created_at, health_data_consent_at FROM users WHERE id = ?").bind(actor.id).first(), profiles };
  if (pids.length) {
    const inList = pids.map(() => "?").join(",");
    data.measurements = await grab(`SELECT * FROM measurements WHERE profile_id IN (${inList}) ORDER BY measured_at`, ...pids);
    data.screenings = await grab(`SELECT * FROM screening_sessions WHERE profile_id IN (${inList}) ORDER BY started_at`, ...pids);
    data.reminders = await grab(`SELECT * FROM reminders WHERE profile_id IN (${inList})`, ...pids);
    data.cycles = await grab(`SELECT * FROM cycle_records WHERE profile_id IN (${inList})`, ...pids).catch(() => []);
    data.pregnancies = await grab(`SELECT * FROM pregnancies WHERE profile_id IN (${inList})`, ...pids).catch(() => []);
    data.immunizations = await grab(`SELECT * FROM immunization_records WHERE profile_id IN (${inList})`, ...pids).catch(() => []);
  }
  data.notifications = await grab("SELECT * FROM notifications WHERE user_id = ?", actor.id);
  data.consents = await grab("SELECT * FROM consents WHERE granted_by_user_id = ?", actor.id).catch(() => []);
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "auth.export_data", objectType: "user", objectId: actor.id });
  return c.json({ data });
});

authRoutes.delete("/account", requireAuth, async (c) => {
  const actor = c.get("actor"); const db = c.env.DB;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const user = await db.prepare("SELECT password_hash FROM users WHERE id = ?").bind(actor.id).first<{ password_hash: string }>();
  if (!user || typeof body.password !== "string" || !(await verifyPassword(body.password, user.password_hash))) {
    throw new ApiError(403, "forbidden", "Kata sandi salah. Penghapusan akun dibatalkan.");
  }
  const profiles = (await db.prepare("SELECT id FROM health_profiles WHERE owner_user_id = ?").bind(actor.id).all()).results.map((p) => String(p.id));
  const stmts: D1PreparedStatement[] = [];
  for (const pid of profiles) {
    stmts.push(db.prepare("DELETE FROM anc_visits WHERE pregnancy_id IN (SELECT id FROM pregnancies WHERE profile_id = ?)").bind(pid));
    stmts.push(db.prepare("DELETE FROM screening_answers WHERE session_id IN (SELECT id FROM screening_sessions WHERE profile_id = ?)").bind(pid));
    stmts.push(db.prepare("DELETE FROM measurement_revisions WHERE measurement_id IN (SELECT id FROM measurements WHERE profile_id = ?)").bind(pid));
    stmts.push(db.prepare("DELETE FROM iot_readings_raw WHERE measurement_id IN (SELECT id FROM measurements WHERE profile_id = ?)").bind(pid));
    stmts.push(db.prepare("DELETE FROM consents WHERE profile_id = ?").bind(pid));
    for (const t of ["measurements", "screening_sessions", "reminders", "cycle_records", "pregnancies", "immunization_records", "medication_schedules", "health_targets", "nutrition_logs", "nutrition_targets"]) {
      stmts.push(db.prepare(`DELETE FROM ${t} WHERE profile_id = ?`).bind(pid));
    }
    stmts.push(db.prepare("DELETE FROM profile_preferences WHERE profile_id = ?").bind(pid));
  }
  stmts.push(db.prepare("DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE user_id = ?)").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM ai_answer_reports WHERE reported_by_user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM ai_conversations WHERE user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM iot_readings_raw WHERE device_id IN (SELECT id FROM iot_devices WHERE owner_user_id = ?)").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM iot_devices WHERE owner_user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM notifications WHERE user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM facility_correction_reports WHERE reported_by_user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM health_profiles WHERE owner_user_id = ?").bind(actor.id));
  stmts.push(db.prepare("DELETE FROM health_worker_profiles WHERE user_id = ?").bind(actor.id));
  // Baris users tidak dapat dihapus fisik karena log audit menunjuknya (FK) — akun disamarkan:
  // email diganti, hash kata sandi diacak, status dinonaktifkan. Data kesehatan sudah terhapus di atas.
  stmts.push(db.prepare("UPDATE users SET email = ?, password_hash = ?, status = 'suspended' WHERE id = ?")
    .bind(`terhapus-${actor.id}@invalid`, `deleted:${crypto.randomUUID()}`, actor.id));
  await db.batch(stmts);
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "auth.delete_account", objectType: "user", objectId: actor.id });
  for (const cookie of clearCookies(c.env)) c.header("Set-Cookie", cookie, { append: true });
  return c.json({ data: { deleted: true } });
});

authRoutes.post("/forgot-password", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const user = email ? await c.env.DB.prepare("SELECT id, role FROM users WHERE email = ? AND status = 'active'").bind(email).first<{ id: string; role: string }>() : null;
  let devToken: string | undefined;
  if (user) {
    const token = randomToken(24);
    const tokenHash = await sha256Hex(token);
    await c.env.DB.prepare("INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?,?,?,datetime('now','+1 hour'))")
      .bind(newId("prt"), user.id, tokenHash).run();
    await logAudit(c.env.DB, { actorUserId: user.id, actorRole: user.role, action: "auth.password_reset_request", objectType: "user", objectId: user.id });
    if (c.env.APP_ENV === "local") devToken = token;
  }
  return c.json({ data: { message: "Bila email terdaftar, tautan atur ulang telah dibuat.", ...(devToken ? { dev_reset_token: devToken } : {}) } });
});

authRoutes.post("/reset-password", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";
  const problem = passwordProblem(password);
  if (problem) throw validationError([{ field: "password", message: problem, code: "weak" }]);
  const tokenHash = await sha256Hex(token);
  const row = await c.env.DB.prepare("SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > datetime('now')").bind(tokenHash).first<{ id: string; user_id: string }>();
  if (!row) throw new ApiError(400, "bad_request", "Tautan atur ulang tidak valid atau sudah kedaluwarsa.");
  const passwordHash = await hashPassword(password);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(passwordHash, row.user_id),
    c.env.DB.prepare("UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?").bind(row.id),
    c.env.DB.prepare("UPDATE sessions SET revoked_at = datetime('now') WHERE user_id = ? AND revoked_at IS NULL").bind(row.user_id),
  ]);
  const user = await c.env.DB.prepare("SELECT role FROM users WHERE id = ?").bind(row.user_id).first<{ role: string }>();
  await logAudit(c.env.DB, { actorUserId: row.user_id, actorRole: user?.role ?? "masyarakat", action: "auth.password_reset", objectType: "user", objectId: row.user_id });
  return c.json({ data: { reset: true } });
});
