import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, BellOff } from "lucide-react";
import { apiFetch } from "../lib/api";
import { formatDateTime } from "../lib/format";
import { PageHeader } from "../components/ui/PageHeader";

type Notif = { id: string; title: string; body: string; link_path: string | null; is_read: number; created_at: string };

// Pusat notifikasi (Master Prompt UI/UX butir 14.3): daftar notifikasi nyata
// milik pengguna dari backend; klik menandai dibaca dan mengikuti tautannya.
export function NotificationsPage() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    apiFetch<Notif[]>("/api/v1/notifications").then(setItems).catch(() => setError("Notifikasi tidak dapat dimuat. Coba muat ulang halaman."));
  }, []);
  async function open(n: Notif) {
    if (!n.is_read) {
      try { await apiFetch(`/api/v1/notifications/${n.id}/read`, { method: "POST" }); } catch { /* tautan tetap diikuti */ }
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)) ?? prev);
    }
    if (n.link_path) navigate(n.link_path);
  }
  const unread = items?.filter((n) => !n.is_read).length ?? 0;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title="Notifikasi" description={items ? (unread ? `${unread} notifikasi belum dibaca.` : "Semua notifikasi sudah dibaca.") : "Memuat notifikasi Anda…"} />
      {error ? <p role="alert" className="mt-6 rounded-card bg-danger-50 p-4 text-danger-700">{error}</p> : null}
      {items && items.length === 0 ? (
        <div className="mt-8 rounded-card border border-dashed border-line bg-white p-8 text-center shadow-card">
          <BellOff size={36} aria-hidden="true" className="mx-auto text-ink-500" />
          <p className="mt-3 font-bold">Belum ada notifikasi</p>
          <p className="mx-auto mt-1 max-w-md text-ink-600">Notifikasi muncul di sini saat pengingatmu jatuh tempo, misalnya jadwal obat, kontrol, atau imunisasi. Buat pengingat pertamamu agar tidak terlewat.</p>
          <Link to="/pengingat" className="mt-4 inline-flex min-h-11 items-center rounded-btn bg-brand-600 px-4 font-semibold text-white">Buat Pengingat</Link>
        </div>
      ) : null}
      {items && items.length > 0 ? (
        <ul className="mt-6 flex flex-col gap-2.5">
          {items.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} className={`flex w-full items-start gap-3 rounded-card border p-4 text-left shadow-card transition-shadow hover:shadow-lift ${n.is_read ? "border-line bg-white" : "border-brand-600/40 bg-brand-50"}`}>
                <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${n.is_read ? "bg-cream text-ink-500" : "bg-brand-600 text-white"}`}><Bell size={18} aria-hidden="true" /></span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-bold text-ink-900">{n.title}</span>
                    {!n.is_read ? <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">Baru</span> : null}
                  </span>
                  <span className="mt-0.5 block text-ink-600">{n.body}</span>
                  <span className="mt-1 block text-xs text-ink-500">{formatDateTime(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-6 flex items-center gap-2 text-sm text-ink-500"><Bell size={15} aria-hidden="true" /> Notifikasi saat ini tampil di dalam situs saat kamu masuk. Pengingat juga dapat dilihat kapan saja di halaman Pengingat.</p>
    </main>
  );
}
