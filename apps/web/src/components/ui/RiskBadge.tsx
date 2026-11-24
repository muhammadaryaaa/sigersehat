import { CheckCircle2, AlertTriangle, OctagonAlert } from "lucide-react";
// Status tidak pernah warna saja: ikon + label (Tahap 3 / WCAG 1.4.1).
const map = {
  rendah: { icon: CheckCircle2, label: "Risiko Rendah", cls: "bg-brand-50 text-brand-800" },
  sedang: { icon: AlertTriangle, label: "Risiko Sedang", cls: "bg-warn-50 text-warn-800" },
  tinggi: { icon: OctagonAlert, label: "Risiko Tinggi", cls: "bg-danger-50 text-danger-700" },
} as const;
export function RiskBadge({ level }: { level: keyof typeof map }) {
  const { icon: Icon, label, cls } = map[level];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${cls}`}><Icon size={16} aria-hidden="true" />{label}</span>;
}
