import type { Context, Next } from "hono";
import { forbidden } from "../domain/errors";
// CSRF double-submit (Tahap 2 AD-05): cookie csrf_token harus sama dengan header X-CSRF-Token
// pada permintaan pengubah data yang membawa cookie sesi. Rute publik awal & ingest perangkat dikecualikan.
const EXEMPT = ["/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password"];
export async function csrfMiddleware(c: Context, next: Next) {
  const method = c.req.method;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && !EXEMPT.includes(c.req.path) && !c.req.path.startsWith("/api/v1/iot/")) {
    const cookie = c.req.header("Cookie") ?? "";
    if (cookie.includes("siger_session=")) {
      const csrfCookie = cookie.match(/csrf_token=([^;]+)/)?.[1];
      const csrfHeader = c.req.header("X-CSRF-Token");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) throw forbidden();
    }
  }
  await next();
}
