import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Activity, Baby, Bell, BookOpen, ClipboardCheck, Cpu, Heart, History, Home, LogOut, MapPin, MessagesSquare, PhoneCall, Salad, ShieldCheck, UserRound, Users } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { SigerMark } from "./SigerMark";

// Kerangka aplikasi bersama.
// Header publik ramping: wordmark + maks 5 menu + 1 tombol aksi utama
// (keputusan desain revisi visual 24 Nov 2026). Untuk pengguna terlogin,
// seluruh modul tetap tertaut lewat baris navigasi layanan di bawah header
// dan grid Semua Layanan di dasbor — tidak ada modul yang yatim.
const NAV_MASYARAKAT: { to: string; label: string; icon: typeof Home }[] = [
  { to: "/beranda", label: "Beranda", icon: Home },
  { to: "/skrining", label: "Periksa Risiko", icon: ClipboardCheck },
  { to: "/pantau", label: "Catat & Pantau", icon: Activity },
  { to: "/pengingat", label: "Pengingat", icon: Bell },
  { to: "/riwayat", label: "Riwayat", icon: History },
  { to: "/keluarga", label: "Keluarga", icon: Users },
  { to: "/perempuan", label: "Perempuan", icon: Heart },
  { to: "/tumbuh", label: "Tumbuh Kembang", icon: Baby },
  { to: "/lansia", label: "Lansia", icon: UserRound },
  { to: "/gizi", label: "Gizi", icon: Salad },
  { to: "/edukasi", label: "Edukasi", icon: BookOpen },
  { to: "/tanya", label: "Tanya AI", icon: MessagesSquare },
  { to: "/peta", label: "Peta Faskes", icon: MapPin },
  { to: "/izin", label: "Izin & Nakes", icon: ShieldCheck },
  { to: "/iot", label: "Perangkat IoT", icon: Cpu },
];
const NAV_NAKES = [
  { to: "/nakes/beranda", label: "Beranda Nakes", icon: Home },
  { to: "/nakes/pasien", label: "Pasien Saya", icon: Users },
  { to: "/edukasi", label: "Edukasi", icon: BookOpen },
  { to: "/peta", label: "Peta Faskes", icon: MapPin },
];
const NAV_ADMIN = [
  { to: "/admin/beranda", label: "Beranda Admin", icon: Home },
  { to: "/admin/kelola", label: "Kelola", icon: Users },
  { to: "/admin/konten", label: "Konten & AI", icon: BookOpen },
  { to: "/admin/insight", label: "Insight", icon: Activity },
];
const NAV_PUBLIC = [
  { to: "/", label: "Beranda" },
  { to: "/skrining", label: "Skrining" },
  { to: "/edukasi", label: "Edukasi" },
  { to: "/peta", label: "Peta Faskes" },
  { to: "/tentang", label: "Tentang" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const role = me?.user?.role;
  const home = me ? (role === "nakes" ? "/nakes/beranda" : role === "admin" || role === "super_admin" ? "/admin/beranda" : "/beranda") : "/";
  const serviceItems = !me ? null : role === "nakes" ? NAV_NAKES : role === "admin" || role === "super_admin" ? NAV_ADMIN : NAV_MASYARAKAT;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to={home} aria-label="SIGERSEHAT — beranda"><SigerMark /></Link>
          {me ? null : (
            <nav aria-label="Navigasi utama" className="ml-4 hidden items-center gap-1 lg:flex">
              {NAV_PUBLIC.map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => `inline-flex min-h-10 items-center rounded-btn px-3 text-[15px] font-semibold ${isActive ? "text-brand-800 underline underline-offset-4" : "text-ink-600 hover:text-ink-900"}`}>{it.label}</NavLink>
              ))}
            </nav>
          )}
          <div className="ml-auto flex items-center gap-2">
            <a href="tel:119" className="hidden min-h-10 items-center gap-1.5 rounded-btn px-2 text-sm font-bold text-accent-800 sm:inline-flex"><PhoneCall size={16} aria-hidden="true" /> Darurat 119</a>
            {me ? <>
              <Link to="/akun" className="inline-flex min-h-10 items-center rounded-btn border border-line bg-white px-3 text-sm font-semibold">Akun</Link>
              <button type="button" onClick={async () => { await logout(); location.href = "/"; }} className="inline-flex min-h-10 items-center gap-1.5 rounded-btn border border-line bg-white px-3 text-sm font-semibold"><LogOut size={16} aria-hidden="true" /> Keluar</button>
            </> : <>
              <Link to="/masuk" className="inline-flex min-h-10 items-center rounded-btn px-3 text-sm font-semibold text-ink-900">Masuk</Link>
              <Link to="/skrining" className="inline-flex min-h-10 items-center rounded-btn bg-brand-800 px-4 text-sm font-semibold text-white shadow-card">Periksa Risiko</Link>
            </>}
          </div>
        </div>
        {serviceItems ? (
          <nav aria-label="Navigasi layanan" className="border-t border-line/60">
            <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-1.5">
              {serviceItems.map((it) => (
                <li key={it.to} className="shrink-0">
                  <NavLink to={it.to} className={({ isActive }) => `inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${isActive ? "bg-brand-800 text-white" : "text-ink-600 hover:bg-brand-50"}`}>
                    <it.icon size={16} aria-hidden="true" /> {it.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : (
          <nav aria-label="Navigasi utama" className="border-t border-line/60 lg:hidden">
            <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-1.5">
              {NAV_PUBLIC.map((it) => (
                <li key={it.to} className="shrink-0">
                  <NavLink to={it.to} className={({ isActive }) => `inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold ${isActive ? "bg-brand-800 text-white" : "text-ink-600 hover:bg-brand-50"}`}>{it.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      {children}
      <div className="tapis-band" aria-hidden="true" />
      <footer className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-600 md:grid-cols-3">
          <div>
            <SigerMark />
            <p className="mt-3">Platform kesehatan preventif untuk masyarakat Provinsi Lampung: skrining awal, edukasi, pemantauan, dan informasi fasilitas kesehatan.</p>
            <p className="mt-3 rounded-card bg-accent-50 p-3 text-accent-800"><strong>Darurat?</strong> Hubungi <a href="tel:119" className="font-bold underline">119</a> atau datangi IGD terdekat. Jangan menunggu jawaban dari platform ini.</p>
          </div>
          <nav aria-label="Tautan footer">
            <p className="font-bold text-ink-900">Jelajahi</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li><Link to="/tentang" className="hover:underline">Tentang SIGERSEHAT</Link></li>
              <li><Link to="/batasan-layanan" className="hover:underline">Batasan Layanan</Link></li>
              <li><Link to="/kebijakan-privasi" className="hover:underline">Kebijakan Privasi</Link></li>
              <li><Link to="/edukasi" className="hover:underline">Edukasi Kesehatan</Link></li>
              <li><Link to="/peta" className="hover:underline">Peta Fasilitas Kesehatan</Link></li>
              <li><a href="/images/CREDITS.md" className="hover:underline">Kredit Foto</a></li>
            </ul>
          </nav>
          <div>
            <p className="font-bold text-ink-900">Sumber data</p>
            <p className="mt-2">Rujukan data: Kemenkes RI (Survei Kesehatan Indonesia 2023), Dinas Kesehatan Provinsi Lampung (Profil Kesehatan 2023), BPS Provinsi Lampung (2024), WHO. Fasilitas kesehatan bersumber dari OpenStreetMap dan diverifikasi per titik.</p>
            <p className="mt-2">Hasil skrining dan jawaban AI di platform ini bersifat <strong>edukatif</strong>, <strong>bukan diagnosis</strong>, dan tidak menggantikan pemeriksaan tenaga kesehatan.</p>
            <p className="mt-2 text-ink-500">Terakhir diperbarui: 24 November 2026.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
