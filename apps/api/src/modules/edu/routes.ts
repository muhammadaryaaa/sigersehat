import { Hono } from "hono";
import { requireAuth, requireRole } from "../../middleware/auth";
import { ApiError, notFound } from "../../domain/errors";
import { requireString, validationError, type FieldError } from "../../lib/validate";
import { newId } from "../../lib/crypto";
import { logAudit } from "../../lib/audit";
import type { Env } from "../auth/service";

// SIGEREDU — konten hanya tampil bila published; kuis dinilai di server; jawaban benar tidak pernah dikirim ke klien.
export const eduPublicRoutes = new Hono<{ Bindings: Env }>();

eduPublicRoutes.get("/categories", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT category AS slug, COUNT(*) AS published_count FROM edu_contents WHERE status = 'published' GROUP BY category ORDER BY category").all();
  return c.json({ data: results });
});

eduPublicRoutes.get("/articles", async (c) => {
  const category = c.req.query("category");
  const q = c.req.query("q");
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit") ?? 20)));
  let sql = "SELECT id, slug, title, category, summary, source_name, published_at FROM edu_contents WHERE status = 'published'";
  const binds: unknown[] = [];
  if (category) { sql += " AND category = ?"; binds.push(category); }
  if (q) { sql += " AND (title LIKE ? OR summary LIKE ? OR body_md LIKE ?)"; const like = `%${q}%`; binds.push(like, like, like); }
  sql += " ORDER BY published_at DESC LIMIT ?";
  binds.push(limit);
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json({ data: results });
});

eduPublicRoutes.get("/articles/:slug", async (c) => {
  const a = await c.env.DB.prepare("SELECT * FROM edu_contents WHERE slug = ? AND status = 'published'").bind(c.req.param("slug")).first<Record<string, unknown>>();
  if (!a) throw notFound();
  const refs = (await c.env.DB.prepare("SELECT title, publisher, url FROM edu_references WHERE content_id = ? ORDER BY sort_order").bind(a.id).all()).results;
  const quiz = await c.env.DB.prepare("SELECT id, title FROM edu_quizzes WHERE content_id = ? AND status = 'published'").bind(a.id).first();
  return c.json({ data: { ...a, references: refs, quiz } });
});

eduPublicRoutes.get("/quizzes", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, title, content_id FROM edu_quizzes WHERE status = 'published'").all();
  return c.json({ data: results });
});

eduPublicRoutes.get("/quizzes/:id", async (c) => {
  const quiz = await c.env.DB.prepare("SELECT id, title, questions_json FROM edu_quizzes WHERE id = ? AND status = 'published'").bind(c.req.param("id")).first<{ id: string; title: string; questions_json: string }>();
  if (!quiz) throw notFound();
  const questions = (JSON.parse(quiz.questions_json) as { question_text: string; options: string[] }[]).map((q) => ({ question_text: q.question_text, options: q.options }));
  return c.json({ data: { id: quiz.id, title: quiz.title, questions } });
});

export const eduUserRoutes = new Hono<{ Bindings: Env }>();
eduUserRoutes.use("*", requireAuth);
eduUserRoutes.post("/quizzes/:id/attempt", async (c) => {
  const actor = c.get("actor");
  const quiz = await c.env.DB.prepare("SELECT questions_json FROM edu_quizzes WHERE id = ? AND status = 'published'").bind(c.req.param("id")).first<{ questions_json: string }>();
  if (!quiz) throw notFound();
  const body = (await c.req.json().catch(() => ({}))) as { answers?: number[] };
  const questions = JSON.parse(quiz.questions_json) as { question_text: string; options: string[]; correct_index: number; explanation: string }[];
  const answers = Array.isArray(body.answers) ? body.answers : [];
  if (answers.length !== questions.length) throw validationError([{ field: "answers", message: "Jawab seluruh pertanyaan kuis.", code: "required" }]);
  let correct = 0;
  const detail = questions.map((q, i) => { const ok = answers[i] === q.correct_index; if (ok) correct++; return { question_text: q.question_text, your_answer: answers[i], correct_index: q.correct_index, correct: ok, explanation: q.explanation }; });
  const score = Math.round((correct / questions.length) * 100);
  await c.env.DB.prepare("INSERT INTO edu_quiz_attempts (id, quiz_id, user_id, score, answers_json) VALUES (?,?,?,?,?)")
    .bind(newId("att"), c.req.param("id"), actor.id, score, JSON.stringify(answers)).run();
  return c.json({ data: { score, correct, total: questions.length, detail } });
});
eduUserRoutes.get("/my-attempts", async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare(
    "SELECT a.id, a.score, a.created_at, q.title AS quiz_title FROM edu_quiz_attempts a JOIN edu_quizzes q ON q.id = a.quiz_id WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 20").bind(actor.id).all();
  return c.json({ data: results });
});

// Manajemen konten (admin/super admin). Terbit mensyaratkan telaah disetujui + penelaah tercatat (FR-EDU-01).
export const eduAdminRoutes = new Hono<{ Bindings: Env }>();
eduAdminRoutes.use("*", requireAuth, requireRole("admin", "super_admin"));

eduAdminRoutes.get("/articles", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, slug, title, category, status, reviewer_user_id, reviewed_at, published_at, updated_at FROM edu_contents ORDER BY updated_at DESC LIMIT 100").all();
  return c.json({ data: results });
});

