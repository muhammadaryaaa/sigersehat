import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";

export function DashboardAdmin() {
  const { me, logout } = useAuth();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Record<string, unknown>>("/api/v1/admin/overview").then(setData).catch(() => setError("Data tidak dapat dimuat.")); }, []);
  const isSuper = me?.user.role === "super_admin";
  const queues: [string, string][] = [
    ["pending_verifications", "Verifikasi nakes menunggu"], ["open_correction_reports", "Laporan koreksi faskes terbuka"],
    ["open_ai_reports", "Laporan jawaban AI terbuka"], ["open_reports", "Laporan pengguna terbuka"],
    ["facilities_verified", "Faskes terverifikasi"], ["facilities_total", "Total faskes"],
    ["users_total", "Total pengguna"], ["edu_published", "Konten edukasi terbit"],
  ];
  if (isSuper) queues.push(["audit_entries", "Entri audit log"], ["admins_total", "Admin & Super Admin"]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-start justify-between gap-4">
        <div><p className="text-lg font-extrabold tracking-tight text-brand-800">SIGERSEHAT</p>
          <h1 className="mt-1 text-2xl font-bold">{isSuper ? "Beranda Super Administrator" : "Beranda Administrator"}</h1>
          <p className="text-ink-600">Antrean pengelolaan platform. Halaman ini tidak menampilkan data kesehatan individu.</p></div>
        <Button variant="secondary" onClick={async () => { await logout(); location.href = "/"; }}>Keluar</Button>
      </header>
      {error ? <p role="alert" className="mt-6 rounded-card bg-danger-50 p-4 text-danger-700">{error}</p> : null}
      {data ? <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {queues.map(([key, label]) => <li key={key} className="rounded-card border border-line bg-white p-4"><p className="text-sm text-ink-600">{label}</p><p className="text-3xl font-bold tabular-nums">{String(data[key] ?? 0)}</p></li>)}
      </ul> : null}
      {isSuper && data ? <section className="mt-8"><h2 className="text-xl font-bold">Pengaturan Sistem</h2>
        {Array.isArray(data.system_settings) && data.system_settings.length ? <p className="mt-2">Terdapat {data.system_settings.length} pengaturan tersimpan.</p> : <p className="mt-2 text-ink-600">Belum ada pengaturan sistem tersimpan. Pengelolaan pengaturan hanya untuk Super Administrator.</p>}</section> : null}
    </main>
  );
}
