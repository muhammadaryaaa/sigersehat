import { Hono } from "hono";
// Modul women — rute diimplementasikan pada tahap modulnya masing-masing (Tahap 2 Bab 3).
// Berkas ini adalah kerangka batas modul (hexagonal): routes -> service -> repository.
export const womenRoutes = new Hono();
