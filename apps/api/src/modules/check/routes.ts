import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { nowSql } from "../../lib/time";
import { logAudit } from "../../lib/audit";
import { calcBmi, classifyBmi, classifyBp, classifySugar, scoreFindrisc, recommendationsFor, SEVERITY_LABEL, DANGER_QUESTIONS, type Finding, type FindriscAnswers } from "../../domain/rules/screening";
import type { Env } from "../auth/service";

export const checkRoutes = new Hono<{ Bindings: Env }>();
// Daftar instrumen bersifat publik (tamu boleh melihat & memakai skrining tanpa menyimpan);
// seluruh endpoint sesi tetap wajib masuk.
checkRoutes.use("/sessions/*", requireAuth);
checkRoutes.use("/sessions", requireAuth);

async function ownedProfile(db: D1Database, userId: string, profileId: string) {
  const p = await db.prepare("SELECT * FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(profileId, userId).first<Record<string, unknown>>();
  if (!p) throw notFound();
  return p;
}

checkRoutes.get("/instruments", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, category, title, version, source_ref, rules_json FROM screening_instruments WHERE status = 'active' ORDER BY category").all<Record<string, unknown>>();
  return c.json({ data: results.map((r) => ({ ...r, rules: JSON.parse(String(r.rules_json)), rules_json: undefined, danger_questions: DANGER_QUESTIONS })) });
});

checkRoutes.post("/sessions", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const profileId = String(body.profileId ?? "");
  const instrumentId = String(body.instrumentId ?? "");
  await ownedProfile(c.env.DB, actor.id, profileId);
  const ins = await c.env.DB.prepare("SELECT id, version FROM screening_instruments WHERE id = ? AND status = 'active'").bind(instrumentId).first<{ id: string; version: number }>();
  if (!ins) throw validationError([{ field: "instrumentId", message: "Instrumen skrining tidak ditemukan atau tidak aktif.", code: "not_found" }]);
  const id = newId("scr");
  await c.env.DB.prepare("INSERT INTO screening_sessions (id, profile_id, instrument_id, instrument_version) VALUES (?,?,?,?)").bind(id, profileId, ins.id, ins.version).run();
  return c.json({ data: { session_id: id } }, 201);
});

function num(body: Record<string, unknown>, field: string, label: string, errors: FieldError[], range: [number, number], required = false): number | null {
  const v = body[field];
  if (v === undefined || v === null || v === "") { if (required) errors.push({ field, message: `${label} wajib diisi.`, code: "required" }); return null; }
  const n = Number(v);
  if (!Number.isFinite(n)) { errors.push({ field, message: `${label} harus berupa angka.`, code: "format" }); return null; }
  if (n < range[0] || n > range[1]) { errors.push({ field, message: `${label} di luar rentang wajar (${range[0]}-${range[1]}). Periksa kembali alat ukur dan isian Anda.`, code: "range" }); return null; }
  return n;
}

