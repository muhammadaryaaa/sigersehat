import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDate, formatDateTime } from "../lib/format";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Activity, ArrowRight, Bell, BookOpen, ClipboardCheck, Heart, MapPin, MessagesSquare, Send, Users } from "lucide-react";
import { TrendChart } from "../components/ui/TrendChart";

type Dash = {
  profile: { id: string; full_name: string };
  latest_measurement: Record<string, unknown> | null;
  recent_measurements: Record<string, unknown>[];
  next_reminders: { id: string; title: string; scheduled_at: string }[];
  unread_notifications: number;
  family_profiles: { id: string; relation: string; full_name: string }[];
  last_screening: { risk_category: string; completed_at: string } | null;
};
type Trend = { metric: string; unit: string; points: { measured_at: string; value: number }[] };
type Article = { slug: string; title: string; category: string; published_at: string };
type Facility = { id: string; name: string; facility_type: string; region_name?: string };
type Stats = { total: number };

const RISK_STYLE: Record<string, { label: string; ring: string; text: string }> = {
  rendah: { label: "Rendah", ring: "#1e9e62", text: "text-health-700" },
  sedang: { label: "Sedang", ring: "#d97706", text: "text-warn-700" },
  tinggi: { label: "Tinggi", ring: "#b91c1c", text: "text-danger-700" },
};
const QUICK = [
  { to: "/skrining", icon: ClipboardCheck, label: "Cek Kesehatan Mandiri", bg: "#e8f1fd", fg: "#175db4" },
  { to: "/pantau", icon: Activity, label: "Pantau Kesehatan", bg: "#e6f6ec", fg: "#177a4c" },
  { to: "/edukasi", icon: BookOpen, label: "Akses Edukasi", bg: "#f0eafd", fg: "#6d28d9" },
  { to: "/peta", icon: MapPin, label: "Cari Fasilitas Kesehatan", bg: "#fdf0e2", fg: "#b45309" },
  { to: "/tanya", icon: MessagesSquare, label: "Tanya AI Assistant", bg: "#e2f5f2", fg: "#0f766e" },
];
const AI_CHIPS = ["Bagaimana cara menjaga kesehatan jantung?", "Apa saja tanda-tanda tekanan darah tinggi?", "Tips hidup sehat di Lampung?"];

