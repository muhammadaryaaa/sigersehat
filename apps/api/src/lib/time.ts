// Semua cap waktu yang DISIMPAN memakai format SQLite "YYYY-MM-DD HH:MM:SS" (UTC)
// agar perbandingan teks di SQL (datetime('now')) selalu benar. Jangan simpan format ISO "T...Z".
export function toSqlTime(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  return d.toISOString().slice(0, 19).replace("T", " ");
}
export function nowSql(): string { return toSqlTime(new Date()); }
