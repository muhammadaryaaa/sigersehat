import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type ArticleListItem = { id: string; slug: string; title: string; category: string; summary: string; source_name: string; published_at: string };
type Category = { slug: string; published_count: number };
const CATEGORY_LABEL: Record<string, string> = { ptm: "Penyakit Tidak Menular", gizi: "Gizi & Makanan", "ibu-anak": "Ibu & Anak", lansia: "Lansia", umum: "Kesehatan Umum" };

export function EduPage() {
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Category[]>("/api/v1/edu/categories").then(setCategories).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (q) params.set("q", q);
    apiFetch<ArticleListItem[]>(`/api/v1/edu/articles?${params}`).then(setArticles).catch(() => setError("Artikel tidak dapat dimuat.")).finally(() => setLoading(false));
  }, [category, q]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Edukasi Kesehatan</h1>
      <p className="mt-2 text-ink-600">Artikel dari sumber resmi (Kemenkes RI dan Dinas Kesehatan) yang telah ditelaah. Setiap artikel mencantumkan referensinya.</p>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()} role="search">
        <TextField label="Cari artikel" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. hipertensi, gizi, posbindu" />
        <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="cat">Kategori</label>
          <select id="cat" className="min-h-12 rounded-btn border border-line bg-white px-3" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Semua kategori</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{CATEGORY_LABEL[c.slug] ?? c.slug} ({c.published_count})</option>)}
          </select></div>
      </form>
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <ul className="mt-6 flex flex-col gap-3">
        {articles.map((a) => <li key={a.id} className="rounded-card border border-line bg-white p-5">
          <p className="text-sm font-medium text-brand-700">{CATEGORY_LABEL[a.category] ?? a.category}</p>
          <h2 className="mt-1 text-xl font-bold"><Link className="hover:underline" to={`/edukasi/${a.slug}`}>{a.title}</Link></h2>
          <p className="mt-2">{a.summary}</p>
          <p className="mt-2 text-sm text-ink-500">Sumber: {a.source_name} • {a.published_at}</p>
        </li>)}
      </ul>
      {loading ? <p className="mt-6 text-ink-600" aria-live="polite">Memuat artikel…</p> : null}
      {!loading && !articles.length && !error ? <p className="mt-6 text-ink-600">Tidak ada artikel yang cocok. Coba kata kunci atau kategori lain.</p> : null}
    </main>
  );
}

type ArticleDetail = ArticleListItem & { body_md: string; source_url: string; references: { title: string; publisher: string; url: string }[]; quiz: { id: string; title: string } | null };
export function ArticlePage() {
  const { slug } = useParams();
  const [article, setArticle] = useState<ArticleDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<ArticleDetail>(`/api/v1/edu/articles/${slug}`).then(setArticle).catch(() => setError("Artikel tidak ditemukan.")); }, [slug]);
  if (error) return <main className="mx-auto max-w-3xl px-4 py-8"><p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p></main>;
  if (!article) return <main className="mx-auto max-w-3xl px-4 py-8"><p aria-live="polite">Memuat artikel…</p></main>;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/edukasi" className="font-medium text-brand-700 underline">Kembali ke daftar artikel</Link>
      <h1 className="mt-4 text-3xl font-bold">{article.title}</h1>
      <p className="mt-2 text-sm text-ink-500">{CATEGORY_LABEL[article.category] ?? article.category} • Sumber: {article.source_name} • Terbit {article.published_at}</p>
      <div className="mt-6 flex flex-col gap-4 text-lg leading-relaxed">
        {article.body_md.split(/\n\n+/).map((para, i) => <p key={i}>{para}</p>)}
      </div>
      {article.quiz ? <p className="mt-8 rounded-card bg-brand-50 p-4">Uji pemahaman Anda: <Link className="font-semibold text-brand-800 underline" to={`/kuis/${article.quiz.id}`}>{article.quiz.title}</Link></p> : null}
      <section aria-labelledby="refs" className="mt-8">
        <h2 id="refs" className="text-xl font-bold">Referensi</h2>
        <ol className="mt-2 list-decimal flex flex-col gap-1 pl-5">
          {article.references.map((r, i) => <li key={i}>{r.title} — {r.publisher}. <a className="text-info-700 underline" href={r.url} target="_blank" rel="noreferrer">{r.url}</a></li>)}
        </ol>
      </section>
    </main>
  );
}

type QuizData = { id: string; title: string; questions: { question_text: string; options: string[] }[] };
type AttemptResult = { score: number; correct: number; total: number; detail: { question_text: string; your_answer: number; correct_index: number; correct: boolean; explanation: string }[] };
export function QuizPage() {
  const { id } = useParams();
  const { me } = useAuth();
  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<QuizData>(`/api/v1/edu/quizzes/${id}`).then((d) => { setQuiz(d); setAnswers(new Array(d.questions.length).fill(-1)); }).catch(() => setError("Kuis tidak ditemukan.")); }, [id]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError("");
    if (answers.some((a) => a < 0)) { setError("Jawab seluruh pertanyaan terlebih dahulu."); return; }
    try { setResult(await apiMutate<AttemptResult>(`/api/v1/edu/quizzes/${id}/attempt`, "POST", { answers })); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Kuis tidak dapat dikirim."); }
  }
  if (!quiz) return <main className="mx-auto max-w-3xl px-4 py-8"><p aria-live="polite">{error || "Memuat kuis…"}</p></main>;
  if (result) return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Hasil: {result.score}</h1>
      <p className="mt-2">Anda menjawab benar {result.correct} dari {result.total} pertanyaan.</p>
      <ol className="mt-6 flex flex-col gap-3">
        {result.detail.map((d, i) => <li key={i} className="rounded-card border border-line bg-white p-4">
          <p className="font-semibold">{i + 1}. {d.question_text}</p>
          <p className="mt-1">{d.correct ? "Jawaban Anda benar." : "Jawaban Anda belum tepat."}</p>
          <p className="mt-1 text-ink-600">{d.explanation}</p></li>)}
      </ol>
      <p className="mt-6"><Link className="font-semibold text-brand-700 underline" to="/edukasi">Kembali ke Edukasi</Link></p>
    </main>
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">{quiz.title}</h1>
      {!me ? <p className="mt-3 rounded-card bg-warn-50 p-3 text-warn-800">Masuk terlebih dahulu agar hasil kuis tersimpan di akun Anda.</p> : null}
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {quiz.questions.map((q, qi) => <fieldset key={qi} className="rounded-card border border-line bg-white p-4">
          <legend className="font-semibold">{qi + 1}. {q.question_text}</legend>
          <div className="mt-2 flex flex-col gap-2">
            {q.options.map((opt, oi) => <label key={oi} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border border-line px-3">
              <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => { const next = [...answers]; next[qi] = oi; setAnswers(next); }} /> {opt}</label>)}
          </div></fieldset>)}
        {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
        <Button type="submit" disabled={!me}>Kirim Jawaban</Button>
      </form>
    </main>
  );
}
