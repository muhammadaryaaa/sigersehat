import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ForgotPage, ResetPage } from "../pages/ResetPages";
import { DashboardMasyarakat } from "../pages/DashboardMasyarakat";
import { DashboardNakes } from "../pages/DashboardNakes";
import { DashboardAdmin } from "../pages/DashboardAdmin";
import { AccountPage } from "../pages/AccountPage";
import { ScreeningPage } from "../pages/ScreeningPage";
import { MonitorPage } from "../pages/MonitorPage";
import { ReminderPage } from "../pages/ReminderPage";
import { HistoryPage } from "../pages/HistoryPage";
import { EduPage, ArticlePage, QuizPage } from "../pages/EduPages";
import { AiPage } from "../pages/AiPage";
import { AdminEduPage } from "../pages/AdminEduPage";
import { FamilyPage } from "../pages/FamilyPage";
import { WomenPage } from "../pages/WomenPage";
import { GrowPage } from "../pages/GrowPage";
import { ElderPage } from "../pages/ElderPage";
import { NutriPage } from "../pages/NutriPage";
import { lazy, Suspense } from "react";
const MapPage = lazy(() => import("../pages/MapPage").then((m) => ({ default: m.MapPage })));
import { ConsentPage } from "../pages/ConsentPage";
import { MedPage } from "../pages/MedPage";
import { AdminManagePage } from "../pages/AdminManagePage";
import { InsightPage } from "../pages/InsightPage";
import { IotPage } from "../pages/IotPage";
import { NotificationsPage } from "../pages/NotificationsPage";
import { HelpPage } from "../pages/HelpPage";
import { ProtectedRoute } from "../components/ui/ProtectedRoute";
import { AppShell } from "../components/ui/AppShell";
import { AboutPage, ServiceLimitsPage, PrivacyPage } from "../pages/InfoPages";

