// Mesin aturan skrining SIGERCHECK — fungsi murni, terversi, TANPA diagnosis.
// Referensi: klasifikasi IMT & tekanan darah Kemenkes RI; FINDRISC (Finnish Diabetes Association)
// untuk skor risiko diabetes. Ambang di sini adalah rentang rujukan skrining, bukan diagnosis.
export const RULES_VERSION = "2026.1";
export const SOURCES = {
  bmi: "Klasifikasi IMT Kemenkes RI (obesitas >= 27 untuk penduduk Indonesia)",
  bp: "Klasifikasi tekanan darah Kemenkes RI / standar klinis umum (hipertensi >= 140/90 mmHg)",
  sugar: "Rentang rujukan gula darah skrining (puasa & sewaktu) — konfirmasi memerlukan pemeriksaan laboratorium",
  findrisc: "FINDRISC — Finnish Diabetes Risk Score (Finnish Diabetes Association)",
};

export type Severity = 0 | 1 | 2; // 0 rendah, 1 sedang, 2 tinggi
export interface Finding { key: string; label: string; value_text: string; category: string; severity: Severity; explanation: string; source: string }
export const SEVERITY_LABEL = ["rendah", "sedang", "tinggi"] as const;

export function calcBmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}
export function classifyBmi(bmi: number): Finding {
  let category: string, severity: Severity, explanation: string;
  if (bmi < 17) { category = "Kurus (berat)"; severity = 1; explanation = "Berat badan jauh di bawah rentang sehat. Konsultasikan gizi Anda ke puskesmas."; }
  else if (bmi < 18.5) { category = "Kurus (ringan)"; severity = 1; explanation = "Berat badan sedikit di bawah rentang sehat."; }
  else if (bmi <= 25) { category = "Normal"; severity = 0; explanation = "Berat badan Anda berada pada rentang sehat. Pertahankan pola makan dan aktivitas Anda."; }
  else if (bmi <= 27) { category = "Gemuk (ringan)"; severity = 1; explanation = "Berat badan di atas rentang sehat. Kelebihan berat badan menaikkan risiko penyakit tidak menular."; }
  else { category = "Gemuk (berat) / Obesitas"; severity = 2; explanation = "Berat badan jauh di atas rentang sehat menurut klasifikasi Kemenkes. Konsultasi ke puskesmas dianjurkan."; }
  return { key: "bmi", label: "Indeks Massa Tubuh", value_text: `${bmi.toLocaleString("id-ID")} kg/m²`, category, severity, explanation, source: SOURCES.bmi };
}
export function classifyBp(systolic: number, diastolic: number): Finding {
  let category: string, severity: Severity, explanation: string;
  if (systolic >= 180 || diastolic >= 110) { category = "Sangat tinggi"; severity = 2; explanation = "Tekanan darah sangat tinggi. Segera periksa ke fasilitas kesehatan, apalagi bila ada keluhan."; }
  else if (systolic >= 160 || diastolic >= 100) { category = "Hipertensi derajat 2"; severity = 2; explanation = "Tekanan darah berada pada rentang hipertensi derajat 2. Periksa ke dokter/puskesmas dalam waktu dekat."; }
  else if (systolic >= 140 || diastolic >= 90) { category = "Hipertensi derajat 1"; severity = 1; explanation = "Tekanan darah berada pada rentang hipertensi. Ulangi pengukuran dan konsultasikan ke puskesmas."; }
  else if (systolic >= 120 || diastolic >= 80) { category = "Prahipertensi"; severity = 1; explanation = "Tekanan darah sedikit di atas normal. Pantau berkala dan kurangi garam."; }
  else { category = "Normal"; severity = 0; explanation = "Tekanan darah Anda berada pada rentang normal."; }
  return { key: "bp", label: "Tekanan Darah", value_text: `${systolic}/${diastolic} mmHg`, category, severity, explanation, source: SOURCES.bp };
}
export function classifySugar(value: number, context: "puasa" | "sewaktu" | "2jam_pp"): Finding {
  const fasting = context === "puasa";
  const [normalMax, midMax] = fasting ? [99, 125] : [139, 199];
  let category: string, severity: Severity, explanation: string;
  if (value <= normalMax) { category = "Normal"; severity = 0; explanation = "Gula darah berada pada rentang rujukan normal untuk skrining."; }
  else if (value <= midMax) { category = "Di atas normal (rentang pradiabetes)"; severity = 1; explanation = "Gula darah di atas rentang normal. Pemeriksaan lanjutan di fasilitas kesehatan dianjurkan untuk memastikan."; }
  else { category = "Tinggi (rentang diabetes)"; severity = 2; explanation = "Gula darah berada pada rentang tinggi. Ini bukan diagnosis — periksa ke fasilitas kesehatan untuk pemeriksaan laboratorium konfirmasi."; }
  return { key: "sugar", label: fasting ? "Gula Darah Puasa" : "Gula Darah Sewaktu", value_text: `${value} mg/dL`, category, severity, explanation, source: SOURCES.sugar };
}

