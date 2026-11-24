# SIGERSEHAT

Platform Kesehatan Digital Terintegrasi Berbasis AI untuk Provinsi Lampung — preventif: edukasi, skrining risiko, pemantauan, dan informasi fasilitas kesehatan terverifikasi. **Bukan** pengganti rumah sakit, dokter, tenaga kesehatan, atau rekam medis resmi.

Dokumen rancangan: Tahap 1 Analisis Kebutuhan, PRD, Tahap 2 Arsitektur & Database, Tahap 3 UI/UX Design (disimpan di workspace proyek SIGERSEHAT).

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS v4 (`apps/web`)
- Backend: Cloudflare Workers (Hono) REST API (`apps/api`)
- Database: Cloudflare D1 (SQLite) — migration di `apps/api/src/db/migrations`
- Kontrak bersama: `packages/contracts` (bentuk respons, kode error, peran, kode modul)
- Hosting target: Cloudflare Pages (web) + Workers (api)

## Struktur

```text
sigersehat/
├─ apps/
│  ├─ web/            # SPA: src/{components/ui, hooks, lib, pages, routes, styles, types, utils}
│  └─ api/            # Worker: src/{middleware, modules/<14 modul>, domain/rules, db/{migrations,seeds}}
└─ packages/contracts # tipe bersama web <-> api (REC-02 Tahap 2)
```

Setiap modul API adalah folder mandiri (`modules/auth`, `check`, `monitor`, `ai`, `edu`, `women`, `grow`, `elder`, `nutri`, `reminder`, `map`, `med`, `insight`, `admin`, `iot`) dengan pola routes → service → repository.

## Instalasi & menjalankan lokal

Prasyarat: Node.js ≥ 20, npm.

```bash
npm install                      # dari root (npm workspaces)
cp apps/web/.env.example apps/web/.env
cp apps/api/.dev.vars.example apps/api/.dev.vars
npm run db:migrate:local --workspace @sigersehat/api   # buat database lokal + 15 wilayah Lampung
npm run dev:api                  # API di http://localhost:8787  (cek: GET /health)
npm run dev:web                  # Web di http://localhost:5173  (proxy /api -> 8787)
```

Perintah lain: `npm run build:web`, `npm run typecheck`, `npm run lint`, `npm run format`.

## Environment variables

- Web: hanya `VITE_API_BASE_URL` (`.env.example`). Jangan menaruh secret apa pun di frontend.
- API: variabel non-secret di `wrangler.toml [vars]` (`APP_ENV`, `APP_ORIGIN`); secret lewat `.dev.vars` lokal atau `wrangler secret put` di production (`SESSION_SECRET`, `AI_API_KEY`, `AI_API_BASE_URL`, `AI_MODEL`). `.dev.vars` dan `.env` tidak di-commit.

## Database

Migration bernomor `0001`–`0010` (forward-only di production). Membuat migration baru: `npx wrangler d1 migrations create sigersehat-db <nama>` dari `apps/api`. Backup & pemulihan mengikuti REC-01 Tahap 2 (D1 Time Travel + ekspor berkala).

Catatan: `database_id` pada `wrangler.toml` masih placeholder — ganti sesudah `wrangler d1 create sigersehat-db` pada akun Cloudflare tujuan.

## Keamanan (ringkas)

Sesi opak via cookie httpOnly (token tersimpan ter-hash), RBAC 4 lapis, audit log insert-only berantai-hash, data kesehatan tidak pernah di URL/log/penyimpanan browser. Rincian: PRD Bab Keamanan (SEC-01 s.d. SEC-14) dan Tahap 2 Bab 9–10.

## Dokumentasi
- Instalasi lokal: [docs/INSTALASI.md](docs/INSTALASI.md)
- Penggunaan per peran: [docs/PENGGUNAAN.md](docs/PENGGUNAAN.md)
- Database & migrasi: [docs/DATABASE.md](docs/DATABASE.md)
- API: [docs/API.md](docs/API.md)
- Deployment Cloudflare & backup/pemulihan: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- Laporan pengujian: [docs/LAPORAN-PENGUJIAN.md](docs/LAPORAN-PENGUJIAN.md)

## Status deployment (24 November 2026)
Build produksi terverifikasi lokal; deployment Cloudflare **belum dijalankan** — menunggu penambahan izin token (D1/Pages/R2) sesuai docs/DEPLOYMENT.md Bagian 0.
