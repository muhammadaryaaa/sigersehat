import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type Profile = { id: string; full_name: string; relation: string };
type Item = { target_type: string; label: string; target_value: number; unit: string; source_ref: string; achieved_today: number; progress_percent: number; within_target: boolean };
type Food = { id: string; food_name: string; energy_kcal: number; protein_g: number; portion_desc: string; source_name: string };

export function NutriPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profileId, setProfileId] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [foods, setFoods] = useState<Food[]>([]);
  const [fq, setFq] = useState("");
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  useEffect(() => { apiFetch<Profile[]>("/api/v1/profiles/family").then((ps) => { setProfiles(ps); if (ps.length) setProfileId(ps[0].id); }).catch(() => setError("Profil tidak dapat dimuat.")); }, []);
  const load = useCallback(() => { if (profileId) apiFetch<{ items: Item[] }>(`/api/v1/nutri/${profileId}/today`).then((d) => setItems(d.items)).catch(() => setError("Target gizi tidak dapat dimuat.")); }, [profileId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { apiFetch<Food[]>(`/api/v1/nutri/foods?q=${encodeURIComponent(fq)}`).then(setFoods).catch(() => {}); }, [fq]);
  async function save(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      for (const item of items) {
        const v = values[item.target_type];
        if (v !== undefined && v !== "") await apiMutate("/api/v1/nutri/logs", "POST", { profileId, targetType: item.target_type, achievedValue: Number(v) });
      }
      setNotice("Catatan gizi hari ini tersimpan."); load();
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Catatan tidak dapat disimpan."); }
  }
  return (
    <> <PageHeader title="Gizi &amp; Pola Makan" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      <p className="mt-2 text-ink-600">Target harian berasal dari aturan resmi Kemenkes/WHO. Catat capaian Anda dan pantau kemajuannya.</p>
      <div className="mt-4 flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="np">Profil</label>
        <select id="np" className="min-h-12 rounded-btn border border-line bg-white px-3" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.relation})</option>)}
        </select></div>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <form onSubmit={save} className="mt-6 flex flex-col gap-3">
        {items.map((item) => <div key={item.target_type} className="rounded-card border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">{item.label}: target {item.target_value} {item.unit}</p>
            <p className={item.within_target ? "font-semibold text-brand-700" : "text-ink-600"}>Hari ini {item.achieved_today} ({item.progress_percent}%)</p>
          </div>
          <div className="mt-2 h-3 rounded-full bg-surface" role="progressbar" aria-valuenow={item.progress_percent} aria-valuemin={0} aria-valuemax={100} aria-label={item.label}>
            <div className="h-3 rounded-full bg-brand-600" style={{ width: `${item.progress_percent}%` }} />
          </div>
          <p className="mt-1 text-sm text-ink-500">Sumber: {item.source_ref}</p>
          <div className="mt-2 max-w-xs"><TextField label={`Capaian hari ini (${item.unit})`} type="number" step="0.1" value={values[item.target_type] ?? ""} onChange={(e) => setValues({ ...values, [item.target_type]: e.target.value })} /></div>
        </div>)}
        <Button type="submit">Simpan Catatan Hari Ini</Button>
      </form>
      <section aria-labelledby="pangan" className="mt-10">
        <h2 id="pangan" className="text-xl font-bold">Kandungan Gizi Pangan (TKPI Kemenkes)</h2>
        <div className="mt-3 max-w-sm"><TextField label="Cari pangan" type="search" value={fq} onChange={(e) => setFq(e.target.value)} placeholder="mis. tempe, ikan, pisang" /></div>
        <table className="mt-3 w-full text-left text-sm">
          <thead><tr><th className="py-1">Pangan</th><th className="py-1">Energi (kkal)</th><th className="py-1">Protein (g)</th><th className="py-1">Porsi acuan</th></tr></thead>
          <tbody>{foods.map((f) => <tr key={f.id} className="border-t border-line"><td className="py-1">{f.food_name}</td><td className="py-1 tabular-nums">{f.energy_kcal}</td><td className="py-1 tabular-nums">{f.protein_g}</td><td className="py-1">{f.portion_desc}</td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-sm text-ink-500">Nilai per 100 gram dari Tabel Komposisi Pangan Indonesia (TKPI) Kemenkes RI. Edukasi gizi lengkap tersedia di artikel Isi Piringku pada SIGEREDU.</p>
      </section>
    </main></>
  );
}
