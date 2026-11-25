type Point = { measured_at: string; value: number };
// Grafik garis SVG dari data aktual (Tahap 3 TrendChart): sumbu berlabel, titik dapat difokuskan,
// dan tabel data pendamping untuk pembaca layar / pengguna yang memilih angka.
export function TrendChart({ points, unit, label }: { points: Point[]; unit: string; label: string }) {
  if (!points.length) return <p className="text-ink-600">Belum ada data pada periode ini. Catat pengukuran pertama Anda untuk melihat perkembangan.</p>;
  const w = 640, h = 220, pad = 36;
  const values = points.map((p) => p.value);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Grafik ${label}: ${points.length} titik data, nilai terakhir ${values[values.length - 1]} ${unit}`} className="w-full">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="#94a3b8" />
        <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="#94a3b8" />
        <text x={4} y={y(max) + 4} fontSize="12" fill="#475569">{max}</text>
        <text x={4} y={y(min) + 4} fontSize="12" fill="#475569">{min}</text>
        <path d={path} fill="none" stroke="#1d74db" strokeWidth="2.5" />
        {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.value)} r="4" fill="#175db4"><title>{`${p.measured_at}: ${p.value} ${unit}`}</title></circle>)}
      </svg>
      <figcaption className="text-sm text-ink-600">{label} ({unit}) — {points.length} pengukuran. Nilai terakhir {values[values.length - 1]} {unit}.</figcaption>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">Lihat data sebagai tabel</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead><tr><th className="py-1">Waktu</th><th className="py-1">Nilai ({unit})</th></tr></thead>
          <tbody>{points.map((p, i) => <tr key={i} className="border-t border-line"><td className="py-1">{p.measured_at}</td><td className="py-1 tabular-nums">{p.value}</td></tr>)}</tbody>
        </table>
      </details>
    </figure>
  );
}
