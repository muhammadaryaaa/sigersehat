import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { RiskBadge } from "../components/ui/RiskBadge";
import { PageHeader } from "../components/ui/PageHeader";
import { Printer, Save } from "lucide-react";

type Instrument = { id: string; category: string; title: string; source_ref: string; rules: { questions: { key: string; text: string; type: string; options?: string[] }[] }; danger_questions: { key: string; text: string }[] };
type Result = { session_id?: string; stored?: boolean; risk_category: "rendah" | "sedang" | "tinggi"; has_danger_sign: boolean; findings: { key: string; label: string; value_text: string; category: string; explanation: string; source: string }[]; recommendations: string[]; disclaimer: string };
type GuestPayload = { instrumentId: string; category: string; measurements: Record<string, unknown>; answers: Record<string, string>; result: Result; at: string };

const GUEST_KEY = "siger_guest_screening";

// Meter risiko: tiga ruas terisi halus sesuai kategori (rendah 1, sedang 2, tinggi 3).
function RiskMeter({ level }: { level: "rendah" | "sedang" | "tinggi" }) {
  const filled = level === "rendah" ? 1 : level === "sedang" ? 2 : 3;
  const color = level === "tinggi" ? "bg-danger-700" : level === "sedang" ? "bg-warn-600" : "bg-brand-600";
  return (
    <div aria-label={`Tingkat risiko: ${level}`}>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-full transition-all duration-500 ${i <= filled ? color : "bg-line"}`} style={{ transitionDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <p className="mt-1.5 text-sm text-ink-500">Perkiraan tingkat risiko: <strong className="capitalize">{level}</strong> — bukan diagnosis.</p>
    </div>
  );
}

// Kalkulator IMT publik: dihitung di perangkat, tidak dikirim ke server.
// Klasifikasi sama dengan aturan Kemenkes yang dipakai mesin skrining.
function ImtCalculator() {
  const [tb, setTb] = useState(""); const [bb, setBb] = useState("");
  const h = Number(tb), w = Number(bb);
  const bmi = h > 0 && w > 0 ? Math.round((w / ((h / 100) ** 2)) * 10) / 10 : null;
  const cat = bmi === null ? null : bmi < 17 ? "Kurus (berat)" : bmi < 18.5 ? "Kurus (ringan)" : bmi <= 25 ? "Normal" : bmi <= 27 ? "Gemuk (ringan)" : "Gemuk (berat) / Obesitas";
  return (
    <section className="mt-8 rounded-card border border-line bg-white p-5 shadow-card" aria-labelledby="imt">
      <h2 id="imt" className="text-xl font-bold">Kalkulator Indeks Massa Tubuh (IMT)</h2>
      <p className="mt-1 text-[15px] text-ink-600">Hitung cepat tanpa akun. Hasil dihitung di perangkatmu dan tidak disimpan.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <TextField label="Tinggi badan" unit="cm" type="number" step="0.1" value={tb} onChange={(e) => setTb(e.target.value)} />
        <TextField label="Berat badan" unit="kg" type="number" step="0.1" value={bb} onChange={(e) => setBb(e.target.value)} />
      </div>
      {bmi !== null && cat ? <p className="mt-3 rounded-card bg-brand-50 p-3" aria-live="polite">IMT kamu <strong>{bmi.toLocaleString("id-ID")} kg/m²</strong> — kategori <strong>{cat}</strong> menurut klasifikasi Kemenkes RI. Ini informasi awal, bukan diagnosis.</p> : null}
    </section>
  );
}

export function ScreeningPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const guest = !me;
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selected, setSelected] = useState<Instrument | null>(null);
  const [step, setStep] = useState(0);
  const [mm, setMm] = useState({ heightCm: "", weightKg: "", systolic: "", diastolic: "", bloodSugarMgdl: "", sugarContext: "sewaktu", waistCm: "" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [guestSaved, setGuestSaved] = useState<GuestPayload | null>(null);
  const [transferMsg, setTransferMsg] = useState("");
  const profileId = me?.profile?.id ?? "";
  useEffect(() => { apiFetch<Instrument[]>("/api/v1/screening/instruments").then(setInstruments).catch(() => setError("Instrumen skrining tidak dapat dimuat.")); }, []);
  useEffect(() => {
    try { const raw = sessionStorage.getItem(GUEST_KEY); if (raw) setGuestSaved(JSON.parse(raw) as GuestPayload); } catch { /* abaikan */ }
  }, []);
  const setM = (k: string) => (e: { target: { value: string } }) => setMm({ ...mm, [k]: e.target.value });

  async function saveGuestResult() {
    if (!guestSaved || !profileId) return;
    setBusy(true); setTransferMsg("");
    try {
      const ins = instruments.find((i) => i.id === guestSaved.instrumentId) ?? instruments.find((i) => i.category === guestSaved.category);
      if (!ins) throw new Error("instrumen tidak ditemukan");
      const session = await apiMutate<{ session_id: string }>("/api/v1/screening/sessions", "POST", { profileId, instrumentId: ins.id });
      await apiMutate(`/api/v1/screening/sessions/${session.session_id}/complete`, "POST", { measurements: guestSaved.measurements, answers: guestSaved.answers, idempotencyKey: crypto.randomUUID() });
      sessionStorage.removeItem(GUEST_KEY); setGuestSaved(null);
      setTransferMsg("Hasil skrining tamu sudah disimpan ke akunmu dan masuk ke Pantau serta Riwayat.");
    } catch { setTransferMsg("Belum dapat menyimpan hasil tamu. Coba lagi dari halaman ini."); }
    finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    const numeric: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(mm)) if (k !== "sugarContext") numeric[k] = v === "" ? null : Number(v);
    const measurements = { ...numeric, sugarContext: mm.sugarContext };
    try {
      if (guest) {
        const res = await apiFetch<Result>("/api/v1/guest/screening", { method: "POST", body: JSON.stringify({ category: selected!.category, measurements, answers }) });
        setResult(res);
        try { sessionStorage.setItem(GUEST_KEY, JSON.stringify({ instrumentId: selected!.id, category: selected!.category, measurements, answers, result: res, at: new Date().toISOString() } satisfies GuestPayload)); } catch { /* abaikan */ }
      } else {
        const session = await apiMutate<{ session_id: string }>("/api/v1/screening/sessions", "POST", { profileId, instrumentId: selected!.id });
        const res = await apiMutate<Result>(`/api/v1/screening/sessions/${session.session_id}/complete`, "POST", { measurements, answers, idempotencyKey: crypto.randomUUID() });
        setResult(res);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Skrining tidak dapat diselesaikan. Periksa koneksi Anda lalu coba lagi.");
    } finally { setBusy(false); }
  }

  if (result) return (
    <>
      <PageHeader title="Hasil Skrining Awal" description={guest ? "Hasil tamu — dihitung tanpa disimpan di server." : "Hasil tersimpan di riwayat akunmu."} />
      <main className="route-enter mx-auto max-w-2xl px-4 py-8">
        {result.has_danger_sign ? <div role="alert" className="rounded-card border-l-4 border-danger-700 bg-danger-50 p-4">
          <p className="text-lg font-bold text-danger-700">Segera cari pertolongan medis</p>
          <p className="mt-1">Ada tanda bahaya atau nilai pengukuran yang sangat tinggi pada skrining ini. Segera ke IGD terdekat atau hubungi <strong>119</strong>.</p>
          <Link to="/peta" className="mt-2 inline-block font-semibold text-info-700 underline">Lihat fasilitas kesehatan terdekat</Link></div> : null}
        <div className="mt-4 flex flex-col gap-3">
          <RiskBadge level={result.risk_category} />
          <RiskMeter level={result.risk_category} />
        </div>
        <ul className="mt-5 flex flex-col gap-3">
          {result.findings.map((f) => <li key={f.key} className="rounded-card border border-line bg-white p-4">
            <p className="font-semibold">{f.label}: {f.value_text} — {f.category}</p>
            <p className="mt-1">{f.explanation}</p>
            <p className="mt-1 text-xs text-ink-500">Sumber: {f.source}</p></li>)}
        </ul>
        <h2 className="mt-6 text-xl font-bold">Langkah Tindak Lanjut</h2>
        <ol className="mt-2 list-decimal flex flex-col gap-1 pl-5">{result.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>
        <p className="mt-5 rounded-card bg-info-50 p-3 text-sm text-info-800">{result.disclaimer}</p>
        <div className="no-print mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => window.print()}><Printer size={16} aria-hidden="true" /> Cetak / Simpan PDF</Button>
          {guest ? <>
            <Button onClick={() => navigate("/daftar?next=/skrining")}>Simpan Hasil Ini — Buat Akun</Button>
            <Button variant="secondary" onClick={() => navigate("/tanya")}>Tanya AI tentang Hasil Ini</Button>
          </> : <>
            <Button onClick={() => navigate("/pantau")}>Lihat di Pantau</Button>
            <Button variant="secondary" onClick={() => navigate("/tanya")}>Jelaskan Hasil Ini (Tanya AI)</Button>
            <Button variant="secondary" onClick={() => navigate("/pengingat")}>Buat Pengingat Kontrol</Button>
          </>}
          <Button variant="secondary" onClick={() => navigate("/edukasi")}>Baca Edukasi Terkait</Button>
          <Button variant="secondary" onClick={() => { setResult(null); setSelected(null); setStep(0); }}>Skrining Lagi</Button>
        </div>
      </main>
    </>
  );

  if (!selected) return (
    <>
      <PageHeader title="Periksa Risiko" description="Skrining awal faktor risiko penyakit tidak menular dan risiko diabetes. Hasilnya perkiraan tingkat risiko untuk edukasi — bukan diagnosis. Dapat diisi tanpa akun; hasil tamu tidak disimpan di server." />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {!guest && guestSaved ? (
          <div className="route-enter mb-5 rounded-card border border-brand-600 bg-brand-50 p-4">
            <p className="font-bold text-brand-800">Kamu punya hasil skrining tamu</p>
            <p className="mt-1 text-[15px]">Kategori risiko: <strong className="capitalize">{guestSaved.result.risk_category}</strong>. Simpan ke akunmu agar masuk ke Pantau dan bisa dibandingkan nanti?</p>
            <div className="mt-3 flex gap-3">
              <Button onClick={saveGuestResult} disabled={busy}><Save size={16} aria-hidden="true" /> {busy ? "Menyimpan…" : "Simpan ke Akun"}</Button>
              <Button variant="secondary" onClick={() => { sessionStorage.removeItem(GUEST_KEY); setGuestSaved(null); }}>Buang</Button>
            </div>
            {transferMsg ? <p className="mt-2 text-sm" role="status">{transferMsg}</p> : null}
          </div>
        ) : null}
        {transferMsg && !guestSaved ? <p className="mb-4 rounded-card bg-brand-50 p-3 text-brand-800" role="status">{transferMsg}</p> : null}
        {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
        <ul className="flex flex-col gap-3">
          {instruments.map((i) => <li key={i.id}>
            <button className="card-hover w-full rounded-card border border-line bg-white p-5 text-left shadow-card" onClick={() => setSelected(i)}>
              <span className="text-lg font-bold">{i.title}</span>
              <span className="mt-1 block text-sm text-ink-600">Sumber aturan: {i.source_ref}</span>
            </button></li>)}
        </ul>
        <ImtCalculator />
      </main>
    </>
  );

  const questions = selected.rules.questions;
  return (
    <>
      <PageHeader title={selected.title} description={guest ? "Mode tamu: jawabanmu dihitung tanpa disimpan." : undefined} />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div aria-live="polite">
          <p className="text-sm text-ink-600">Langkah {step + 1} dari 3</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={step + 1} aria-valuemin={1} aria-valuemax={3}>
            <div className="h-full rounded-full bg-brand-700 transition-all duration-300" style={{ width: `${((step + 1) / 3) * 100}%` }} />
          </div>
        </div>
        <form onSubmit={submit} className="route-enter mt-6 flex flex-col gap-4" key={step}>
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
            <p className="text-sm text-ink-600">{guest ? "Periksa kembali isian Anda, lalu selesaikan skrining. Hasil tamu tidak disimpan di server — buat akun bila ingin menyimpannya." : "Periksa kembali isian Anda, lalu selesaikan skrining. Hasil akan tersimpan di riwayat dan pengukuran masuk ke Pantau."}</p>
          </> : null}
          {error ? <p role="alert" className="rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
          <div className="flex gap-3">
            {step > 0 ? <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : null}
            {step < 2 ? <Button type="button" onClick={() => setStep(step + 1)}>Lanjut</Button> : <Button type="submit" disabled={busy}>{busy ? "Memproses…" : "Selesaikan Skrining"}</Button>}
          </div>
        </form>
      </main>
    </>
  );
}
