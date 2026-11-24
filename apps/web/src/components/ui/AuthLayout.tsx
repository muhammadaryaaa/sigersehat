import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SigerMark } from "./SigerMark";

// Kerangka halaman Masuk/Daftar (revisi putaran 2): dua kolom di desktop —
// sisi foto nyata berkredit + manfaat akun, sisi kartu form. Di mobile foto
// menjadi pita ringkas di atas form. Kualitas setara beranda, bukan form polos.
export function AuthLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">
      <div className="grid overflow-hidden rounded-card border border-line bg-white shadow-card md:grid-cols-2">
        <div className="relative">
          <img src="/images/posyandu-960.webp" srcSet="/images/posyandu-480.webp 480w, /images/posyandu-960.webp 960w, /images/posyandu-1600.webp 1600w" sizes="(max-width: 768px) 100vw, 50vw" width={1600} height={1064} alt="Kegiatan posyandu: ibu menggendong bayi di timbangan, kader bertugas di meja layanan" className="h-44 w-full object-cover md:h-full md:min-h-[560px]" />
          <div className="absolute inset-x-0 bottom-0 bg-ink-900/72 p-5 text-white">
            <p className="font-display text-xl font-bold">Satu akun untuk riwayat kesehatanmu.</p>
            <p className="mt-1 text-[15px] text-white/85">Simpan hasil skrining, pantau tren tekanan darah dan gula darahmu, dan terima pengingat kontrol — hanya kamu yang dapat melihatnya.</p>
            <p className="mt-2 text-xs text-white/65">Foto: Kanoman123 (CC BY-SA 4.0), Wikimedia Commons.</p>
          </div>
        </div>
        <div className="route-enter p-6 md:p-9">
          <Link to="/" aria-label="SIGERSEHAT — beranda"><SigerMark /></Link>
          <h1 className="mt-5 text-3xl font-bold">{title}</h1>
          {children}
          <div className="mt-7 border-t border-line pt-4 text-sm text-ink-600">
            <p><strong>Tanpa akun pun bisa:</strong> membaca edukasi, membuka peta fasilitas, mengisi skrining awal, dan bertanya ke Tanya AI untuk edukasi umum.</p>
            <p className="mt-2">Kami tidak meminta NIK atau nomor BPJS. Data kesehatanmu disimpan hanya dengan persetujuanmu — baca <Link to="/kebijakan-privasi" className="font-semibold text-brand-800 underline">Kebijakan Privasi</Link>.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
