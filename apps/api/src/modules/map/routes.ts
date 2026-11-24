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
  const { results } = await c.env.DB.prepare(
    `SELECT f.*, r.name AS region_name FROM facilities f JOIN regions r ON r.id = f.region_id
     WHERE f.verification_status = 'verified' AND f.name LIKE ? AND (? = '' OR f.facility_type = ?) AND (? = '' OR f.region_id = ?)
     ORDER BY f.name LIMIT 200`).bind(`%${q}%`, type, type, region, region).all();
  return c.json({ data: results });
});

mapPublicRoutes.get("/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT f.*, r.name AS region_name FROM facilities f JOIN regions r ON r.id = f.region_id WHERE f.id = ? AND f.verification_status = 'verified'").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!row) return c.json({ error: { code: "not_found", message: "Fasilitas tidak ditemukan." } }, 404);
  return c.json({ data: { ...row, directions_url: `https://www.openstreetmap.org/directions?to=${row.latitude}%2C${row.longitude}` } });
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
