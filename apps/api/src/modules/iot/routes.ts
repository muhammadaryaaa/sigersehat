import { Hono, type Context, type Next } from "hono";
import { requireAuth } from "../../middleware/auth";
import { ApiError, forbidden, notFound, unauthorized } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId, randomToken, sha256Hex } from "../../lib/crypto";
import { nowSql } from "../../lib/time";
import type { Env } from "../auth/service";

// SIGERIOT — arsitektur: Sensor → ESP32 → Internet → API ini → D1 → Website (MONITOR).
// Autentikasi perangkat: token acak per perangkat, hanya hash SHA-256 yang disimpan; token mentah
// ditampilkan SATU KALI saat registrasi. Ingest tervalidasi rentang fisiologis + idempoten.
// Data dari perangkat berjenis 'simulator' selalu berlabel SIMULASI pada pengukuran yang dihasilkan.
export const iotRoutes = new Hono<{ Bindings: Env }>();

const ONLINE_WINDOW_MIN = 15;
export function deviceStatus(lastSeenAt: string | null, status: string): "online" | "offline" | "revoked" {
  if (status === "revoked") return "revoked";
  if (!lastSeenAt) return "offline";
  const diffMin = (Date.now() - new Date(lastSeenAt.replace(" ", "T")).getTime()) / 60000;
  return diffMin <= ONLINE_WINDOW_MIN ? "online" : "offline";
}

async function deviceAuth(c: Context<{ Bindings: Env }>) {
  const token = c.req.header("X-Device-Token");
  if (!token) throw unauthorized();
  const hash = await sha256Hex(token);
  const device = await c.env.DB.prepare("SELECT * FROM iot_devices WHERE token_hash = ? AND status = 'active'").bind(hash).first<Record<string, unknown>>();
  if (!device) throw unauthorized();
  return device;
}

// ---- Jalur perangkat (tanpa cookie; token perangkat) ----
iotRoutes.post("/readings", async (c) => {
  const device = await deviceAuth(c);
  const db = c.env.DB;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const idem = typeof body.idempotencyKey === "string" ? body.idempotencyKey : null;
  if (idem) {
    const dup = await db.prepare("SELECT measurement_id FROM iot_readings_raw WHERE idempotency_key = ?").bind(idem).first<{ measurement_id: string }>();
    if (dup) return c.json({ data: { measurement_id: dup.measurement_id, duplicated: true } });
  }
  const num = (k: string) => (typeof body[k] === "number" ? (body[k] as number) : null);
  const spo2 = num("spo2Percent"), hr = num("heartRateBpm"), temp = num("temperatureC");
  const errors: FieldError[] = [];
  if (spo2 === null && hr === null && temp === null) errors.push({ field: "reading", message: "Minimal satu nilai sensor (spo2Percent, heartRateBpm, atau temperatureC) wajib ada.", code: "required" });
  if (spo2 !== null && (spo2 < 50 || spo2 > 100)) errors.push({ field: "spo2Percent", message: "SpO2 di luar rentang fisiologis 50-100%.", code: "range" });
  if (hr !== null && (hr < 20 || hr > 250)) errors.push({ field: "heartRateBpm", message: "Denyut jantung di luar rentang 20-250 bpm.", code: "range" });
  if (temp !== null && (temp < 30 || temp > 45)) errors.push({ field: "temperatureC", message: "Suhu di luar rentang 30-45 °C.", code: "range" });
  if (errors.length) throw validationError(errors);
  // Profil tujuan: profil milik pemilik perangkat (bawaan: profil diri pemilik).
  let profileId = typeof body.profileId === "string" ? body.profileId : null;
  if (profileId) {
    const owned = await db.prepare("SELECT id FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, device.owner_user_id).first();
    if (!owned) throw new ApiError(403, "forbidden", "Profil tujuan bukan milik pemilik perangkat.");
  } else {
    const self = await db.prepare("SELECT id FROM health_profiles WHERE linked_user_id = ? AND relation = 'self'").bind(device.owner_user_id).first<{ id: string }>();
    if (!self) throw new ApiError(422, "validation_error", "Pemilik perangkat tidak memiliki profil diri.");
    profileId = self.id;
  }
  const measuredAt = typeof body.measuredAt === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(body.measuredAt) ? body.measuredAt : nowSql();
  const delayed = (new Date(nowSql().replace(" ", "T")).getTime() - new Date(measuredAt.replace(" ", "T")).getTime()) > 10 * 60000;
  const isSim = device.device_type === "simulator";
  const measurementId = newId("msr");
  const rawId = newId("raw");
  const source = isSim ? "iot_simulator" : "iot_device";
  await db.batch([
    db.prepare(`INSERT INTO measurements (id, profile_id, measured_at, temperature_c, spo2_percent, heart_rate_bpm, source, recorded_by_user_id, recorded_by_role, note)
      VALUES (?,?,?,?,?,?,?,?, 'device', ?)`)
      .bind(measurementId, profileId, measuredAt, temp, spo2, hr, source, device.owner_user_id,
        `${isSim ? "SIMULASI — " : ""}Perangkat ${device.device_label}${delayed ? " (data tertunda/offline store-and-forward)" : ""}`),
    db.prepare("INSERT INTO iot_readings_raw (id, device_id, payload_json, measurement_id, idempotency_key, processed) VALUES (?,?,?,?,?,1)")
      .bind(rawId, device.id, JSON.stringify(body), measurementId, idem),
    db.prepare("UPDATE iot_devices SET last_seen_at = datetime('now') WHERE id = ?").bind(device.id),
  ]);
  return c.json({ data: { measurement_id: measurementId, simulation: isSim, delayed } }, 201);
});

iotRoutes.post("/heartbeat", async (c) => {
  const device = await deviceAuth(c);
  await c.env.DB.prepare("UPDATE iot_devices SET last_seen_at = datetime('now') WHERE id = ?").bind(device.id).run();
  return c.json({ data: { ok: true, server_time: nowSql() } });
});

// ---- Jalur pengguna (cookie; CSRF ditegakkan manual karena prefix /iot/ dikecualikan middleware umum) ----
async function csrfForCookie(c: Context, next: Next) {
  const cookie = c.req.header("Cookie") ?? "";
  if (cookie.includes("siger_session=") && ["POST", "PUT", "DELETE"].includes(c.req.method)) {
    const csrfCookie = cookie.match(/csrf_token=([^;]+)/)?.[1];
    if (!csrfCookie || csrfCookie !== c.req.header("X-CSRF-Token")) throw forbidden();
  }
  await next();
}
iotRoutes.use("/devices", csrfForCookie, requireAuth);
iotRoutes.use("/devices/*", csrfForCookie, requireAuth);

iotRoutes.post("/devices", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const label = requireString(body, "deviceLabel", "Label perangkat", errors, { min: 2, max: 80 });
  const type = ["max30102", "temperature", "simulator", "other"].includes(String(body.deviceType)) ? String(body.deviceType) : null;
  if (!type) errors.push({ field: "deviceType", message: "Jenis perangkat tidak valid.", code: "format" });
  if (errors.length) throw validationError(errors);
  const rawToken = `sgd_${randomToken(24)}`;
  const id = newId("dev");
  await c.env.DB.prepare("INSERT INTO iot_devices (id, owner_user_id, device_label, device_type, token_hash) VALUES (?,?,?,?,?)")
    .bind(id, actor.id, label, type, await sha256Hex(rawToken)).run();
  return c.json({ data: { device_id: id, device_token: rawToken, warning: "Token ini hanya ditampilkan satu kali. Simpan di perangkat (firmware ESP32), jangan bagikan." } }, 201);
});

