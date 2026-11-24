import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Baby, Bell, BookOpen, ClipboardCheck, Cpu, Heart, MapPin, MessagesSquare, Salad, ShieldCheck, UserRound, Users } from "lucide-react";
import { apiFetch } from "../lib/api";

type Facility = { id: string; name: string; facility_type: string; address: string };
type Article = { slug: string; title: string; category: string; summary: string };

const TYPE_LABEL: Record<string, string> = { rumah_sakit: "Rumah Sakit", puskesmas: "Puskesmas", klinik: "Klinik", laboratorium: "Laboratorium", apotek: "Apotek", pustu: "Pustu", posyandu: "Posyandu" };
const MODULES = [
  { icon: ClipboardCheck, name: "SIGERCHECK", desc: "Skrining risiko PTM, jantung, dan diabetes — bukan diagnosis.", to: "/daftar" },
  { icon: Activity, name: "SIGERMONITOR", desc: "Catatan dan grafik perkembangan dari data Anda sendiri.", to: "/daftar" },
  { icon: MessagesSquare, name: "SIGERAI", desc: "Penjelasan hasil skrining dari sumber Kemenkes & WHO.", to: "/daftar" },
  { icon: BookOpen, name: "SIGEREDU", desc: "Artikel dan kuis kesehatan yang telah ditelaah.", to: "/edukasi" },
  { icon: Heart, name: "SIGERWOMEN", desc: "Siklus, kehamilan, dan kunjungan ANC dengan privasi terjaga.", to: "/daftar" },
  { icon: Baby, name: "SIGERGROW", desc: "Tumbuh kembang anak dan jadwal imunisasi Kemenkes.", to: "/daftar" },
  { icon: UserRound, name: "SIGERELDER", desc: "Jadwal obat dan target kesehatan lansia.", to: "/daftar" },
  { icon: Salad, name: "SIGERNUTRI", desc: "Target gizi harian dan komposisi pangan TKPI.", to: "/daftar" },
  { icon: Bell, name: "SIGERREMINDER", desc: "Pengingat obat, kontrol, imunisasi, dan kunjungan.", to: "/daftar" },
  { icon: MapPin, name: "SIGERMAP", desc: "Peta fasilitas kesehatan terverifikasi se-Lampung.", to: "/peta" },
  { icon: ShieldCheck, name: "SIGERMED", desc: "Tenaga kesehatan memantau pasien hanya dengan izin aktif.", to: "/daftar" },
  { icon: Cpu, name: "IoT Kesehatan", desc: "Integrasi perangkat pemantau ESP32 dan simulator berlabel.", to: "/daftar" },
];
const STEPS = [
  { n: 1, t: "Belajar", d: "Baca edukasi bersumber resmi agar tahu faktor risiko sejak awal." },
  { n: 2, t: "Skrining", d: "Isi pengukuran dan kuesioner; sistem menghitung kategori risiko." },
  { n: 3, t: "Paham Hasil", d: "Setiap hasil dijelaskan dengan bahasa sederhana dan langkah lanjutan." },
  { n: 4, t: "Pantau & Diingatkan", d: "Catat berkala, lihat grafik, dan terima pengingat di dalam website." },
  { n: 5, t: "Ke Faskes yang Tepat", d: "Temukan fasilitas terverifikasi; nakes dapat memantau bila Anda mengizinkan." },
];

