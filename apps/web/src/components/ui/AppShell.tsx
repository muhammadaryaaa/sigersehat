import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Activity, Baby, Bell, BookOpen, ChevronDown, CircleHelp, ClipboardCheck, Cpu, Heart, History, Home, LogOut, MapPin, Menu, MessagesSquare, PhoneCall, Salad, Settings, ShieldCheck, UserRound, Users, X } from "lucide-react";
import { useAuth } from "../../lib/auth";
import { apiFetch } from "../../lib/api";
import { SigerMark } from "./SigerMark";

// Kerangka aplikasi (Revisi UI/UX Putaran 3 mengikuti referensi dashboard):
// - Publik (belum masuk): header atas ramping + navigasi publik.
// - Terlogin: sidebar kiri berkelompok (desktop), laci geser (mobile), dan
//   header atas berisi lonceng notifikasi + menu profil (avatar inisial).
// Seluruh modul tetap tertaut dari sidebar; tidak ada modul yang yatim.
type NavItem = { to: string; label: string; icon: typeof Home };
type NavGroup = { title: string; items: NavItem[] };

const GROUPS_MASYARAKAT: NavGroup[] = [
  { title: "Menu Utama", items: [
    { to: "/beranda", label: "Beranda", icon: Home },
    { to: "/skrining", label: "Periksa Risiko", icon: ClipboardCheck },
    { to: "/pantau", label: "Catat & Pantau", icon: Activity },
    { to: "/edukasi", label: "Edukasi", icon: BookOpen },
    { to: "/tanya", label: "Tanya AI", icon: MessagesSquare },
    { to: "/peta", label: "Peta Faskes", icon: MapPin },
    { to: "/notifikasi", label: "Notifikasi", icon: Bell },
  ] },
  { title: "Kesehatan Keluarga", items: [
    { to: "/keluarga", label: "Keluarga", icon: Users },
    { to: "/perempuan", label: "Perempuan", icon: Heart },
    { to: "/tumbuh", label: "Tumbuh Kembang", icon: Baby },
    { to: "/lansia", label: "Lansia", icon: UserRound },
    { to: "/gizi", label: "Gizi Harian", icon: Salad },
    { to: "/pengingat", label: "Pengingat", icon: Bell },
    { to: "/riwayat", label: "Riwayat", icon: History },
  ] },
  { title: "Akun & Lainnya", items: [
    { to: "/izin", label: "Izin & Nakes", icon: ShieldCheck },
    { to: "/iot", label: "Perangkat IoT", icon: Cpu },
    { to: "/akun", label: "Pengaturan", icon: Settings },
    { to: "/bantuan", label: "Bantuan", icon: CircleHelp },
  ] },
];
const GROUPS_NAKES: NavGroup[] = [
  { title: "Menu Utama", items: [
    { to: "/nakes/beranda", label: "Beranda Nakes", icon: Home },
    { to: "/nakes/pasien", label: "Pasien Saya", icon: Users },
    { to: "/edukasi", label: "Edukasi", icon: BookOpen },
    { to: "/peta", label: "Peta Faskes", icon: MapPin },
    { to: "/notifikasi", label: "Notifikasi", icon: Bell },
  ] },
  { title: "Akun & Lainnya", items: [
    { to: "/akun", label: "Pengaturan", icon: Settings },
    { to: "/bantuan", label: "Bantuan", icon: CircleHelp },
  ] },
];
const GROUPS_ADMIN: NavGroup[] = [
  { title: "Administrasi", items: [
    { to: "/admin/beranda", label: "Beranda Admin", icon: Home },
    { to: "/admin/kelola", label: "Kelola", icon: Users },
    { to: "/admin/konten", label: "Konten & AI", icon: BookOpen },
    { to: "/admin/insight", label: "Insight", icon: Activity },
    { to: "/notifikasi", label: "Notifikasi", icon: Bell },
  ] },
  { title: "Akun & Lainnya", items: [
    { to: "/akun", label: "Pengaturan", icon: Settings },
    { to: "/bantuan", label: "Bantuan", icon: CircleHelp },
  ] },
];
const NAV_PUBLIC = [
  { to: "/", label: "Beranda" },
  { to: "/skrining", label: "Skrining" },
  { to: "/edukasi", label: "Edukasi" },
  { to: "/peta", label: "Peta Faskes" },
  { to: "/tentang", label: "Tentang" },
];
const ROLE_LABEL: Record<string, string> = { masyarakat: "Pengguna", nakes: "Tenaga Kesehatan", admin: "Administrator", super_admin: "Super Administrator" };

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "S";
}

