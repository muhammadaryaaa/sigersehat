import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { PageHeader } from "../components/ui/PageHeader";

type UserRow = { id: string; email: string; full_name: string; role: string; status: string; verification_status: string | null };
type Pending = { user_id: string; full_name: string; email: string; profession: string; credential_type: string; credential_number: string; workplace_name: string | null };
type FacRow = { id: string; name: string; facility_type: string; verification_status: string; region_name: string };
type Report = { id: string; kind: string; description: string; created_at: string };
type Audit = { id: number; actor_name: string | null; actor_role: string; action: string; object_type: string; created_at: string };
type Source = { id: string; title: string; publisher: string; status: string };
type Instrument = { id: string; code: string; name: string; category: string; is_active: number };

export function AdminManagePage() {
  const { me } = useAuth();
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [facs, setFacs] = useState<FacRow[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [facForm, setFacForm] = useState({ name: "", address: "", regionId: "reg-1871", facilityType: "puskesmas", latitude: "", longitude: "", sourceName: "OpenStreetMap", sourceUrl: "" });
  const [srcForm, setSrcForm] = useState({ title: "", publisher: "", url: "", contentText: "", topicTags: "" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(() => {
    apiFetch<UserRow[]>("/api/v1/admin/users").then(setUsers).catch(() => {});
    apiFetch<Pending[]>("/api/v1/admin/verifications").then(setPending).catch(() => {});
    apiFetch<FacRow[]>("/api/v1/admin/facilities").then(setFacs).catch(() => {});
    apiFetch<Report[]>("/api/v1/admin/reports").then(setReports).catch(() => {});
    apiFetch<Audit[]>("/api/v1/admin/audit?limit=30").then(setAudit).catch(() => {});
    apiFetch<Source[]>("/api/v1/admin/ai-sources").then(setSources).catch(() => {});
    apiFetch<Instrument[]>("/api/v1/admin/screening-instruments").then(setInstruments).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setError(""); setNotice("");
    try { await fn(); setNotice(ok); load(); } catch (err) { setError(err instanceof ApiClientError ? err.message : "Tindakan gagal."); }
  };
  const TABS = [["users", "Pengguna"], ["nakes", "Verifikasi Nakes"], ["facilities", "Fasilitas"], ["content", "Konten & AI"], ["reports", "Laporan"], ["audit", "Audit Log"]] as const;
  return (
    <>
      <PageHeader title="Kelola Sistem" description="Halaman ini tidak menampilkan data kesehatan individu." />
      <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-ink-600">Konten edukasi dikelola di <Link className="font-semibold text-brand-700 underline" to="/admin/konten">Manajemen Konten</Link>.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Bagian pengelolaan">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full border px-4 py-2 text-sm font-medium ${tab === k ? "border-brand-600 bg-brand-50 text-brand-800" : "border-line bg-white"}`}>{label}</button>)}
      </div>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}

      {tab === "users" ? <ul className="mt-5 flex flex-col gap-2">{users.map((u) => <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
        <span><strong>{u.full_name}</strong> — {u.email} • {u.role} • {u.status}{u.verification_status ? ` • nakes: ${u.verification_status}` : ""}</span>
        <span className="flex gap-2">
          {u.role !== "super_admin" ? <Button variant="secondary" onClick={() => act(() => apiMutate(`/api/v1/admin/users/${u.id}/status`, "POST", { status: u.status === "active" ? "suspended" : "active" }), "Status pengguna diperbarui.")}>{u.status === "active" ? "Tangguhkan" : "Aktifkan"}</Button> : null}
          {me?.user.role === "super_admin" && u.role === "masyarakat" ? <Button variant="secondary" onClick={() => act(() => apiMutate(`/api/v1/admin/users/${u.id}/role`, "POST", { role: "admin" }), "Role diperbarui.")}>Jadikan Admin</Button> : null}
        </span></li>)}</ul> : null}

      {tab === "nakes" ? <ul className="mt-5 flex flex-col gap-2">{pending.length ? pending.map((p) => <li key={p.user_id} className="rounded-card border border-line bg-white p-3">
        <p><strong>{p.full_name}</strong> ({p.email}) — {p.profession}, {p.credential_type} {p.credential_number}{p.workplace_name ? `, ${p.workplace_name}` : ""}</p>
        <p className="mt-2 flex gap-2">
          <Button onClick={() => act(() => apiMutate(`/api/v1/admin/verifications/${p.user_id}`, "POST", { decision: "verified" }), "Tenaga kesehatan terverifikasi.")}>Verifikasi</Button>
          <Button variant="danger" onClick={() => { const reason = prompt("Alasan penolakan (wajib jelas):"); if (reason) act(() => apiMutate(`/api/v1/admin/verifications/${p.user_id}`, "POST", { decision: "rejected", reason }), "Pendaftaran ditolak dengan alasan tercatat."); }}>Tolak</Button>
        </p></li>) : <p className="text-ink-600">Tidak ada pendaftaran menunggu verifikasi.</p>}</ul> : null}

      {tab === "facilities" ? <div className="mt-5">
        <ul className="flex flex-col gap-2">{facs.map((f) => <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
          <span><strong>{f.name}</strong> — {f.facility_type} • {f.region_name} • {f.verification_status}</span>
          {f.verification_status !== "verified" ? <Button onClick={() => act(() => apiMutate(`/api/v1/admin/facilities/${f.id}/verify`, "POST", { status: "verified" }), "Fasilitas terverifikasi dan tampil publik.")}>Verifikasi</Button> : null}
        </li>)}</ul>
        <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); act(() => apiMutate("/api/v1/admin/facilities", "POST", { ...facForm, latitude: Number(facForm.latitude), longitude: Number(facForm.longitude) }), "Fasilitas dibuat (pending) — verifikasi sebelum tampil publik."); }}>
          <TextField label="Nama fasilitas" required value={facForm.name} onChange={(e) => setFacForm({ ...facForm, name: e.target.value })} />
          <TextField label="Alamat" required value={facForm.address} onChange={(e) => setFacForm({ ...facForm, address: e.target.value })} />
          <TextField label="Lintang" required value={facForm.latitude} onChange={(e) => setFacForm({ ...facForm, latitude: e.target.value })} />
          <TextField label="Bujur" required value={facForm.longitude} onChange={(e) => setFacForm({ ...facForm, longitude: e.target.value })} />
          <TextField label="Nama sumber data" required value={facForm.sourceName} onChange={(e) => setFacForm({ ...facForm, sourceName: e.target.value })} />
          <TextField label="URL sumber" value={facForm.sourceUrl} onChange={(e) => setFacForm({ ...facForm, sourceUrl: e.target.value })} />
          <div className="sm:col-span-2"><Button type="submit">Tambah Fasilitas (Pending)</Button></div>
        </form></div> : null}

      {tab === "content" ? <div className="mt-5">
        <h2 className="font-bold">Instrumen Skrining</h2>
        <ul className="mt-2 flex flex-col gap-2">{instruments.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
          <span>{i.name} ({i.category}) — {i.is_active ? "aktif" : "nonaktif"}</span>
          <Button variant="secondary" onClick={() => act(() => apiMutate(`/api/v1/admin/screening-instruments/${i.id}/active`, "POST", { active: !i.is_active }), "Status instrumen diperbarui.")}>{i.is_active ? "Nonaktifkan" : "Aktifkan"}</Button></li>)}</ul>
        <h2 className="mt-6 font-bold">Sumber Pengetahuan SIGERAI</h2>
        <ul className="mt-2 flex flex-col gap-2">{sources.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
          <span>{s.title} — {s.publisher} • {s.status}</span>
          {s.status !== "active" ? <Button variant="secondary" onClick={() => act(() => apiMutate(`/api/v1/admin/ai-sources/${s.id}/status`, "POST", { status: "active" }), "Sumber diaktifkan untuk retrieval.")}>Aktifkan</Button> : null}
        </li>)}</ul>
        <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); act(() => apiMutate("/api/v1/admin/ai-sources", "POST", srcForm), "Sumber dibuat sebagai draft dengan penelaah tercatat."); }}>
          <TextField label="Judul sumber" required value={srcForm.title} onChange={(e) => setSrcForm({ ...srcForm, title: e.target.value })} />
          <TextField label="Penerbit" required value={srcForm.publisher} onChange={(e) => setSrcForm({ ...srcForm, publisher: e.target.value })} />
          <TextField label="URL" value={srcForm.url} onChange={(e) => setSrcForm({ ...srcForm, url: e.target.value })} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="srcBody">Isi sumber (teks resmi)</label>
            <textarea id="srcBody" required rows={5} className="rounded-btn border border-line bg-white px-3 py-2" value={srcForm.contentText} onChange={(e) => setSrcForm({ ...srcForm, contentText: e.target.value })} /></div>
          <Button type="submit">Tambah Sumber (Draft)</Button>
        </form></div> : null}

      {tab === "reports" ? <ul className="mt-5 flex flex-col gap-2">{reports.length ? reports.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
        <span><strong>{r.kind}</strong> — {r.description} <span className="text-ink-500">({r.created_at})</span></span>
        <Button variant="secondary" onClick={() => act(() => apiMutate(`/api/v1/admin/reports/${r.kind}/${r.id}/resolve`, "POST", {}), "Laporan ditandai selesai ditangani.")}>Tangani</Button></li>)
        : <p className="text-ink-600">Tidak ada laporan terbuka.</p>}</ul> : null}

      {tab === "audit" ? <ol className="mt-5 flex flex-col gap-1 text-sm">{audit.map((a) => <li key={a.id} className="rounded-card border border-line bg-white p-2">
        {a.created_at} — {a.actor_name ?? "(sistem)"} ({a.actor_role}) — {a.action} pada {a.object_type}</li>)}</ol> : null}
    </main>
    </>
  );
}
