import { useEffect, useState, type FormEvent } from "react";
import { apiFetch } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { PageHeader } from "../components/ui/PageHeader";
import { apiFetch as rawFetch } from "../lib/api";

type Session = { id: string; device_label: string | null; ip_address: string | null; created_at: string; expires_at: string; is_current: boolean; is_active: boolean };
export function AccountPage() {
  const { me, refresh } = useAuth();
  const [form, setForm] = useState({ fullName: "", birthDate: "", sex: "female", phone: "" });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => {
    apiFetch<{ profile: Record<string, string> }>("/api/v1/profiles/me").then((d) => setForm({ fullName: d.profile.full_name ?? "", birthDate: d.profile.birth_date ?? "", sex: d.profile.sex ?? "female", phone: me?.user.phone ?? "" })).catch(() => {});
    loadSessions();
  }, []);
  async function loadSessions() { try { setSessions(await apiFetch<Session[]>("/api/v1/auth/sessions")); } catch { /* abaikan: keadaan dibersihkan di bawah */ } }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice(""); setError("");
    try { await apiMutate("/api/v1/profiles/me", "PUT", form); setNotice("Profil tersimpan."); await refresh(); }
    catch { setError("Profil tidak dapat disimpan."); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    try { await apiMutate(`/api/v1/auth/sessions/${id}`, "DELETE"); setNotice("Sesi dicabut."); loadSessions(); }
    catch { setError("Sesi tidak dapat dicabut."); }
  }
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  const [delPassword, setDelPassword] = useState(""); const [delConfirm, setDelConfirm] = useState(false);
  async function exportData() {
    setError(""); setNotice("");
    try {
      const data = await rawFetch<Record<string, unknown>>("/api/v1/auth/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "data-sigersehat-saya.json"; a.click();
      URL.revokeObjectURL(url); setNotice("Data kamu diunduh sebagai berkas JSON.");
    } catch { setError("Ekspor data gagal. Coba lagi."); }
  }
  async function deleteAccount(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      await apiMutate("/api/v1/auth/account", "DELETE", { password: delPassword });
      await refresh(); window.location.href = "/";
    } catch { setError("Penghapusan gagal — periksa kata sandimu."); setBusy(false); }
  }
  return (
    <>
    <PageHeader title="Akun & Sesi" description={`${me?.user.email ?? ""} — peran: ${me?.user.role ?? ""}`} />
    <main className="mx-auto max-w-2xl px-4 py-8">
      <section className="mt-8"><h2 className="text-xl font-bold">Profil Saya</h2>
        <form onSubmit={save} className="mt-4 flex flex-col gap-4">
          <TextField label="Nama lengkap" required value={form.fullName} onChange={set("fullName")} />
          <TextField label="Tanggal lahir" type="date" required value={form.birthDate} onChange={set("birthDate")} />
          <TextField label="Nomor telepon" type="tel" value={form.phone} onChange={set("phone")} />
          {notice ? <p role="status" className="rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
          {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
          <Button type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Profil"}</Button>
        </form></section>
      <section className="mt-10"><h2 className="text-xl font-bold">Sesi Perangkat</h2>
        <ul className="mt-4 flex flex-col gap-2">
          {sessions.map((s) => <li key={s.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
            <div><p className="font-medium">{s.is_current ? "Perangkat ini" : (s.device_label ?? "Perangkat lain")} {s.is_active ? "" : "(tidak aktif)"}</p>
              <p className="text-sm text-ink-600">Masuk {s.created_at} — berlaku s.d. {s.expires_at}</p></div>
            {s.is_active && !s.is_current ? <Button variant="danger" onClick={() => revoke(s.id)}>Cabut</Button> : null}
          </li>)}
        </ul></section>
      <section className="mt-10"><h2 className="text-xl font-bold">Data Saya</h2>
        <p className="mt-2 text-ink-600">Unduh seluruh data yang tersimpan di akunmu (profil, pengukuran, skrining, pengingat, persetujuan) sebagai berkas JSON — untuk disimpan atau dibawa ke tenaga kesehatan.</p>
        <div className="mt-3"><Button variant="secondary" onClick={exportData}>Ekspor Data Saya</Button></div>
      </section>
      <section className="mt-10 rounded-card border border-danger-700/40 bg-danger-50 p-5"><h2 className="text-xl font-bold text-danger-700">Hapus Akun dan Seluruh Data</h2>
        <p className="mt-2">Penghapusan bersifat permanen: seluruh profil, pengukuran, hasil skrining, pengingat, dan percakapan AI dihapus; akun dinonaktifkan dan disamarkan. Catatan audit keamanan disimpan dalam bentuk tersamar sesuai kebijakan privasi. Tindakan ini tidak dapat dibatalkan.</p>
        <form onSubmit={deleteAccount} className="mt-4 flex flex-col gap-3">
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={delConfirm} onChange={(e) => setDelConfirm(e.target.checked)} /> Saya memahami dan ingin menghapus akun beserta seluruh data saya.</label>
          <TextField label="Kata sandi untuk konfirmasi" type="password" autoComplete="current-password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} />
          <div><Button type="submit" variant="danger" disabled={busy || !delConfirm || !delPassword}>{busy ? "Menghapus…" : "Hapus Akun Saya Permanen"}</Button></div>
        </form>
      </section>
    </main>
    </>
  );
}