export const router = createBrowserRouter([
  { path: "/", element: <AppShell><LandingPage /></AppShell> },
  { path: "/masuk", element: <LoginPage /> },
  { path: "/daftar", element: <RegisterPage /> },
  { path: "/lupa-kata-sandi", element: <ForgotPage /> },
  { path: "/atur-ulang", element: <ResetPage /> },
  { path: "/tentang", element: <AppShell><AboutPage /></AppShell> },
  { path: "/batasan-layanan", element: <AppShell><ServiceLimitsPage /></AppShell> },
  { path: "/kebijakan-privasi", element: <AppShell><PrivacyPage /></AppShell> },
  { path: "/edukasi", element: <AppShell><EduPage /></AppShell> },
  { path: "/edukasi/:slug", element: <AppShell><ArticlePage /></AppShell> },
  { path: "/kuis/:id", element: <AppShell><QuizPage /></AppShell> },
  { path: "/peta", element: <AppShell><Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-8">Peta sedang dimuat…</p>}><MapPage /></Suspense></AppShell> },
  { path: "/beranda", element: <ProtectedRoute locked={{ title: "Beranda Saya", description: "Ringkasan kesehatanmu hari ini.", points: ["Hasil skrining terakhir dan tren singkatmu", "Pengingat terdekat dan jalan pintas ke semua layanan"] }} roles={["masyarakat", "nakes"]}><AppShell><DashboardMasyarakat /></AppShell></ProtectedRoute> },
  { path: "/notifikasi", element: <ProtectedRoute roles={["masyarakat", "nakes", "admin", "super_admin"]}><AppShell><NotificationsPage /></AppShell></ProtectedRoute> },
  { path: "/bantuan", element: <AppShell><HelpPage /></AppShell> },
  { path: "/akun", element: <ProtectedRoute roles={["masyarakat", "nakes", "admin", "super_admin"]}><AppShell><AccountPage /></AppShell></ProtectedRoute> },
  { path: "/skrining", element: <AppShell><ScreeningPage /></AppShell> },
  { path: "/pantau", element: <ProtectedRoute locked={{ title: "Catat & Pantau", description: "Catatan tekanan darah, gula darah, dan berat badanmu beserta grafik trennya.", points: ["Catatan pengukuran tersimpan dan dapat dikoreksi, bukan dihapus diam-diam", "Grafik tren dari datamu sendiri, bukan data contoh", "Ekspor rekap untuk dibawa ke tenaga kesehatan"] }} roles={["masyarakat"]}><AppShell><MonitorPage /></AppShell></ProtectedRoute> },
  { path: "/pengingat", element: <ProtectedRoute locked={{ title: "Pengingat", description: "Pengingat kontrol, imunisasi, dan jadwal kesehatanmu.", points: ["Pengingat berulang sesuai jadwal yang kamu atur", "Notifikasi di dalam situs saat pengingat jatuh tempo"] }} roles={["masyarakat"]}><AppShell><ReminderPage /></AppShell></ProtectedRoute> },
  { path: "/riwayat", element: <ProtectedRoute locked={{ title: "Riwayat Kesehatan", description: "Garis waktu catatan dan hasil skriningmu.", points: ["Hasil skrining tersimpan untuk dibandingkan dari waktu ke waktu", "Catatan pengukuran dan imunisasi dalam satu garis waktu"] }} roles={["masyarakat"]}><AppShell><HistoryPage /></AppShell></ProtectedRoute> },
  { path: "/keluarga", element: <ProtectedRoute locked={{ title: "Profil Keluarga", description: "Profil anggota keluarga yang kamu kelola.", points: ["Profil anak dan lansia dalam satu akun", "Persetujuan wali tercatat untuk profil anak"] }} roles={["masyarakat"]}><AppShell><FamilyPage /></AppShell></ProtectedRoute> },
  { path: "/perempuan", element: <ProtectedRoute locked={{ title: "Kesehatan Perempuan", description: "Pencatatan siklus dan kehamilan yang bersifat pribadi.", points: ["Siklus dan kunjungan ANC tercatat rapi", "Pengingat kunjungan kehamilan otomatis"] }} roles={["masyarakat"]}><AppShell><WomenPage /></AppShell></ProtectedRoute> },
  { path: "/tumbuh", element: <ProtectedRoute locked={{ title: "Tumbuh Kembang Anak", description: "Pantau pertumbuhan dan imunisasi anakmu.", points: ["Penilaian pertumbuhan menurut standar WHO/Kemenkes", "Status imunisasi: selesai, berikutnya, jatuh tempo"] }} roles={["masyarakat"]}><AppShell><GrowPage /></AppShell></ProtectedRoute> },
  { path: "/lansia", element: <ProtectedRoute locked={{ title: "Kesehatan Lansia", description: "Jadwal obat dan target kesehatan lansia.", points: ["Daftar obat aktif dan jadwal minum", "Target kesehatan yang dipantau bersama keluarga"] }} roles={["masyarakat"]}><AppShell><ElderPage /></AppShell></ProtectedRoute> },
  { path: "/gizi", element: <ProtectedRoute locked={{ title: "Gizi Harian", description: "Target dan catatan gizi harianmu.", points: ["Target garam, gula, sayur-buah, dan air harian", "Rujukan komposisi pangan lokal Lampung (TKPI)"] }} roles={["masyarakat"]}><AppShell><NutriPage /></AppShell></ProtectedRoute> },
  { path: "/iot", element: <ProtectedRoute locked={{ title: "Perangkat IoT", description: "Penautan perangkat pemantau kesehatan.", points: ["Token perangkat ditampilkan sekali dan tersimpan ter-hash", "Pembacaan simulator selalu berlabel SIMULASI"] }} roles={["masyarakat"]}><AppShell><IotPage /></AppShell></ProtectedRoute> },
  { path: "/tanya", element: <AppShell><AiPage /></AppShell> },
  { path: "/izin", element: <ProtectedRoute locked={{ title: "Persetujuan Berbagi Data", description: "Atur siapa tenaga kesehatan yang boleh melihat datamu.", points: ["Persetujuan aktif per tenaga kesehatan dan per cakupan", "Dapat dicabut kapan saja; setiap akses tercatat di log audit"] }} roles={["masyarakat"]}><AppShell><ConsentPage /></AppShell></ProtectedRoute> },
  { path: "/nakes/beranda", element: <ProtectedRoute roles={["nakes"]}><AppShell><DashboardNakes /></AppShell></ProtectedRoute> },
  { path: "/nakes/pasien", element: <ProtectedRoute roles={["nakes"]}><AppShell><MedPage /></AppShell></ProtectedRoute> },
  { path: "/admin/beranda", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><DashboardAdmin /></AppShell></ProtectedRoute> },
  { path: "/admin/konten", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><AdminEduPage /></AppShell></ProtectedRoute> },
  { path: "/admin/kelola", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><AdminManagePage /></AppShell></ProtectedRoute> },
  { path: "/admin/insight", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><InsightPage /></AppShell></ProtectedRoute> },
  { path: "*", element: <AppShell><NotFoundPage /></AppShell> },
]);