checkRoutes.post("/sessions/:id/complete", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const session = await db.prepare("SELECT * FROM screening_sessions WHERE id = ?").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!session) throw notFound();
  await ownedProfile(db, actor.id, String(session.profile_id));
  if (session.status === "completed") throw new ApiError(409, "conflict", "Skrining ini sudah selesai. Mulai skrining baru bila perlu.");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const m = (body.measurements ?? {}) as Record<string, unknown>;
  const answers = (body.answers ?? {}) as Record<string, string>;
  const errors: FieldError[] = [];
  const heightCm = num(m, "heightCm", "Tinggi badan", errors, [30, 272]);
  const weightKg = num(m, "weightKg", "Berat badan", errors, [1, 635]);
  const systolic = num(m, "systolic", "Tekanan darah sistolik", errors, [40, 300]);
  const diastolic = num(m, "diastolic", "Tekanan darah diastolik", errors, [20, 200]);
  if (systolic !== null && diastolic !== null && systolic <= diastolic) errors.push({ field: "systolic", message: "Sistolik harus lebih besar dari diastolik.", code: "range" });
  const sugar = num(m, "bloodSugarMgdl", "Gula darah", errors, [10, 1000]);
  const sugarContext = (m.sugarContext === "puasa" || m.sugarContext === "2jam_pp") ? m.sugarContext : "sewaktu";
  const waist = num(m, "waistCm", "Lingkar pinggang", errors, [30, 300]);
  if (errors.length) throw validationError(errors);

  const findings: Finding[] = [];
  let bmi: number | null = null;
  if (weightKg !== null && heightCm !== null) { bmi = calcBmi(weightKg, heightCm); findings.push(classifyBmi(bmi)); }
  if (systolic !== null && diastolic !== null) findings.push(classifyBp(systolic, diastolic));
  if (sugar !== null) findings.push(classifySugar(sugar, sugarContext));

  const ins = await db.prepare("SELECT category FROM screening_instruments WHERE id = ?").bind(session.instrument_id).first<{ category: string }>();
  if (ins?.category === "diabetes_risk") {
    const fa = answers as unknown as FindriscAnswers;
    const required = ["age_band", "bmi_band", "waist_band", "activity", "veg_daily", "bp_meds", "high_glucose_history", "family_history"];
    const missing = required.filter((k) => !fa[k as keyof FindriscAnswers]);
    if (missing.length) throw validationError(missing.map((k) => ({ field: k, message: "Pertanyaan ini wajib dijawab.", code: "required" })));
    findings.push(scoreFindrisc(fa).finding);
  }
  const dangerFromAnswers = DANGER_QUESTIONS.some((q) => answers[q.key] === "yes");
  const dangerFromValues = (systolic !== null && systolic >= 180) || (diastolic !== null && diastolic >= 110);
  const hasDanger = dangerFromAnswers || dangerFromValues;
  const maxSeverity = hasDanger ? 2 : Math.max(0, ...findings.map((f) => f.severity));
  const riskCategory = SEVERITY_LABEL[maxSeverity as 0 | 1 | 2];
  const recommendations = recommendationsFor(findings, hasDanger);

  const measurementId = newId("msr");
  const idem = typeof body.idempotencyKey === "string" ? body.idempotencyKey : null;
  const statements = [
    db.prepare(`INSERT INTO measurements (id, profile_id, measured_at, height_cm, weight_kg, bmi, systolic, diastolic, blood_sugar_mgdl, sugar_context, waist_cm, source, recorded_by_user_id, recorded_by_role, screening_session_id, idempotency_key)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(measurementId, session.profile_id, nowSql(), heightCm, weightKg, bmi, systolic, diastolic, sugar, sugar ? sugarContext : null, waist, "screening", actor.id, actor.role, session.id, idem),
    db.prepare("UPDATE screening_sessions SET status = 'completed', measurement_id = ?, risk_category = ?, findings_json = ?, recommendations_json = ?, has_danger_sign = ?, completed_at = datetime('now') WHERE id = ?")
      .bind(measurementId, riskCategory, JSON.stringify(findings), JSON.stringify(recommendations), hasDanger ? 1 : 0, session.id),
    ...Object.entries(answers).map(([k, v]) => db.prepare("INSERT OR REPLACE INTO screening_answers (id, session_id, question_key, answer_value) VALUES (?,?,?,?)").bind(newId("ans"), session.id, k, String(v))),
  ];
  await db.batch(statements);
  await logAudit(db, { actorUserId: actor.id, actorRole: actor.role, action: "screening.complete", objectType: "screening_session", objectId: String(session.id), profileId: String(session.profile_id) });
  return c.json({ data: { session_id: session.id, measurement_id: measurementId, risk_category: riskCategory, has_danger_sign: hasDanger, findings, recommendations,
    disclaimer: "Hasil ini adalah skrining awal berdasarkan jawaban dan pengukuran yang Anda masukkan — bukan diagnosis. Diagnosis hanya ditegakkan tenaga kesehatan melalui pemeriksaan langsung." } });
});

checkRoutes.get("/sessions", async (c) => {
  const actor = c.get("actor");
  const profileId = c.req.query("profileId");
  if (!profileId) throw validationError([{ field: "profileId", message: "profileId wajib disertakan.", code: "required" }]);
  await ownedProfile(c.env.DB, actor.id, profileId);
  const { results } = await c.env.DB.prepare(
    `SELECT s.id, s.status, s.risk_category, s.has_danger_sign, s.started_at, s.completed_at, i.title AS instrument_title, i.category
     FROM screening_sessions s JOIN screening_instruments i ON i.id = s.instrument_id
     WHERE s.profile_id = ? ORDER BY s.started_at DESC LIMIT 50`).bind(profileId).all();
  return c.json({ data: results });
});

checkRoutes.get("/sessions/:id", async (c) => {
  const actor = c.get("actor");
  const s = await c.env.DB.prepare("SELECT * FROM screening_sessions WHERE id = ?").bind(c.req.param("id")).first<Record<string, unknown>>();
  if (!s) throw notFound();
  await ownedProfile(c.env.DB, actor.id, String(s.profile_id));
  const answers = (await c.env.DB.prepare("SELECT question_key, answer_value FROM screening_answers WHERE session_id = ?").bind(s.id).all()).results;
  return c.json({ data: { ...s, findings: s.findings_json ? JSON.parse(String(s.findings_json)) : null, recommendations: s.recommendations_json ? JSON.parse(String(s.recommendations_json)) : null, findings_json: undefined, recommendations_json: undefined, answers } });
});
