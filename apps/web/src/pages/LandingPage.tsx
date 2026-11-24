import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowRight, BookOpen, ClipboardCheck, MapPin, MessagesSquare, PhoneCall } from "lucide-react";
import { apiFetch } from "../lib/api";

// Halaman depan SIGERSEHAT (revisi visual 24 Nov 2026).
// Semua foto adalah foto nyata berlisensi bebas dari Wikimedia Commons,
// diunduh lokal sebagai WebP; kredit fotografer tampil di bawah tiap foto
// dan lengkap di /images/CREDITS.md. Semua angka menampilkan sumbernya.

type Article = { id: string; slug: string; title: string; summary: string; source_name: string; category: string };
type Facility = { id: string; name: string; facility_type: string; region_name: string };

const ARTICLE_PHOTO: Record<string, { src: string; alt: string; credit: string }> = {
  ptm: { src: "cek-tekanan-darah", alt: "Petugas kesehatan memeriksa tekanan darah warga", credit: "Foto: rawpixel.com (CC0)" },
  gizi: { src: "pasar-sayur", alt: "Pedagang sayuran di pasar tradisional", credit: "Foto: Tyo Satriany (CC BY-SA 4.0)" },
  ibu_anak: { src: "ibu-anak-timbang", alt: "Kader menimbang bayi dengan timbangan gantung di pos pelayanan", credit: "Foto: USAID Indonesia (domain publik)" },
  imunisasi: { src: "posyandu", alt: "Kegiatan posyandu: ibu dan anak dilayani kader", credit: "Foto: Kanoman123 (CC BY-SA 4.0)" },
};
const FALLBACK_PHOTO = { src: "posyandu", alt: "Kegiatan posyandu di Indonesia", credit: "Foto: Kanoman123 (CC BY-SA 4.0)" };

function Img({ name, alt, w, h, eager = false, className = "" }: { name: string; alt: string; w: number; h: number; eager?: boolean; className?: string }) {
  return (
    <img src={`/images/${name}-960.webp`} srcSet={`/images/${name}-480.webp 480w, /images/${name}-960.webp 960w, /images/${name}-1600.webp 1600w`} sizes="(max-width: 768px) 100vw, 50vw" width={w} height={h} alt={alt} loading={eager ? "eager" : "lazy"} fetchPriority={eager ? "high" : "auto"} className={className} />
  );
}

const FAQ = [
  { q: "Apakah hasil skrining di sini adalah diagnosis?", a: "Bukan. Skrining menghasilkan perkiraan tingkat risiko awal dari jawaban dan ukuran yang Anda masukkan, sebagai bahan edukasi dan pertimbangan untuk memeriksakan diri. Diagnosis hanya dapat ditegakkan tenaga kesehatan lewat pemeriksaan langsung." },
  { q: "Apakah saya harus mendaftar untuk memakai SIGERSEHAT?", a: "Edukasi dan peta fasilitas dapat dibaca tanpa akun. Skrining, pemantauan, dan pengingat memerlukan akun agar hasilnya tersimpan dan hanya dapat dilihat oleh Anda." },
  { q: "Apakah data kesehatan saya aman?", a: "Data disimpan dengan kata sandi ter-hash, akses berbasis peran, dan administrator tidak dapat membaca data kesehatan individu. Data hanya dibagikan ke tenaga kesehatan bila Anda memberi persetujuan aktif, dan persetujuan dapat dicabut kapan saja. Rinciannya ada di Kebijakan Privasi." },
  { q: "Apakah peta menampilkan semua fasilitas kesehatan di Lampung?", a: "Tidak. Peta menampilkan sebagian fasilitas terpilih yang diverifikasi satu per satu dari OpenStreetMap, lengkap dengan tanggal verifikasinya. Untuk fasilitas lain, gunakan pencarian OpenStreetMap atau tanyakan ke dinas kesehatan setempat." },
  { q: "Apa yang harus saya lakukan bila mengalami gejala berat?", a: "Hubungi 119 atau datangi IGD terdekat segera. Jangan menunggu jawaban dari skrining atau asisten AI di platform ini." },
  { q: "Apakah layanan ini berbayar?", a: "Tidak. SIGERSEHAT dapat digunakan tanpa biaya. Pemeriksaan lanjutan di fasilitas kesehatan mengikuti ketentuan fasilitas dan program pemerintah yang berlaku, misalnya Cek Kesehatan Gratis Kemenkes di puskesmas." },
];

