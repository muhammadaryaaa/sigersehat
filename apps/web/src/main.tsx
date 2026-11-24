import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Preferensi tampilan tersimpan lokal (berlaku juga tanpa akun).
try { if (localStorage.getItem("siger_display") === "elderly") document.documentElement.dataset.display = "elderly"; } catch { /* abaikan */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA ringan: daftarkan service worker aset statis hanya di produksi.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}
