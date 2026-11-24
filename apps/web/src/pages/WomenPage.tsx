import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type Profile = { id: string; full_name: string; sex: string; relation: string };
type CycleData = { records: { id: string; period_start_date: string; period_end_date: string | null; cycle_length_days: number | null; symptoms: string | null }[]; summary: { average_cycle_days: number | null; predicted_next_period: string | null; estimated_ovulation: string | null; estimated_fertile_window: { from: string; to: string } | null; basis: string; note: string } };
type Pregnancy = { id: string; hpht_date: string; estimated_due_date: string; status: string; gestational_age_weeks: number | null };
type Visit = { id: string; visit_number: number; scheduled_date: string | null; actual_date: string | null; facility_name: string | null };

export function WomenPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [cycles, setCycles] = useState<CycleData | null>(null);
  const [pregnancies, setPregnancies] = useState<Pregnancy[]>([]);
  const [visits, setVisits] = useState<Record<string, Visit[]>>({});
  const [cycleForm, setCycleForm] = useState({ periodStartDate: "", periodEndDate: "", symptoms: "" });
  const [hpht, setHpht] = useState("");
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { apiFetch<Profile[]>("/api/v1/profiles/family").then((ps) => { const females = ps.filter((p) => p.sex === "female"); setProfiles(females); if (females.length) setProfileId(females[0].id); }).catch(() => setError("Profil tidak dapat dimuat.")); }, []);
  const load = useCallback(() => {
    if (!profileId) return;
    apiFetch<CycleData>(`/api/v1/women/cycles?profileId=${profileId}`).then(setCycles).catch(() => {});
    apiFetch<Pregnancy[]>(`/api/v1/women/pregnancies?profileId=${profileId}`).then(async (ps) => {
      setPregnancies(ps);
      const map: Record<string, Visit[]> = {};
      for (const p of ps) map[p.id] = await apiFetch<Visit[]>(`/api/v1/women/pregnancies/${p.id}/visits`).catch(() => []);
      setVisits(map);
    }).catch(() => {});
  }, [profileId]);
  useEffect(() => { load(); }, [load]);
  async function addCycle(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { await apiMutate("/api/v1/women/cycles", "POST", { profileId, ...cycleForm }); setNotice("Siklus tercatat."); setCycleForm({ periodStartDate: "", periodEndDate: "", symptoms: "" }); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Siklus tidak dapat dicatat."); }
  }
  async function addPregnancy(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { const r = await apiMutate<{ estimated_due_date: string }>("/api/v1/women/pregnancies", "POST", { profileId, hphtDate: hpht }); setNotice(`Kehamilan tercatat. Perkiraan tanggal persalinan: ${r.estimated_due_date} (aturan Naegele, dikonfirmasi lewat pemeriksaan).`); setHpht(""); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Kehamilan tidak dapat dicatat."); }
  }
  async function addVisit(p: Pregnancy) {
    const num = prompt("Nomor kunjungan ANC (1-6):", String((visits[p.id]?.length ?? 0) + 1));
    if (!num) return;
    const date = prompt("Tanggal dijadwalkan (TTTT-BB-HH), kosongkan bila belum terjadwal:", "");
    try { const r = await apiMutate<{ reminder_id: string | null }>(`/api/v1/women/pregnancies/${p.id}/visits`, "POST", { visitNumber: Number(num), scheduledDate: date || null });
      setNotice(r.reminder_id ? "Kunjungan dijadwalkan dan pengingat otomatis dibuat di SIGERREMINDER." : "Kunjungan dicatat."); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Kunjungan tidak dapat dicatat."); }
  }
  async function completeVisit(p: Pregnancy, v: Visit) {
    try { await apiMutate(`/api/v1/women/pregnancies/${p.id}/visits/${v.id}/complete`, "POST", {}); setNotice("Kunjungan ditandai selesai."); load(); }
    catch { setError("Kunjungan tidak dapat diselesaikan."); }
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Kesehatan Perempuan</h1>
      <p className="mt-2 text-ink-600">Data siklus dan kehamilan bersifat privat: hanya tampil untuk pemilik profil dan tidak muncul di ringkasan keluarga.</p>
      <div className="mt-4 flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="wp">Profil perempuan</label>
        <select id="wp" className="min-h-12 rounded-btn border border-line bg-white px-3" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.relation})</option>)}
        </select></div>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <section aria-labelledby="siklus" className="mt-8">
        <h2 id="siklus" className="text-xl font-bold">Siklus Haid</h2>
        {cycles?.summary.predicted_next_period ? <div className="mt-3 rounded-card bg-info-50 p-4 text-info-800">
          <p>Perkiraan haid berikutnya: <strong>{cycles.summary.predicted_next_period}</strong></p>
          <p className="mt-1">Perkiraan ovulasi: {cycles.summary.estimated_ovulation}; masa subur perkiraan: {cycles.summary.estimated_fertile_window?.from} s.d. {cycles.summary.estimated_fertile_window?.to}.</p>
          <p className="mt-1 text-sm">Dasar: {cycles.summary.basis}. {cycles.summary.note}</p></div>
          : <p className="mt-3 text-ink-600">Catat minimal satu siklus untuk melihat perkiraan. Perkiraan awal memakai asumsi umum 28 hari dan dinyatakan sebagai asumsi.</p>}
        <form onSubmit={addCycle} className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextField label="Mulai haid" type="date" required value={cycleForm.periodStartDate} onChange={(e) => setCycleForm({ ...cycleForm, periodStartDate: e.target.value })} />
          <TextField label="Selesai haid" type="date" value={cycleForm.periodEndDate} onChange={(e) => setCycleForm({ ...cycleForm, periodEndDate: e.target.value })} />
          <TextField label="Gejala (opsional)" value={cycleForm.symptoms} onChange={(e) => setCycleForm({ ...cycleForm, symptoms: e.target.value })} />
          <div className="sm:col-span-3"><Button type="submit">Catat Siklus</Button></div>
        </form>
        {cycles?.records.length ? <ul className="mt-4 flex flex-col gap-2">{cycles.records.map((r) => <li key={r.id} className="rounded-card border border-line bg-white p-3">{r.period_start_date}{r.period_end_date ? ` s.d. ${r.period_end_date}` : ""}{r.cycle_length_days ? ` • siklus ${r.cycle_length_days} hari` : ""}{r.symptoms ? ` • ${r.symptoms}` : ""}</li>)}</ul> : null}
      </section>
      <section aria-labelledby="hamil" className="mt-10">
        <h2 id="hamil" className="text-xl font-bold">Kehamilan &amp; Kunjungan ANC</h2>
        <form onSubmit={addPregnancy} className="mt-4 flex flex-wrap items-end gap-3">
          <TextField label="HPHT (hari pertama haid terakhir)" type="date" required value={hpht} onChange={(e) => setHpht(e.target.value)} />
          <Button type="submit">Catat Kehamilan</Button>
        </form>
        <p className="mt-2 text-sm text-ink-600">Standar Kemenkes: minimal 6 kali kunjungan ANC selama kehamilan (Permenkes 21/2021).</p>
        {pregnancies.map((p) => <div key={p.id} className="mt-4 rounded-card border border-line bg-white p-4">
          <p><strong>HPHT {p.hpht_date}</strong> • Perkiraan persalinan {p.estimated_due_date} • Status {p.status}{p.gestational_age_weeks !== null ? ` • Usia kehamilan ± ${p.gestational_age_weeks} minggu` : ""}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {(visits[p.id] ?? []).map((v) => <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>Kunjungan {v.visit_number}: {v.actual_date ? `selesai ${v.actual_date}` : v.scheduled_date ? `terjadwal ${v.scheduled_date}` : "belum terjadwal"}</span>
              {!v.actual_date ? <Button variant="secondary" onClick={() => completeVisit(p, v)}>Tandai Selesai</Button> : null}</li>)}
          </ul>
          <Button variant="secondary" onClick={() => addVisit(p)}>Tambah Kunjungan</Button>
        </div>)}
      </section>
    </main>
  );
}
