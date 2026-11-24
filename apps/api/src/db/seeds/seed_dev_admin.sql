-- SEED LOKAL SAJA (jangan jalankan di production): akun admin dev untuk pengujian RBAC.
-- admin@sigersehat.local / AdminSiger2026! ; superadmin@sigersehat.local / SuperSiger2026!
INSERT OR IGNORE INTO users (id, email, password_hash, role, email_verified_at) VALUES
 ('usr-admin-dev','admin@sigersehat.local','pbkdf2-sha256$100000$jYvKjRLdRqknV4V0ovLHcA==$OUnEMp7dAS6L60Ttsv+a5rdO3cRqykYGvIt0Cp/Lraw=','admin', datetime('now')),
 ('usr-super-dev','superadmin@sigersehat.local','pbkdf2-sha256$100000$HTzN/DoJc8USI19954YSxg==$21wZjuxJ6uxoCHDnkTB1CX25/vuYkZGzbmdqbjDb1y4=','super_admin', datetime('now'));
INSERT OR IGNORE INTO health_profiles (id, owner_user_id, linked_user_id, relation, full_name, birth_date, sex) VALUES
 ('prf-admin-dev','usr-admin-dev','usr-admin-dev','self','Admin SIGERSEHAT (dev lokal)','1990-01-01','male'),
 ('prf-super-dev','usr-super-dev','usr-super-dev','self','Super Admin SIGERSEHAT (dev lokal)','1990-01-01','female');
INSERT OR IGNORE INTO profile_preferences (profile_id) VALUES ('prf-admin-dev'),('prf-super-dev');