import type { Context, Next } from "hono";
import { unauthorized, forbidden } from "../domain/errors";
declare module "hono" {
  interface ContextVariableMap {
    actor: { id: string; role: import("@sigersehat/contracts").Role };
  }
}
import type { Role } from "@sigersehat/contracts";
// Kerangka autentikasi sesi opak (Tahap 2 AD-04): token cookie di-hash, dicocokkan ke tabel sessions.
// Implementasi penuh sesi adalah pekerjaan Tahap Autentikasi; middleware ini menegakkan bentuk kontraknya sejak awal.
export async function requireAuth(c: Context, next: Next) {
  const cookie = c.req.header("Cookie") ?? "";
  const match = cookie.match(/siger_session=([^;]+)/);
  if (!match) throw unauthorized();
  const tokenHash = await sha256(match[1]);
  const row = await c.env.DB.prepare(
    "SELECT u.id, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > datetime('now') AND u.status = 'active'"
  ).bind(tokenHash).first() as { id: string; role: Role } | null;
  if (!row) throw unauthorized();
  c.set("actor", row);
  await next();
}
export function requireRole(...roles: Role[]) {
  return async (c: Context, next: Next) => {
    const actor = c.get("actor") as { role: Role } | undefined;
    if (!actor || !roles.includes(actor.role)) throw forbidden();
    await next();
  };
}
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
