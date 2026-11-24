CREATE TABLE iot_devices (
  id TEXT PRIMARY KEY, owner_user_id TEXT NOT NULL REFERENCES users(id),
  device_label TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('max30102','temperature','simulator','other')),
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_seen_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), revoked_at TEXT
);
CREATE TABLE iot_readings_raw (
  id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES iot_devices(id),
  payload_json TEXT NOT NULL, received_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed INTEGER NOT NULL DEFAULT 0 CHECK (processed IN (0,1)),
  measurement_id TEXT REFERENCES measurements(id),
  idempotency_key TEXT UNIQUE
);
CREATE INDEX idx_iot_raw_device ON iot_readings_raw(device_id, received_at DESC);
