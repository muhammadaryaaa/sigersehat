import type { Context, Next } from "hono";
import { ApiError } from "../domain/errors";
// Error handling terpusat: envelope standar Tahap 2 Bab 2.1; tidak pernah membocorkan stack/SQL/PHI (SEC-07).
export async function errorMiddleware(c: Context, next: Next) {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  try { await next(); }
  catch (err) {
    if (err instanceof ApiError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as never);
    }
    console.error(JSON.stringify({ level: "error", request_id: requestId, message: err instanceof Error ? err.message : "unknown" }));
    return c.json({ error: { code: "internal_error", message: "Terjadi kesalahan pada server. Silakan coba lagi." } }, 500);
  }
}
