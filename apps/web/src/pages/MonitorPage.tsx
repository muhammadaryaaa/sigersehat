import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { TrendChart } from "../components/ui/TrendChart";

type Trend = { points: { measured_at: string; value: number }[]; summary: { count: number; first: number; last: number; min: number; max: number; avg: number; change: number } | null };
type Measurement = { id: string; measured_at: string; systolic: number | null; diastolic: number | null; weight_kg: number | null; blood_sugar_mgdl: number | null; bmi: number | null; source: string };
const METRIC_LABEL: Record<string, [string, string]> = { systolic: ["Tekanan Darah Sistolik", "mmHg"], weight: ["Berat Badan", "kg"], sugar: ["Gula Darah", "mg/dL"], bmi: ["IMT", "kg/m²"] };

export function MonitorPage() {
  const { me } = useAuth();
  const profileId = me?.profile?.id ?? "";
  const [metric, setMetric] = useState("systolic");
  const [trend, setTrend] = useState<Trend | null>(null);
  const [list, setList] = useState<Measurement[]>([]);
  const [form, setForm] = useState({ systolic: "", diastolic: "", weightKg: "", heightCm: "", bloodSugarMgdl: "" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!profileId) return;
    apiFetch<Trend>(`/api/v1/measurements/trends?profileId=${profileId}&metric=${metric}&days=365`).then(setTrend).catch(() => setError("Tren tidak dapat dimuat."));
    apiFetch<Measurement[]>(`/api/v1/measurements?profileId=${profileId}&limit=20`).then(setList).catch(() => {});
  }, [profileId, metric]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setNotice(""); setError("");
    const body: Record<string, unknown> = { profileId, idempotencyKey: crypto.randomUUID() };
    for (const [k, v] of Object.entries(form)) if (v !== "") body[k] = Number(v);
    try { await apiMutate("/api/v1/measurements", "POST", body); setNotice("Pengukuran tersimpan."); setForm({ systolic: "", diastolic: "", weightKg: "", heightCm: "", bloodSugarMgdl: "" }); load(); }
    catch (err) { setError(err instanceof ApiClientError ? err.message : "Pengukuran tidak dapat disimpan."); }
    finally { setBusy(false); }
  }
  async function correct(m: Measurement) {
    const input = prompt(`Ubah sistolik untuk pengukuran ${m.measured_at} (sekarang ${m.systolic ?? "-"}). Kosongkan untuk membatalkan.`, m.systolic ? String(m.systolic) : "");
    if (input === null || input === "") return;
    const reason = prompt("Alasan koreksi (mis. salah ketik):", "") ?? "";
    try { await apiMutate(`/api/v1/measurements/${m.id}`, "PUT", { systolic: Number(input), reason }); setNotice("Koreksi tersimpan dan tercatat di riwayat perubahan."); load(); }
    catch { setError("Koreksi tidak dapat disimpan."); }
  }
  const [label, unit] = METRIC_LABEL[metric];
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Catat &amp; Pantau</h1>
      <section aria-labelledby="tren" className="mt-6 rounded-card border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="tren" className="text-xl font-bold">Perkembangan {label}</h2>
          <label className="text-sm">Metrik <select className="ml-2 min-h-11 rounded-btn border border-line px-2" value={metric} onChange={(e) => setMetric(e.target.value)}>
            {Object.entries(METRIC_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select></label>
        </div>
        <div className="mt-4">{trend ? <TrendChart points={trend.points} unit={unit} label={label} /> : <p aria-live="polite">Memuat…</p>}</div>
        {trend?.summary ? <p className="mt-3 text-sm text-ink-600">Rata-rata {trend.summary.avg} {unit} • Terendah {trend.summary.min} • Tertinggi {trend.summary.max} • Perubahan {trend.summary.change > 0 ? "+" : ""}{trend.summary.change} {unit} dari pengukuran pertama periode ini.</p> : null}
      </section>
      <section aria-labelledby="catat" className="mt-8">
        <h2 id="catat" className="text-xl font-bold">Catat Pengukuran</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Sistolik" unit="mmHg" type="number" value={form.systolic} onChange={set("systolic")} />
          <TextField label="Diastolik" unit="mmHg" type="number" value={form.diastolic} onChange={set("diastolic")} />
          <TextField label="Berat badan" unit="kg" type="number" step="0.1" value={form.weightKg} onChange={set("weightKg")} />
          <TextField label="Tinggi badan" unit="cm" type="number" step="0.1" value={form.heightCm} onChange={set("heightCm")} />
          <TextField label="Gula darah" unit="mg/dL" type="number" value={form.bloodSugarMgdl} onChange={set("bloodSugarMgdl")} />
          <div className="flex items-end"><Button type="submit" disabled={busy}>{busy ? "Menyimpan…" : "Simpan Pengukuran"}</Button></div>
        </form>
        {notice ? <p role="status" className="mt-3 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
        {error ? <p role="alert" className="mt-3 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      </section>
      <section aria-labelledby="terbaru" className="mt-8">
        <h2 id="terbaru" className="text-xl font-bold">Pengukuran Terbaru</h2>
        {list.length ? <ul className="mt-3 flex flex-col gap-2">{list.map((m) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-4">
          <span>{m.measured_at} — {m.systolic ? `TD ${m.systolic}/${m.diastolic} mmHg` : ""}{m.weight_kg ? ` • BB ${m.weight_kg} kg` : ""}{m.blood_sugar_mgdl ? ` • Gula ${m.blood_sugar_mgdl} mg/dL` : ""} <span className="text-sm text-ink-500">({m.source === "screening" ? "Skrining" : m.source === "manual" ? "Manual" : m.source})</span></span>
          <Button variant="secondary" onClick={() => correct(m)}>Koreksi</Button></li>)}</ul>
          : <p className="mt-3 text-ink-600">Belum ada pengukuran tercatat. <a href="/skrining" className="font-semibold text-brand-800 underline">Mulai dari skrining pertama</a> atau catat pengukuran manual pada formulir di bawah.</p>}
      </section>
    </main>
  );
}
