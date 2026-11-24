import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";

type Stats = { period_days: number; users_by_role: { role: string; count: number | string }[]; screenings_completed: number;
  risk_distribution: { category: string; count: number | string }[]; measurements_recorded: number;
  profiles_by_region: { region: string; profiles: number | string }[]; screenings_by_month: { month: string; count: number }[]; privacy_note: string };
function Bars({ items, label }: { items: { label: string; value: number | string }[]; label: string }) {
  const max = Math.max(1, ...items.map((i) => (typeof i.value === "number" ? i.value : 0)));
  return <div className="flex flex-col gap-2" role="img" aria-label={label}>
    {items.map((i) => <div key={i.label} className="flex items-center gap-3">
      <span className="w-44 shrink-0 text-sm">{i.label}</span>
      <div className="h-5 flex-1 rounded bg-surface"><div className="h-5 rounded bg-brand-600" style={{ width: `${typeof i.value === "number" ? (i.value / max) * 100 : 8}%` }} /></div>
      <span className="w-12 text-right font-semibold tabular-nums">{i.value}</span></div>)}
  </div>;
}
export function InsightPage() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Stats>(`/api/v1/insights/statistics?days=${days}`).then(setStats).catch(() => setError("Statistik tidak dapat dimuat.")); }, [days]);
  return (
    <>
      <PageHeader title="SIGERINSIGHT — Statistik Agregat" description="Seluruh angka adalah agregat anonim dari data aktual sistem. Tidak ada data individu dan tidak ada penelusuran per orang." />
      <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mt-4 flex flex-col gap-1.5 max-w-xs"><label className="text-sm font-medium" htmlFor="period">Periode</label>
        <select id="period" className="min-h-12 rounded-btn border border-line bg-white px-3" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>7 hari</option><option value={30}>30 hari</option><option value={90}>90 hari</option><option value={365}>1 tahun</option>
        </select></div>
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      {stats ? <div className="mt-6 flex flex-col gap-8">
        <section aria-labelledby="ringkas"><h2 id="ringkas" className="text-xl font-bold">Ringkasan {stats.period_days} Hari</h2>
          <p className="mt-2">Skrining selesai: <strong>{stats.screenings_completed}</strong> • Pengukuran tercatat: <strong>{stats.measurements_recorded}</strong></p></section>
        <section aria-labelledby="risiko"><h2 id="risiko" className="text-xl font-bold">Distribusi Kategori Risiko Skrining</h2>
          <div className="mt-3"><Bars label="Distribusi kategori risiko" items={stats.risk_distribution.map((r) => ({ label: r.category, value: r.count }))} /></div></section>
        <section aria-labelledby="wilayah"><h2 id="wilayah" className="text-xl font-bold">Profil per Wilayah</h2>
          <div className="mt-3"><Bars label="Profil per wilayah" items={stats.profiles_by_region.map((r) => ({ label: r.region, value: r.profiles }))} /></div></section>
        <section aria-labelledby="peran"><h2 id="peran" className="text-xl font-bold">Pengguna per Peran</h2>
          <div className="mt-3"><Bars label="Pengguna per peran" items={stats.users_by_role.map((r) => ({ label: r.role, value: r.count }))} /></div></section>
        <section aria-labelledby="bulanan"><h2 id="bulanan" className="text-xl font-bold">Skrining per Bulan</h2>
          <div className="mt-3"><Bars label="Skrining per bulan" items={stats.screenings_by_month.map((r) => ({ label: r.month, value: r.count }))} /></div></section>
        <p className="text-sm text-ink-500">{stats.privacy_note}</p>
      </div> : null}
    </main>
    </>
  );
}
