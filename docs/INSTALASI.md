# Dokumentasi Instalasi SIGERSEHAT (Lokal)

## Prasyarat
- Node.js 20+ (teruji pada Node 24), npm 10+
- Akun Cloudflare hanya diperlukan untuk deployment production (lihat DEPLOYMENT.md); pengembangan lokal berjalan penuh tanpa akun.

## Langkah
```bash
git clone https://github.com/muhammadaryaaa/sigersehat.git
cd sigersehat
npm install            # bila gagal soal peer dependency eslint: npm install --legacy-peer-deps

# 1) Siapkan basis data lokal (WAJIB sebelum API pertama kali jalan;
#    wrangler dev TIDAK menerapkan migrasi secara otomatis)
npm run db:migrate:local --workspace @sigersehat/api

# 2) (Opsional, lokal) akun admin contoh dari seed pengembangan
#    Berkas: apps/api/src/db/seeds/seed_dev_admin.sql — JANGAN PERNAH di production.

# 3) Jalankan API (http://localhost:8787) dan web (http://localhost:5173) di dua terminal
npm run dev:api
npm run dev:web
```

## Pemeriksaan kesehatan
- `GET http://localhost:8787/health` → `{"data":{"status":"ok","db":"ok","env":"local"}}`
- Web terbuka di http://localhost:5173 dengan judul "SIGERSEHAT — Kesehatan Preventif Lampung".

## Variabel lingkungan
- Web: salin `apps/web/.env.example` → `.env` (`VITE_API_BASE_URL`, kosongkan untuk memakai proxy lokal).
- API lokal: salin `apps/api/.dev.vars.example` → `.dev.vars` (`SESSION_SECRET`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL` — ketiganya opsional; tanpa provider eksternal, SIGERAI memakai Penyusun Retrieval terkurasi).
- **Jangan pernah meng-commit `.env`/`.dev.vars` berisi nilai asli.** Keduanya sudah tercantum di `.gitignore`.

## Perintah berguna
- Build produksi web: `npm run build:web`
- Typecheck: `npx tsc --noEmit` di `apps/api` dan `apps/web`
- Lint: `npx eslint apps/web/src apps/api/src packages`
- Suite QA: lihat `LAPORAN-PENGUJIAN.md` (skrip tersimpan di luar repo: `~/workspace/sigersehat-qa/`).
