CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id),
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  object_type TEXT NOT NULL, object_id TEXT,
  profile_id TEXT,
  ip_address TEXT, user_agent TEXT,
  prev_hash TEXT, entry_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_actor_time ON audit_logs(actor_user_id, created_at);
CREATE INDEX idx_audit_object ON audit_logs(object_type, object_id);
CREATE INDEX idx_audit_profile_time ON audit_logs(profile_id, created_at);