function SidebarNav({ groups, unread, onNavigate }: { groups: NavGroup[]; unread: number; onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigasi layanan" className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-ink-500">{g.title}</p>
          <ul className="mt-1.5 flex flex-col gap-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} onClick={onNavigate} className={({ isActive }) => `flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold transition-colors ${isActive ? "bg-brand-600 text-white shadow-card" : "text-ink-600 hover:bg-brand-50 hover:text-ink-900"}`}>
                  <it.icon size={19} aria-hidden="true" /> {it.label}
                  {it.to === "/notifikasi" && unread > 0 ? <span className="ml-auto inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger-700 px-1 text-[11px] font-bold text-white">{unread}</span> : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);
  const routeLoc = useLocation();
  useEffect(() => { setDrawer(false); setMenuOpen(false); }, [routeLoc.pathname]);
  useEffect(() => {
    if (!me) { setUnread(0); return; }
    apiFetch<{ is_read: number }[]>("/api/v1/notifications")
      .then((rows) => setUnread(rows.filter((r) => !r.is_read).length))
      .catch(() => {});
  }, [me, location.pathname]);
  function setDisplay(mode: string) {
    if (mode === "elderly") { document.documentElement.dataset.display = "elderly"; localStorage.setItem("siger_display", "elderly"); }
    else { delete document.documentElement.dataset.display; localStorage.setItem("siger_display", "standard"); }
  }
  const role = me?.user?.role;
  const home = me ? (role === "nakes" ? "/nakes/beranda" : role === "admin" || role === "super_admin" ? "/admin/beranda" : "/beranda") : "/";
  const groups = !me ? null : role === "nakes" ? GROUPS_NAKES : role === "admin" || role === "super_admin" ? GROUPS_ADMIN : GROUPS_MASYARAKAT;
  const fullName = me?.profile?.full_name ?? "Pengguna";

  const footer = (
    <>
      <div className="tapis-band" aria-hidden="true" />
      <footer className="bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 text-sm text-ink-600 md:grid-cols-3">
          <div>
            <SigerMark />
            <p className="mt-3">Platform kesehatan preventif untuk masyarakat Provinsi Lampung: skrining awal, edukasi, pemantauan, dan informasi fasilitas kesehatan.</p>
            <p className="mt-3 rounded-card bg-danger-50 p-3 text-danger-700"><strong>Darurat?</strong> Hubungi <a href="tel:119" className="font-bold underline">119</a> atau datangi IGD terdekat. Jangan menunggu jawaban dari platform ini.</p>
          </div>
          <nav aria-label="Tautan footer">
            <p className="font-bold text-ink-900">Jelajahi</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              <li><Link to="/tentang" className="hover:underline">Tentang SIGERSEHAT</Link></li>
              <li><Link to="/bantuan" className="hover:underline">Pusat Bantuan</Link></li>
              <li><Link to="/batasan-layanan" className="hover:underline">Batasan Layanan</Link></li>
              <li><Link to="/kebijakan-privasi" className="hover:underline">Kebijakan Privasi</Link></li>
              <li><Link to="/edukasi" className="hover:underline">Edukasi Kesehatan</Link></li>
              <li><Link to="/peta" className="hover:underline">Peta Fasilitas Kesehatan</Link></li>
              <li><a href="/images/CREDITS.md" className="hover:underline">Kredit Foto</a></li>
            </ul>
          </nav>
          <div>
            <p className="font-bold text-ink-900">Sumber data</p>
            <p className="mt-2">Rujukan data: Kemenkes RI (Survei Kesehatan Indonesia 2023), Dinas Kesehatan Provinsi Lampung (Profil Kesehatan 2023), BPS Provinsi Lampung (2024), WHO. Fasilitas kesehatan bersumber dari data terbuka OpenStreetMap untuk seluruh kabupaten/kota di Lampung, ditambah titik kurasi terverifikasi.</p>
            <p className="mt-2">Hasil skrining dan jawaban AI di platform ini bersifat <strong>edukatif</strong>, <strong>bukan diagnosis</strong>, dan tidak menggantikan pemeriksaan tenaga kesehatan.</p>
            <p className="mt-2 text-ink-500">Dikembangkan oleh Kelompok Ditolak UGM. Terakhir diperbarui: 25 November 2026.</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-semibold text-ink-900">Ukuran teks:</span>
              <button type="button" onClick={() => setDisplay("standard")} className="min-h-10 rounded-btn border border-line px-3 font-semibold hover:bg-brand-50">Standar</button>
              <button type="button" onClick={() => setDisplay("elderly")} className="min-h-10 rounded-btn border border-line px-3 font-semibold hover:bg-brand-50">Besar (lansia)</button>
            </div>
          </div>
        </div>
      </footer>
    </>
  );

  if (!me || !groups) {
    return (
      <div className="min-h-screen bg-canvas">
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
            <Link to={home} aria-label="SIGERSEHAT — beranda"><SigerMark /></Link>
            <nav aria-label="Navigasi utama" className="ml-4 hidden items-center gap-1 lg:flex">
              {NAV_PUBLIC.map((it) => (
                <NavLink key={it.to} to={it.to} className={({ isActive }) => `inline-flex min-h-10 items-center rounded-btn px-3 text-[15px] font-semibold ${isActive ? "text-brand-800 underline underline-offset-4" : "text-ink-600 hover:text-ink-900"}`}>{it.label}</NavLink>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <a href="tel:119" className="hidden min-h-10 items-center gap-1.5 rounded-btn px-2 text-sm font-bold text-danger-700 sm:inline-flex"><PhoneCall size={16} aria-hidden="true" /> Darurat 119</a>
              <Link to="/masuk" className="inline-flex min-h-10 items-center rounded-btn px-3 text-sm font-semibold text-ink-900">Masuk</Link>
              <Link to="/skrining" className="inline-flex min-h-10 items-center rounded-btn bg-brand-600 px-4 text-sm font-semibold text-white shadow-card">Periksa Risiko</Link>
            </div>
          </div>
          <nav aria-label="Navigasi utama" className="border-t border-line/60 lg:hidden">
            <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-1.5">
              {NAV_PUBLIC.map((it) => (
                <li key={it.to} className="shrink-0">
                  <NavLink to={it.to} className={({ isActive }) => `inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold ${isActive ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-brand-50"}`}>{it.label}</NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        {children}
        {footer}
      </div>
    );
  }

  const sidebarInner = (
    <>
      <Link to={home} aria-label="SIGERSEHAT — beranda" className="px-1"><SigerMark tagline /></Link>
      <div className="mt-6 flex-1 overflow-y-auto pr-1"><SidebarNav groups={groups} unread={unread} onNavigate={() => setDrawer(false)} /></div>
      {role === "masyarakat" ? (
        <div className="relative mt-5 overflow-hidden rounded-card shadow-card">
          <img src="/images/menara-siger-480.webp" alt="" width={480} height={320} loading="lazy" className="h-32 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-800/90 via-brand-800/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-3.5 text-white">
            <p className="text-sm font-bold leading-snug">Lampung Sehat Bersama SIGERSEHAT</p>
            <Link to="/tentang" className="mt-2 inline-flex min-h-9 items-center rounded-full bg-white/95 px-3 text-xs font-bold text-brand-800">Pelajari Lebih Lanjut</Link>
          </div>
        </div>
      ) : null}
      <p className="mt-4 rounded-card bg-danger-50 p-3 text-[13px] leading-snug text-danger-700"><strong>Darurat?</strong> Hubungi <a href="tel:119" className="font-bold underline">119</a> atau ke IGD terdekat.</p>
    </>
  );

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <aside className="sticky top-0 hidden h-screen w-[264px] shrink-0 flex-col border-r border-line bg-white px-4 py-5 lg:flex" aria-label="Panel samping">
        {sidebarInner}
      </aside>
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button type="button" aria-label="Tutup menu" onClick={() => setDrawer(false)} className="absolute inset-0 h-full w-full bg-ink-900/50" />
          <div className="route-enter absolute inset-y-0 left-0 flex w-[280px] flex-col overflow-y-auto bg-white px-4 py-5 shadow-lift">
            <button type="button" onClick={() => setDrawer(false)} className="absolute right-3 top-3 inline-flex min-h-10 min-w-10 items-center justify-center rounded-btn hover:bg-brand-50" aria-label="Tutup menu"><X size={20} aria-hidden="true" /></button>
            {sidebarInner}
          </div>
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <button type="button" onClick={() => setDrawer(true)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-btn hover:bg-brand-50 lg:hidden" aria-label="Buka menu navigasi"><Menu size={22} aria-hidden="true" /></button>
            <Link to={home} className="lg:hidden" aria-label="SIGERSEHAT — beranda"><SigerMark compact /></Link>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <a href="tel:119" className="hidden min-h-10 items-center gap-1.5 rounded-btn px-2 text-sm font-bold text-danger-700 md:inline-flex"><PhoneCall size={16} aria-hidden="true" /> Darurat 119</a>
              <Link to="/notifikasi" aria-label={unread ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"} className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-brand-50">
                <Bell size={21} aria-hidden="true" />
                {unread > 0 ? <span className="absolute right-1 top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger-700 px-1 text-[11px] font-bold text-white">{unread}</span> : null}
              </Link>
              <div className="relative">
                <button type="button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)} className="flex min-h-11 items-center gap-2.5 rounded-full py-1 pl-1 pr-2 hover:bg-brand-50">
                  <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{initials(fullName)}</span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-40 truncate text-sm font-bold text-ink-900">{fullName}</span>
                    <span className="block text-xs text-ink-500">{ROLE_LABEL[role ?? ""] ?? "Pengguna"}</span>
                  </span>
                  <ChevronDown size={16} aria-hidden="true" className="text-ink-500" />
                </button>
                {menuOpen ? (
                  <div role="menu" className="route-enter absolute right-0 top-full z-50 mt-1.5 w-56 rounded-card border border-line bg-white p-1.5 shadow-lift">
                    <Link role="menuitem" to={home} onClick={() => setMenuOpen(false)} className="block rounded-btn px-3 py-2.5 text-sm font-medium hover:bg-brand-50">Beranda saya</Link>
                    <Link role="menuitem" to="/akun" onClick={() => setMenuOpen(false)} className="block rounded-btn px-3 py-2.5 text-sm font-medium hover:bg-brand-50">Pengaturan akun</Link>
                    <Link role="menuitem" to="/bantuan" onClick={() => setMenuOpen(false)} className="block rounded-btn px-3 py-2.5 text-sm font-medium hover:bg-brand-50">Pusat bantuan</Link>
                    <button role="menuitem" type="button" onClick={async () => { await logout(); location.href = "/"; }} className="flex w-full items-center gap-1.5 rounded-btn px-3 py-2.5 text-left text-sm font-medium text-danger-700 hover:bg-danger-50"><LogOut size={15} aria-hidden="true" /> Keluar</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        {footer}
      </div>
    </div>
  );
}