export function LandingPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  useEffect(() => { apiFetch<Article[]>("/api/v1/edu/articles").then((a) => setArticles(a.slice(0, 3))).catch(() => {}); }, []);
  useEffect(() => { apiFetch<Facility[]>("/api/v1/facilities").then((f) => setFacilities(f.slice(0, 5))).catch(() => {}); }, []);

  return (
    <main>
      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-8 md:pt-12">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-gold-700">Kesehatan preventif · Provinsi Lampung</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">Kenali tekanan darah dan risiko penyakitmu sebelum menjadi keluhan.</h1>
            <p className="mt-4 text-lg text-ink-600">Di Lampung, 29,7% warga dewasa terukur hipertensi, tetapi hanya 7,9% yang terdiagnosis (SKI 2023). SIGERSEHAT membantu menutup jarak itu: skrining awal, catatan pemantauan, edukasi bersumber resmi, dan arah ke fasilitas kesehatan terdekat.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/skrining" className="inline-flex min-h-12 items-center gap-2 rounded-btn bg-brand-800 px-6 font-semibold text-white shadow-card">Mulai Skrining Awal <ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/edukasi" className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white px-6 font-semibold">Baca Edukasi</Link>
            </div>
            <p className="mt-4 text-sm text-ink-500">Skrining bersifat edukatif dan bukan diagnosis. Untuk keadaan darurat hubungi <a href="tel:119" className="font-bold text-accent-800 underline">119</a>.</p>
          </div>
          <figure>
            <img src="/images/menara-siger-960.webp" srcSet="/images/menara-siger-480.webp 480w, /images/menara-siger-960.webp 960w, /images/menara-siger-1380.webp 1380w" sizes="(max-width: 768px) 100vw, 50vw" width={1380} height={480} alt="Menara Siger di atas bukit hijau di Bakauheni, Lampung Selatan" loading="eager" fetchPriority="high" className="aspect-[4/3] w-full rounded-card object-cover shadow-lift" />
            <figcaption className="mt-2 text-xs text-ink-500">Menara Siger, Bakauheni — gerbang masuk Provinsi Lampung. Foto: Sakurai Midori (CC BY 2.5), Wikimedia Commons, dipotong dari bingkai asli.</figcaption>
          </figure>
        </div>
      </section>

      {/* BARIS KEPERCAYAAN */}
      <section aria-label="Sumber data" className="mx-auto max-w-6xl px-4 pt-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-line bg-white px-5 py-4 text-sm shadow-card">
          <p><span className="font-bold text-ink-900">Rujukan data:</span> Kemenkes RI · Dinas Kesehatan Provinsi Lampung · BPS Provinsi Lampung · WHO</p>
          <p className="text-ink-500">Konten ditelaah sebelum diterbitkan · Diperbarui 24 November 2026</p>
          <Link to="/tentang" className="ml-auto font-semibold text-brand-800 underline">Tentang platform ini</Link>
        </div>
      </section>

      {/* FITUR UTAMA — bobot visual berbeda sesuai prioritas */}
      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="fitur">
        <h2 id="fitur" className="text-3xl font-bold">Lima hal yang dapat dilakukan di sini</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-3">
          <article className="overflow-hidden rounded-card border border-line bg-white shadow-card md:col-span-2">
            <Img name="cek-tekanan-darah" alt="Petugas kesehatan memeriksa tekanan darah warga" w={1600} h={946} className="aspect-[16/8] w-full object-cover" />
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-2xl font-bold"><ClipboardCheck className="text-brand-800" aria-hidden="true" /> Periksa Risiko (SIGERCHECK)</h3>
              <p className="mt-2 text-ink-600">Skrining faktor risiko PTM dan skor risiko diabetes FINDRISC, dirujuk dari pedoman Kemenkes RI. Hasilnya berupa kategori risiko dan langkah tindak lanjut — bukan diagnosis.</p>
              <Link to="/skrining" className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-brand-800 underline">Mulai periksa risiko <ArrowRight size={16} aria-hidden="true" /></Link>
              <p className="mt-2 text-xs text-ink-500">Foto: rawpixel.com (CC0), Wikimedia Commons.</p>
            </div>
          </article>
          <article className="flex flex-col rounded-card border border-line bg-brand-800 p-6 text-white shadow-card">
            <h3 className="flex items-center gap-2 text-2xl font-bold"><MessagesSquare aria-hidden="true" /> Tanya AI (SIGERAI)</h3>
            <p className="mt-2 text-brand-50">Asisten edukasi yang menjawab hanya dari sumber Kemenkes RI dan WHO, menampilkan rujukannya, dan menolak memberi diagnosis atau resep. Setiap jawaban berlabel dibantu AI.</p>
            <Link to="/tanya" className="mt-auto inline-flex min-h-11 items-center gap-2 pt-4 font-bold text-white underline">Ajukan pertanyaan <ArrowRight size={16} aria-hidden="true" /></Link>
          </article>
          <article className="rounded-card border border-line bg-white p-6 shadow-card">
            <h3 className="flex items-center gap-2 text-xl font-bold"><Activity className="text-brand-800" aria-hidden="true" /> Catat &amp; Pantau</h3>
            <p className="mt-2 text-ink-600">Catat tekanan darah, berat badan, dan gula darahmu; lihat grafik tren dari catatanmu sendiri. Tidak ada data contoh yang menyamar sebagai data nyata.</p>
            <Link to="/pantau" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-800 underline">Buka pemantauan</Link>
          </article>
          <article className="overflow-hidden rounded-card border border-line bg-white shadow-card">
            <Img name="jalan-sehat" alt="Warga berjalan dan berolahraga pada hari bebas kendaraan" w={1600} h={1200} className="aspect-[16/9] w-full object-cover" />
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-xl font-bold"><BookOpen className="text-brand-800" aria-hidden="true" /> Edukasi Kesehatan</h3>
              <p className="mt-2 text-ink-600">Artikel dan kuis seputar PTM, gizi, ibu dan anak, imunisasi, dan gaya hidup — masing-masing dengan sumber dan tanggal tinjau.</p>
              <Link to="/edukasi" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-800 underline">Baca edukasi</Link>
              <p className="mt-2 text-xs text-ink-500">Foto: baka_neko_baka (CC BY 2.0), Wikimedia Commons.</p>
            </div>
          </article>
          <article className="rounded-card border border-line bg-white p-6 shadow-card">
            <h3 className="flex items-center gap-2 text-xl font-bold"><MapPin className="text-brand-800" aria-hidden="true" /> Peta Faskes Terpilih</h3>
            <p className="mt-2 text-ink-600">Sebagian fasilitas kesehatan terverifikasi satu per satu dari OpenStreetMap — bukan direktori lengkap Lampung.</p>
            {facilities.length ? <ul className="mt-3 flex flex-col gap-1.5 text-[15px]">{facilities.map((f) => <li key={f.id} className="flex gap-2"><MapPin size={15} className="mt-1 shrink-0 text-accent-700" aria-hidden="true" /><span>{f.name} <span className="text-ink-500">— {f.region_name}</span></span></li>)}</ul> : null}
            <Link to="/peta" className="mt-3 inline-flex min-h-11 items-center font-bold text-brand-800 underline">Buka peta fasilitas</Link>
          </article>
        </div>
      </section>

      <div className="tapis-band mx-auto mt-14 max-w-6xl px-4" aria-hidden="true" />

      {/* CARA KERJA */}
      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="cara">
        <div className="grid items-start gap-8 md:grid-cols-5">
          <figure className="md:col-span-2">
            <Img name="posyandu" alt="Kegiatan posyandu: ibu menggendong bayi di timbangan, kader bertugas di meja layanan" w={1600} h={1064} className="aspect-[4/3] w-full rounded-card object-cover shadow-card" />
            <figcaption className="mt-2 text-xs text-ink-500">Kegiatan posyandu di Indonesia. Foto: Kanoman123 (CC BY-SA 4.0), Wikimedia Commons.</figcaption>
          </figure>
          <div className="md:col-span-3">
            <h2 id="cara" className="text-3xl font-bold">Cara kerjanya</h2>
            <ol className="mt-5 flex flex-col gap-4">
              {[
                ["Belajar dulu", "Baca edukasi singkat tentang tekanan darah, gula darah, dan faktor risiko PTM."],
                ["Periksa risiko", "Jawab pertanyaan dan masukkan ukuran tubuhmu; sistem menghitung perkiraan risiko dari aturan Kemenkes RI."],
                ["Pahami hasilnya", "Hasil ditampilkan sebagai kategori risiko dengan penjelasan dan sumbernya — bukan vonis."],
                ["Pantau dan diingatkan", "Catat pengukuran berkala dan buat pengingat kontrol atau imunisasi."],
                ["Ke fasilitas yang tepat", "Bila risiko tinggi atau ada tanda bahaya, peta mengarahkanmu ke fasilitas terverifikasi terdekat."],
              ].map(([t, d], i) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-800 font-display text-lg font-bold text-white">{i + 1}</span>
                  <p><strong>{t}.</strong> <span className="text-ink-600">{d}</span></p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* DATA + EDUKASI */}
      <section className="mt-14 bg-cream" aria-labelledby="data">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h2 id="data" className="text-3xl font-bold">Angka kesehatan Lampung, dengan sumbernya</h2>
          <div className="mt-6 grid gap-5 md:grid-cols-3">
            <div className="rounded-card border border-line bg-white p-6 shadow-card">
              <p className="font-display text-5xl font-bold text-brand-800">29,7% <span className="text-2xl text-ink-500">vs</span> 7,9%</p>
              <p className="mt-2 text-ink-600">Prevalensi hipertensi warga ≥18 tahun di Lampung: terukur 29,7%, tetapi yang terdiagnosis dokter hanya 7,9%. Sebagian besar belum menyadari kondisinya.</p>
              <p className="mt-3 text-sm text-ink-500">Sumber: Survei Kesehatan Indonesia 2023, Kemenkes RI.</p>
            </div>
            <div className="rounded-card border border-line bg-white p-6 shadow-card">
              <p className="font-display text-5xl font-bold text-brand-800">2.771</p>
              <p className="mt-2 text-ink-600">Posbindu PTM tersebar di Lampung, di samping 320 puskesmas dan 81 rumah sakit — titik deteksi dini yang sebenarnya dekat dengan warga.</p>
              <p className="mt-3 text-sm text-ink-500">Sumber: Profil Kesehatan Provinsi Lampung 2023, Dinkes Lampung.</p>
            </div>
            <div className="rounded-card border border-line bg-white p-6 shadow-card">
              <p className="font-display text-5xl font-bold text-brand-800">85,99%</p>
              <p className="mt-2 text-ink-600">Warga Lampung memakai telepon seluler, sementara pemakai komputer hanya 7,88%. Karena itu platform ini dirancang untuk ponsel lebih dulu.</p>
              <p className="mt-3 text-sm text-ink-500">Sumber: Susenas Maret 2024, BPS Provinsi Lampung.</p>
            </div>
          </div>
          {articles.length ? (
            <div className="mt-10">
              <h3 className="text-2xl font-bold">Edukasi terbaru</h3>
              <div className="mt-4 grid gap-5 md:grid-cols-3">
                {articles.map((a) => {
                  const ph = ARTICLE_PHOTO[a.category] ?? FALLBACK_PHOTO;
                  return (
                    <article key={a.id} className="overflow-hidden rounded-card border border-line bg-white shadow-card">
                      <Img name={ph.src} alt={ph.alt} w={960} h={640} className="aspect-[16/9] w-full object-cover" />
                      <div className="p-5">
                        <h4 className="text-lg font-bold leading-snug"><Link to={`/edukasi/${a.slug}`} className="hover:underline">{a.title}</Link></h4>
                        <p className="mt-2 text-[15px] text-ink-600">{a.summary}</p>
                        <p className="mt-3 text-xs text-ink-500">Sumber: {a.source_name} · {ph.credit}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* NUANGSA LAMPUNG */}
      <section className="mx-auto max-w-6xl px-4 pt-12" aria-labelledby="lampung">
        <h2 id="lampung" className="text-3xl font-bold">Dibangun untuk Lampung</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <figure>
            <Img name="kain-tapis" alt="Kain tapis Lampung berwarna hitam dan merah dengan sulaman benang emas" w={1600} h={1200} className="aspect-[16/10] w-full rounded-card object-cover shadow-card" />
            <figcaption className="mt-2 text-xs text-ink-500">Kain tapis, tenun tradisional Lampung. Foto: Crisco 1492 (CC BY-SA 3.0), Wikimedia Commons.</figcaption>
          </figure>
          <figure>
            <Img name="pantai-pahawang" alt="Pesisir Pulau Pahawang, Pesawaran, Lampung" w={1600} h={885} className="aspect-[16/10] w-full rounded-card object-cover shadow-card" />
            <figcaption className="mt-2 text-xs text-ink-500">Pulau Pahawang, Pesawaran. Foto: Fidelia Zheng (CC0), Wikimedia Commons.</figcaption>
          </figure>
        </div>
        <p className="mt-5 max-w-3xl text-ink-600">Nama SIGERSEHAT mengambil mahkota siger — simbol Lampung — dan warna marun-emas kain tapis menjadi aksen visualnya. Isi platformnya berpijak pada data Lampung sendiri: angka SKI dan Profil Kesehatan provinsi, wilayah 15 kabupaten/kota, dan fasilitas yang diverifikasi di lapangan digital OpenStreetMap.</p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-4" aria-labelledby="faq">
        <h2 id="faq" className="text-3xl font-bold">Pertanyaan yang sering diajukan</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="rounded-card border border-line bg-white p-5 shadow-card">
              <summary className="cursor-pointer font-bold">{f.q}</summary>
              <p className="mt-2 text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-start gap-3 rounded-card bg-accent-800 p-6 text-white md:flex-row md:items-center">
          <PhoneCall size={28} aria-hidden="true" className="shrink-0" />
          <p className="text-lg"><strong>Darurat medis?</strong> Hubungi <a href="tel:119" className="font-bold underline">119</a> atau datangi IGD terdekat sekarang. Platform ini tidak menangani keadaan darurat.</p>
          <Link to="/batasan-layanan" className="inline-flex min-h-11 shrink-0 items-center rounded-btn bg-white px-4 font-bold text-accent-800 md:ml-auto">Baca Batasan Layanan</Link>
        </div>
      </section>
    </main>
  );
}
