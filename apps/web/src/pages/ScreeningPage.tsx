import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { RiskBadge } from "../components/ui/RiskBadge";

type Instrument = { id: string; category: string; title: string; source_ref: string; rules: { questions: { key: string; text: string; type: string; options?: string[] }[] }; danger_questions: { key: string; text: string }[] };
type Result = { session_id: string; risk_category: "rendah" | "sedang" | "tinggi"; has_danger_sign: boolean; findings: { key: string; label: string; value_text: string; category: string; explanation: string; source: string }[]; recommendations: string[]; disclaimer: string };

export function ScreeningPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [step, setStep] = useState(0);
  const [mm, setMm] = useState({ heightCm: "", weightKg: "", systolic: "", diastolic: "", bloodSugarMgdl: "", sugarContext: "sewaktu", waistCm: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const profileId = me?.profile?.id ?? "";
  useEffect(() => { apiFetch<Instrument[]>("/api/v1/screening/instruments").then(setInstruments).catch(() => setError("Instrumen skrining tidak dapat dimuat.")); }, []);
  const setM = (k: string) => (e: { target: { value: string } }) => setMm({ ...mm, [k]: e.target.value });
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const session = await apiMutate<{ session_id: string }>("/api/v1/screening/sessions", "POST", { profileId, instrumentId: selected!.id });
      const numeric: Record<string, number | null> = {};
      for (const [k, v] of Object.entries(mm)) if (k !== "sugarContext") numeric[k] = v === "" ? null : Number(v);
      const res = await apiMutate<Result>(`/api/v1/screening/sessions/${session.session_id}/complete`, "POST", { measurements: { ...numeric, sugarContext: mm.sugarContext }, answers, idempotencyKey: crypto.randomUUID() });
      setResult(res);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Skrining tidak dapat diselesaikan.");
    } finally { setBusy(false); }
  }
  if (result) return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Hasil Skrining</h1>
      {result.has_danger_sign ? <div role="alert" className="mt-4 rounded-card border-l-4 border-danger-700 bg-danger-50 p-4">
        <p className="text-lg font-bold text-danger-700">Segera cari pertolongan medis</p>
        <p className="mt-1">Ada tanda bahaya atau nilai pengukuran yang sangat tinggi pada skrining ini. Segera ke IGD terdekat atau hubungi <strong>119</strong>.</p>
        <Link to="/peta" className="mt-2 inline-block font-semibold text-info-700 underline">Lihat fasilitas kesehatan terdekat</Link></div> : null}
      <div className="mt-4"><RiskBadge level={result.risk_category} /></div>
      <ul className="mt-5 flex flex-col gap-3">
        {result.findings.map((f) => <li key={f.key} className="rounded-card border border-line bg-white p-4">
          <p className="font-semibold">{f.label}: {f.value_text} — {f.category}</p>
          <p className="mt-1">{f.explanation}</p>
          <p className="mt-1 text-xs text-ink-500">Sumber: {f.source}</p></li>)}
      </ul>
      <h2 className="mt-6 text-xl font-bold">Langkah Tindak Lanjut</h2>
      <ol className="mt-2 list-decimal flex flex-col gap-1 pl-5">{result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
      <p className="mt-5 rounded-card bg-info-50 p-3 text-sm text-info-800">{result.disclaimer}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => navigate("/pantau")}>Lihat di Pantau</Button>
        <Button variant="secondary" onClick={() => navigate("/tanya")}>Jelaskan Hasil Ini (Tanya AI)</Button>
        <Button variant="secondary" onClick={() => navigate("/edukasi")}>Baca Edukasi Terkait</Button>
        <Button variant="secondary" onClick={() => navigate("/pengingat")}>Buat Pengingat Kontrol</Button>
        <Button variant="secondary" onClick={() => { setResult(null); setSelected(null); setStep(0); }}>Skrining Lagi</Button>
      </div>
    </main>
  );
  if (!selected) return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-3xl font-bold">Periksa Risiko</h1>
      <p className="mt-2 text-ink-600">Pilih jenis skrining. Hasilnya adalah perkiraan risiko awal, bukan diagnosis.</p>
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <ul className="mt-6 flex flex-col gap-3">
        {instruments.map((i) => <li key={i.id}>
          <button className="w-full rounded-card border border-line bg-white p-5 text-left hover:bg-brand-50" onClick={() => setSelected(i)}>
            <span className="text-lg font-bold">{i.title}</span>
            <span className="mt-1 block text-sm text-ink-600">Sumber aturan: {i.source_ref}</span>
          </button></li>)}
      </ul>
    </main>
  );
  const questions = selected.rules.questions;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-bold">{selected.title}</h1>
      <p className="mt-1 text-sm text-ink-600" aria-live="polite">Langkah {step + 1} dari 3</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        {step === 0 ? <>
          <TextField label="Tinggi badan" unit="cm" type="number" step="0.1" value={mm.heightCm} onChange={setM("heightCm")} />
          <TextField label="Berat badan" unit="kg" type="number" step="0.1" value={mm.weightKg} onChange={setM("weightKg")} />
          <TextField label="Tekanan darah sistolik" unit="mmHg" type="number" value={mm.systolic} onChange={setM("systolic")} />
          <TextField label="Tekanan darah diastolik" unit="mmHg" type="number" value={mm.diastolic} onChange={setM("diastolic")} />
          <TextField label="Gula darah (bila ada)" unit="mg/dL" type="number" value={mm.bloodSugarMgdl} onChange={setM("bloodSugarMgdl")} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="sugarContext">Konteks gula darah</label>
            <select id="sugarContext" className="min-h-12 rounded-btn border border-line bg-white px-3" value={mm.sugarContext} onChange={setM("sugarContext")}>
              <option value="sewaktu">Sewaktu</option><option value="puasa">Puasa</option><option value="2jam_pp">2 jam sesudah makan</option></select></div>
          <TextField label="Lingkar pinggang (bila ada)" unit="cm" type="number" step="0.1" value={mm.waistCm} onChange={setM("waistCm")} />
        </> : null}
        {step === 1 ? <>
          {questions.map((q) => <fieldset key={q.key} className="rounded-card border border-line bg-white p-4">
            <legend className="font-medium">{q.text}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {(q.type === "yesno" ? ["yes", "no"] : q.options ?? []).map((opt) => <label key={opt} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-btn border border-line px-3">
                <input type="radio" name={q.key} value={opt} checked={answers[q.key] === opt} onChange={() => setAnswers({ ...answers, [q.key]: opt })} />
                {q.type === "yesno" ? (opt === "yes" ? "Ya" : "Tidak") : opt}</label>)}
            </div></fieldset>)}
        </> : null}
        {step === 2 ? <>
          <fieldset className="rounded-card border border-line bg-white p-4">
            <legend className="font-medium">Apakah saat ini Anda mengalami salah satu tanda berikut?</legend>
            {selected.danger_questions.map((q) => <label key={q.key} className="mt-2 flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={answers[q.key] === "yes"} onChange={(e) => setAnswers({ ...answers, [q.key]: e.target.checked ? "yes" : "no" })} /> {q.text}</label>)}
          </fieldset>
          <p className="text-sm text-ink-600">Periksa kembali isian Anda, lalu selesaikan skrining. Hasil akan tersimpan di riwayat dan pengukuran masuk ke Pantau.</p>
        </> : null}
        {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
        <div className="flex gap-3">
          {step > 0 ? <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : null}
          {step < 2 ? <Button type="button" onClick={() => setStep(step + 1)}>Lanjut</Button> : <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Selesaikan Skrining"}</Button>}
        </div>
      </form>
    </main>
  );
}
