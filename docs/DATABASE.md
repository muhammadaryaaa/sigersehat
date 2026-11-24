# Dokumentasi Database SIGERSEHAT

- Mesin: Cloudflare D1 (SQLite). Skema dibuat oleh migrasi bernomor `apps/api/src/db/migrations/0001`–`0016` (46 tabel + 1 tabel virtual FTS5 `ai_sources_fts`).
- Terapkan: lokal `npm run db:migrate:local --workspace @sigersehat/api`; production `wrangler d1 migrations apply sigersehat-db --remote`.

## Kelompok tabel
1. **Identitas & akses**: users, sessions, password_reset_tokens, login_attempts, health_worker_profiles, audit_logs (insert-only, rantai hash prev_hash/entry_hash).
2. **Profil & keluarga**: regions (15 kab/kota Lampung berkode BPS), health_profiles (diri/anak/lansia/keluarga; `guardian_consent_at` untuk anak), profile_preferences, consents + consent_scopes.
3. **Pengukuran bersama**: `measurements` — SATU tabel untuk CHECK/MONITOR/WOMEN/GROW/ELDER/MED/IoT, dibedakan kolom `source` (manual/screening/health_worker/anc/iot_device/iot_simulator) dan `recorded_by_role`; koreksi dicatat di `measurement_revisions` (nilai tidak dihapus).
4. **Skrining**: screening_instruments, screening_questions, screening_sessions, screening_answers.
5. **Modul keluarga**: cycle_records, pregnancies, anc_visits, growth_standards, immunization_schedules, immunization_records, food_nutrition, nutrition_targets, nutrition_logs, health_targets, medication_schedules.
6. **Konten & AI**: edu_contents, edu_quizzes, edu_quiz_attempts, edu_references, ai_sources (+FTS5), ai_conversations, ai_messages, ai_answer_reports.
7. **Layanan**: facilities, facility_correction_reports, reports, reminders, notifications, follow_up_tasks, clinical_notes, iot_devices (token_hash unik), iot_readings_raw (idempotency_key unik), system_settings.

## Aturan integritas penting
- Batasan fisiologis ditegakkan CHECK SQL (sistolik 40–300 & > diastolik, gula 10–1000, SpO2 50–100, dst.).
- Seluruh stempel waktu disimpan format SQLite UTC melalui `apps/api/src/lib/time.ts` — jangan memakai `Date.toISOString()` untuk kolom waktu.
- Data benih resmi: wilayah (BPS), instrumen skrining, jadwal imunisasi (Kepmenkes 1098/2024), pangan (TKPI Kemenkes 2017), standar pertumbuhan (subset jangkar WHO 2006 0–24 bulan — **utang pra-produksi: muat tabel resmi Permenkes 2/2020 lengkap**), 5 fasilitas terverifikasi OpenStreetMap (24 Nov 2026; telepon belum terverifikasi dan sengaja kosong).
