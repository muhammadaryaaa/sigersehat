-- 0017: Fasilitas terverifikasi tambahan, fokus Bandar Lampung.
-- Semua titik diverifikasi lewat OpenStreetMap Nominatim pada 24 Nov 2026
-- (pencarian nama + alamat terstruktur + URL elemen OSM sebagai sumber).
-- Telepon dibiarkan NULL karena tidak terverifikasi. Fasilitas yang tidak
-- ditemukan di OSM (antara lain Puskesmas Kemiling, Rajabasa, Panjang,
-- Way Halim, Labuhan Ratu) TIDAK dimasukkan. RSUD Dr. H. Abdul Moeloek juga
-- belum dimasukkan: elemen OSM-nya bernama "RSUD Abdul Muluk" (dugaan salah
-- eja di OSM) sehingga menunggu keputusan pemilik/sumber resmi.
INSERT OR IGNORE INTO facilities (id, name, facility_type, address, region_id, latitude, longitude, phone, emergency_phone, has_igd, services, source_name, source_url, verification_status, verified_at) VALUES
('fac-rs-urip-sumoharjo', 'RS Urip Sumoharjo Bandar Lampung', 'rumah_sakit', 'Urip Sumoharjo, Kalibalau Kencana, Bandar Lampung, Lampung 35133', 'reg-1871', -5.3920686, 105.2764638, NULL, NULL, NULL, NULL, 'OpenStreetMap (Nominatim)', 'https://www.openstreetmap.org/way/461332157', 'verified', '2026-11-24'),
('fac-rs-advent', 'RS Advent Bandar Lampung', 'rumah_sakit', 'Jalan Danau Batur, Surabaya, Bandar Lampung, Lampung 35132', 'reg-1871', -5.3921715, 105.2625518, NULL, NULL, NULL, NULL, 'OpenStreetMap (Nominatim)', 'https://www.openstreetmap.org/relation/10917428', 'verified', '2026-11-24'),
('fac-rs-bumi-waras', 'Rumah Sakit Bumi Waras', 'rumah_sakit', 'Jalan Raden Saleh, Palapa, Bandar Lampung, Lampung 35119', 'reg-1871', -5.4251412, 105.2511403, NULL, NULL, NULL, NULL, 'OpenStreetMap (Nominatim)', 'https://www.openstreetmap.org/way/633412055', 'verified', '2026-11-24'),
('fac-rs-graha-husada', 'RS Graha Husada', 'rumah_sakit', '6 GH, Jalan Gajah Mada, Rawa Laut, Bandar Lampung, Lampung 35126', 'reg-1871', -5.4135242, 105.2676474, NULL, NULL, NULL, NULL, 'OpenStreetMap (Nominatim)', 'https://www.openstreetmap.org/way/624934553', 'verified', '2026-11-24'),
('fac-pkm-satelit', 'Puskesmas Satelit', 'puskesmas', 'Jalan Gajah Mada, Tanjung Raya, Bandar Lampung, Lampung 35213', 'reg-1871', -5.4225736, 105.2696731, NULL, NULL, NULL, NULL, 'OpenStreetMap (Nominatim)', 'https://www.openstreetmap.org/way/1063801442', 'verified', '2026-11-24'),
('fac-pkm-kupang-teba', 'Puskesmas Kupang Teba', 'puskesmas', 'Jalan Pattimura, Kupang Raya, Bandar Lampung, Lampung 35211', 'reg-1871', -5.4429868, 105.2664999, NULL, NULL, NULL, NULL, 'OpenStreetMap (Nominatim)', 'https://www.openstreetmap.org/node/9896555322', 'verified', '2026-11-24');