// FINDRISC: 8 pertanyaan, skor 0-26.
export interface FindriscAnswers { age_band: string; bmi_band: string; waist_band: string; activity: string; veg_daily: string; bp_meds: string; high_glucose_history: string; family_history: string }
const FINDRISC_POINTS: Record<string, Record<string, number>> = {
  age_band: { "<45": 0, "45-54": 2, "55-64": 3, ">64": 4 },
  bmi_band: { "<25": 0, "25-30": 1, ">30": 3 },
  waist_band: { normal: 0, mid: 3, high: 4 },
  activity: { yes: 0, no: 2 },
  veg_daily: { daily: 0, not_daily: 1 },
  bp_meds: { no: 0, yes: 2 },
  high_glucose_history: { no: 0, yes: 5 },
  family_history: { none: 0, extended: 3, immediate: 5 },
};
export function scoreFindrisc(a: FindriscAnswers): { score: number; finding: Finding } {
  let score = 0;
  for (const [k, table] of Object.entries(FINDRISC_POINTS)) score += table[(a as unknown as Record<string, string>)[k]] ?? 0;
  let category: string, severity: Severity, explanation: string;
  if (score < 7) { category = "Risiko rendah"; severity = 0; explanation = "Perkiraan risiko diabetes tipe 2 dalam 10 tahun rendah (sekitar 1 dari 100)."; }
  else if (score < 12) { category = "Risiko sedikit meningkat"; severity = 1; explanation = "Perkiraan risiko diabetes tipe 2 dalam 10 tahun sedikit meningkat (sekitar 1 dari 25)."; }
  else if (score < 15) { category = "Risiko sedang"; severity = 1; explanation = "Perkiraan risiko diabetes tipe 2 dalam 10 tahun sedang (sekitar 1 dari 6). Periksa gula darah di fasilitas kesehatan."; }
  else if (score < 21) { category = "Risiko tinggi"; severity = 2; explanation = "Perkiraan risiko diabetes tipe 2 dalam 10 tahun tinggi (sekitar 1 dari 3). Periksa gula darah dan konsultasikan ke puskesmas."; }
  else { category = "Risiko sangat tinggi"; severity = 2; explanation = "Perkiraan risiko diabetes tipe 2 dalam 10 tahun sangat tinggi (sekitar 1 dari 2). Segera periksa ke fasilitas kesehatan."; }
  return { score, finding: { key: "findrisc", label: "Skor Risiko Diabetes (FINDRISC)", value_text: `${score} dari 26`, category, severity, explanation, source: SOURCES.findrisc } };
}

export const DANGER_QUESTIONS = [
  { key: "chest_pain", text: "Nyeri dada yang menjalar atau terasa berat seperti tertindih" },
  { key: "severe_breath", text: "Sesak napas berat" },
  { key: "weakness_side", text: "Kelemahan/kebas pada satu sisi tubuh atau wajah mencong" },
  { key: "speech_trouble", text: "Bicara pelo atau sulit berbicara" },
  { key: "fainting", text: "Pingsan atau hampir pingsan" },
] as const;

export function recommendationsFor(findings: Finding[], hasDanger: boolean): string[] {
  if (hasDanger) return [
    "Segera ke IGD rumah sakit terdekat atau hubungi 119 — ada tanda bahaya atau nilai pengukuran sangat tinggi.",
    "Jangan menunda: bawa catatan hasil skrining ini saat berobat.",
  ];
  const recs: string[] = [];
  const maxSev = Math.max(0, ...findings.map((f) => f.severity));
  if (maxSev === 2) recs.push("Periksa ke puskesmas/dokter dalam 7 hari untuk pemeriksaan lanjutan dan konfirmasi.");
  else if (maxSev === 1) recs.push("Periksa ke puskesmas dalam 30 hari, atau lebih cepat bila ada keluhan.");
  else recs.push("Pertahankan pola hidup sehat dan ulangi skrining 6-12 bulan lagi, atau lebih cepat bila ada keluhan.");
  if (findings.some((f) => f.key === "bp" && f.severity >= 1)) recs.push("Kurangi garam, berhenti merokok, dan pantau tekanan darah secara berkala di SIGERMONITOR.");
  if (findings.some((f) => f.key === "bmi" && f.severity >= 1)) recs.push("Atur pola makan dan tingkatkan aktivitas fisik bertahap; baca edukasi gizi di SIGEREDU.");
  if (findings.some((f) => (f.key === "sugar" || f.key === "findrisc") && f.severity >= 1)) recs.push("Lakukan pemeriksaan gula darah laboratorium di fasilitas kesehatan untuk memastikan.");
  recs.push("Hasil ini adalah skrining awal, bukan diagnosis. Diagnosis hanya dapat ditegakkan tenaga kesehatan melalui pemeriksaan langsung.");
  return recs;
}
