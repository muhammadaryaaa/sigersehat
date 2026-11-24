// Format tampilan tanggal/waktu: menerima format SQLite ("2026-11-24 08:00:00")
// maupun ISO ("2026-11-24T09:00:00.000Z") dan menampilkannya sebagai waktu lokal yang terbaca.
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value.includes("T") ? value : value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}
