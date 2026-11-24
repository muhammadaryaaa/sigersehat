import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { Activity, Baby, Bell, BookOpen, ClipboardCheck, Cpu, Heart, History, Home, LogOut, MapPin, MessagesSquare, Salad, ShieldCheck, UserRound, Users } from "lucide-react";
import { useAuth } from "../../lib/auth";

// Kerangka aplikasi bersama: header lengket + navigasi lengkap semua modul.
// Satu-satunya tempat daftar menu didefinisikan, supaya tidak ada lagi modul
// yang hidup tetapi tidak tertaut dari mana pun (temuan audit 24 Nov 2026:
// Edukasi & Tanya AI tidak muncul di menu mana pun).
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
  { to: "/", label: "Beranda", icon: Home },
  { to: "/edukasi", label: "Edukasi", icon: BookOpen },
  { to: "/peta", label: "Peta Faskes", icon: MapPin },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const role = me?.user?.role;
  const items = !me ? NAV_PUBLIC : role === "nakes" ? NAV_NAKES : role === "admin" || role === "super_admin" ? NAV_ADMIN : NAV_MASYARAKAT;
  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link to={me ? (role === "nakes" ? "/nakes/beranda" : role === "admin" || role === "super_admin" ? "/admin/beranda" : "/beranda") : "/"} className="text-lg font-extrabold tracking-tight text-brand-800">SIGERSEHAT</Link>
          <div className="ml-auto flex items-center gap-2">
            {me ? <>
              <Link to="/akun" className="inline-flex min-h-10 items-center rounded-btn border border-line bg-white px-3 text-sm font-semibold">Akun</Link>
              <button type="button" onClick={async () => { await logout(); location.href = "/"; }} className="inline-flex min-h-10 items-center gap-1.5 rounded-btn border border-line bg-white px-3 text-sm font-semibold"><LogOut size={16} aria-hidden="true" /> Keluar</button>
            </> : <>
              <Link to="/masuk" className="inline-flex min-h-10 items-center rounded-btn border border-line bg-white px-3 text-sm font-semibold">Masuk</Link>
              <Link to="/daftar" className="inline-flex min-h-10 items-center rounded-btn bg-brand-800 px-3 text-sm font-semibold text-white">Daftar</Link>
            </>}
          </div>
        </div>
        <nav aria-label="Navigasi utama" className="border-t border-line/60">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-1.5">
            {items.map((it) => (
              <li key={it.to} className="shrink-0">
                <NavLink to={it.to} className={({ isActive }) => `inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold ${isActive ? "bg-brand-800 text-white" : "text-ink-600 hover:bg-brand-50"}`}>
                  <it.icon size={16} aria-hidden="true" /> {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {children}
      <footer className="border-t border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-600">
          <p className="font-bold text-ink-900">SIGERSEHAT — Kesehatan Preventif Lampung</p>
          <p className="mt-1">Hasil skrining di platform ini <strong>bukan diagnosis</strong> dan tidak menggantikan pemeriksaan tenaga kesehatan. Dalam keadaan darurat, hubungi <strong>119</strong> atau datangi IGD terdekat.</p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/edukasi" className="font-semibold text-brand-800">Edukasi</Link>
            <Link to="/peta" className="font-semibold text-brand-800">Peta Fasilitas Kesehatan</Link>
            <Link to="/izin" className="font-semibold text-brand-800">Izin &amp; Privasi</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
