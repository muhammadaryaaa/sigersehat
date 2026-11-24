CREATE TABLE measurements (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  measured_at TEXT NOT NULL,
  height_cm REAL CHECK (height_cm IS NULL OR height_cm BETWEEN 30 AND 272),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg BETWEEN 1 AND 635),
  bmi REAL CHECK (bmi IS NULL OR bmi BETWEEN 5 AND 100),
  systolic INTEGER CHECK (systolic IS NULL OR systolic BETWEEN 40 AND 300),
  diastolic INTEGER CHECK (diastolic IS NULL OR diastolic BETWEEN 20 AND 200),
  blood_sugar_mgdl REAL CHECK (blood_sugar_mgdl IS NULL OR blood_sugar_mgdl BETWEEN 10 AND 1000),
  sugar_context TEXT CHECK (sugar_context IN ('puasa','sewaktu','2jam_pp') OR sugar_context IS NULL),
  temperature_c REAL CHECK (temperature_c IS NULL OR temperature_c BETWEEN 30 AND 45),
  heart_rate_bpm INTEGER CHECK (heart_rate_bpm IS NULL OR heart_rate_bpm BETWEEN 20 AND 250),
  spo2_percent REAL CHECK (spo2_percent IS NULL OR spo2_percent BETWEEN 50 AND 100),
  waist_cm REAL CHECK (waist_cm IS NULL OR waist_cm BETWEEN 30 AND 300),
  source TEXT NOT NULL CHECK (source IN ('manual','screening','health_worker','iot_device','iot_simulator')),
  recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
  recorded_by_role TEXT NOT NULL CHECK (recorded_by_role IN ('masyarakat','nakes','admin','super_admin','device')),
  device_id TEXT,
  screening_session_id TEXT,
  note TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (systolic IS NULL OR diastolic IS NULL OR systolic > diastolic)
);
CREATE INDEX idx_meas_profile_time ON measurements(profile_id, measured_at DESC);
CREATE INDEX idx_meas_screening ON measurements(screening_session_id);
CREATE TABLE measurement_revisions (
  id TEXT PRIMARY KEY, measurement_id TEXT NOT NULL REFERENCES measurements(id),
  changed_by_user_id TEXT NOT NULL REFERENCES users(id),
  field_name TEXT NOT NULL, old_value TEXT, new_value TEXT, reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE screening_instruments (
  id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL,
  version INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  source_ref TEXT NOT NULL, rules_json TEXT NOT NULL,
  published_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), published_at TEXT,
  UNIQUE (category, version)
);
CREATE TABLE screening_sessions (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  instrument_id TEXT NOT NULL REFERENCES screening_instruments(id),
  instrument_version INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  measurement_id TEXT REFERENCES measurements(id),
  risk_category TEXT CHECK (risk_category IN ('rendah','sedang','tinggi') OR risk_category IS NULL),
  findings_json TEXT, recommendations_json TEXT,
  has_danger_sign INTEGER NOT NULL DEFAULT 0 CHECK (has_danger_sign IN (0,1)),
  started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
  idempotency_key TEXT UNIQUE
);
CREATE INDEX idx_screen_profile ON screening_sessions(profile_id, started_at DESC);
CREATE TABLE screening_answers (
  id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES screening_sessions(id),
  question_key TEXT NOT NULL, answer_value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (session_id, question_key)
);
