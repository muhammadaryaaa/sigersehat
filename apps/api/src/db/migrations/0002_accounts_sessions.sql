CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  password_algo TEXT NOT NULL DEFAULT 'pbkdf2-sha256',
  role TEXT NOT NULL CHECK (role IN ('masyarakat','nakes','admin','super_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','pending_deletion','deleted')),
  email_verified_at TEXT, last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE,
  device_label TEXT, ip_address TEXT, user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL, revoked_at TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id, revoked_at);
CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
  token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
