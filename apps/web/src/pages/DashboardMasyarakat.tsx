import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatDate, formatDateTime } from "../lib/format";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Activity, ArrowRight, Bell, BookOpen, Bot, Check, ClipboardCheck, Heart, MapPin, MessagesSquare, Send, Users } from "lucide-react";

const MiniMap = lazy(() => import("../components/ui/MiniMap").then((m) => ({ default: m.MiniMap })));

type Dash = {
  profile: { id: string; full_name: string };
  latest_measurement: Record<string, unknown> | null;
  next_reminders: { id: string; title: string; scheduled_at: string }[];
  unread_notifications: number;
  family_profiles: { id: string; relation: string; full_name: string }[];
  last_screening: { id: string; risk_category: string; completed_at: string } | null;
};
type Pt = { measured_at: string; value: number };
type Trend = { metric: string; unit: string; points: Pt[] };
type Article = { slug: string; title: string; category: string; published_at: string };
type Facility = { id: string; name: string; facility_type: string; region_name?: string; latitude: number; longitude: number };
type Device = { last_seen_at: string | null; status: string };

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
const PHOTO_BY_SLUG: Record<string, string> = {
  "cek-kesehatan-gratis-2026-yang-baru": "posyandu",
  "aktivitas-fisik-150-menit-seminggu": "jalan-sehat",
  "diabetes-melitus-mengenali-gula-darahmu": "pasar-sayur",
  "mengenal-hipertensi-dan-cara-mengendalikannya": "jalan-sehat",
  "cek-kesehatan-dan-skrining-ptm-di-posbindu": "posyandu",
};
const PHOTO_BY_CAT: Record<string, string> = { ptm: "cek-tekanan-darah", gizi: "pasar-sayur", "ibu-anak": "ibu-anak-timbang", ibu_anak: "ibu-anak-timbang", imunisasi: "posyandu", program: "posyandu", tb: "posyandu", jiwa: "jalan-sehat", umum: "jalan-sehat", lingkungan: "pantai-pahawang" };
const photoOf = (a: Article) => `/images/${PHOTO_BY_SLUG[a.slug] ?? PHOTO_BY_CAT[a.category] ?? "posyandu"}-480.webp`;
const TYPE_LABEL: Record<string, string> = { rumah_sakit: "Rumah Sakit Umum Daerah", puskesmas: "Puskesmas", klinik: "Klinik", apotek: "Apotek", posyandu: "Posyandu", pustu: "Puskesmas Pembantu" };
const GENERAL_TIPS = [
  "Batasi garam maksimal 1 sendok teh dan gula maksimal 4 sendok makan per hari.",
  "Beraktivitas fisik minimal 30 menit setiap hari, misalnya jalan cepat.",
  "Istirahat cukup 7–8 jam dan kelola stres dengan baik.",
  "Periksa tekanan darah berkala di Posbindu, puskesmas, atau Cek Kesehatan Gratis.",
];

