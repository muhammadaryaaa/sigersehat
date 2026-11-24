import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
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
import { ProtectedRoute } from "../components/ui/ProtectedRoute";
import { AppShell } from "../components/ui/AppShell";

export const router = createBrowserRouter([
  { path: "/", element: <AppShell><LandingPage /></AppShell> },
  { path: "/masuk", element: <LoginPage /> },
  { path: "/daftar", element: <RegisterPage /> },
  { path: "/lupa-kata-sandi", element: <ForgotPage /> },
  { path: "/atur-ulang", element: <ResetPage /> },
  { path: "/edukasi", element: <AppShell><EduPage /></AppShell> },
  { path: "/edukasi/:slug", element: <AppShell><ArticlePage /></AppShell> },
  { path: "/kuis/:id", element: <AppShell><QuizPage /></AppShell> },
  { path: "/peta", element: <AppShell><Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-8">Peta sedang dimuat…</p>}><MapPage /></Suspense></AppShell> },
  { path: "/beranda", element: <ProtectedRoute roles={["masyarakat", "nakes"]}><AppShell><DashboardMasyarakat /></AppShell></ProtectedRoute> },
  { path: "/akun", element: <ProtectedRoute roles={["masyarakat", "nakes", "admin", "super_admin"]}><AppShell><AccountPage /></AppShell></ProtectedRoute> },
  { path: "/skrining", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><ScreeningPage /></AppShell></ProtectedRoute> },
  { path: "/pantau", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><MonitorPage /></AppShell></ProtectedRoute> },
  { path: "/pengingat", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><ReminderPage /></AppShell></ProtectedRoute> },
  { path: "/riwayat", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><HistoryPage /></AppShell></ProtectedRoute> },
  { path: "/keluarga", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><FamilyPage /></AppShell></ProtectedRoute> },
  { path: "/perempuan", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><WomenPage /></AppShell></ProtectedRoute> },
  { path: "/tumbuh", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><GrowPage /></AppShell></ProtectedRoute> },
  { path: "/lansia", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><ElderPage /></AppShell></ProtectedRoute> },
  { path: "/gizi", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><NutriPage /></AppShell></ProtectedRoute> },
  { path: "/iot", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><IotPage /></AppShell></ProtectedRoute> },
  { path: "/tanya", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><AiPage /></AppShell></ProtectedRoute> },
  { path: "/izin", element: <ProtectedRoute roles={["masyarakat"]}><AppShell><ConsentPage /></AppShell></ProtectedRoute> },
  { path: "/nakes/beranda", element: <ProtectedRoute roles={["nakes"]}><AppShell><DashboardNakes /></AppShell></ProtectedRoute> },
  { path: "/nakes/pasien", element: <ProtectedRoute roles={["nakes"]}><AppShell><MedPage /></AppShell></ProtectedRoute> },
  { path: "/admin/beranda", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><DashboardAdmin /></AppShell></ProtectedRoute> },
  { path: "/admin/konten", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><AdminEduPage /></AppShell></ProtectedRoute> },
  { path: "/admin/kelola", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><AdminManagePage /></AppShell></ProtectedRoute> },
  { path: "/admin/insight", element: <ProtectedRoute roles={["admin", "super_admin"]}><AppShell><InsightPage /></AppShell></ProtectedRoute> },
  { path: "*", element: <PlaceholderPage title="Halaman Tidak Ditemukan" /> },
]);
