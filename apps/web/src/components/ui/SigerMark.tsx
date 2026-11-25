// Wordmark SIGERSEHAT: elemen mahkota siger digambar sebagai geometri SVG
// sederhana (puncak berundak emas, dasar hijau) + nama biru. Bukan logo resmi —
// menunggu persetujuan pemilik (TODO di laporan revisi visual).
export function SigerMark({ compact = false, tagline = false }: { compact?: boolean; tagline?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
        <path d="M17 1 L19.5 8 L26 4.5 L25 11 L31 8.5 L28.5 16 L30 22 L4 22 L5.5 16 L3 8.5 L9 11 L8 4.5 L14.5 8 Z" fill="#be9a44" />
        <path d="M7 22 L27 22 L25.8 17.5 L8.2 17.5 Z" fill="#1e9e62" />
      </svg>
      {compact ? null : (
        <span className="leading-none">
          <span className="font-display text-[22px] font-bold leading-none tracking-tight text-brand-800">
            SIGERSEHAT
          </span>
          {tagline ? <span className="mt-1 block text-[11px] font-medium leading-none text-ink-500">Sehat Hari Ini, Lampung Lebih Baik</span> : null}
        </span>
      )}
    </span>
  );
}