// Grafik dua seri (tekanan darah + detak jantung) dari data aktual pengguna.
function DualChart({ bp, hr }: { bp: Pt[]; hr: Pt[] }) {
  const dates = [...new Set([...bp.map((p) => p.measured_at.slice(0, 10)), ...hr.map((p) => p.measured_at.slice(0, 10))])].sort();
  if (dates.length < 2) return <p className="text-ink-600">Belum cukup data untuk grafik. Catat pengukuran pada hari yang berbeda untuk melihat tren mingguanmu di sini.</p>;
  const at = (pts: Pt[], d: string) => pts.find((p) => p.measured_at.slice(0, 10) === d)?.value;
  const all = [...bp.map((p) => p.value), ...hr.map((p) => p.value)];
  const min = Math.floor((Math.min(...all) - 8) / 10) * 10, max = Math.ceil((Math.max(...all) + 8) / 10) * 10;
  const w = 640, h = 230, padL = 38, padB = 28, padT = 12;
  const x = (i: number) => padL + (i / (dates.length - 1)) * (w - padL - 12);
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (h - padT - padB);
  const line = (pts: Pt[]) => dates.map((d, i) => { const v = at(pts, d); return v === undefined ? null : `${i === 0 || at(pts, dates[i - 1]) === undefined ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`; }).filter(Boolean).join(" ");
  const dayLabel = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short" }).replace(".", "");
  return (
    <figure>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Tekanan Darah</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-health-600" /> Detak Jantung</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Grafik tren ${dates.length} hari: tekanan darah sistolik dan detak jantung dari catatanmu`} className="mt-2 w-full">
        {[min, Math.round((min + max) / 2), max].map((v) => (
          <g key={v}>
            <line x1={padL} y1={y(v)} x2={w - 12} y2={y(v)} stroke="#e3ebf2" />
            <text x={4} y={y(v) + 4} fontSize="12" fill="#6b7c8c">{v}</text>
          </g>
        ))}
        <path d={line(bp)} fill="none" stroke="#1d74db" strokeWidth="2.5" />
        <path d={line(hr)} fill="none" stroke="#1e9e62" strokeWidth="2.5" />
        {dates.map((d, i) => {
          const b = at(bp, d), j = at(hr, d);
          return <g key={d}>
            {b !== undefined ? <circle cx={x(i)} cy={y(b)} r="4" fill="#175db4"><title>{`${d}: sistolik ${b} mmHg`}</title></circle> : null}
            {j !== undefined ? <circle cx={x(i)} cy={y(j)} r="4" fill="#177a4c"><title>{`${d}: detak jantung ${j} bpm`}</title></circle> : null}
            <text x={x(i)} y={h - 6} fontSize="12" fill="#6b7c8c" textAnchor="middle">{dayLabel(d)}</text>
          </g>;
        })}
      </svg>
      <figcaption className="text-sm text-ink-600">Tren {dates.length} hari pencatatan terakhir. Grafik lengkap dan tabel data tersedia di halaman Catat &amp; Pantau.</figcaption>
    </figure>
  );
}

