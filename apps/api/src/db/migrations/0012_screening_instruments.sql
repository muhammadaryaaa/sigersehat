-- Instrumen skrining aktif v1 (aturan di domain/rules/screening.ts; rules_json menyimpan definisi pertanyaan).
INSERT INTO screening_instruments (id, category, title, version, status, source_ref, rules_json, published_at) VALUES
 ('ins-ptm-v1', 'ptm', 'Skrining Risiko Penyakit Tidak Menular (PTM)', 1, 'active',
  'Kemenkes RI: klasifikasi IMT & tekanan darah; rentang rujukan gula darah skrining',
  '{"questions":[
    {"key":"smoking","text":"Apakah Anda merokok?","type":"yesno"},
    {"key":"activity_30min","text":"Apakah Anda beraktivitas fisik minimal 30 menit hampir setiap hari?","type":"yesno"},
    {"key":"family_ptm","text":"Apakah ada riwayat hipertensi/diabetes pada keluarga inti?","type":"yesno"}
  ]}', datetime('now')),
 ('ins-diabetes-v1', 'diabetes_risk', 'Skor Risiko Diabetes FINDRISC', 1, 'active',
  'FINDRISC — Finnish Diabetes Risk Score (Finnish Diabetes Association)',
  '{"questions":[
    {"key":"age_band","text":"Kelompok usia Anda","type":"choice","options":["<45","45-54","55-64",">64"]},
    {"key":"bmi_band","text":"Kelompok IMT Anda","type":"choice","options":["<25","25-30",">30"]},
    {"key":"waist_band","text":"Lingkar pinggang Anda","type":"choice","options":["normal","mid","high"]},
    {"key":"activity","text":"Aktivitas fisik 30 menit setiap hari?","type":"choice","options":["yes","no"]},
    {"key":"veg_daily","text":"Makan sayur/buah setiap hari?","type":"choice","options":["daily","not_daily"]},
    {"key":"bp_meds","text":"Pernah minum obat tekanan darah secara teratur?","type":"choice","options":["no","yes"]},
    {"key":"high_glucose_history","text":"Pernah ditemukan gula darah tinggi?","type":"choice","options":["no","yes"]},
    {"key":"family_history","text":"Riwayat diabetes pada keluarga","type":"choice","options":["none","extended","immediate"]}
  ]}', datetime('now'));
