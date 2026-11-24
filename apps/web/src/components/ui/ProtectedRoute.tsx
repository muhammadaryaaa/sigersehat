import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { AppShell } from "./AppShell";
import { PageHeader } from "./PageHeader";
import { Lock, LogIn } from "lucide-react";
import type { ReactNode } from "react";

// Proteksi halaman per role (diperkuat penegakan server di API — ini lapisan tampilan).
// Fitur yang menyimpan data pribadi menampilkan keadaan terkunci yang terdesain
// (alasan + pratinjau jujur + tombol Masuk dengan tujuan kembali), bukan redirect kasar.
export type LockedInfo = { title: string; description: string; points: string[] };

export function ProtectedRoute({ roles, locked, children }: { roles: string[]; locked?: LockedInfo; children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10" aria-live="polite">
        <div className="skeleton h-9 w-56" />
        <div className="skeleton mt-4 h-24 w-full" />
        <div className="skeleton mt-4 h-24 w-full" />
        <span className="sr-only">Memuat…</span>
      </main>
    );
  }
  if (!me) {
    if (locked) {
      return (
        <AppShell>
          <PageHeader title={locked.title} description={locked.description} />
          <main className="mx-auto max-w-3xl px-4 py-8">
            <div className="route-enter rounded-card border border-line bg-white p-6 shadow-card">
              <p className="flex items-center gap-2 font-bold text-brand-800"><Lock size={18} aria-hidden="true" /> Halaman ini perlu akun</p>
              <p className="mt-2 text-ink-600">Fitur ini menyimpan data pribadimu dari waktu ke waktu, jadi hanya dapat dibuka setelah masuk. Yang akan kamu dapatkan:</p>
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-ink-600">
                {locked.points.map((pt) => <li key={pt}>{pt}</li>)}
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link to={`/masuk?next=${encodeURIComponent(location.pathname)}`} className="inline-flex min-h-12 items-center gap-2 rounded-btn bg-brand-800 px-5 font-semibold text-white"><LogIn size={17} aria-hidden="true" /> Masuk</Link>
                <Link to={`/daftar?next=${encodeURIComponent(location.pathname)}`} className="inline-flex min-h-12 items-center rounded-btn border border-line bg-white px-5 font-semibold">Daftar akun baru</Link>
              </div>
              <p className="mt-4 text-sm text-ink-500">Tanpa akun, kamu tetap bisa membaca edukasi, membuka peta, mengisi skrining awal, dan bertanya ke Tanya AI.</p>
            </div>
          </main>
        </AppShell>
      );
    }
    return <Navigate to={`/masuk?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (!roles.includes(me.user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
