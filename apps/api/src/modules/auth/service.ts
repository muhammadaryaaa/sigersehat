import { hashPassword, verifyPassword, newId, randomToken, sha256Hex } from "../../lib/crypto";
import { toSqlTime, nowSql } from "../../lib/time";
import { logAudit } from "../../lib/audit";
import { ApiError } from "../../domain/errors";
import type { Role } from "@sigersehat/contracts";

export type Env = { DB: D1Database; APP_ENV: string };
const SESSION_DAYS = 7;

export async function createSession(db: D1Database, userId: string, meta: { ip?: string | null; userAgent?: string | null; deviceLabel?: string | null }) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const id = newId("ses");
  const expires = toSqlTime(Date.now() + SESSION_DAYS * 86400_000);
  await db.prepare("INSERT INTO sessions (id, user_id, token_hash, device_label, ip_address, user_agent, expires_at) VALUES (?,?,?,?,?,?,?)")
    .bind(id, userId, tokenHash, meta.deviceLabel ?? null, meta.ip ?? null, meta.userAgent ?? null, expires).run();
  const csrf = randomToken(16);
  return { token, csrf, sessionId: id, expiresAt: expires };
}

export function sessionCookies(env: Env, token: string, csrf: string): string[] {
  const secure = env.APP_ENV === "local" ? "" : "; Secure";
  const sameSite = env.APP_ENV === "local" ? "Lax" : "None";
  const maxAge = SESSION_DAYS * 86400;
  return [
    `siger_session=${token}; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`,
    `csrf_token=${csrf}; Path=/; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`,
  ];
}
export function clearCookies(env: Env): string[] {
  const secure = env.APP_ENV === "local" ? "" : "; Secure";
  const sameSite = env.APP_ENV === "local" ? "Lax" : "None";
  return [
    `siger_session=; HttpOnly; Path=/; SameSite=${sameSite}; Max-Age=0${secure}`,
    `csrf_token=; Path=/; SameSite=${sameSite}; Max-Age=0${secure}`,
  ];
}

export async function registerUser(db: D1Database, input: {
  email: string; password: string; fullName: string; birthDate: string; sex: string; regionId?: string | null;
  accountType: "masyarakat" | "nakes"; profession?: string; credentialType?: string; credentialNumber?: string; workplaceName?: string;
}) {
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(input.email).first();
  if (existing) throw new ApiError(409, "conflict", "Email sudah terdaftar. Silakan masuk atau gunakan email lain.");
  const userId = newId("usr");
  const passwordHash = await hashPassword(input.password);
  const role: Role = input.accountType === "nakes" ? "nakes" : "masyarakat";
  const profileId = newId("prf");
  const statements = [
    db.prepare("INSERT INTO users (id, email, password_hash, role, email_verified_at) VALUES (?,?,?,?,?)")
      .bind(userId, input.email, passwordHash, role, nowSql()),
    db.prepare("INSERT INTO health_profiles (id, owner_user_id, linked_user_id, relation, full_name, birth_date, sex, region_id) VALUES (?,?,?,?,?,?,?,?)")
      .bind(profileId, userId, userId, "self", input.fullName, input.birthDate, input.sex, input.regionId ?? null),
    db.prepare("INSERT INTO profile_preferences (profile_id) VALUES (?)").bind(profileId),
  ];
  if (input.accountType === "nakes") {
    statements.push(db.prepare("INSERT INTO health_worker_profiles (user_id, profession, credential_type, credential_number, workplace_name) VALUES (?,?,?,?,?)")
      .bind(userId, input.profession, input.credentialType, input.credentialNumber, input.workplaceName ?? null));
  }
  await db.batch(statements);
  await logAudit(db, { actorUserId: userId, actorRole: role, action: "auth.register", objectType: "user", objectId: userId });
  return { userId, profileId, role };
}

export async function loginUser(db: D1Database, email: string, password: string, meta: { ip?: string | null; userAgent?: string | null }) {
  // Rate limit: maks 10 kegagalan per email dalam 15 menit (REC-05).
  const fails = await db.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE email = ? AND success = 0 AND created_at > datetime('now','-15 minutes')").bind(email).first<{ n: number }>();
  if ((fails?.n ?? 0) >= 10) throw new ApiError(429, "rate_limited", "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit.");
  const user = await db.prepare("SELECT id, password_hash, role, status FROM users WHERE email = ?").bind(email)
    .first<{ id: string; password_hash: string; role: Role; status: string }>();
  const ok = user && user.status === "active" ? await verifyPassword(password, user.password_hash) : false;
  await db.prepare("INSERT INTO login_attempts (id, email, ip_address, success) VALUES (?,?,?,?)").bind(newId("lat"), email, meta.ip ?? null, ok ? 1 : 0).run();
  if (!user || !ok) {
    if (user) await logAudit(db, { actorUserId: user.id, actorRole: user.role, action: "auth.login_failed", objectType: "user", objectId: user.id, ip: meta.ip, userAgent: meta.userAgent });
    throw new ApiError(401, "unauthorized", "Email atau kata sandi salah.");
  }
  await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
  await logAudit(db, { actorUserId: user.id, actorRole: user.role, action: "auth.login", objectType: "user", objectId: user.id, ip: meta.ip, userAgent: meta.userAgent });
  return user;
}
