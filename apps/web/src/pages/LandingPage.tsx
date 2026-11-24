import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
// Kerangka landing sesuai Tahap 3: tipografi + wordmark, tanpa foto hero, batasan dinyatakan di muka.
export function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-xl font-extrabold tracking-tight text-brand-800">SIGERSEHAT</p>
      <h1 className="mt-6 text-4xl font-extrabold leading-tight">Kenali risiko kesehatanmu lebih awal, pantau dengan tenang.</h1>
      <p className="mt-4 text-lg">Skrining risiko, pemantauan kesehatan, edukasi bersumber Kemenkes &amp; WHO, dan informasi fasilitas kesehatan terverifikasi untuk masyarakat Lampung.</p>
      <p className="mt-4 flex items-start gap-2 rounded-card bg-info-50 p-4 text-info-800"><ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" /> <span>SIGERSEHAT membantu pencegahan dan skrining awal. Hasil di platform ini <strong>bukan diagnosis</strong> dan tidak menggantikan pemeriksaan tenaga kesehatan.</span></p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/daftar" className="inline-flex min-h-12 items-center rounded-btn bg-brand-800 px-5 font-semibold text-white">Daftar</Link>
        <Link to="/peta" className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white px-5 font-semibold">Cari Fasilitas Kesehatan</Link>
      </div>
    </main>
  );
}
