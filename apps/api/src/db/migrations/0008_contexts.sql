CREATE TABLE cycle_records (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  period_start_date TEXT NOT NULL, period_end_date TEXT,
  cycle_length_days INTEGER CHECK (cycle_length_days IS NULL OR cycle_length_days BETWEEN 15 AND 90),
  symptoms TEXT, note TEXT, created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_cycle_profile ON cycle_records(profile_id, period_start_date DESC);
CREATE TABLE pregnancies (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  hpht_date TEXT, estimated_due_date TEXT, current_facility TEXT,
  status TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing','delivered','ended')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE anc_visits (
  id TEXT PRIMARY KEY, pregnancy_id TEXT NOT NULL REFERENCES pregnancies(id),
  visit_number INTEGER NOT NULL CHECK (visit_number BETWEEN 1 AND 6),
  scheduled_date TEXT, actual_date TEXT, facility_name TEXT,
  measurement_id TEXT REFERENCES measurements(id), note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE growth_standards (
  id TEXT PRIMARY KEY,
  indicator TEXT NOT NULL CHECK (indicator IN ('wfa','hfa','wfh','bfa')),
  sex TEXT NOT NULL CHECK (sex IN ('male','female')),
  age_value REAL NOT NULL, age_unit TEXT NOT NULL CHECK (age_unit IN ('day','month')),
  sd_neg3 REAL, sd_neg2 REAL, sd_neg1 REAL, median REAL, sd_pos1 REAL, sd_pos2 REAL, sd_pos3 REAL,
  standard_version TEXT NOT NULL, source_ref TEXT NOT NULL,
  UNIQUE (indicator, sex, age_value, age_unit, standard_version)
);
CREATE TABLE immunization_schedules (
  id TEXT PRIMARY KEY, vaccine_code TEXT NOT NULL, vaccine_name TEXT NOT NULL,
  dose_number INTEGER NOT NULL, due_age_value REAL NOT NULL,
  due_age_unit TEXT NOT NULL CHECK (due_age_unit IN ('day','month')),
  schedule_version TEXT NOT NULL, source_ref TEXT NOT NULL,
  UNIQUE (vaccine_code, dose_number, schedule_version)
);
CREATE TABLE immunization_records (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  schedule_id TEXT REFERENCES immunization_schedules(id),
  vaccine_code TEXT NOT NULL, dose_number INTEGER,
  given_date TEXT NOT NULL, facility_name TEXT, batch_note TEXT,
  recorded_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_imm_profile ON immunization_records(profile_id, given_date);
CREATE TABLE nutrition_targets (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  target_type TEXT NOT NULL, target_value REAL NOT NULL, unit TEXT NOT NULL,
  effective_from TEXT NOT NULL, effective_to TEXT,
  set_by TEXT NOT NULL CHECK (set_by IN ('system_rule','nakes','user_adjusted')),
  source_ref TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE nutrition_logs (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  log_date TEXT NOT NULL, target_type TEXT NOT NULL, achieved_value REAL NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (profile_id, log_date, target_type)
);
CREATE TABLE food_nutrition (
  id TEXT PRIMARY KEY, food_name TEXT NOT NULL, category TEXT,
  energy_kcal REAL, protein_g REAL, fat_g REAL, carb_g REAL, sodium_mg REAL, sugar_g REAL,
  portion_desc TEXT NOT NULL, source_name TEXT NOT NULL, source_ref TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