export function DashboardMasyarakat() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Dash | null>(null);
  const [trend, setTrend] = useState<Trend | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facTotal, setFacTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  useEffect(() => { apiFetch<Dash>("/api/v1/dashboard/masyarakat").then(setData).catch(() => setError("Data beranda tidak dapat dimuat. Coba muat ulang halaman.")); }, []);
  useEffect(() => {
    if (!data) return;
    apiFetch<Trend>(`/api/v1/measurements/trends?profileId=${data.profile.id}&metric=systolic&days=30`).then(setTrend).catch(() => {});
  }, [data]);
  useEffect(() => {
    apiFetch<Article[]>("/api/v1/edu/articles?limit=3").then(setArticles).catch(() => {});
    apiFetch<Facility[]>("/api/v1/facilities?limit=3").then(setFacilities).catch(() => {});
    apiFetch<Stats>("/api/v1/facilities/stats").then((s) => setFacTotal(s.total)).catch(() => {});
  }, []);
  function askAi(e: FormEvent) { e.preventDefault(); if (question.trim()) navigate(`/tanya?q=${encodeURIComponent(question.trim())}`); }
  const lm = data?.latest_measurement;
  const risk = data?.last_screening ? RISK_STYLE[data.last_screening.risk_category] ?? RISK_STYLE.sedang : null;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">Beranda SIGERSEHAT</h1>
      {error ? <p role="alert" className="rounded-card bg-danger-50 p-4 text-danger-700">{error}</p> : null}
      {!data && !error ? <div className="skeleton h-64 w-full" aria-label="Memuat beranda" /> : null}
      {data ? <>
        <div className="grid gap-4 xl:grid-cols-3">
          <section aria-label="Sambutan" className="relative overflow-hidden rounded-card shadow-card xl:col-span-2">
            <img src="/images/menara-siger-1380.webp" srcSet="/images/menara-siger-480.webp 480w, /images/menara-siger-960.webp 960w, /images/menara-siger-1380.webp 1380w" sizes="(max-width: 1280px) 100vw, 900px" width={1380} height={480} alt="Menara Siger, landmark Provinsi Lampung" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/85 to-white/10" />
            <div className="relative max-w-xl p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-wider text-brand-700">SIGERSEHAT</p>
              <p className="mt-1.5 font-display text-3xl font-bold leading-tight text-ink-900 sm:text-4xl">Sehat Hari Ini,<br />Lampung Lebih Baik</p>
              <p className="mt-3 text-ink-600">Selamat datang, <strong className="text-ink-900">{me?.profile?.full_name ?? data.profile.full_name}</strong>. Platform kesehatan digital terintegrasi untuk masyarakat Lampung yang lebih sehat dan preventif.</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to="/skrining" className="inline-flex min-h-12 items-center gap-2 rounded-btn bg-brand-600 px-5 font-semibold text-white shadow-card">Mulai Cek Kesehatan <ArrowRight size={17} aria-hidden="true" /></Link>
                <Link to="/pantau" className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white/95 px-5 font-semibold text-ink-900">Catat Pengukuran</Link>
              </div>
            </div>
          </section>
          <section aria-labelledby="ringkasan" className="rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="ringkasan" className="font-bold">Ringkasan Kesehatan Anda</h2>
              <Link to="/pantau" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Detail <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            {data.last_screening && risk ? (
              <div className="mt-4 flex items-center gap-4">
                <svg viewBox="0 0 96 96" className="h-24 w-24 shrink-0" role="img" aria-label={`Kategori risiko skrining terakhir: ${risk.label}`}>
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#e6edf3" strokeWidth="10" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke={risk.ring} strokeWidth="10" strokeLinecap="round" strokeDasharray="251.3" strokeDashoffset="42" transform="rotate(-90 48 48)" />
                  <text x="48" y="53" textAnchor="middle" fontSize="15" fontWeight="700" fill="#152a42">{risk.label}</text>
                </svg>
                <div>
                  <p className="text-sm text-ink-500">Status skrining terakhir</p>
                  <p className={`text-lg font-bold ${risk.text}`}>Risiko {risk.label}</p>
                  <p className="text-sm text-ink-500">{formatDate(data.last_screening.completed_at)} · hasil edukatif, bukan diagnosis</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-card bg-brand-50 p-3.5 text-sm text-ink-600">Kamu belum pernah skrining. <Link to="/skrining" className="font-bold text-brand-700 underline">Mulai skrining pertamamu</Link> untuk melihat ringkasan risikomu di sini.</p>
            )}
            {lm ? (
              <dl className="mt-4 flex flex-col divide-y divide-line border-t border-line">
                {num(lm.systolic) !== null ? <div className="flex items-center gap-3 py-2.5"><Heart size={18} aria-hidden="true" className="text-danger-700" /><dt className="text-ink-600">Tekanan Darah</dt><dd className="ml-auto font-bold tabular-nums">{num(lm.systolic)}/{num(lm.diastolic)} mmHg</dd></div> : null}
                {num(lm.heart_rate_bpm) !== null ? <div className="flex items-center gap-3 py-2.5"><Activity size={18} aria-hidden="true" className="text-danger-700" /><dt className="text-ink-600">Detak Jantung</dt><dd className="ml-auto font-bold tabular-nums">{num(lm.heart_rate_bpm)} bpm</dd></div> : null}
                {num(lm.blood_sugar_mgdl) !== null ? <div className="flex items-center gap-3 py-2.5"><ClipboardCheck size={18} aria-hidden="true" className="text-brand-700" /><dt className="text-ink-600">Gula Darah</dt><dd className="ml-auto font-bold tabular-nums">{num(lm.blood_sugar_mgdl)} mg/dL</dd></div> : null}
                {num(lm.bmi) !== null ? <div className="flex items-center gap-3 py-2.5"><Users size={18} aria-hidden="true" className="text-brand-700" /><dt className="text-ink-600">Indeks Massa Tubuh</dt><dd className="ml-auto font-bold tabular-nums">{num(lm.bmi)}</dd></div> : null}
              </dl>
            ) : <p className="mt-3 border-t border-line pt-3 text-sm text-ink-500">Belum ada pengukuran tercatat. Nilai tekanan darah, gula darah, dan IMT terakhir akan tampil di sini.</p>}
          </section>
        </div>

        <section aria-label="Aksi cepat" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {QUICK.map((q) => (
            <Link key={q.to} to={q.to} className="card-hover flex flex-col items-center gap-2 rounded-card px-3 py-5 text-center shadow-card" style={{ backgroundColor: q.bg }}>
              <q.icon size={30} aria-hidden="true" style={{ color: q.fg }} />
              <span className="text-[15px] font-bold leading-snug text-ink-900">{q.label}</span>
            </Link>
          ))}
        </section>

        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section aria-labelledby="pantau-judul" className="rounded-card border border-line bg-white p-5 shadow-card xl:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 id="pantau-judul" className="font-bold">Pemantauan Kesehatan</h2>
              <Link to="/riwayat" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Riwayat <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            <p className="mt-1 text-sm text-ink-500">Tren tekanan darah sistolik 30 hari terakhir dari catatanmu sendiri.</p>
            <div className="mt-3">{trend ? <TrendChart points={trend.points} unit={trend.unit} label="Tekanan darah sistolik" /> : <p aria-live="polite" className="text-ink-600">Memuat tren…</p>}</div>
            <div className="mt-4 rounded-card bg-health-50 p-4">
              <p className="font-bold text-health-700">Rekomendasi edukasi untukmu</p>
              <ul className="mt-1.5 list-inside list-disc text-[15px] leading-relaxed text-ink-600">
                <li>Batasi garam maksimal 1 sendok teh per hari dan gula maksimal 4 sendok makan per hari.</li>
                <li>Beraktivitas fisik minimal 30 menit setiap hari, misalnya jalan cepat.</li>
                <li>Periksa tekanan darah secara berkala di Posbindu, puskesmas, atau lewat Cek Kesehatan Gratis.</li>
              </ul>
              <Link to="/edukasi" className="mt-2 inline-flex min-h-10 items-center gap-1.5 font-semibold text-brand-700">Lihat tips lengkap <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </section>
          <section aria-labelledby="ai-judul" className="flex flex-col rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white"><MessagesSquare size={19} aria-hidden="true" /></span>
              <div>
                <h2 id="ai-judul" className="font-bold leading-tight">AI Assistant SIGERSEHAT</h2>
                <p className="text-xs font-semibold text-health-700">Sumber terkurasi Kemenkes &amp; WHO</p>
              </div>
            </div>
            <p className="mt-4 rounded-card rounded-tl-none bg-cream p-3.5 text-[15px] leading-relaxed">Halo! Saya SigerAI, asisten kesehatan Anda. Ada yang bisa saya bantu?</p>
            <div className="mt-3 flex flex-col items-end gap-2">
              {AI_CHIPS.map((c) => (
                <Link key={c} to={`/tanya?q=${encodeURIComponent(c)}`} className="rounded-full border border-line px-3.5 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700">{c}</Link>
              ))}
            </div>
            <form onSubmit={askAi} className="mt-auto flex gap-2 pt-4">
              <label htmlFor="ai-cepat" className="sr-only">Tulis pertanyaan Anda</label>
              <input id="ai-cepat" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Tulis pertanyaan Anda…" className="min-h-12 min-w-0 flex-1 rounded-btn border border-line px-3" />
              <button type="submit" aria-label="Kirim pertanyaan ke Tanya AI" className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-btn bg-brand-600 text-white shadow-card"><Send size={18} aria-hidden="true" /></button>
            </form>
            <p className="mt-2.5 text-xs leading-relaxed text-ink-500">Jawaban bersifat edukatif, bukan diagnosis. Untuk keadaan darurat hubungi 119.</p>
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          <section aria-labelledby="edu-judul" className="rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="edu-judul" className="font-bold">Edukasi Kesehatan</h2>
              <Link to="/edukasi" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Semua <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-line">
              {articles.map((a) => (
                <li key={a.slug} className="py-3 first:pt-1">
                  <Link to={`/edukasi/${a.slug}`} className="font-semibold leading-snug text-ink-900 hover:text-brand-700 hover:underline">{a.title}</Link>
                  <p className="mt-0.5 text-xs text-ink-500">{formatDate(a.published_at)}</p>
                </li>
              ))}
              {!articles.length ? <li className="py-3 text-ink-600">Artikel belum dapat dimuat.</li> : null}
            </ul>
          </section>
          <section aria-labelledby="peta-judul" className="rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="peta-judul" className="font-bold">Peta Fasilitas Kesehatan</h2>
              <Link to="/peta" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Peta <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            <p className="mt-2 text-[15px] text-ink-600">{facTotal !== null ? <><strong className="text-ink-900">{facTotal.toLocaleString("id-ID")} fasilitas</strong> terpetakan di seluruh Lampung dari data OpenStreetMap.</> : "Fasilitas terpetakan di seluruh Lampung."}</p>
            <ul className="mt-2 flex flex-col divide-y divide-line">
              {facilities.map((f) => (
                <li key={f.id} className="flex items-center gap-2.5 py-2.5">
                  <MapPin size={17} aria-hidden="true" className="shrink-0 text-brand-700" />
                  <span className="min-w-0"><span className="block truncate font-semibold">{f.name}</span><span className="block text-xs text-ink-500">{f.region_name ?? "Lampung"}</span></span>
                </li>
              ))}
            </ul>
            <Link to="/peta" className="mt-2 inline-flex min-h-11 items-center rounded-btn bg-brand-600 px-4 font-semibold text-white">Buka Peta Faskes</Link>
          </section>
          <section aria-labelledby="keluarga-judul" className="rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="keluarga-judul" className="font-bold">Keluarga &amp; Pengingat</h2>
              <Link to="/keluarga" className="shrink-0 text-sm font-semibold text-brand-700">Kelola <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            {data.family_profiles.length ? (
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {data.family_profiles.slice(0, 4).map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 py-2.5"><Users size={17} aria-hidden="true" className="text-brand-700" /><span className="font-semibold">{f.full_name}</span><span className="ml-auto text-sm capitalize text-ink-500">{f.relation}</span></li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[15px] text-ink-600">Belum ada profil keluarga tambahan. Tambahkan anak, orang tua, atau anggota keluarga lain untuk memantau mereka dalam satu akun.</p>}
            <div className="mt-3 border-t border-line pt-3">
              <p className="flex items-center gap-2 font-bold"><Bell size={17} aria-hidden="true" className="text-brand-700" /> Pengingat berikutnya</p>
              {data.next_reminders.length ? (
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {data.next_reminders.map((r) => <li key={r.id} className="text-[15px] text-ink-600"><span className="font-semibold text-ink-900">{r.title}</span> · {formatDateTime(r.scheduled_at)}</li>)}
                </ul>
              ) : <p className="mt-1.5 text-[15px] text-ink-600">Tidak ada pengingat terjadwal. {data.unread_notifications ? <>Ada <strong>{data.unread_notifications} notifikasi</strong> belum dibaca di <Link to="/notifikasi" className="font-semibold text-brand-700 underline">pusat notifikasi</Link>.</> : null}</p>}
            </div>
          </section>
        </div>
      </> : null}
    </main>
  );
}
