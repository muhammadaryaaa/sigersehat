import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { PageHeader } from "../components/ui/PageHeader";

type Overview = { verification_status: string; profession: string | null; consented_patients: number; follow_up_due_today: number };
type Patient = { id: string; full_name: string; birth_date: string; sex: string };
type Detail = { profile: Patient; measurements: { id: string; measured_at: string; systolic: number | null; diastolic: number | null; weight_kg: number | null }[];
  screenings: { id: string; risk_category: string | null; completed_at: string | null; status: string }[];
  clinical_notes: { id: string; note_text: string; author_name: string; created_at: string }[];
  follow_up_tasks: { id: string; task_type: string; due_date: string; status: string; note: string | null }[] };

export function MedPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState("");
  const [taskForm, setTaskForm] = useState({ dueDate: "", note: "", articleSlug: "" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { apiFetch<Overview>("/api/v1/med/overview").then(setOverview).catch(() => setError("Ringkasan tidak dapat dimuat.")); }, []);
  const loadPatients = useCallback(() => { apiFetch<Patient[]>("/api/v1/med/patients").then(setPatients).catch(() => {}); }, []);
  useEffect(() => { if (overview?.verification_status === "verified") loadPatients(); }, [overview, loadPatients]);
  async function open(id: string) {
    setError("");
    try { setDetail(await apiFetch<Detail>(`/api/v1/med/patients/${id}`)); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Data pasien tidak dapat dibuka."); }
  }
  async function addNote(e: FormEvent) {
    e.preventDefault(); if (!detail) return;
    try { await apiMutate(`/api/v1/med/patients/${detail.profile.id}/notes`, "POST", { noteText: note }); setNote(""); setNotice("Catatan klinis tersimpan."); open(detail.profile.id); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Catatan tidak dapat disimpan."); }
  }
  async function addTask(e: FormEvent) {
    e.preventDefault(); if (!detail) return;
    try { await apiMutate(`/api/v1/med/patients/${detail.profile.id}/tasks`, "POST", { dueDate: taskForm.dueDate, note: taskForm.note, title: "Tindak lanjut dari tenaga kesehatan", articleSlug: taskForm.articleSlug || undefined });
      setNotice("Tindak lanjut dibuat; pasien menerima pengingat (dan rekomendasi artikel bila diisi)."); open(detail.profile.id); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Tindak lanjut tidak dapat dibuat."); }
  }
  if (overview && overview.verification_status !== "verified") return (
    <>
      <PageHeader title="Ruang Tenaga Kesehatan" description="Akses data pasien hanya terbuka untuk tenaga kesehatan terverifikasi dan hanya atas persetujuan aktif pasien." />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-card bg-warn-50 p-4 text-warn-800">
          Status kredensial Anda: <strong>{overview.verification_status}</strong>. Akses data pasien terbuka setelah administrator memverifikasi STR/SIP Anda. Selama menunggu, Anda tetap dapat memakai fitur masyarakat.
        </div>
      </main>
    </>
  );
  return (
    <>
      <PageHeader title="Ruang Tenaga Kesehatan" description="Pasien yang tampil hanya yang memberikan persetujuan aktif kepada Anda. Setiap pembukaan riwayat tercatat di audit log." />
      <main className="mx-auto max-w-3xl px-4 py-8">
      {overview ? <p className="mt-2 text-sm text-ink-600">Pasien ber-consent: {overview.consented_patients} • Tindak lanjut jatuh tempo: {overview.follow_up_due_today}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <ul className="mt-5 flex flex-col gap-2">
        {patients.map((p) => <li key={p.id}><button className="w-full rounded-card border border-line bg-white p-3 text-left" onClick={() => open(p.id)}>
          <strong>{p.full_name}</strong> — lahir {p.birth_date}</button></li>)}
      </ul>
      {!patients.length ? <p className="mt-4 text-ink-600">Belum ada pasien yang memberikan persetujuan kepada Anda.</p> : null}
      {detail ? <section aria-labelledby="pasien" className="mt-8">
        <h2 id="pasien" className="text-xl font-bold">{detail.profile.full_name}</h2>
        <h3 className="mt-4 font-bold">Pengukuran Terakhir</h3>
        {detail.measurements.slice(0, 5).map((m) => <p key={m.id} className="text-sm">{m.measured_at} — {m.systolic ? `TD ${m.systolic}/${m.diastolic}` : ""}{m.weight_kg ? ` BB ${m.weight_kg} kg` : ""}</p>)}
        <h3 className="mt-4 font-bold">Skrining</h3>
        {detail.screenings.map((s) => <p key={s.id} className="text-sm">{s.completed_at ?? "(belum selesai)"} — kategori {s.risk_category ?? "-"}</p>)}
        <h3 className="mt-4 font-bold">Catatan Klinis</h3>
        {detail.clinical_notes.map((n) => <p key={n.id} className="mt-1 rounded-card bg-surface p-3 text-sm"><strong>{n.author_name}</strong> ({n.created_at}): {n.note_text}</p>)}
        <form onSubmit={addNote} className="mt-3 flex flex-col gap-2">
          <TextField label="Catatan baru" required value={note} onChange={(e) => setNote(e.target.value)} />
          <Button type="submit">Simpan Catatan</Button>
        </form>
        <h3 className="mt-6 font-bold">Tindak Lanjut &amp; Edukasi Pasien</h3>
        {detail.follow_up_tasks.map((t) => <p key={t.id} className="text-sm">{t.due_date} — {t.task_type} ({t.status}){t.note ? `: ${t.note}` : ""}</p>)}
        <form onSubmit={addTask} className="mt-3 grid gap-3 sm:grid-cols-3">
          <TextField label="Tanggal tindak lanjut" type="date" required value={taskForm.dueDate} onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })} />
          <TextField label="Catatan tindak lanjut" value={taskForm.note} onChange={(e) => setTaskForm({ ...taskForm, note: e.target.value })} />
          <TextField label="Slug artikel edukasi (opsional)" value={taskForm.articleSlug} onChange={(e) => setTaskForm({ ...taskForm, articleSlug: e.target.value })} placeholder="mis. mengenal-hipertensi-dan-cara-mengendalikannya" />
          <div className="sm:col-span-3"><Button type="submit">Buat Tindak Lanjut</Button></div>
        </form>
      </section> : null}
      </main>
    </>
  );
}
