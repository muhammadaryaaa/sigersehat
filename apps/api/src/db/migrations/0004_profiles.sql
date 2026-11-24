CREATE TABLE health_profiles (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id),
  linked_user_id TEXT REFERENCES users(id),
  relation TEXT NOT NULL CHECK (relation IN ('self','child','elderly','other_family')),
  full_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('male','female')),
  region_id TEXT REFERENCES regions(id),
  blood_type TEXT CHECK (blood_type IN ('A','B','AB','O') OR blood_type IS NULL),
  allergies TEXT, chronic_conditions TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_profiles_owner ON health_profiles(owner_user_id, is_active);
CREATE TABLE profile_invitations (
  id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES health_profiles(id),
  invited_by_user_id TEXT NOT NULL REFERENCES users(id),
  invited_contact TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired','revoked')),
  expires_at TEXT NOT NULL, responded_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE profile_preferences (
  profile_id TEXT PRIMARY KEY REFERENCES health_profiles(id),
  large_text INTEGER NOT NULL DEFAULT 0 CHECK (large_text IN (0,1)),
  high_contrast INTEGER NOT NULL DEFAULT 0 CHECK (high_contrast IN (0,1)),
  language TEXT NOT NULL DEFAULT 'id',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
