CREATE TABLE regions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('kabupaten','kota')),
  province_code TEXT NOT NULL DEFAULT '18',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1))
);
INSERT INTO regions (id, code, name, type) VALUES
 ('reg-1801','1801','Lampung Selatan','kabupaten'),('reg-1802','1802','Lampung Timur','kabupaten'),
 ('reg-1803','1803','Lampung Tengah','kabupaten'),('reg-1804','1804','Lampung Utara','kabupaten'),
 ('reg-1805','1805','Lampung Barat','kabupaten'),('reg-1806','1806','Tulang Bawang','kabupaten'),
 ('reg-1807','1807','Tanggamus','kabupaten'),('reg-1808','1808','Way Kanan','kabupaten'),
 ('reg-1809','1809','Pesawaran','kabupaten'),('reg-1810','1810','Pringsewu','kabupaten'),
 ('reg-1811','1811','Mesuji','kabupaten'),('reg-1812','1812','Tulang Bawang Barat','kabupaten'),
 ('reg-1813','1813','Pesisir Barat','kabupaten'),('reg-1871','1871','Bandar Lampung','kota'),
 ('reg-1872','1872','Metro','kota');