function slugify(title: string): string {
  return title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

eduAdminRoutes.post("/articles", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const title = requireString(body, "title", "Judul", errors, { min: 8, max: 200 });
  const summary = requireString(body, "summary", "Ringkasan", errors, { min: 20, max: 600 });
  const bodyMd = requireString(body, "bodyMd", "Isi artikel", errors, { min: 100 });
  const sourceName = requireString(body, "sourceName", "Nama sumber", errors, { min: 3, max: 160 });
  const sourceUrl = requireString(body, "sourceUrl", "URL sumber", errors, { min: 8, max: 400 });
  const category = typeof body.category === "string" && body.category ? body.category : "umum";
  const refs = Array.isArray(body.references) ? (body.references as { title?: string; publisher?: string; url?: string }[]) : [];
  if (!refs.length) errors.push({ field: "references", message: "Artikel wajib memiliki minimal satu referensi yang dapat diperiksa.", code: "required" });
  if (errors.length) throw validationError(errors);
  const id = newId("art");
  const slug = slugify(String(title)) + "-" + id.slice(4, 10);
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO edu_contents (id, slug, title, category, summary, body_md, source_name, source_url, status) VALUES (?,?,?,?,?,?,?,?,'draft')")
      .bind(id, slug, title, category, summary, bodyMd, sourceName, sourceUrl),
    ...refs.map((r, i) => c.env.DB.prepare("INSERT INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES (?,?,?,?,?,?)")
      .bind(newId("ref"), id, String(r.title ?? ""), String(r.publisher ?? ""), String(r.url ?? ""), i + 1)),
  ]);
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "edu.article_create", objectType: "edu_content", objectId: id });
  return c.json({ data: { article_id: id, slug, status: "draft" } }, 201);
});

eduAdminRoutes.put("/articles/:id", async (c) => {
  const actor = c.get("actor");
  const a = await c.env.DB.prepare("SELECT id, status FROM edu_contents WHERE id = ?").bind(c.req.param("id")).first<{ id: string; status: string }>();
  if (!a) throw notFound();
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const sets: string[] = []; const binds: unknown[] = [];
  for (const [api, col] of [["title", "title"], ["summary", "summary"], ["bodyMd", "body_md"], ["sourceName", "source_name"], ["sourceUrl", "source_url"], ["category", "category"]] as const) {
    if (typeof body[api] === "string" && body[api]) { sets.push(`${col} = ?`); binds.push(body[api]); }
  }
  if (body.reviewApproved === true) { sets.push("reviewer_user_id = ?", "reviewed_at = datetime('now')"); binds.push(actor.id); }
  if (!sets.length) return c.json({ data: { updated: false } });
  sets.push("updated_at = datetime('now')"); binds.push(a.id);
  await c.env.DB.prepare(`UPDATE edu_contents SET ${sets.join(", ")} WHERE id = ?`).bind(...binds).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "edu.article_update", objectType: "edu_content", objectId: a.id });
  return c.json({ data: { updated: true } });
});

eduAdminRoutes.post("/articles/:id/publish", async (c) => {
  const actor = c.get("actor");
  const a = await c.env.DB.prepare("SELECT * FROM edu_contents WHERE id = ?").bind(c.req.param("id")).first<{ id: string; reviewer_user_id: string | null; reviewed_at: string | null }>();
  if (!a) throw notFound();
  if (!a.reviewer_user_id || !a.reviewed_at) throw new ApiError(422, "review_required", "Artikel belum ditelaah. Tetapkan telaah persetujuan (reviewer tercatat) sebelum menerbitkan.");
  await c.env.DB.prepare("UPDATE edu_contents SET status = 'published', published_at = datetime('now'), updated_at = datetime('now') WHERE id = ?").bind(a.id).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "edu.article_publish", objectType: "edu_content", objectId: a.id });
  return c.json({ data: { published: true } });
});

eduAdminRoutes.post("/articles/:id/unpublish", async (c) => {
  const actor = c.get("actor");
  const a = await c.env.DB.prepare("SELECT id FROM edu_contents WHERE id = ?").bind(c.req.param("id")).first();
  if (!a) throw notFound();
  await c.env.DB.prepare("UPDATE edu_contents SET status = 'archived', updated_at = datetime('now') WHERE id = ?").bind(c.req.param("id")).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "edu.article_unpublish", objectType: "edu_content", objectId: c.req.param("id") ?? "" });
  return c.json({ data: { archived: true } });
});

eduAdminRoutes.post("/quizzes", async (c) => {
  const actor = c.get("actor");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const errors: FieldError[] = [];
  const title = requireString(body, "title", "Judul kuis", errors, { min: 5, max: 160 });
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (!questions.length) errors.push({ field: "questions", message: "Kuis wajib memiliki pertanyaan.", code: "required" });
  if (errors.length) throw validationError(errors);
  const id = newId("quz");
  await c.env.DB.prepare("INSERT INTO edu_quizzes (id, content_id, title, questions_json, status) VALUES (?,?,?,?,'draft')")
    .bind(id, typeof body.contentId === "string" ? body.contentId : null, title, JSON.stringify(questions)).run();
  await logAudit(c.env.DB, { actorUserId: actor.id, actorRole: actor.role, action: "edu.quiz_create", objectType: "edu_quiz", objectId: id });
  return c.json({ data: { quiz_id: id, status: "draft" } }, 201);
});
