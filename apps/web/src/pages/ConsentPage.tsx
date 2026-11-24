import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";

type Nakes = { user_id: string; full_name: string; profession: string; workplace_name: string | null };
type Consent = { id: string; profile_name: string; grantee_name: string; status: string; granted_at: string };
type Profile = { id: string; full_name: string; relation: string };
export function ConsentPage() {
  const [nakes, setNakes] = useState<Nakes[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [form, setForm] = useState({ profileId: "", granteeUserId: "", canAddRecord: false });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(() => {
    apiFetch<Nakes[]>("/api/v1/nakes-directory").then(setNakes).catch(() => {});
    apiFetch<Consent[]>("/api/v1/consents").then(setConsents).catch(() => {});
    apiFetch<Profile[]>("/api/v1/profiles/family").then((ps) => { setProfiles(ps); if (ps.length) setForm((f) => ({ ...f, profileId: ps[0].id })); }).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  async function grant(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { await apiMutate("/api/v1/consents", "POST", form); setNotice("Persetujuan diberikan. Tenaga kesehatan kini dapat melihat profil sesuai cakupan yang Anda pilih."); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Persetujuan tidak dapat diberikan."); }
  }
  async function revoke(id: string) {
    try { await apiMutate(`/api/v1/consents/${id}/revoke`, "POST", {}); setNotice("Persetujuan dicabut. Akses tenaga kesehatan berhenti segera."); load(); }
    catch { setError("Persetujuan tidak dapat dicabut."); }
  }
  return (
    <> <PageHeader title="Izin &amp; Tenaga Kesehatan" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mt-2 text-ink-600">Tenaga kesehatan hanya dapat melihat data Anda bila Anda memberikan persetujuan di sini — dan hanya tenaga kesehatan yang sudah terverifikasi administrator yang tampil. Cabut kapan saja; akses berhenti seketika.</p>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <section aria-labelledby="aktif" className="mt-6">
        <h2 id="aktif" className="text-xl font-bold">Persetujuan Saya</h2>
        {consents.length ? <ul className="mt-3 flex flex-col gap-2">{consents.map((cn) => <li key={cn.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
          <span>{cn.profile_name} → {cn.grantee_name} • {cn.status} • sejak {cn.granted_at}</span>
          {cn.status === "active" ? <Button variant="danger" onClick={() => revoke(cn.id)}>Cabut Izin</Button> : null}</li>)}</ul>
          : <p className="mt-2 text-ink-600">Belum ada persetujuan. Data Anda tidak dapat dilihat tenaga kesehatan mana pun.</p>}
      </section>
      <section aria-labelledby="beri" className="mt-8">
        <h2 id="beri" className="text-xl font-bold">Berikan Persetujuan</h2>
        {nakes.length ? <form onSubmit={grant} className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="pf">Profil</label>
            <select id="pf" className="min-h-12 rounded-btn border border-line bg-white px-3" value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })}>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.relation})</option>)}</select></div>
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="nk">Tenaga kesehatan terverifikasi</label>
            <select id="nk" required className="min-h-12 rounded-btn border border-line bg-white px-3" value={form.granteeUserId} onChange={(e) => setForm({ ...form, granteeUserId: e.target.value })}>
              <option value="">Pilih tenaga kesehatan</option>
              {nakes.map((n) => <option key={n.user_id} value={n.user_id}>{n.full_name} — {n.profession}{n.workplace_name ? `, ${n.workplace_name}` : ""}</option>)}</select></div>
          <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={form.canAddRecord} onChange={(e) => setForm({ ...form, canAddRecord: e.target.checked })} />
            Izinkan juga menambahkan catatan &amp; pengukuran (bila tidak dicentang: hanya melihat)</label>
          <Button type="submit">Berikan Persetujuan</Button>
        </form> : <p className="mt-2 text-ink-600">Belum ada tenaga kesehatan terverifikasi pada sistem. Pendaftaran nakes diverifikasi administrator terlebih dahulu.</p>}
      </section>
    </main></>
  );
}
