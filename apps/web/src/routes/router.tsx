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

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/masuk", element: <LoginPage /> },
  { path: "/daftar", element: <RegisterPage /> },
  { path: "/lupa-kata-sandi", element: <ForgotPage /> },
  { path: "/atur-ulang", element: <ResetPage /> },
  { path: "/edukasi", element: <EduPage /> },
  { path: "/edukasi/:slug", element: <ArticlePage /> },
  { path: "/kuis/:id", element: <QuizPage /> },
  { path: "/peta", element: <Suspense fallback={<p className="mx-auto max-w-3xl px-4 py-8">Peta sedang dimuat…</p>}><MapPage /></Suspense> },
  { path: "/beranda", element: <ProtectedRoute roles={["masyarakat", "nakes"]}><DashboardMasyarakat /></ProtectedRoute> },
  { path: "/akun", element: <ProtectedRoute roles={["masyarakat", "nakes", "admin", "super_admin"]}><AccountPage /></ProtectedRoute> },
  { path: "/skrining", element: <ProtectedRoute roles={["masyarakat"]}><ScreeningPage /></ProtectedRoute> },
  { path: "/pantau", element: <ProtectedRoute roles={["masyarakat"]}><MonitorPage /></ProtectedRoute> },
  { path: "/pengingat", element: <ProtectedRoute roles={["masyarakat"]}><ReminderPage /></ProtectedRoute> },
  { path: "/riwayat", element: <ProtectedRoute roles={["masyarakat"]}><HistoryPage /></ProtectedRoute> },
  { path: "/keluarga", element: <ProtectedRoute roles={["masyarakat"]}><FamilyPage /></ProtectedRoute> },
  { path: "/perempuan", element: <ProtectedRoute roles={["masyarakat"]}><WomenPage /></ProtectedRoute> },
  { path: "/tumbuh", element: <ProtectedRoute roles={["masyarakat"]}><GrowPage /></ProtectedRoute> },
  { path: "/lansia", element: <ProtectedRoute roles={["masyarakat"]}><ElderPage /></ProtectedRoute> },
  { path: "/gizi", element: <ProtectedRoute roles={["masyarakat"]}><NutriPage /></ProtectedRoute> },
  { path: "/iot", element: <ProtectedRoute roles={["masyarakat"]}><IotPage /></ProtectedRoute> },
  { path: "/tanya", element: <ProtectedRoute roles={["masyarakat"]}><AiPage /></ProtectedRoute> },
  { path: "/izin", element: <ProtectedRoute roles={["masyarakat"]}><ConsentPage /></ProtectedRoute> },
  { path: "/nakes/beranda", element: <ProtectedRoute roles={["nakes"]}><DashboardNakes /></ProtectedRoute> },
  { path: "/nakes/pasien", element: <ProtectedRoute roles={["nakes"]}><MedPage /></ProtectedRoute> },
  { path: "/admin/beranda", element: <ProtectedRoute roles={["admin", "super_admin"]}><DashboardAdmin /></ProtectedRoute> },
  { path: "/admin/konten", element: <ProtectedRoute roles={["admin", "super_admin"]}><AdminEduPage /></ProtectedRoute> },
  { path: "/admin/kelola", element: <ProtectedRoute roles={["admin", "super_admin"]}><AdminManagePage /></ProtectedRoute> },
  { path: "/admin/insight", element: <ProtectedRoute roles={["admin", "super_admin"]}><InsightPage /></ProtectedRoute> },
  { path: "*", element: <PlaceholderPage title="Halaman Tidak Ditemukan" /> },
]);
