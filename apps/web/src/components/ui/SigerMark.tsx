// Wordmark sementara SIGERSEHAT: elemen mahkota siger digambar sebagai geometri
// SVG sederhana (puncak berundak) + nama dalam huruf serif. Bukan logo resmi —
// menunggu persetujuan pemilik (TODO di laporan revisi visual).
export function SigerMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="34" height="26" viewBox="0 0 34 26" aria-hidden="true" className="shrink-0">
        <path d="M17 1 L19.5 8 L26 4.5 L25 11 L31 8.5 L28.5 16 L30 22 L4 22 L5.5 16 L3 8.5 L9 11 L8 4.5 L14.5 8 Z" fill="#be9a44" />
        <path d="M7 22 L27 22 L25.8 17.5 L8.2 17.5 Z" fill="#711c2a" />
      </svg>
      {compact ? null : (
        <span className="font-display text-[22px] font-bold leading-none tracking-tight text-ink-900">
          SIGER<span className="text-brand-800">SEHAT</span>
        </span>
      )}
    </span>
  );
}