iotRoutes.get("/devices", async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare("SELECT id, device_label, device_type, status, last_seen_at, created_at FROM iot_devices WHERE owner_user_id = ? ORDER BY created_at DESC").bind(actor.id).all<Record<string, unknown>>();
  const out = [];
  for (const d of results) {
    const last = await c.env.DB.prepare("SELECT m.measured_at, m.spo2_percent, m.heart_rate_bpm, m.temperature_c FROM measurements m JOIN iot_readings_raw r ON r.measurement_id = m.id WHERE r.device_id = ? ORDER BY m.measured_at DESC LIMIT 1").bind(d.id).first();
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM iot_readings_raw WHERE device_id = ?").bind(d.id).first<{ n: number }>();
    out.push({ ...d, computed_status: deviceStatus(d.last_seen_at as string | null, String(d.status)), readings_count: count?.n ?? 0, last_reading: last });
  }
  return c.json({ data: out });
});

iotRoutes.post("/devices/:id/revoke", async (c) => {
  const actor = c.get("actor");
  const device = await c.env.DB.prepare("SELECT id FROM iot_devices WHERE id = ? AND owner_user_id = ?").bind(c.req.param("id"), actor.id).first();
  if (!device) throw notFound();
  await c.env.DB.prepare("UPDATE iot_devices SET status = 'revoked', revoked_at = datetime('now') WHERE id = ?").bind(device.id).run();
  return c.json({ data: { revoked: true } });
});

iotRoutes.get("/devices/:id/readings", async (c) => {
  const actor = c.get("actor");
  const device = await c.env.DB.prepare("SELECT id, device_type FROM iot_devices WHERE id = ? AND owner_user_id = ?").bind(c.req.param("id"), actor.id).first<Record<string, unknown>>();
  if (!device) throw notFound();
  const { results } = await c.env.DB.prepare("SELECT id, payload_json, received_at, processed, measurement_id FROM iot_readings_raw WHERE device_id = ? ORDER BY received_at DESC LIMIT 100").bind(device.id).all();
  return c.json({ data: { device_type: device.device_type, simulation: device.device_type === "simulator", readings: results } });
});
