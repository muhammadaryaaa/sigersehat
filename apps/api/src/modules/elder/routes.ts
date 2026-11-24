import { Hono } from "hono";
// Modul elder — rute diimplementasikan pada tahap modulnya masing-masing (Tahap 2 Bab 3).
// Berkas ini adalah kerangka batas modul (hexagonal): routes -> service -> repository.
export const elderRoutes = new Hono();
