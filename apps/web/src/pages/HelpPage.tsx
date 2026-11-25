import { Link } from "react-router-dom";
import { BookOpen, ClipboardCheck, LifeBuoy, MapPin, MessagesSquare, PhoneCall, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";

// Pusat bantuan (Master Prompt UI/UX butir 14.2): panduan penggunaan nyata,
// pertanyaan umum, dan batasan layanan. Tidak ada kontak fiktif: saluran
// bantuan yang tersedia adalah fitur laporan di dalam platform.
const GUIDES = [
  { icon: ClipboardCheck, title: "Melakukan skrining awal", text: "Buka Periksa Risiko, isi pengukuran dan jawab pertanyaan, lalu baca hasilnya. Skrining dapat dilakukan tanpa akun dan hasilnya tidak disimpan di server; dengan akun, hasil tersimpan dan dapat dipantau.", to: "/skrining" },
  { icon: MessagesSquare, title: "Bertanya ke SIGERAI", text: "Tanya AI menjawab dari sumber terkurasi Kemenkes dan WHO dengan sitasi. Jangan menuliskan nama, NIK, atau data pribadi di percakapan. Untuk gejala darurat, AI akan mengarahkanmu ke IGD atau 119.", to: "/tanya" },
  { icon: MapPin, title: "Menemukan fasilitas kesehatan", text: "Peta Faskes memuat 369 fasilitas dari data terbuka OpenStreetMap untuk seluruh Lampung beserta sumber dan tanggal pembaruan datanya. Bila menemukan data yang keliru, gunakan tombol Laporkan pada detail fasilitas.", to: "/peta" },
  { icon: BookOpen, title: "Membaca edukasi", text: "Artikel edukasi bersumber Kemenkes RI, Dinas Kesehatan, dan WHO, masing-masing dengan referensi yang dapat dibuka. Ikuti kuis di akhir topik untuk menguji pemahamanmu.", to: "/edukasi" },
  { icon: ShieldCheck, title: "Mengelola data dan izin", text: "Datamu hanya dapat dilihat tenaga kesehatan yang kamu beri izin, dan izin dapat dicabut kapan saja. Kamu juga dapat mengekspor seluruh datamu atau menghapus akun secara mandiri di Pengaturan Akun.", to: "/akun" },
];
const FAQS = [
  { q: "Apakah hasil skrining di SIGERSEHAT adalah diagnosis?", a: "Bukan. Hasil skrining adalah perkiraan tingkat risiko awal yang bersifat edukatif. Diagnosis hanya dapat ditegakkan tenaga kesehatan melalui pemeriksaan langsung." },
  { q: "Apakah saya harus membuat akun?", a: "Tidak untuk membaca edukasi, melihat peta, melakukan skrining dasar, dan bertanya ke AI sebagai tamu. Akun diperlukan untuk menyimpan hasil, memantau tren, memakai pengingat, dan mengelola profil keluarga." },
  { q: "Apakah SIGERSEHAT meminta NIK atau nomor BPJS?", a: "Tidak. Pendaftaran hanya memakai nama, email, dan kata sandi. Kami tidak meminta NIK atau nomor BPJS." },
  { q: "Dari mana data fasilitas kesehatan di peta?", a: "Dari data terbuka OpenStreetMap yang diimpor untuk seluruh 15 kabupaten/kota di Lampung ditambah titik kurasi terverifikasi. Setiap fasilitas mencantumkan sumbernya; data dapat berubah dan kami menampilkan tanggal pembaruan terakhir." },
  { q: "Bagaimana bila saya mengalami gejala darurat?", a: "Segera hubungi 119 atau datangi IGD terdekat. Jangan menunggu jawaban dari platform atau asisten AI." },
  { q: "Bagaimana cara melaporkan data fasilitas yang salah?", a: "Buka detail fasilitas di Peta Faskes lalu gunakan formulir Laporkan. Laporan dapat dikirim tanpa akun; cantumkan email bila ingin menerima tindak lanjut." },
];
export function HelpPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <PageHeader title="Pusat Bantuan" description="Panduan menggunakan SIGERSEHAT, jawaban atas pertanyaan umum, dan batasan layanan yang perlu kamu ketahui." />
      <p className="mt-6 flex items-start gap-2.5 rounded-card bg-danger-50 p-4 text-danger-700"><PhoneCall size={19} aria-hidden="true" className="mt-0.5 shrink-0" /><span><strong>Keadaan darurat:</strong> hubungi <a href="tel:119" className="font-bold underline">119</a> atau datangi IGD terdekat. Pusat bantuan ini bukan saluran penanganan darurat.</span></p>
      <section aria-labelledby="panduan" className="mt-8">
        <h2 id="panduan" className="flex items-center gap-2 text-xl font-bold"><LifeBuoy size={21} aria-hidden="true" /> Panduan Penggunaan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {GUIDES.map((g) => (
            <Link key={g.title} to={g.to} className="card-hover rounded-card border border-line bg-white p-4 shadow-card">
              <g.icon size={22} aria-hidden="true" className="text-brand-700" />
              <p className="mt-2 font-bold">{g.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-600">{g.text}</p>
            </Link>
          ))}
        </div>
      </section>
      <section aria-labelledby="faq-bantuan" className="mt-10">
        <h2 id="faq-bantuan" className="text-xl font-bold">Pertanyaan Umum</h2>
        <div className="mt-4 flex flex-col gap-2.5">
          {FAQS.map((f) => (
            <details key={f.q} className="faq rounded-card border border-line bg-white px-4 shadow-card">
              <summary className="cursor-pointer py-3.5 font-semibold">{f.q}</summary>
              <p className="pb-4 text-ink-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="mt-10 rounded-card border border-line bg-white p-5 shadow-card">
        <h2 className="text-lg font-bold">Masih butuh bantuan?</h2>
        <p className="mt-1.5 text-ink-600">SIGERSEHAT dikelola oleh Kelompok Ditolak UGM. Untuk data fasilitas yang keliru, gunakan fitur Laporkan pada detail fasilitas di Peta Faskes — laporanmu masuk ke antrean peninjauan pengelola. Baca juga <Link to="/batasan-layanan" className="font-semibold text-brand-700 underline">Batasan Layanan</Link> dan <Link to="/kebijakan-privasi" className="font-semibold text-brand-700 underline">Kebijakan Privasi</Link> untuk memahami cakupan dan perlindungan datamu.</p>
      </section>
    </main>
  );
}
