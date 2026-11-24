CREATE TABLE health_targets (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  metric TEXT NOT NULL, direction TEXT NOT NULL CHECK (direction IN ('at_least','at_most','reach')),
  target_value REAL NOT NULL, unit TEXT NOT NULL,
  start_date TEXT NOT NULL, end_date TEXT, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','missed','cancelled')),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE medication_schedules (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  medicine_name TEXT NOT NULL, dosage_text TEXT NOT NULL, frequency_text TEXT NOT NULL,
  times_json TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','stopped')),
  stopped_reason TEXT, created_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE reminders (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('medication','measurement','follow_up','immunization','anc','custom')),
  title TEXT NOT NULL, scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','done','snoozed','cancelled')),
  related_type TEXT, related_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_reminders_due ON reminders(status, scheduled_at);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL, body TEXT NOT NULL, link_path TEXT,
  reminder_id TEXT REFERENCES reminders(id),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), read_at TEXT
);
CREATE INDEX idx_notif_user ON notifications(user_id, is_read, created_at DESC);
CREATE TABLE edu_contents (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
  category TEXT NOT NULL, summary TEXT NOT NULL, body_md TEXT NOT NULL,
  cover_image_url TEXT, cover_source TEXT,
  source_name TEXT NOT NULL, source_url TEXT NOT NULL,
  reviewer_user_id TEXT REFERENCES users(id), reviewed_at TEXT,
  review_due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','review','published','archived')),
  related_modules TEXT, published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE edu_quizzes (
  id TEXT PRIMARY KEY, content_id TEXT REFERENCES edu_contents(id),
  title TEXT NOT NULL, questions_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE edu_quiz_attempts (
  id TEXT PRIMARY KEY, quiz_id TEXT NOT NULL REFERENCES edu_quizzes(id),
  user_id TEXT NOT NULL REFERENCES users(id), score REAL NOT NULL, answers_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ai_sources (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, publisher TEXT NOT NULL, url TEXT,
  content_text TEXT NOT NULL, topic_tags TEXT,
  reviewer_user_id TEXT REFERENCES users(id), reviewed_at TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','inactive')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE VIRTUAL TABLE ai_sources_fts USING fts5(title, content_text, topic_tags, content='ai_sources', content_rowid='rowid', tokenize='unicode61 remove_diacritics 1');
CREATE TABLE ai_conversations (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  profile_id TEXT REFERENCES health_profiles(id),
  context_consent_at TEXT,
  title TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ai_messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES ai_conversations(id),
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system_flag')),
  content TEXT NOT NULL, sources_json TEXT,
  is_emergency INTEGER NOT NULL DEFAULT 0 CHECK (is_emergency IN (0,1)),
  model_ref TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE ai_answer_reports (
  id TEXT PRIMARY KEY, message_id TEXT NOT NULL REFERENCES ai_messages(id),
  reported_by_user_id TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed_ok','corrected','escalated')),
  reviewed_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), reviewed_at TEXT
);
CREATE TABLE facilities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  facility_type TEXT NOT NULL CHECK (facility_type IN ('rumah_sakit','puskesmas','klinik','laboratorium','apotek','pustu','posyandu')),
  address TEXT NOT NULL, region_id TEXT NOT NULL REFERENCES regions(id),
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  phone TEXT, emergency_phone TEXT, has_igd INTEGER CHECK (has_igd IN (0,1) OR has_igd IS NULL),
  services TEXT,
  source_name TEXT NOT NULL, source_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending','verified','needs_correction')),
  verified_at TEXT, verified_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fac_region ON facilities(region_id, verification_status);
CREATE TABLE facility_correction_reports (
  id TEXT PRIMARY KEY, facility_id TEXT NOT NULL REFERENCES facilities(id),
  reported_by_user_id TEXT REFERENCES users(id),
  field_name TEXT NOT NULL, reported_value TEXT NOT NULL, note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT
);
CREATE TABLE follow_up_tasks (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  created_by_user_id TEXT NOT NULL REFERENCES users(id),
  assigned_to_user_id TEXT REFERENCES users(id),
  task_type TEXT NOT NULL, due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','cancelled')),
  note TEXT, completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE clinical_notes (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  author_user_id TEXT NOT NULL REFERENCES users(id),
  author_role TEXT NOT NULL CHECK (author_role IN ('nakes')),
  measurement_id TEXT REFERENCES measurements(id),
  note_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE insight_snapshots (
  id TEXT PRIMARY KEY, snapshot_date TEXT NOT NULL,
  region_id TEXT REFERENCES regions(id), metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL, sample_size INTEGER NOT NULL,
  min_group_size INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (snapshot_date, region_id, metric_key)
);
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_by_user_id TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE reports (
  id TEXT PRIMARY KEY, reporter_user_id TEXT REFERENCES users(id),
  report_type TEXT NOT NULL CHECK (report_type IN ('content','facility','ai_answer','other')),
  target_ref TEXT, description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','rejected')),
  handled_by_user_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), resolved_at TEXT
);
