import { Hono } from "hono";
// Modul profiles — rute diimplementasikan pada tahap modulnya masing-masing (Tahap 2 Bab 3).
// Berkas ini adalah kerangka batas modul (hexagonal): routes -> service -> repository.
export const profilesRoutes = new Hono();
