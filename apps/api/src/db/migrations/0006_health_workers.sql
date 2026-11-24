CREATE TABLE health_worker_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  profession TEXT NOT NULL CHECK (profession IN ('dokter','perawat','bidan','tenaga_gizi','kader','lainnya')),
  credential_type TEXT NOT NULL CHECK (credential_type IN ('STR','SIP','lainnya')),
  credential_number TEXT NOT NULL,
  workplace_name TEXT, workplace_region_id TEXT REFERENCES regions(id),
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','rejected')),
  verified_by_user_id TEXT REFERENCES users(id), verified_at TEXT, rejection_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_hw_verification ON health_worker_profiles(verification_status, created_at);
CREATE TABLE health_worker_documents (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  doc_type TEXT NOT NULL CHECK (doc_type IN ('str','sip','ktp','lainnya')),
  r2_key TEXT NOT NULL, file_name TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
