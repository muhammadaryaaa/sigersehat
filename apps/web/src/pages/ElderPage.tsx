import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type Profile = { id: string; full_name: string; relation: string };
type Overview = { latest_measurement: { measured_at: string; systolic: number | null; diastolic: number | null; weight_kg: number | null } | null;
  medications: { id: string; medicine_name: string; dosage_text: string; frequency_text: string; times_json: string }[];
  targets: { id: string; metric: string; direction: string; target_value: number; unit: string }[];
  upcoming_reminders: { id: string; title: string; scheduled_at: string }[];
  last_screening: { risk_category: string; completed_at: string } | null };

export function ElderPage() {
  const [elders, setElders] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [data, setData] = useState<Overview | null>(null);
  const [form, setForm] = useState({ medicineName: "", dosageText: "", frequencyText: "", time1: "07:00", startDate: "" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { apiFetch<Profile[]>("/api/v1/profiles/family").then((ps) => { const es = ps.filter((p) => p.relation === "elderly"); setElders(es); if (es.length) setProfileId(es[0].id); }).catch(() => setError("Profil lansia tidak dapat dimuat.")); }, []);
  const load = useCallback(() => { if (profileId) apiFetch<Overview>(`/api/v1/elder/${profileId}/overview`).then(setData).catch(() => setError("Data lansia tidak dapat dimuat.")); }, [profileId]);
  useEffect(() => { load(); }, [load]);
  async function addMed(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { await apiMutate(`/api/v1/elder/${profileId}/medications`, "POST", { medicineName: form.medicineName, dosageText: form.dosageText, frequencyText: form.frequencyText, times: [form.time1], startDate: form.startDate });
      setNotice("Jadwal obat ditambahkan sesuai resep yang Anda masukkan."); setForm({ medicineName: "", dosageText: "", frequencyText: "", time1: "07:00", startDate: "" }); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Jadwal obat tidak dapat ditambahkan."); }
  }
  async function stopMed(id: string) {
    try { await apiMutate(`/api/v1/elder/${profileId}/medications/${id}/stop`, "POST", { reason: "Dihentikan sesuai instruksi dokter" }); setNotice("Jadwal obat dihentikan."); load(); }
    catch { setError("Jadwal obat tidak dapat dihentikan."); }
  }
  return (
    <> <PageHeader title="Kesehatan Lansia" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mt-2 text-ink-600">Ringkasan pengukuran, jadwal obat sesuai resep, target, dan pengingat untuk profil lansia yang Anda dampingi. Aktifkan mode lansia di Akun &amp; Sesi untuk teks lebih besar.</p>
      <div className="mt-4 flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="elder">Profil lansia</label>
        <select id="elder" className="min-h-12 rounded-btn border border-line bg-white px-3" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {elders.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select></div>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      {data ? <div className="mt-6 flex flex-col gap-4">
        <section className="rounded-card border border-line bg-white p-4" aria-labelledby="terakhir">
          <h2 id="terakhir" className="font-bold">Pengukuran Terakhir</h2>
          {data.latest_measurement ? <p className="mt-1">{data.latest_measurement.measured_at} — {data.latest_measurement.systolic ? `TD ${data.latest_measurement.systolic}/${data.latest_measurement.diastolic} mmHg` : ""}{data.latest_measurement.weight_kg ? ` • BB ${data.latest_measurement.weight_kg} kg` : ""}</p> : <p className="mt-1 text-ink-600">Belum ada pengukuran. Catat melalui SIGERMONITOR untuk profil ini.</p>}
          {data.last_screening ? <p className="mt-1">Skrining terakhir: kategori {data.last_screening.risk_category} ({data.last_screening.completed_at}).</p> : null}
        </section>
        <section className="rounded-card border border-line bg-white p-4" aria-labelledby="obat">
          <h2 id="obat" className="font-bold">Jadwal Obat Aktif (sesuai resep dokter)</h2>
          {data.medications.length ? <ul className="mt-2 flex flex-col gap-2">{data.medications.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{m.medicine_name} — {m.dosage_text}, {m.frequency_text}, pukul {JSON.parse(m.times_json).join(", ")}</span>
            <Button variant="danger" onClick={() => stopMed(m.id)}>Hentikan</Button></li>)}</ul>
            : <p className="mt-1 text-ink-600">Belum ada jadwal obat aktif.</p>}
          <form onSubmit={addMed} className="mt-4 grid gap-4 sm:grid-cols-2">
            <TextField label="Nama obat" required value={form.medicineName} onChange={(e) => setForm({ ...form, medicineName: e.target.value })} />
            <TextField label="Dosis sesuai resep" required value={form.dosageText} onChange={(e) => setForm({ ...form, dosageText: e.target.value })} placeholder="mis. 1 tablet 10 mg" />
            <TextField label="Frekuensi" required value={form.frequencyText} onChange={(e) => setForm({ ...form, frequencyText: e.target.value })} placeholder="mis. 1x sehari sesudah makan" />
            <TextField label="Jam minum" type="time" required value={form.time1} onChange={(e) => setForm({ ...form, time1: e.target.value })} />
            <TextField label="Tanggal mulai" type="date" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <div className="flex items-end"><Button type="submit">Tambah Jadwal Obat</Button></div>
          </form>
        </section>
        <section className="rounded-card border border-line bg-white p-4" aria-labelledby="target">
          <h2 id="target" className="font-bold">Target &amp; Pengingat</h2>
          {data.targets.length ? <ul className="mt-2">{data.targets.map((t) => <li key={t.id}>{t.metric}: {t.direction} {t.target_value} {t.unit}</li>)}</ul> : <p className="mt-1 text-ink-600">Belum ada target kesehatan aktif.</p>}
          {data.upcoming_reminders.length ? <ul className="mt-2">{data.upcoming_reminders.map((r) => <li key={r.id}>Pengingat: {r.title} — {r.scheduled_at}</li>)}</ul> : null}
        </section>
      </div> : null}
    </main></>
  );
}
