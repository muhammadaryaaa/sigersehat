CREATE TABLE consents (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  granted_by_user_id TEXT NOT NULL REFERENCES users(id),
  grantee_user_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','expired')),
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT, revoked_at TEXT, revoked_by_user_id TEXT REFERENCES users(id),
  note TEXT
);
CREATE INDEX idx_consents_grantee ON consents(grantee_user_id, status);
CREATE INDEX idx_consents_profile ON consents(profile_id, status);
CREATE TABLE consent_scopes (
  consent_id TEXT NOT NULL REFERENCES consents(id),
  module_code TEXT NOT NULL CHECK (module_code IN ('check','monitor','women','grow','elder','nutri','reminder','med')),
  can_view INTEGER NOT NULL DEFAULT 1 CHECK (can_view IN (0,1)),
  can_add_record INTEGER NOT NULL DEFAULT 0 CHECK (can_add_record IN (0,1)),
  PRIMARY KEY (consent_id, module_code)
);