export function DashboardMasyarakat() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Dash | null>(null);
  const [bpTrend, setBpTrend] = useState<Pt[]>([]);
  const [hrTrend, setHrTrend] = useState<Pt[]>([]);
  const [recs, setRecs] = useState<string[] | null>(null);
  const [iotOnline, setIotOnline] = useState<boolean | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [facTotal, setFacTotal] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  useEffect(() => { apiFetch<Dash>("/api/v1/dashboard/masyarakat").then(setData).catch(() => setError("Data beranda tidak dapat dimuat. Coba muat ulang halaman.")); }, []);
  useEffect(() => {
    if (!data) return;
    const pid = data.profile.id;
    apiFetch<Trend>(`/api/v1/measurements/trends?profileId=${pid}&metric=systolic&days=30`).then((t) => setBpTrend(t.points)).catch(() => {});
    apiFetch<Trend>(`/api/v1/measurements/trends?profileId=${pid}&metric=heart_rate&days=30`).then((t) => setHrTrend(t.points)).catch(() => {});
    if (data.last_screening) {
      apiFetch<{ recommendations: string[] | null }>(`/api/v1/screening/sessions/${data.last_screening.id}`).then((s) => setRecs(s.recommendations)).catch(() => {});
    }
    apiFetch<Device[]>("/api/v1/iot/devices").then((ds) => {
      const now = Date.now();
      setIotOnline(ds.some((d) => d.status === "active" && d.last_seen_at && now - new Date(d.last_seen_at.replace(" ", "T") + "Z").getTime() <= 15 * 60 * 1000));
    }).catch(() => setIotOnline(false));
  }, [data]);
  const [featuredFac, setFeaturedFac] = useState<Facility | null>(null);
  useEffect(() => {
    apiFetch<Article[]>("/api/v1/edu/articles?limit=10").then(setArticles).catch(() => {});
    apiFetch<Facility[]>("/api/v1/facilities?limit=60").then(setFacilities).catch(() => {});
    apiFetch<Facility[]>("/api/v1/facilities?q=Abdul&limit=5").then((rows) => setFeaturedFac(rows[0] ?? null)).catch(() => {});
    apiFetch<{ total: number }>("/api/v1/facilities/stats").then((s) => setFacTotal(s.total)).catch(() => {});
  }, []);
  function askAi(e: FormEvent) { e.preventDefault(); if (question.trim()) navigate(`/tanya?q=${encodeURIComponent(question.trim())}`); }
  const lm = data?.latest_measurement;
  const risk = data?.last_screening ? RISK_STYLE[data.last_screening.risk_category] ?? RISK_STYLE.sedang : null;
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  const lampungFacs = facilities.filter((f) => f.region_name === "Bandar Lampung");
  const featured = featuredFac ?? lampungFacs[0];
  const program = articles.find((a) => a.slug === "cek-kesehatan-gratis-2026-yang-baru");
  const eduCards = articles.filter((a) => a.slug !== program?.slug).slice(0, 3);
  const tips = recs && recs.length ? recs.slice(0, 4) : GENERAL_TIPS;
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id="pantau-judul" className="font-bold">Pemantauan Kesehatan</h2>
              {iotOnline !== null ? <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-600"><span className={`h-2 w-2 rounded-full ${iotOnline ? "bg-health-600" : "bg-ink-500"}`} />{iotOnline ? "Terhubung" : "Catat manual"}</span> : null}
              <Link to="/riwayat" className="ml-auto shrink-0 text-sm font-semibold text-brand-700">Lihat Riwayat <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_290px]">
              <div>
                <p className="text-sm font-semibold text-ink-600">Tren Kesehatan 7 Hari Terakhir</p>
                <div className="mt-1.5"><DualChart bp={bpTrend} hr={hrTrend} /></div>
              </div>
              <div className="flex flex-col rounded-card bg-brand-50 p-4">
                <p className="flex items-center gap-2 font-bold"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white"><Bot size={17} aria-hidden="true" /></span> Rekomendasi AI</p>
                <p className="mt-2 text-sm font-semibold text-ink-900">{data.last_screening ? "Berdasarkan skrining terakhirmu:" : "Pertahankan pola hidup sehat dengan:"}</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {tips.map((t) => <li key={t} className="flex gap-2 text-sm leading-relaxed text-ink-600"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-health-600" /> {t}</li>)}
                </ul>
                <Link to="/edukasi" className="mt-auto inline-flex min-h-10 items-center gap-1.5 pt-3 font-semibold text-brand-700">Lihat Tips Lengkap <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            </div>
          </section>
          <section aria-labelledby="ai-judul" className="flex flex-col rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white"><MessagesSquare size={19} aria-hidden="true" /></span>
              <div>
                <h2 id="ai-judul" className="font-bold leading-tight">AI Assistant SIGERSEHAT</h2>
                <p className="flex items-center gap-1.5 text-xs font-semibold text-health-700"><span className="h-1.5 w-1.5 rounded-full bg-health-600" /> Online · sumber terkurasi</p>
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

        <div className="mt-4 grid gap-4 xl:grid-cols-12">
          <section aria-labelledby="edu-judul" className="rounded-card border border-line bg-white p-5 shadow-card xl:col-span-6">
            <div className="flex items-center justify-between gap-2">
              <h2 id="edu-judul" className="font-bold">Edukasi Kesehatan</h2>
              <Link to="/edukasi" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Semua <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {eduCards.map((a) => (
                <Link key={a.slug} to={`/edukasi/${a.slug}`} className="card-hover group block overflow-hidden rounded-card border border-line bg-white">
                  <img src={photoOf(a)} alt="" width={480} height={320} loading="lazy" className="aspect-[3/2] w-full object-cover" />
                  <span className="block p-3">
                    <span className="block text-[15px] font-bold leading-snug group-hover:text-brand-700">{a.title}</span>
                    <span className="mt-1 block text-xs text-ink-500">{formatDate(a.published_at)}</span>
                  </span>
                </Link>
              ))}
              {!articles.length ? <p className="text-ink-600">Artikel belum dapat dimuat.</p> : null}
            </div>
          </section>
          <section aria-labelledby="peta-judul" className="overflow-hidden rounded-card border border-line bg-white shadow-card xl:col-span-3">
            <div className="flex items-center justify-between gap-2 p-4 pb-2">
              <h2 id="peta-judul" className="font-bold">Peta Fasilitas Kesehatan</h2>
              <Link to="/peta" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Peta <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            <Suspense fallback={<div className="skeleton h-44 w-full" aria-label="Memuat pratinjau peta" />}>
              <MiniMap facilities={lampungFacs.slice(0, 6).map((f) => ({ name: f.name, latitude: f.latitude, longitude: f.longitude }))} />
            </Suspense>
            {featured ? (
              <div className="p-4 pt-3">
                <p className="font-bold leading-snug">{featured.name}</p>
                <p className="text-sm text-ink-500">{TYPE_LABEL[featured.facility_type] ?? "Fasilitas kesehatan"} · {featured.region_name ?? "Lampung"}</p>
                <div className="mt-2.5 flex items-center gap-2">
                  <Link to="/peta" className="inline-flex min-h-10 items-center rounded-btn bg-brand-600 px-3.5 text-sm font-semibold text-white">Lihat Detail</Link>
                  <span className="text-sm text-ink-500">{facTotal !== null ? `${facTotal.toLocaleString("id-ID")} fasilitas terpetakan` : ""}</span>
                </div>
              </div>
            ) : null}
          </section>
          <section aria-labelledby="program-judul" className="rounded-card border border-line bg-white p-5 shadow-card xl:col-span-3">
            <div className="flex items-center justify-between gap-2">
              <h2 id="program-judul" className="font-bold">Informasi Program</h2>
              <Link to="/edukasi" className="shrink-0 text-sm font-semibold text-brand-700">Lihat Semua <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            {program ? (
              <Link to={`/edukasi/${program.slug}`} className="card-hover group mt-3 block overflow-hidden rounded-card border border-line">
                <img src="/images/posyandu-480.webp" alt="" width={480} height={320} loading="lazy" className="aspect-[3/2] w-full object-cover" />
                <span className="block p-3">
                  <span className="block text-[15px] font-bold leading-snug group-hover:text-brand-700">{program.title}</span>
                  <span className="mt-1 block text-xs text-ink-500">{formatDate(program.published_at)} · Program Kemenkes RI</span>
                </span>
              </Link>
            ) : <p className="mt-3 text-ink-600">Informasi program belum dapat dimuat.</p>}
          </section>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section aria-labelledby="keluarga-judul" className="rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="keluarga-judul" className="font-bold">Keluargaku</h2>
              <Link to="/keluarga" className="shrink-0 text-sm font-semibold text-brand-700">Kelola <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            {data.family_profiles.length ? (
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {data.family_profiles.slice(0, 4).map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 py-2.5"><Users size={17} aria-hidden="true" className="text-brand-700" /><span className="font-semibold">{f.full_name}</span><span className="ml-auto text-sm capitalize text-ink-500">{f.relation === "self" ? "Saya" : f.relation}</span></li>
                ))}
              </ul>
            ) : <p className="mt-2 text-[15px] text-ink-600">Belum ada profil keluarga tambahan. Tambahkan anak, orang tua, atau anggota keluarga lain untuk memantau mereka dalam satu akun.</p>}
          </section>
          <section aria-labelledby="pengingat-judul" className="rounded-card border border-line bg-white p-5 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <h2 id="pengingat-judul" className="flex items-center gap-2 font-bold"><Bell size={18} aria-hidden="true" className="text-brand-700" /> Pengingat Berikutnya</h2>
              <Link to="/pengingat" className="shrink-0 text-sm font-semibold text-brand-700">Kelola <ArrowRight size={14} className="inline" aria-hidden="true" /></Link>
            </div>
            {data.next_reminders.length ? (
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {data.next_reminders.map((r) => <li key={r.id} className="py-2.5 text-[15px] text-ink-600"><span className="font-semibold text-ink-900">{r.title}</span> · {formatDateTime(r.scheduled_at)}</li>)}
              </ul>
            ) : <p className="mt-2 text-[15px] text-ink-600">Tidak ada pengingat terjadwal. {data.unread_notifications ? <>Ada <strong>{data.unread_notifications} notifikasi</strong> belum dibaca di <Link to="/notifikasi" className="font-semibold text-brand-700 underline">pusat notifikasi</Link>.</> : null}</p>}
          </section>
        </div>
      </> : null}
    </main>
  );
}
