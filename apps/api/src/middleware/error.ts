import type { Context, Next } from "hono";
import { ApiError } from "../domain/errors";
// Error handling terpusat: envelope standar Tahap 2 Bab 2.1; tidak pernah membocorkan stack/SQL/PHI (SEC-07).
// Dipasang ganda: middleware try/catch + app.onError (Hono meneruskan galat handler ke onError, bukan ke rantai middleware).
export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as never);
  }
  console.error(JSON.stringify({ level: "error", message: err instanceof Error ? err.message : "unknown" }));
  return c.json({ error: { code: "internal_error", message: "Terjadi kesalahan pada server. Silakan coba lagi." } }, 500);
}
export async function errorMiddleware(c: Context, next: Next) {
  c.set("requestId", crypto.randomUUID());
  try { await next(); }
  catch (err) { return handleError(err as Error, c); }
}
