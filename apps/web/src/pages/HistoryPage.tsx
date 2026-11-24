import { useEffect, useState } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";

type Item = { kind: string; at: string; title: string; id: string; detail: Record<string, unknown> };
export function HistoryPage() {
  const { me } = useAuth();
  const profileId = me?.profile?.id ?? "";
  const [items, setItems] = useState<Item[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { if (profileId) apiFetch<Item[]>(`/api/v1/profiles/history?profileId=${profileId}`).then(setItems).catch(() => setError("Riwayat tidak dapat dimuat.")); }, [profileId]);
  return (
    <> <PageHeader title="Riwayat Kesehatan" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mt-2 text-ink-600">Seluruh catatan Anda dalam urutan waktu — pengukuran, skrining, dan imunisasi.</p>
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      {items.length ? <ol className="mt-6 flex flex-col gap-2">
        {items.map((i) => <li key={`${i.kind}-${i.id}`} className="rounded-card border border-line bg-white p-4">
          <p className="font-semibold">{i.title} <span className="text-sm font-normal text-ink-500">— {String(i.at)}</span></p>
          {i.kind === "measurement" ? <p className="mt-1 text-sm">{i.detail.systolic ? `TD ${String(i.detail.systolic)}/${String(i.detail.diastolic)} mmHg` : ""}{i.detail.weight_kg ? ` • BB ${String(i.detail.weight_kg)} kg` : ""}{i.detail.blood_sugar_mgdl ? ` • Gula ${String(i.detail.blood_sugar_mgdl)} mg/dL` : ""}{i.detail.bmi ? ` • IMT ${String(i.detail.bmi)}` : ""} ({String(i.detail.source)})</p> : null}
          {i.kind === "screening" ? <p className="mt-1 text-sm">Kategori risiko: <strong>{String(i.detail.risk_category)}</strong>{i.detail.has_danger_sign ? " — ada tanda bahaya saat itu" : ""}. <Link className="text-brand-700 underline" to="/skrining">Mulai skrining baru</Link></p> : null}
          {i.kind === "immunization" ? <p className="mt-1 text-sm">Vaksin {String(i.detail.vaccine_code)} dosis {String(i.detail.dose_number)} di {String(i.detail.facility_name ?? "-")}</p> : null}
        </li>)}
      </ol> : <p className="mt-6 text-ink-600">Belum ada riwayat. Catatan pertama Anda akan muncul di sini setelah skrining atau pencatatan pengukuran.</p>}
    </main></>
  );
}
