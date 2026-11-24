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
import { ProtectedRoute } from "../components/ui/ProtectedRoute";

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/masuk", element: <LoginPage /> },
  { path: "/daftar", element: <RegisterPage /> },
  { path: "/lupa-kata-sandi", element: <ForgotPage /> },
  { path: "/atur-ulang", element: <ResetPage /> },
  { path: "/edukasi", element: <PlaceholderPage title="Edukasi" /> },
  { path: "/peta", element: <PlaceholderPage title="Peta Fasilitas Kesehatan" /> },
  { path: "/beranda", element: <ProtectedRoute roles={["masyarakat", "nakes"]}><DashboardMasyarakat /></ProtectedRoute> },
  { path: "/akun", element: <ProtectedRoute roles={["masyarakat", "nakes", "admin", "super_admin"]}><AccountPage /></ProtectedRoute> },
  { path: "/skrining", element: <ProtectedRoute roles={["masyarakat"]}><PlaceholderPage title="Periksa Risiko" /></ProtectedRoute> },
  { path: "/pantau", element: <ProtectedRoute roles={["masyarakat"]}><PlaceholderPage title="Catat & Pantau" /></ProtectedRoute> },
  { path: "/keluarga", element: <ProtectedRoute roles={["masyarakat"]}><PlaceholderPage title="Keluargaku" /></ProtectedRoute> },
  { path: "/tanya", element: <ProtectedRoute roles={["masyarakat"]}><PlaceholderPage title="Tanya SIGERAI" /></ProtectedRoute> },
  { path: "/izin", element: <ProtectedRoute roles={["masyarakat"]}><PlaceholderPage title="Izin & Privasi" /></ProtectedRoute> },
  { path: "/nakes/beranda", element: <ProtectedRoute roles={["nakes"]}><DashboardNakes /></ProtectedRoute> },
  { path: "/admin/beranda", element: <ProtectedRoute roles={["admin", "super_admin"]}><DashboardAdmin /></ProtectedRoute> },
  { path: "*", element: <PlaceholderPage title="Halaman Tidak Ditemukan" /> },
]);
