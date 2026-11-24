import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";

type Conv = { id: string; title: string; message_count: number; context_enabled: number };
type Msg = { id: string; role: string; content: string; sources?: { title: string; publisher: string; url: string | null }[]; is_emergency?: number };
type Usage = { used_today: number; limit: number; remaining: number };
type GuestReply = { content: string; sources: { title: string; publisher: string; url: string | null }[]; is_emergency: boolean };

function TypingIndicator() {
  return (
    <p className="flex items-center gap-1.5 rounded-card border border-line bg-white p-4" aria-live="polite" aria-label="SIGERAI sedang menyusun jawaban">
      <span className="typing-dot h-2 w-2 rounded-full bg-brand-700" />
      <span className="typing-dot h-2 w-2 rounded-full bg-brand-700" />
      <span className="typing-dot h-2 w-2 rounded-full bg-brand-700" />
      <span className="ml-2 text-sm text-ink-500">Menyusun jawaban dari sumber resmi…</span>
    </p>
  );
}

function MessageList({ messages, busy }: { messages: Msg[]; busy: boolean }) {
  return (
    <>
      {messages.map((m, i) => (
        <article key={m.id + i} className={`route-enter rounded-card p-4 ${m.role === "user" ? "bg-brand-50" : m.is_emergency ? "border-l-4 border-danger-700 bg-danger-50" : "border border-line bg-white"}`}>
          <p className="text-sm font-semibold">{m.role === "user" ? "Anda" : "SIGERAI · dibantu AI"}</p>
          <p className="mt-1 whitespace-pre-wrap">{m.content}</p>
          {m.sources?.length ? <p className="mt-2 text-sm text-ink-600">Sumber: {m.sources.map((s, si) => <span key={si}>{si > 0 ? "; " : ""}{s.url ? <a className="text-info-700 underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a> : s.title} ({s.publisher})</span>)}</p> : null}
        </article>
      ))}
      {busy ? <TypingIndicator /> : null}
    </>
  );
}

export function AiPage() {
  const { me } = useAuth();
  const guest = !me;
  const [params] = useSearchParams();
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(params.get("q") ?? "");
  const [usage, setUsage] = useState<Usage | null>(null);
  const [useContext, setUseContext] = useState(false);
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadConvs = useCallback(() => {
    if (guest) return;
    apiFetch<Conv[]>("/api/v1/ai/conversations").then(setConvs).catch(() => {});
    apiFetch<Usage>("/api/v1/ai/usage").then(setUsage).catch(() => {});
  }, [guest]);
  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function openConv(id: string) {
    setActive(id);
    const data = await apiFetch<{ messages: Msg[] }>(`/api/v1/ai/conversations/${id}`);
    setMessages(data.messages);
  }
  async function newConv() {
    const res = await apiMutate<{ conversation_id: string }>("/api/v1/ai/conversations", "POST", { profileId: me?.profile?.id, useScreeningContext: useContext, title: useContext ? "Penjelasan hasil skrining" : "Percakapan baru" });
    loadConvs(); await openConv(res.conversation_id);
  }
  async function send(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (!guest && !active) return;
    setBusy(true); setError(""); setInput("");
    setMessages((prev) => [...prev, { id: `u${Date.now()}`, role: "user", content: text }]);
    try {
      if (guest) {
        const res = await apiFetch<GuestReply>("/api/v1/guest/ai", { method: "POST", body: JSON.stringify({ message: text }) });
        setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: "assistant", content: res.content, sources: res.sources, is_emergency: res.is_emergency ? 1 : 0 }]);
      } else {
        const res = await apiMutate<{ content: string; sources: { title: string; publisher: string; url: string | null }[]; is_emergency: boolean }>(`/api/v1/ai/conversations/${active}/messages`, "POST", { content: text });
        setMessages((prev) => [...prev, { id: `a${Date.now()}`, role: "assistant", content: res.content, sources: res.sources, is_emergency: res.is_emergency ? 1 : 0 }]);
        loadConvs();
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Pesan tidak dapat dikirim.");
      setMessages((prev) => prev.filter((m) => m.content !== text || m.role !== "user"));
    } finally { setBusy(false); }
  }

  return (
    <>
      <PageHeader title="Tanya SIGERAI" description="Asisten informasi kesehatan yang menjawab hanya dari sumber resmi terkurasi (Kemenkes RI/WHO). Bukan pengganti tenaga kesehatan dan tidak memberikan diagnosis atau resep. Setiap jawaban berlabel dibantu AI." />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="rounded-card bg-danger-50 p-3 text-danger-700">Keadaan darurat (nyeri dada, sesak berat, kelemahan satu sisi tubuh): segera ke IGD atau hubungi <strong>119</strong> — jangan menunggu jawaban di sini.</p>
        {guest ? (
          <p className="mt-3 rounded-card bg-info-50 p-3 text-[15px] text-info-800">Kamu memakai mode tamu: percakapan hanya ada di tab ini dan <strong>tidak disimpan di server</strong>. Jangan mengetik nama, NIK, atau data identitas lain. <Link to="/masuk?next=/tanya" className="font-semibold underline">Masuk</Link> bila ingin riwayat tersimpan dan konteks hasil skriningmu.</p>
        ) : usage ? <p className="mt-3 text-sm text-ink-600" aria-live="polite">Pemakaian hari ini: {usage.used_today} dari {usage.limit} pesan.</p> : null}
        {!guest ? (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" checked={useContext} onChange={(e) => setUseContext(e.target.checked)} />
                Sertakan hasil skrining terakhir saya sebagai konteks (dengan izin saya)
              </label>
              <Button onClick={newConv}>Percakapan Baru</Button>
            </div>
            {convs.length ? <ul className="mt-4 flex flex-wrap gap-2" aria-label="Riwayat percakapan">
              {convs.map((cv) => <li key={cv.id}><button onClick={() => openConv(cv.id)} className={`rounded-full border px-4 py-2 text-sm font-medium ${active === cv.id ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white"}`}>{cv.title} ({cv.message_count})</button></li>)}
            </ul> : null}
          </>
        ) : null}
        {guest || active ? (
          <section aria-label="Isi percakapan" className="mt-6 flex flex-col gap-3">
            <MessageList messages={messages} busy={busy} />
            <div ref={bottomRef} />
            <form onSubmit={send} className="flex gap-2">
              <label className="sr-only" htmlFor="chat-input">Tulis pertanyaan kesehatan</label>
              <input id="chat-input" className="min-h-12 flex-1 rounded-btn border border-line bg-white px-3" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Contoh: bagaimana cara menurunkan tekanan darah?" maxLength={2000} />
              <Button type="submit" disabled={busy}>{busy ? "Mengirim…" : "Kirim"}</Button>
            </form>
            {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
          </section>
        ) : <p className="mt-6 text-ink-600">Pilih "Percakapan Baru" untuk mulai. Riwayat percakapan hanya dapat dilihat oleh Anda.</p>}
      </main>
    </>
  );
}
