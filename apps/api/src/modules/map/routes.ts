import { Hono } from "hono";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import type { Env } from "../auth/service";

// SIGERMAP — publik untuk fasilitas TERVERIFIKASI saja (FR-MAP-01). Koordinat/alamat selalu dari basis data
// yang bersumber; tautan rute memakai OpenStreetMap. Laporan koreksi dari pengguna masuk antrean admin.
export const mapPublicRoutes = new Hono<{ Bindings: Env }>();
mapPublicRoutes.use("*", optionalAuth);

mapPublicRoutes.get("/", async (c) => {
  const q = c.req.query("q") ?? "";
  const type = c.req.query("type") ?? "";
  const region = c.req.query("regionId") ?? "";
  const limit = Math.min(2000, Math.max(1, Number(c.req.query("limit") ?? 1000) || 1000));
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  const total = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n FROM facilities f
     WHERE f.verification_status = 'verified' AND f.name LIKE ? AND (? = '' OR f.facility_type = ?) AND (? = '' OR f.region_id = ?)`
  ).bind(`%${q}%`, type, type, region, region).first<{ n: number }>();
  const { results } = await c.env.DB.prepare(
    `SELECT f.*, r.name AS region_name FROM facilities f JOIN regions r ON r.id = f.region_id
     WHERE f.verification_status = 'verified' AND f.name LIKE ? AND (? = '' OR f.facility_type = ?) AND (? = '' OR f.region_id = ?)
     ORDER BY f.name LIMIT ? OFFSET ?`).bind(`%${q}%`, type, type, region, region, limit, offset).all();
  return c.json({ data: results, meta: { total: total?.n ?? results.length, limit, offset } });
});

mapPublicRoutes.get("/stats", async (c) => {
  const byRegion = (await c.env.DB.prepare(
    `SELECT r.id AS region_id, r.name AS region_name, COUNT(*) AS n FROM facilities f JOIN regions r ON r.id = f.region_id
     WHERE f.verification_status = 'verified' GROUP BY r.id ORDER BY n DESC`).all()).results;
  const byType = (await c.env.DB.prepare(
    `SELECT facility_type, COUNT(*) AS n FROM facilities WHERE verification_status = 'verified' GROUP BY facility_type`).all()).results;
  const total = byRegion.reduce((a, r) => a + Number(r.n), 0);
  const updated = await c.env.DB.prepare("SELECT MAX(verified_at) AS d FROM facilities WHERE verification_status = 'verified'").first<{ d: string }>();
  return c.json({ data: { total, by_region: byRegion, by_type: byType, data_updated: updated?.d ?? null } });
});

mapPublicRoutes.get("/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT f.*, r.name AS region_name FROM facilities f JOIN regions r ON r.id = f.region_id WHERE f.id = ? AND f.verification_status = 'verified'").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!row) return c.json({ error: { code: "not_found", message: "Fasilitas tidak ditemukan." } }, 404);
  return c.json({ data: { ...row, directions_url: `https://www.google.com/maps/dir/?api=1&destination=${row.latitude}%2C${row.longitude}` } });
});

mapPublicRoutes.post("/:id/report-guest", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 5) throw validationError([{ field: "description", message: "Jelaskan koreksinya (minimal 5 karakter).", code: "required" }]);
  const email = typeof body.email === "string" && body.email.includes("@") ? body.email.slice(0, 190) : null;
  const fac = await c.env.DB.prepare("SELECT id FROM facilities WHERE id = ?").bind(c.req.param("id")).first();
  if (!fac) return c.json({ error: { code: "not_found", message: "Fasilitas tidak ditemukan." } }, 404);
  await c.env.DB.prepare("INSERT INTO facility_correction_reports (id, facility_id, reported_by_user_id, field_name, reported_value, note, reporter_email) VALUES (?,?,NULL,'lainnya','laporan tamu',?,?)")
    .bind(newId("fcr"), c.req.param("id"), description, email).run();
  return c.json({ data: { received: true } }, 201);
});

mapPublicRoutes.post("/:id/report", requireAuth, async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const desc = requireString(body, "description", "Uraian koreksi", errors, { min: 10, max: 1000 });
  if (errors.length) throw validationError(errors);
  const id = newId("cor");
  await c.env.DB.prepare("INSERT INTO facility_correction_reports (id, facility_id, reported_by_user_id, field_name, reported_value, note) VALUES (?,?,?,'lainnya','',?)")
    .bind(id, c.req.param("id"), actor.id, desc).run();
  return c.json({ data: { report_id: id } }, 201);
});
