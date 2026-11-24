import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type AdminArticle = { id: string; title: string; category: string; status: string; reviewer_user_id: string | null; reviewed_at: string | null; updated_at: string };
export function AdminEduPage() {
  const [items, setItems] = useState<AdminArticle[]>([]);
  const [form, setForm] = useState({ title: "", summary: "", bodyMd: "", sourceName: "", sourceUrl: "", category: "umum", refTitle: "", refPublisher: "", refUrl: "" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(() => { apiFetch<AdminArticle[]>("/api/v1/edu/admin/articles").then(setItems).catch(() => setError("Konten tidak dapat dimuat.")); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  async function create(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      await apiMutate("/api/v1/edu/admin/articles", "POST", { ...form, references: [{ title: form.refTitle, publisher: form.refPublisher, url: form.refUrl }] });
      setNotice("Artikel dibuat sebagai draf. Tetapkan telaah persetujuan sebelum menerbitkan.");
      setForm({ title: "", summary: "", bodyMd: "", sourceName: "", sourceUrl: "", category: "umum", refTitle: "", refPublisher: "", refUrl: "" }); load();
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Artikel tidak dapat dibuat."); }
  }
  async function act(id: string, action: string) {
    setError(""); setNotice("");
    try {
      if (action === "approve") await apiMutate(`/api/v1/edu/admin/articles/${id}`, "PUT", { reviewApproved: true });
      else await apiMutate(`/api/v1/edu/admin/articles/${id}/${action}`, "POST", {});
      setNotice(action === "publish" ? "Artikel diterbitkan." : action === "approve" ? "Telaah persetujuan tercatat atas nama Anda." : "Artikel diarsipkan.");
      load();
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Tindakan gagal."); }
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Manajemen Konten Edukasi</h1>
      <p className="mt-2 text-ink-600">Artikel hanya dapat diterbitkan setelah ditelaah dan penelaahnya tercatat. Referensi wajib dapat diperiksa.</p>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {items.map((a) => <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-4">
          <span><strong>{a.title}</strong> — {a.status}{a.reviewed_at ? ` • ditelaah ${a.reviewed_at}` : " • belum ditelaah"}</span>
          <span className="flex gap-2">
            {!a.reviewed_at && a.status !== "published" ? <Button variant="secondary" onClick={() => act(a.id, "approve")}>Setujui Telaah</Button> : null}
            {a.status !== "published" ? <Button onClick={() => act(a.id, "publish")}>Terbitkan</Button> : null}
            {a.status === "published" ? <Button variant="danger" onClick={() => act(a.id, "unpublish")}>Arsipkan</Button> : null}
          </span></li>)}
      </ul>
      <section aria-labelledby="baru" className="mt-10">
        <h2 id="baru" className="text-xl font-bold">Artikel Baru</h2>
        <form onSubmit={create} className="mt-4 flex flex-col gap-4">
          <TextField label="Judul" required value={form.title} onChange={set("title")} />
          <TextField label="Ringkasan" required value={form.summary} onChange={set("summary")} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="bodyMd">Isi artikel</label>
            <textarea id="bodyMd" required rows={8} className="rounded-btn border border-line bg-white px-3 py-2" value={form.bodyMd} onChange={set("bodyMd")} /></div>
          <TextField label="Nama sumber utama" required value={form.sourceName} onChange={set("sourceName")} />
          <TextField label="URL sumber utama" required value={form.sourceUrl} onChange={set("sourceUrl")} />
          <TextField label="Judul referensi" required value={form.refTitle} onChange={set("refTitle")} />
          <TextField label="Penerbit referensi" required value={form.refPublisher} onChange={set("refPublisher")} />
          <TextField label="URL referensi" required value={form.refUrl} onChange={set("refUrl")} />
          <Button type="submit">Simpan sebagai Draf</Button>
        </form>
      </section>
    </main>
  );
}
