import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { logAudit } from "../../lib/audit";
import { nowSql } from "../../lib/time";
import { retrieveSources, RetrievalComposer, OpenAICompatibleProvider, SYSTEM_PROMPT, EMERGENCY_PATTERNS, PRESCRIPTION_PATTERNS, DIAGNOSIS_LEAK_PATTERNS, emergencyResponse, prescriptionRefusal, type SourcePassage } from "./provider";
import type { Env } from "../auth/service";

// SIGERAI — retrieval-only dari sumber terkurasi; filter keamanan deterministik sebelum & sesudah model;
// batas pemakaian harian; konteks skrining hanya dengan consent eksplisit (REC-08).
export const aiRoutes = new Hono<{ Bindings: Env }>();
aiRoutes.use("*", requireAuth);

async function ownConversation(db: D1Database, userId: string, id: string) {
  const conv = await db.prepare("SELECT * FROM ai_conversations WHERE id = ? AND user_id = ?").bind(id, userId).first<Record<string, unknown>>();
  if (!conv) throw notFound();
  return conv;
}

aiRoutes.post("/conversations", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  let profileId: string | null = null;
  if (typeof body.profileId === "string" && body.profileId) {
    const p = await c.env.DB.prepare("SELECT id FROM health_profiles WHERE id = ? AND owner_user_id = ? AND is_active = 1").bind(body.profileId, actor.id).first();
    if (!p) throw notFound();
    profileId = body.profileId;
  }
  const wantsContext = body.useScreeningContext === true;
  if (wantsContext && !profileId) throw validationError([{ field: "profileId", message: "Pilih profil untuk memakai konteks skrining.", code: "required" }]);
  const id = newId("cnv");
  await c.env.DB.prepare("INSERT INTO ai_conversations (id, user_id, profile_id, context_consent_at, title) VALUES (?,?,?,?,?)")
    .bind(id, actor.id, profileId, wantsContext ? nowSql() : null, typeof body.title === "string" ? body.title.slice(0, 120) : "Percakapan baru").run();
  return c.json({ data: { conversation_id: id, context_enabled: wantsContext } }, 201);
});

aiRoutes.get("/conversations", async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare(
    `SELECT cv.id, cv.title, cv.created_at, cv.context_consent_at IS NOT NULL AS context_enabled,
      (SELECT COUNT(*) FROM ai_messages m WHERE m.conversation_id = cv.id) AS message_count
     FROM ai_conversations cv WHERE cv.user_id = ? ORDER BY cv.updated_at DESC LIMIT 30`).bind(actor.id).all();
  return c.json({ data: results });
});

aiRoutes.get("/conversations/:id", async (c) => {
  const actor = c.get("actor");
  const conv = await ownConversation(c.env.DB, actor.id, c.req.param("id") ?? "");
  const { results } = await c.env.DB.prepare("SELECT id, role, content, sources_json, is_emergency, created_at FROM ai_messages WHERE conversation_id = ? AND role != 'system_flag' ORDER BY created_at ASC LIMIT 200").bind(conv.id).all<Record<string, unknown>>();
  return c.json({ data: { conversation: { id: conv.id, title: conv.title, context_enabled: !!conv.context_consent_at }, messages: results.map((m) => ({ ...m, sources: m.sources_json ? JSON.parse(String(m.sources_json)) : [] })) } });
});

aiRoutes.delete("/conversations/:id", async (c) => {
  const actor = c.get("actor");
  const conv = await ownConversation(c.env.DB, actor.id, c.req.param("id") ?? "");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM ai_messages WHERE conversation_id = ?").bind(conv.id),
    c.env.DB.prepare("DELETE FROM ai_conversations WHERE id = ?").bind(conv.id),
  ]);
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "ai.conversation_delete", objectType: "ai_conversation", objectId: String(conv.id) });
  return c.json({ data: { deleted: true } });
});

async function dailyLimit(db: D1Database): Promise<number> {
  const row = await db.prepare("SELECT value FROM system_settings WHERE key = 'ai_daily_limit'").first<{ value: string }>();
  const n = Number(row?.value ?? 20);
  return Number.isFinite(n) && n > 0 ? n : 20;
}