export function LandingPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  useEffect(() => {
    apiFetch<Facility[]>("/api/v1/facilities").then((f) => setFacilities(f.slice(0, 4))).catch(() => setFacilities([]));
    apiFetch<Article[]>("/api/v1/edu/articles").then((a) => setArticles(a.slice(0, 3))).catch(() => setArticles([]));
  }, []);
  return (
    <main>
      <section className="mx-auto max-w-3xl px-4 pt-12 pb-10 text-center sm:text-left">
        <h1 className="text-4xl font-extrabold leading-tight">Kenali risiko kesehatanmu lebih awal, pantau dengan tenang.</h1>
        <p className="mt-4 text-lg text-ink-600">Skrining risiko, pemantauan kesehatan, edukasi bersumber Kemenkes &amp; WHO, dan informasi fasilitas kesehatan terverifikasi untuk masyarakat Lampung — semua terhubung dalam satu akun.</p>
        <p className="mt-4 flex items-start gap-2 rounded-card bg-info-50 p-4 text-left text-info-800"><ShieldCheck className="mt-0.5 shrink-0" size={20} aria-hidden="true" /> <span>SIGERSEHAT membantu pencegahan dan skrining awal. Hasil di platform ini <strong>bukan diagnosis</strong> dan tidak menggantikan pemeriksaan tenaga kesehatan.</span></p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/daftar" className="inline-flex min-h-12 items-center rounded-btn bg-brand-800 px-5 font-semibold text-white">Daftar Gratis</Link>
          <Link to="/skrining" className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white px-5 font-semibold">Mulai Skrining</Link>
          <Link to="/peta" className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white px-5 font-semibold">Cari Fasilitas Kesehatan</Link>
        </div>
      </section>

      <section aria-labelledby="data-lampung" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 id="data-lampung" className="text-2xl font-bold">Kenapa pencegahan penting di Lampung</h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-3">
            <li className="rounded-card border border-line p-5"><p className="text-3xl font-extrabold text-brand-800">29,7% vs 7,9%</p><p className="mt-1 text-sm text-ink-600">Prevalensi hipertensi terukur warga Lampung ≥18 tahun dibanding yang terdiagnosis dokter — sebagian besar belum menyadari kondisinya.</p><p className="mt-2 text-xs text-ink-500">Sumber: SKI 2023, BKPK Kemenkes RI</p></li>
            <li className="rounded-card border border-line p-5"><p className="text-3xl font-extrabold text-brand-800">2.771 Posbindu</p><p className="mt-1 text-sm text-ink-600">Titik skrining PTM di masyarakat, ditambah 320 puskesmas dan 81 rumah sakit di 15 kabupaten/kota.</p><p className="mt-2 text-xs text-ink-500">Sumber: Profil Kesehatan Provinsi Lampung 2023</p></li>
            <li className="rounded-card border border-line p-5"><p className="text-3xl font-extrabold text-brand-800">85,99%</p><p className="mt-1 text-sm text-ink-600">Warga Lampung memakai telepon seluler — karena itu SIGERSEHAT dirancang mobile-first dan ringan.</p><p className="mt-2 text-xs text-ink-500">Sumber: BPS Lampung, Susenas Maret 2024</p></li>
          </ul>
        </div>
      </section>

      <section aria-labelledby="cara-kerja" className="mx-auto max-w-6xl px-4 py-10">
        <h2 id="cara-kerja" className="text-2xl font-bold">Cara kerjanya — satu alur yang saling terhubung</h2>
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => <li key={s.n} className="rounded-card border border-line bg-white p-4"><p className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-800 font-bold text-white">{s.n}</p><p className="mt-2 font-bold">{s.t}</p><p className="mt-1 text-sm text-ink-600">{s.d}</p></li>)}
        </ol>
      </section>

      <section aria-labelledby="modul" className="border-y border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <h2 id="modul" className="text-2xl font-bold">14 modul dalam satu platform</h2>
          <p className="mt-1 text-ink-600">Setiap modul memakai satu basis data yang sama: pengukuran yang Anda catat sekali dapat dibaca oleh pemantauan, keluarga, dan — hanya dengan izin Anda — tenaga kesehatan.</p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <li key={m.name}>
                <Link to={m.to} className="flex h-full gap-3 rounded-card border border-line p-4 hover:border-brand-600">
                  <m.icon className="mt-0.5 shrink-0 text-brand-700" size={22} aria-hidden="true" />
                  <span><span className="font-bold">{m.name}</span><span className="mt-0.5 block text-sm text-ink-600">{m.desc}</span></span>
                </Link>
              </li>
            ))}
            <li className="flex h-full gap-3 rounded-card border border-dashed border-line p-4"><Users className="mt-0.5 shrink-0 text-brand-700" size={22} aria-hidden="true" /><span><span className="font-bold">SIGERINSIGHT &amp; SIGERADMIN</span><span className="mt-0.5 block text-sm text-ink-600">Statistik agregat anonim untuk pemangku kebijakan dan pengelolaan platform oleh admin — tanpa akses ke data individu.</span></span></li>
          </ul>
        </div>
      </section>

      {articles.length ? (
        <section aria-labelledby="edukasi-terbaru" className="mx-auto max-w-6xl px-4 py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="edukasi-terbaru" className="text-2xl font-bold">Edukasi terbaru</h2><Link to="/edukasi" className="font-semibold text-brand-800">Lihat semua artikel</Link></div>
          <ul className="mt-5 grid gap-3 sm:grid-cols-3">
            {articles.map((a) => <li key={a.slug}><Link to={`/edukasi/${a.slug}`} className="block h-full rounded-card border border-line bg-white p-5 hover:border-brand-600"><p className="text-xs font-bold uppercase tracking-wide text-brand-700">{a.category}</p><p className="mt-1 font-bold">{a.title}</p><p className="mt-1 text-sm text-ink-600">{a.summary}</p></Link></li>)}
          </ul>
        </section>
      ) : null}

      {facilities.length ? (
        <section aria-labelledby="faskes" className="border-t border-line bg-white">
          <div className="mx-auto max-w-6xl px-4 py-10">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id="faskes" className="text-2xl font-bold">Fasilitas kesehatan terverifikasi</h2><Link to="/peta" className="font-semibold text-brand-800">Buka peta interaktif</Link></div>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {facilities.map((f) => <li key={f.id} className="rounded-card border border-line p-4"><p className="font-bold">{f.name}</p><p className="text-sm text-ink-600">{TYPE_LABEL[f.facility_type] ?? f.facility_type} — {f.address}</p></li>)}
            </ul>
          </div>
        </section>
      ) : null}
    </main>
  );
}
