import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { TextField } from "../components/ui/TextField";

type Profile = { id: string; full_name: string; relation: string; birth_date: string; sex: string };
const RELATION_LABEL: Record<string, string> = { self: "Saya", child: "Anak", elderly: "Lansia", other_family: "Keluarga lain" };
export function FamilyPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState({ fullName: "", birthDate: "", sex: "female", relation: "child", guardianConsent: false });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(() => { apiFetch<Profile[]>("/api/v1/profiles/family").then(setProfiles).catch(() => setError("Profil keluarga tidak dapat dimuat.")); }, []);
  useEffect(() => { load(); }, [load]);
  async function create(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { await apiMutate("/api/v1/profiles/family", "POST", form); setNotice("Profil keluarga ditambahkan."); setForm({ fullName: "", birthDate: "", sex: "female", relation: "child", guardianConsent: false }); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Profil tidak dapat dibuat."); }
  }
  async function deactivate(id: string, name: string) {
    if (!confirm(`Nonaktifkan profil ${name}? Data riwayatnya tetap tersimpan, tetapi profil tidak lagi tampil.`)) return;
    try { await apiMutate(`/api/v1/profiles/family/${id}`, "DELETE", undefined); setNotice("Profil dinonaktifkan."); load(); }
    catch { setError("Profil tidak dapat dinonaktifkan."); }
  }
  return (
    <> <PageHeader title="Keluargaku" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mt-2 text-ink-600">Kelola profil anggota keluarga yang Anda dampingi. Data anak hanya dibuat dengan persetujuan Anda sebagai orang tua/wali.</p>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <ul className="mt-6 flex flex-col gap-2">
        {profiles.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-4">
          <span><strong>{p.full_name}</strong> — {RELATION_LABEL[p.relation] ?? p.relation} • Lahir {p.birth_date}</span>
          <span className="flex flex-wrap gap-2">
            {p.relation === "child" ? <Link className="font-medium text-brand-700 underline" to="/tumbuh">Tumbuh Kembang</Link> : null}
            {p.relation === "elderly" ? <Link className="font-medium text-brand-700 underline" to="/lansia">Lansia</Link> : null}
            {p.sex === "female" ? <Link className="font-medium text-brand-700 underline" to="/perempuan">Perempuan</Link> : null}
            <Link className="font-medium text-brand-700 underline" to="/gizi">Gizi</Link>
            {p.relation !== "self" ? <Button variant="danger" onClick={() => deactivate(p.id, p.full_name)}>Nonaktifkan</Button> : null}
          </span></li>)}
      </ul>
      <section aria-labelledby="tambah" className="mt-10">
        <h2 id="tambah" className="text-xl font-bold">Tambah Anggota Keluarga</h2>
        <form onSubmit={create} className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Nama lengkap" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          <TextField label="Tanggal lahir" type="date" required value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="sex">Jenis kelamin</label>
            <select id="sex" className="min-h-12 rounded-btn border border-line bg-white px-3" value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
              <option value="female">Perempuan</option><option value="male">Laki-laki</option></select></div>
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="relation">Hubungan</label>
            <select id="relation" className="min-h-12 rounded-btn border border-line bg-white px-3" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
              <option value="child">Anak</option><option value="elderly">Lansia (orang tua)</option><option value="other_family">Keluarga lain</option></select></div>
          {form.relation === "child" ? <label className="flex min-h-11 items-start gap-2 sm:col-span-2">
            <input type="checkbox" className="mt-1" checked={form.guardianConsent} onChange={(e) => setForm({ ...form, guardianConsent: e.target.checked })} />
            <span>Saya adalah orang tua/wali anak ini dan menyetujui data kesehatannya dikelola pada akun saya. Persetujuan ini tercatat beserta waktunya.</span></label> : null}
          <div className="sm:col-span-2"><Button type="submit">Tambah Profil</Button></div>
        </form>
      </section>
    </main></>
  );
}
