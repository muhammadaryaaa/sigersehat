import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

type Dash = {
  profile: { full_name: string };
  latest_measurement: Record<string, unknown> | null;
  recent_measurements: Record<string, unknown>[];
  next_reminders: { id: string; title: string; scheduled_at: string }[];
  unread_notifications: number;
  family_profiles: { id: string; relation: string; full_name: string }[];
  last_screening: { risk_category: string; completed_at: string } | null;
};
export function DashboardMasyarakat() {
  const { me, logout } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Dash>("/api/v1/dashboard/masyarakat").then(setData).catch(() => setError("Data beranda tidak dapat dimuat. Coba muat ulang halaman.")); }, []);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-lg font-extrabold tracking-tight text-brand-800">SIGERSEHAT</p>
          <h1 className="mt-1 text-2xl font-bold">Halo, {me?.profile?.full_name ?? "Pengguna"}</h1></div>
        <div className="flex gap-2">
          <Link to="/akun" className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white px-4 font-semibold">Akun &amp; Sesi</Link>
          <Button variant="secondary" onClick={async () => { await logout(); location.href = "/"; }}>Keluar</Button>
        </div>
      </header>
      <nav aria-label="Modul utama" className="mt-6 flex flex-wrap gap-2">
        <Link to="/skrining" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Periksa Risiko</Link>
        <Link to="/pantau" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Catat &amp; Pantau</Link>
        <Link to="/pengingat" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Pengingat</Link>
        <Link to="/riwayat" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Riwayat</Link>
        <Link to="/keluarga" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Keluarga</Link>
        <Link to="/perempuan" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Perempuan</Link>
        <Link to="/tumbuh" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Tumbuh Kembang</Link>
        <Link to="/lansia" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Lansia</Link>
        <Link to="/gizi" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Gizi</Link>
        <Link to="/izin" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Izin & Nakes</Link>
        <Link to="/peta" className="rounded-full bg-brand-50 px-4 py-2 font-semibold text-brand-800">Peta Faskes</Link>
      </nav>
      {error ? <p role="alert" className="mt-6 rounded-card bg-danger-50 p-4 text-danger-700">{error}</p> : null}
      {!data && !error ? <p className="mt-6" aria-live="polite">Memuat data Anda…</p> : null}
      {data ? <>
        <section aria-labelledby="keadaan" className="mt-8">
          <h2 id="keadaan" className="text-xl font-bold">Keadaan Terakhir</h2>
          {data.latest_measurement ? (
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {data.latest_measurement.systolic ? <li className="rounded-card border border-line bg-white p-4"><p className="text-sm text-ink-600">Tekanan darah</p><p className="text-3xl font-bold tabular-nums">{String(data.latest_measurement.systolic)}/{String(data.latest_measurement.diastolic)} <span className="text-base font-medium">mmHg</span></p></li> : null}
              {data.latest_measurement.weight_kg ? <li className="rounded-card border border-line bg-white p-4"><p className="text-sm text-ink-600">Berat badan</p><p className="text-3xl font-bold tabular-nums">{String(data.latest_measurement.weight_kg)} <span className="text-base font-medium">kg</span></p></li> : null}
              {data.latest_measurement.blood_sugar_mgdl ? <li className="rounded-card border border-line bg-white p-4"><p className="text-sm text-ink-600">Gula darah</p><p className="text-3xl font-bold tabular-nums">{String(data.latest_measurement.blood_sugar_mgdl)} <span className="text-base font-medium">mg/dL</span></p></li> : null}
            </ul>
          ) : (
            <div className="mt-3 rounded-card border border-line bg-white p-5">
              <p>Belum ada pengukuran tercatat. Mulai dengan skrining pertama untuk mengetahui keadaan awal Anda.</p>
              <Link to="/skrining" className="mt-3 inline-flex min-h-12 items-center rounded-btn bg-brand-800 px-5 font-semibold text-white">Mulai Skrining Pertama</Link>
            </div>
          )}
        </section>
        <section aria-labelledby="langkah" className="mt-8">
          <h2 id="langkah" className="text-xl font-bold">Langkah Berikutnya</h2>
          {data.next_reminders.length ? <ul className="mt-3 flex flex-col gap-2">{data.next_reminders.map((r) => <li key={r.id} className="rounded-card border border-line bg-white p-4">{r.title} — {r.scheduled_at}</li>)}</ul>
            : <p className="mt-3 text-ink-600">Tidak ada pengingat terjadwal. {data.last_screening ? `Skrining terakhir: risiko ${data.last_screening.risk_category}.` : "Skrining berkala membantu memantau risiko Anda."}</p>}
          {data.unread_notifications ? <p className="mt-2 text-sm">Notifikasi belum dibaca: {data.unread_notifications}</p> : null}
        </section>
        <section aria-labelledby="keluarga" className="mt-8">
          <h2 id="keluarga" className="text-xl font-bold">Keluargaku</h2>
          <ul className="mt-3 flex flex-wrap gap-2">{data.family_profiles.map((p) => <li key={p.id} className="rounded-full bg-brand-50 px-4 py-2 font-medium text-brand-800">{p.full_name} ({p.relation === "self" ? "Saya" : p.relation})</li>)}</ul>
        </section>
      </> : null}
    </main>
  );
}
