import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "../pages/LandingPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/masuk", element: <PlaceholderPage title="Masuk" /> },
  { path: "/daftar", element: <PlaceholderPage title="Daftar" /> },
  { path: "/edukasi", element: <PlaceholderPage title="Edukasi" /> },
  { path: "/peta", element: <PlaceholderPage title="Peta Fasilitas Kesehatan" /> },
  { path: "/beranda", element: <PlaceholderPage title="Beranda" /> },
  { path: "/skrining", element: <PlaceholderPage title="Periksa Risiko" /> },
  { path: "/pantau", element: <PlaceholderPage title="Catat & Pantau" /> },
  { path: "/keluarga", element: <PlaceholderPage title="Keluargaku" /> },
  { path: "/tanya", element: <PlaceholderPage title="Tanya SIGERAI" /> },
  { path: "/izin", element: <PlaceholderPage title="Izin & Privasi" /> },
  { path: "/nakes/beranda", element: <PlaceholderPage title="Beranda Tenaga Kesehatan" /> },
  { path: "/admin/beranda", element: <PlaceholderPage title="Beranda Administrator" /> },
  { path: "*", element: <PlaceholderPage title="Halaman Tidak Ditemukan" /> },
]);
