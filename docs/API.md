# Dokumentasi API SIGERSEHAT

- Basis: `/api/v1` (lokal `http://localhost:8787/api/v1`). Format: JSON.
- Amplop sukses: `{"data": ...}`; galat: `{"error": {"code", "message", "details?"}}` dengan kode baku dari `@sigersehat/contracts` (validation_error, unauthorized, forbidden, not_found, conflict, rate_limited, usage_limit, consent_required, review_required, service_unavailable, internal_error).
- Autentikasi pengguna: cookie sesi httpOnly `siger_session` + token CSRF double-submit (header `X-CSRF-Token` = cookie `csrf_token`) untuk semua mutasi ber-cookie.
- Autentikasi perangkat IoT: header `X-Device-Token` (token mentah; server menyimpan hash SHA-256).
- Batas laju: login 10 kegagalan/15 menit per email → 429; SIGERAI 20 pesan/hari per pengguna (system_settings `ai_daily_limit`).
- Kontrak tipe bersama (REC-02): paket `packages/contracts` adalah sumber skema validasi bersama frontend–backend.

## Kelompok endpoint (104 rute terdaftar)
- **Publik**: `GET /health` (di luar /api/v1), `GET /regions`, `GET /edu/categories|articles|articles/:slug|quizzes|quizzes/:id`, `GET /facilities`, `GET /facilities/:id`.
- **Auth**: `POST /auth/register|login|logout|forgot-password|reset-password`, `GET /auth/me|sessions`, `DELETE /auth/sessions/:id`.
- **Profil & dasbor**: `GET/PUT /profiles/me`, `GET/POST /profiles/family`, `DELETE /profiles/family/:id`, `GET /profiles/history`, `GET /dashboard/masyarakat`.
- **CHECK**: `GET /screening/instruments`, `POST /screening/sessions`, `POST /screening/sessions/:id/complete`, `GET /screening/sessions`, `GET /screening/sessions/:id`.
- **MONITOR**: `POST/GET /measurements`, `PUT /measurements/:id`, `GET /measurements/trends`.
- **REMINDER**: `POST/GET /reminders`, `PUT /reminders/:id`, `POST /reminders/:id/done|cancel|snooze`, `GET /notifications`, `POST /notifications/:id/read`. Notifikasi jatuh tempo dibuat cron Worker tiap 15 menit.
- **EDU (pengguna/admin)**: `POST /edu/quizzes/:id/attempt`, `GET /edu/my-attempts`, `GET/POST /edu/admin/articles`, `PUT /edu/admin/articles/:id`, `POST /edu/admin/articles/:id/publish|unpublish` (publikasi ditolak 422 tanpa penelaah tercatat), `POST /edu/admin/quizzes`.
- **AI**: `POST/GET /ai/conversations`, `GET/DELETE /ai/conversations/:id`, `POST /ai/conversations/:id/messages`, `POST /ai/messages/:id/report`, `GET /ai/usage`. Alur keamanan: batas kuota → deteksi gawat darurat → penolakan resep → retrieval FTS5 sumber aktif → provider (eksternal kompatibel-OpenAI bila dikonfigurasi, selain itu Penyusun Retrieval terkurasi) → filter keluaran (diagnosis/kategori menyimpang diganti jawaban aman + dicatat `system_flag`).
- **WOMEN**: `POST/GET /women/cycles`, `POST/GET /women/pregnancies`, `POST /women/pregnancies/:id/visits`, `POST /women/pregnancies/:id/visits/:visitId/complete`, `GET /women/pregnancies/:id/visits`.
- **GROW**: `GET /grow/:profileId/status|immunizations`, `POST /grow/:profileId/immunizations`.
- **ELDER**: `GET /elder/:profileId/overview`, `POST /elder/:profileId/medications`, `POST /elder/:profileId/medications/:medId/stop`, `POST /elder/:profileId/targets`.
- **NUTRI**: `GET /nutri/foods`, `GET /nutri/:profileId/today|summary`, `POST /nutri/logs`.
- **Consent & MED**: `GET /nakes-directory`, `POST/GET /consents`, `POST /consents/:id/revoke`, `GET /med/overview|patients|patients/:profileId`, `POST /med/patients/:profileId/notes|measurements|tasks`, `POST /med/tasks/:taskId/complete`.
- **MAP**: `POST /facilities/:id/report` (pengguna masuk).
- **ADMIN**: `GET /admin/overview|users|verifications|facilities|screening-instruments|ai-sources|reports|audit`, `POST /admin/users/:id/status|role`, `POST /admin/verifications/:userId`, `POST /admin/facilities`, `POST /admin/facilities/:id/verify`, `POST /admin/screening-instruments/:id/active`, `POST /admin/ai-sources`, `POST /admin/ai-sources/:id/status`, `POST /admin/reports/:kind/:id/resolve`, `GET/POST /admin/settings` (super admin).
- **INSIGHT**: `GET /insights/statistics?days=&regionId=` — agregat anonim, penekanan sel <5.
- **IoT**: `POST /iot/readings` (token perangkat), `POST /iot/heartbeat`, `POST/GET /iot/devices`, `POST /iot/devices/:id/revoke`, `GET /iot/devices/:id/readings`.

Dokumentasi mesin (OpenAPI 3.1 dari skema kontrak bersama) adalah pekerjaan lanjutan yang tercatat di Tahap 2 REC-02; daftar ini dihasilkan dari rute aktual kode.
