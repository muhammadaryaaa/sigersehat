import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type Profile = { id: string; full_name: string; relation: string };
type Assessment = { value: number; z_score?: number; category?: string; status?: string; source_ref?: string } | null;
type GrowStatus = { age_months: number; assessment: { weight_for_age: Assessment; height_for_age: Assessment } | null; note?: string; disclaimer?: string; latest_measurement: { measured_at: string } | null };
type ImmItem = { vaccine_code: string; vaccine_name: string; dose_number: number; due_age_value: number; due_age_unit: string; status: string; record: { given_date: string } | null };
const STATUS_LABEL: Record<string, string> = { done: "Sudah diberikan", due: "Sudah waktunya", upcoming: "Belum waktunya", overdue: "Terlewat — segera susulkan" };

export function GrowPage() {
  const [children, setChildren] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [status, setStatus] = useState<GrowStatus | null>(null);
  const [imm, setImm] = useState<ImmItem[]>([]);
  const [form, setForm] = useState({ vaccineCode: "BCG", doseNumber: "1", givenDate: "", facilityName: "" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { apiFetch<Profile[]>("/api/v1/profiles/family").then((ps) => { const kids = ps.filter((p) => p.relation === "child"); setChildren(kids); if (kids.length) setProfileId(kids[0].id); }).catch(() => setError("Profil anak tidak dapat dimuat.")); }, []);
  const load = useCallback(() => {
    if (!profileId) return;
    apiFetch<GrowStatus>(`/api/v1/grow/${profileId}/status`).then(setStatus).catch((e) => setError(e instanceof ApiClientError ? e.message : "Status tumbuh kembang tidak dapat dimuat."));
    apiFetch<{ items: ImmItem[] }>(`/api/v1/grow/${profileId}/immunizations`).then((d) => setImm(d.items)).catch(() => {});
  }, [profileId]);
  useEffect(() => { load(); }, [load]);
  async function record(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { await apiMutate(`/api/v1/grow/${profileId}/immunizations`, "POST", { vaccineCode: form.vaccineCode, doseNumber: Number(form.doseNumber), givenDate: form.givenDate, facilityName: form.facilityName }); setNotice("Imunisasi tercatat."); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Imunisasi tidak dapat dicatat."); }
  }
  const assessCard = (title: string, a: Assessment, unit: string) => (
    <div className="rounded-card border border-line bg-white p-4">
      <h3 className="font-bold">{title}</h3>
      {a ? a.category ? <p className="mt-1">Nilai terakhir {a.value} {unit} • Skor Z {a.z_score} • <strong>{a.category}</strong></p>
        : <p className="mt-1 text-warn-800">{a.status}</p>
        : <p className="mt-1 text-ink-600">Belum ada data.</p>}
    </div>
  );
  return (
    <> <PageHeader title="Tumbuh Kembang Anak" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mt-2 text-ink-600">Penilaian memakai standar pertumbuhan di basis data (WHO 2006, rujukan Permenkes 2/2020) dan jadwal imunisasi Kepmenkes 1098/2024.</p>
      <div className="mt-4 flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="kid">Anak</label>
        <select id="kid" className="min-h-12 rounded-btn border border-line bg-white px-3" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {children.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select></div>
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {status ? <section aria-labelledby="nilai" className="mt-6">
        <h2 id="nilai" className="text-xl font-bold">Penilaian (usia {status.age_months} bulan)</h2>
        {status.assessment ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {assessCard("Berat Badan menurut Umur (BB/U)", status.assessment.weight_for_age, "kg")}
          {assessCard("Tinggi Badan menurut Umur (TB/U)", status.assessment.height_for_age, "cm")}
        </div> : <p className="mt-3 text-ink-600">{status.note}</p>}
        {status.disclaimer ? <p className="mt-3 text-sm text-ink-600">{status.disclaimer}</p> : null}
      </section> : null}
      <section aria-labelledby="imun" className="mt-10">
        <h2 id="imun" className="text-xl font-bold">Imunisasi</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {imm.map((i) => <li key={`${i.vaccine_code}-${i.dose_number}`} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-3">
            <span>{i.vaccine_name} — dosis {i.dose_number} (jadwal: {i.due_age_value} {i.due_age_unit === "day" ? "hari" : "bulan"})</span>
            <span className={i.status === "overdue" ? "font-semibold text-danger-700" : i.status === "done" ? "font-semibold text-brand-700" : "text-ink-600"}>{STATUS_LABEL[i.status]}{i.record ? ` • ${i.record.given_date}` : ""}</span></li>)}
        </ul>
        <form onSubmit={record} className="mt-5 grid gap-4 sm:grid-cols-2">
          <TextField label="Kode vaksin (HB0, BCG, POLIO, DPT-HB-Hib, PCV, RV, IPV, MR)" required value={form.vaccineCode} onChange={(e) => setForm({ ...form, vaccineCode: e.target.value })} />
          <TextField label="Dosis ke-" type="number" required value={form.doseNumber} onChange={(e) => setForm({ ...form, doseNumber: e.target.value })} />
          <TextField label="Tanggal diberikan" type="date" required value={form.givenDate} onChange={(e) => setForm({ ...form, givenDate: e.target.value })} />
          <TextField label="Fasilitas" value={form.facilityName} onChange={(e) => setForm({ ...form, facilityName: e.target.value })} />
          <div className="sm:col-span-2"><Button type="submit">Catat Imunisasi</Button></div>
        </form>
      </section>
    </main></>
  );
}
