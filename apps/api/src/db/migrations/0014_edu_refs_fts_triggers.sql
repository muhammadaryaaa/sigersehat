-- Tabel referensi artikel + pemicu sinkronisasi FTS sumber AI (Tahap 7).
CREATE TABLE IF NOT EXISTS edu_references (
  id TEXT PRIMARY KEY, content_id TEXT NOT NULL REFERENCES edu_contents(id),
  title TEXT NOT NULL, publisher TEXT NOT NULL, url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES ('ref-art-hipertensi-1', 'art-hipertensi', 'Hipertensi — materi edukasi Kemenkes RI', 'Kementerian Kesehatan RI', 'https://ayosehat.kemkes.go.id', 1);
INSERT OR IGNORE INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES ('ref-art-hipertensi-2', 'art-hipertensi', 'Survei Kesehatan Indonesia (SKI) 2023 Dalam Angka', 'BKPK Kemenkes RI', 'https://kemkes.go.id', 2);
INSERT OR IGNORE INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES ('ref-art-isi-piringku-1', 'art-isi-piringku', 'Isi Piringku — pedoman gizi seimbang Kemenkes RI', 'Kementerian Kesehatan RI', 'https://ayosehat.kemkes.go.id', 1);
INSERT OR IGNORE INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES ('ref-art-isi-piringku-2', 'art-isi-piringku', 'Pedoman Gizi Seimbang', 'Kementerian Kesehatan RI', 'https://kemkes.go.id', 2);
INSERT OR IGNORE INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES ('ref-art-skrining-posbindu-1', 'art-skrining-posbindu', 'Profil Kesehatan Provinsi Lampung 2023', 'Dinas Kesehatan Provinsi Lampung', 'https://dinkes.lampungprov.go.id', 1);
INSERT OR IGNORE INTO edu_references (id, content_id, title, publisher, url, sort_order) VALUES ('ref-art-skrining-posbindu-2', 'art-skrining-posbindu', 'Cek Kesehatan Gratis — Kemenkes RI', 'Kementerian Kesehatan RI', 'https://kemkes.go.id', 2);
CREATE TRIGGER IF NOT EXISTS ai_sources_ai AFTER INSERT ON ai_sources BEGIN
  INSERT INTO ai_sources_fts(rowid, title, content_text, topic_tags) VALUES (new.rowid, new.title, new.content_text, new.topic_tags);
END;
CREATE TRIGGER IF NOT EXISTS ai_sources_ad AFTER DELETE ON ai_sources BEGIN
  INSERT INTO ai_sources_fts(ai_sources_fts, rowid, title, content_text, topic_tags) VALUES ('delete', old.rowid, old.title, old.content_text, old.topic_tags);
END;
CREATE TRIGGER IF NOT EXISTS ai_sources_au AFTER UPDATE ON ai_sources BEGIN
  INSERT INTO ai_sources_fts(ai_sources_fts, rowid, title, content_text, topic_tags) VALUES ('delete', old.rowid, old.title, old.content_text, old.topic_tags);
  INSERT INTO ai_sources_fts(rowid, title, content_text, topic_tags) VALUES (new.rowid, new.title, new.content_text, new.topic_tags);
END;
INSERT INTO ai_sources_fts(ai_sources_fts) VALUES('rebuild');
