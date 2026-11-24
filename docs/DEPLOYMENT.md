# Panduan Deployment SIGERSEHAT (Cloudflare)

Arsitektur production: **Pages** (frontend statis) + **Workers** (API) + **D1** (database) + **R2** (berkas kredensial nakes, privat). HTTPS otomatis pada domain `*.pages.dev` dan `*.workers.dev`; domain khusus dapat ditambahkan kemudian di dasbor Cloudflare.

## 0. Prasyarat izin (PENTING — status 24 Nov 2026)
Token API Cloudflare yang terhubung ke Muse saat ini hanya memiliki izin **Workers Scripts** dan **KV**. Probe langsung 24 Nov 2026: D1 → 401, Pages → 403, R2 → 403. Agar deployment dapat dijalankan, tambahkan pada token (Cloudflare Dashboard → My Profile → API Tokens → Edit):
- **Account — D1 — Edit**
- **Account — Cloudflare Pages — Edit**
- **Account — Workers R2 Storage — Edit**
- **Account — Workers Scripts — Edit** (sudah ada)
dengan Account Resources = akun `project-ma` (id 1c64e4edf3f07cf47c09c7c278848cdf).
Alternatif: jalankan `wrangler login` dari komputer yang memiliki browser dan biarkan sesi OAuth dipakai perintah-perintah di bawah.

## 1. Database produksi
```bash
cd apps/api
npx wrangler d1 create sigersehat-db          # catat database_id hasilnya
# tempel database_id ke apps/api/wrangler.toml menggantikan placeholder 00000000-...
npx wrangler d1 migrations apply sigersehat-db --remote
npx wrangler r2 bucket create sigersehat-files
```
Jangan menjalankan seed pengembangan (`seed_dev_admin.sql`) di production. Akun admin production pertama dibuat lewat registrasi biasa lalu perannya dinaikkan super admin melalui SQL terkontrol oleh pemilik akun.

## 2. Secret & variabel Worker
```bash
npx wrangler secret put SESSION_SECRET        # nilai acak panjang; jangan dicatat di repo/chat
# Opsional (SIGERAI dengan model eksternal):
npx wrangler secret put AI_API_KEY
npx wrangler secret put AI_API_BASE_URL
npx wrangler secret put AI_MODEL
```
Tanpa secret AI, SIGERAI tetap berfungsi memakai Penyusun Retrieval terkurasi (jawaban hanya dari sumber aktif). Atur `[vars] APP_ENV = "production"` dan `APP_ORIGIN = "https://<proyek>.pages.dev"` pada wrangler.toml.

## 3. Deploy API (Worker)
```bash
npx wrangler deploy                            # dari apps/api
curl https://sigersehat-api.project-ma.workers.dev/health
```

## 4. Deploy Web (Pages)
```bash
cd ../.. && npm run build:web                  # menghasilkan apps/web/dist
cd apps/web && npx wrangler pages deploy dist --project-name sigersehat
```
Situs terbit di `https://sigersehat.pages.dev` (atau subdomain proyek yang dipilih). Pastikan `APP_ORIGIN` Worker sama persis dengan origin Pages agar CORS + cookie bekerja.

## 5. Verifikasi pasca-deploy (wajib, jangan dilewati)
1. `GET /health` pada URL Worker → status ok, db ok, env production.
2. Daftar akun uji di situs live → login → jalankan satu skrining → pastikan tersimpan (buka Riwayat).
3. Jalankan suite QA terhadap URL production (`~/workspace/sigersehat-qa/`, sesuaikan BASE/WEB).
4. Buka situs dari ponsel, tablet, laptop, desktop (atau viewport 320/375/430/768/1366/1920 seperti Tahap 11).
5. Periksa tidak ada secret di repo: `git grep -n "AI_API_KEY\|SESSION_SECRET" -- ':!*.example' ':!docs'`.

## 6. Monitoring
- `GET /health` publik untuk pemeriksaan uptime eksternal (mis. UptimeRobot) — tanpa data sensitif.
- Log terstruktur JSON Worker (request_id, tanpa PHI) — `wrangler tail` saat investigasi.
- Dasbor Cloudflare: Workers analytics (request/error), D1 metrics (ukuran & kuota; REC-10), Pages deployment status.

## 7. Backup & pemulihan (REC-01)
- **D1 Time Travel** selalu aktif: pulihkan ke menit mana pun dalam 7 hari (Free) / 30 hari (Paid) — `wrangler d1 time-travel restore sigersehat-db --timestamp=<ISO>`. Buat bookmark sebelum migrasi berisiko: `wrangler d1 time-travel create-bookmark`.
- **Ekspor terjadwal**: `wrangler d1 export sigersehat-db --remote --output backup-YYYYMMDD.sql` lalu simpan ke R2 privat/penyimpanan terpisah; uji pemulihan (restore drill) setiap rilis ke database staging.
- **R2** berisi dokumen kredensial nakes: aktifkan versioning/lifecycle sesuai kebijakan retensi (OQ-07).
- Kode selalu dapat dibangun ulang dari GitHub (branch main); deployment ulang mengikuti langkah 3–4.
