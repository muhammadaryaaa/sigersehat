import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

type Overview = { health_worker: { profession: string; verification_status: string; rejection_reason: string | null } | null; active_patients: number; follow_ups_due: { id: string; full_name: string; task_type: string; due_date: string }[] };
export function DashboardNakes() {
  const { me, logout } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Overview>("/api/v1/med/overview").then(setData).catch(() => setError("Data tidak dapat dimuat.")); }, []);
  const status = data?.health_worker?.verification_status;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-lg font-extrabold tracking-tight text-brand-800">SIGERSEHAT</p>
          <h1 className="mt-1 text-2xl font-bold">Beranda Tenaga Kesehatan</h1>
          <p className="text-ink-600">{me?.profile?.full_name} — {data?.health_worker?.profession ?? ""}</p></div>
        <Button variant="secondary" onClick={async () => { await logout(); location.href = "/"; }}>Keluar</Button>
      </header>
      {error ? <p role="alert" className="mt-6 rounded-card bg-danger-50 p-4 text-danger-700">{error}</p> : null}
      {data && status !== "verified" ? (
        <section className="mt-8 rounded-card bg-warn-50 p-5 text-warn-800">
          <h2 className="text-lg font-bold">Status verifikasi: {status === "rejected" ? "Ditolak" : "Menunggu verifikasi"}</h2>
          <p className="mt-1">{status === "rejected" ? `Alasan: ${data.health_worker?.rejection_reason ?? "—"}. Perbaiki data kredensial lalu ajukan kembali melalui administrator.` : "Kredensial Anda sedang diperiksa administrator. Akses data pasien terbuka setelah verifikasi disetujui."}</p>
        </section>
      ) : null}
      {data && status === "verified" ? <>
        <section className="mt-8"><h2 className="text-xl font-bold">Tindak Lanjut Jatuh Tempo</h2>
          {data.follow_ups_due.length ? <ul className="mt-3 flex flex-col gap-2">{data.follow_ups_due.map((f) => <li key={f.id} className="rounded-card border border-line bg-white p-4">{f.full_name} — {f.task_type} — jatuh tempo {f.due_date}</li>)}</ul>
            : <p className="mt-3 text-ink-600">Tidak ada tindak lanjut yang jatuh tempo hari ini.</p>}</section>
        <section className="mt-8"><h2 className="text-xl font-bold">Pasien Saya</h2>
          <p className="mt-3 text-ink-600">Pasien dengan izin aktif: {data.active_patients}. Daftar pasien lengkap dibangun pada tahap SIGERMED.</p></section>
      </> : null}
    <p className="mt-6"><a className="rounded-btn bg-brand-600 px-4 py-2 font-semibold text-white" href="/nakes/pasien">Buka Ruang Pasien (SIGERMED)</a></p>
    </main>
  );
}
