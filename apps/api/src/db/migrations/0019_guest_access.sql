-- 0019: Model akses tamu (publik) + persetujuan data kesehatan + laporan tamu.
-- Tamu boleh memakai skrining & Tanya AI TANPA data disimpan ke basis data;
-- yang dicatat hanya penghitung laju ter-hash per alamat IP (bukan IP mentah).
CREATE TABLE IF NOT EXISTS guest_rate_limits (
  ip_hash TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  hour_bucket TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, endpoint, hour_bucket)
);
ALTER TABLE facility_correction_reports ADD COLUMN reporter_email TEXT;
ALTER TABLE users ADD COLUMN health_data_consent_at TEXT;
