import { Hono } from "hono";
import { ApiError } from "../../domain/errors";
import { validationError, type FieldError } from "../../lib/validate";
import { calcBmi, classifyBmi, classifyBp, classifySugar, scoreFindrisc, recommendationsFor, SEVERITY_LABEL, DANGER_QUESTIONS, type Finding, type FindriscAnswers } from "../../domain/rules/screening";
import { retrieveSources, RetrievalComposer, EMERGENCY_PATTERNS, PRESCRIPTION_PATTERNS, emergencyResponse, prescriptionRefusal } from "../ai/provider";
import type { Env } from "../auth/service";

// Endpoint publik (tamu) — Model Akses bagian A pada prompt revisi:
// skrining dihitung TANPA disimpan, Tanya AI menjawab TANPA riwayat disimpan.
// Perlindungan: batas laju per alamat IP (IP di-hash SHA-256, tidak disimpan mentah).
export const guestRoutes = new Hono<{ Bindings: Env }>();

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function rateLimit(c: { env: Env; req: { header: (n: string) => string | undefined } }, endpoint: string, maxPerHour: number) {
  const ip = c.req.header("CF-Connecting-IP") ?? c.req.header("X-Forwarded-For") ?? "unknown";
  const ipHash = await sha256Hex(`siger:${ip}`);
  const bucket = new Date().toISOString().slice(0, 13); // per jam, format ISO dari jam server
  const db = c.env.DB;
  await db.prepare(
    `INSERT INTO guest_rate_limits (ip_hash, endpoint, hour_bucket, hits) VALUES (?,?,?,1)
     ON CONFLICT (ip_hash, endpoint, hour_bucket) DO UPDATE SET hits = hits + 1`,
  ).bind(ipHash, endpoint, bucket).run();
  const row = await db.prepare("SELECT hits FROM guest_rate_limits WHERE ip_hash = ? AND endpoint = ? AND hour_bucket = ?").bind(ipHash, endpoint, bucket).first<{ hits: number }>();
  if ((row?.hits ?? 0) > maxPerHour) throw new ApiError(429, "rate_limited", "Batas penggunaan tanpa akun untuk jam ini tercapai. Masuk atau daftar untuk melanjutkan, atau coba lagi nanti.");
}

function num(body: Record<string, unknown>, field: string, label: string, errors: FieldError[], range: [number, number]): number | null {
  const v = body[field];
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) { errors.push({ field, message: `${label} harus berupa angka.`, code: "format" }); return null; }
  if (n < range[0] || n > range[1]) { errors.push({ field, message: `${label} di luar rentang wajar (${range[0]}-${range[1]}).`, code: "range" }); return null; }
  return n;
}

// POST /guest/screening — hitung skrining tanpa menyimpan apa pun.
guestRoutes.post("/screening", async (c) => {
  await rateLimit(c, "guest_screening", 30);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const category = body.category === "diabetes_risk" ? "diabetes_risk" : "ptm_risk";
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
  if (errors.length) throw validationError(errors);

  const findings: Finding[] = [];
  if (weightKg !== null && heightCm !== null) findings.push(classifyBmi(calcBmi(weightKg, heightCm)));
  if (systolic !== null && diastolic !== null) findings.push(classifyBp(systolic, diastolic));
  if (sugar !== null) findings.push(classifySugar(sugar, sugarContext));
  if (category === "diabetes_risk") {
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
  return c.json({ data: {
    stored: false,
    risk_category: SEVERITY_LABEL[maxSeverity as 0 | 1 | 2],
    has_danger_sign: hasDanger,
    findings,
    recommendations: recommendationsFor(findings, hasDanger),
    disclaimer: "Hasil ini adalah skrining awal berdasarkan jawaban dan pengukuran yang Anda masukkan — bukan diagnosis. Hasil tamu ini tidak disimpan; buat akun bila ingin menyimpan dan memantau perubahannya.",
  } });
});

// POST /guest/ai — tanya jawab edukasi tanpa riwayat tersimpan (retrieval saja).
guestRoutes.post("/ai", async (c) => {
  await rateLimit(c, "guest_ai", 20);
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (message.length < 3 || message.length > 1000) throw validationError([{ field: "message", message: "Pertanyaan harus 3-1000 karakter.", code: "range" }]);
  const lower = message.toLowerCase();
  if (EMERGENCY_PATTERNS.some((p) => lower.includes(p))) {
    return c.json({ data: { content: emergencyResponse(), sources: [], is_emergency: true, model: "safety-rule", stored: false } });
  }
  if (PRESCRIPTION_PATTERNS.some((p) => lower.includes(p))) {
    return c.json({ data: { content: prescriptionRefusal(), sources: [], is_emergency: false, model: "safety-rule", stored: false } });
  }
  const sources = await retrieveSources(c.env.DB, message, 3);
  const result = new RetrievalComposer().compose(message, sources);
  return c.json({ data: { content: result.text, sources: sources.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url })), is_emergency: false, model: result.modelRef, stored: false } });
});