aiRoutes.get("/usage", async (c) => {
  const actor = c.get("actor");
  const used = await c.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM ai_messages m JOIN ai_conversations cv ON cv.id = m.conversation_id WHERE cv.user_id = ? AND m.role = 'user' AND date(m.created_at) = date('now')").bind(actor.id).first<{ n: number }>();
  const limit = await dailyLimit(c.env.DB);
  return c.json({ data: { used_today: used?.n ?? 0, limit, remaining: Math.max(0, limit - (used?.n ?? 0)) } });
});

aiRoutes.post("/conversations/:id/messages", async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const conv = await ownConversation(db, actor.id, c.req.param("id") ?? "");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const content = requireString(body, "content", "Pesan", errors, { min: 2, max: 2000 });
  if (errors.length) throw validationError(errors);
  const limit = await dailyLimit(db);
  const used = await db.prepare("SELECT COUNT(*) AS n FROM ai_messages m JOIN ai_conversations cv ON cv.id = m.conversation_id WHERE cv.user_id = ? AND m.role = 'user' AND date(m.created_at) = date('now')").bind(actor.id).first<{ n: number }>();
  if ((used?.n ?? 0) >= limit) throw new ApiError(429, "usage_limit", `Batas pemakaian SIGERAI hari ini (${limit} pesan) sudah tercapai. Batas ini menjaga layanan tetap adil dan aman; coba lagi besok, atau baca artikel di SIGEREDU.`);

  const lower = content.toLowerCase();
  const userMsgId = newId("msg");
  await db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?,?, 'user', ?)").bind(userMsgId, conv.id, content).run();

  const finish = async (text: string, opts: { sources?: SourcePassage[]; emergency?: boolean; modelRef?: string; flagged?: string }) => {
    const assistantId = newId("msg");
    const sourcesJson = opts.sources?.length ? JSON.stringify(opts.sources.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url }))) : null;
    const stmts = [db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content, sources_json, is_emergency, model_ref) VALUES (?,?, 'assistant', ?, ?, ?, ?)")
      .bind(assistantId, conv.id, text, sourcesJson, opts.emergency ? 1 : 0, opts.modelRef ?? null)];
    if (opts.flagged) stmts.push(db.prepare("INSERT INTO ai_messages (id, conversation_id, role, content) VALUES (?,?, 'system_flag', ?)").bind(newId("msg"), conv.id, opts.flagged));
    stmts.push(db.prepare("UPDATE ai_conversations SET updated_at = datetime('now') WHERE id = ?").bind(conv.id));
    await db.batch(stmts);
    return c.json({ data: { message_id: assistantId, content: text, sources: opts.sources?.map((s) => ({ title: s.title, publisher: s.publisher, url: s.url })) ?? [], is_emergency: !!opts.emergency, model: opts.modelRef ?? null } });
  };

  // 1) Keadaan darurat — sebelum retrieval/model apa pun.
  if (EMERGENCY_PATTERNS.some((p) => lower.includes(p))) return finish(emergencyResponse(), { emergency: true, modelRef: "safety-rule" });
  // 2) Permintaan resep/dosis — ditolak secara deterministik.
  if (PRESCRIPTION_PATTERNS.some((p) => lower.includes(p))) return finish(prescriptionRefusal(), { modelRef: "safety-rule" });

  // 3) Retrieval dari sumber terkurasi.
  const sources = await retrieveSources(db, content, 3);

  // 4) Konteks skrining — hanya bila consent tercatat pada percakapan ini.
  let screeningContext: string | undefined;
  let screeningCategory: string | null = null;
  if (conv.context_consent_at && conv.profile_id) {
    const s = await db.prepare("SELECT risk_category, findings_json, recommendations_json, completed_at FROM screening_sessions WHERE profile_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1")
      .bind(conv.profile_id).first<{ risk_category: string; findings_json: string; recommendations_json: string; completed_at: string }>();
    if (s) {
      screeningCategory = s.risk_category;
      const findings = JSON.parse(s.findings_json) as { label: string; value_text: string; category: string }[];
      screeningContext = `Hasil skrining terakhir Anda (${s.completed_at}): kategori risiko keseluruhan adalah "${s.risk_category}" — kategori ini berasal dari SIGERCHECK dan tidak berubah. Rinciannya: ${findings.map((f) => `${f.label} ${f.value_text} (${f.category})`).join("; ")}. Penjelasan: kategori menunjukkan tingkat risiko gabungan dari pengukuran Anda; ikuti anjuran tindak lanjut pada hasil skrining dan periksalah ke fasilitas kesehatan bila kategori sedang atau tinggi.`;
    }
  }

  // Konteks skrining hanya disertakan bila pertanyaan memang tentang hasil skrining (privasi & relevansi).
  const CONTEXT_TRIGGERS = ["skrining", "hasil", "risiko", "kategori", "jelaskan", "tekanan darah saya", "gula saya", "imt saya", "skor saya"];
  if (screeningContext && !CONTEXT_TRIGGERS.some((t) => lower.includes(t))) screeningContext = undefined;

  // 5) Provider eksternal bila dikonfigurasi; selain itu Penyusun Retrieval terkurasi adalah
  //    penyedia bawaan di SEMUA lingkungan: ia hanya menyusun jawaban dari sumber aktif yang
  //    terambil (tidak pernah mengarang), sehingga aman menjadi bawaan production.
  const env = c.env as Env & { AI_API_KEY?: string; AI_API_BASE_URL?: string; AI_MODEL?: string };
  let result: { text: string; modelRef: string };
  if (env.AI_API_KEY && env.AI_API_BASE_URL && env.AI_MODEL) {
    const contextText = [screeningContext ?? "", ...sources.map((s) => `SUMBER: ${s.title} (${s.publisher})\n${s.text}`)].filter(Boolean).join("\n\n");
    try {
      result = await new OpenAICompatibleProvider(env.AI_API_BASE_URL, env.AI_API_KEY, env.AI_MODEL)
        .complete(SYSTEM_PROMPT, `KONTEKS:\n${contextText || "(tidak ada sumber ditemukan)"}\n\nPERTANYAAN PENGGUNA: ${content}`);
    } catch {
      result = new RetrievalComposer().compose(content, sources, screeningContext);
      result = { ...result, modelRef: "retrieval-fallback" };
    }
  } else {
    result = new RetrievalComposer().compose(content, sources, screeningContext);
  }

  // 6) Pemeriksaan keluaran: pola diagnosis pasti / kategori skrining yang diubah model → diganti aman + ditandai.
  const leaked = DIAGNOSIS_LEAK_PATTERNS.some((re) => re.test(result.text));
  const categoryChanged = screeningCategory !== null && /kategori (?:risiko )?(?:keseluruhan )?(?:anda )?(?:adalah|tergolong|masuk) (rendah|sedang|tinggi)/i.test(result.text)
    && !result.text.toLowerCase().includes(`"${screeningCategory}"`) && !new RegExp(`kategori[^.]{0,40}${screeningCategory}`, "i").test(result.text);
  if (leaked || categoryChanged) {
    const safe = new RetrievalComposer().compose(content, sources, screeningContext);
    return finish(safe.text, { sources, modelRef: "safety-filter", flagged: `output_filtered:${leaked ? "diagnosis_pattern" : "category_mismatch"}` });
  }
  return finish(result.text, { sources, modelRef: result.modelRef });
});

// Laporan pengguna atas jawaban AI (umpan balik untuk penelaahan admin).
aiRoutes.post("/messages/:id/report", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const msg = await c.env.DB.prepare("SELECT m.id FROM ai_messages m JOIN ai_conversations cv ON cv.id = m.conversation_id WHERE m.id = ? AND cv.user_id = ?").bind(c.req.param("id"), actor.id).first();
  if (!msg) throw notFound();
  const id = newId("air");
  await c.env.DB.prepare("INSERT INTO ai_answer_reports (id, message_id, reported_by_user_id, reason) VALUES (?,?,?,?)")
    .bind(id, msg.id, actor.id, typeof body.reason === "string" ? body.reason.slice(0, 500) : "Dilaporkan pengguna").run();
  return c.json({ data: { report_id: id } }, 201);
});
