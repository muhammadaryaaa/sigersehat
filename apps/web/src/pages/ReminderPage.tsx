import { useCallback, useEffect, useState, type FormEvent } from "react";
import { formatDateTime } from "../lib/format";
import { apiFetch } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { PageHeader } from "../components/ui/PageHeader";
import { TextField } from "../components/ui/TextField";

type Reminder = { id: string; title: string; scheduled_at: string; status: string; reminder_type: string };
type Notif = { id: string; title: string; body: string; is_read: number; created_at: string };
export function ReminderPage() {
  const { me } = useAuth();
  const profileId = me?.profile?.id ?? "";
  const [items, setItems] = useState<Reminder[]>([]);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [form, setForm] = useState({ title: "", scheduledAt: "", reminderType: "measurement" });
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(() => {
    apiFetch<Reminder[]>("/api/v1/reminders").then(setItems).catch(() => setError("Pengingat tidak dapat dimuat."));
    apiFetch<Notif[]>("/api/v1/notifications").then(setNotifs).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  async function submit(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try { await apiMutate("/api/v1/reminders", "POST", { ...form, profileId, scheduledAt: new Date(form.scheduledAt).toISOString() }); setNotice("Pengingat dibuat."); setForm({ title: "", scheduledAt: "", reminderType: "measurement" }); load(); }
    catch { setError("Pengingat tidak dapat dibuat. Periksa judul dan waktu."); }
  }
  async function act(id: string, action: string) {
    try { await apiMutate(`/api/v1/reminders/${id}/${action}`, "POST", action === "snooze" ? { until: new Date(Date.now() + 86400_000).toISOString() } : {}); load(); }
    catch { setError("Tindakan tidak dapat dilakukan."); }
  }
  async function readNotif(id: string) { try { await apiMutate(`/api/v1/notifications/${id}/read`, "POST", {}); load(); } catch { /* notifikasi tetap tampil; pengguna dapat mencoba lagi */ } }
  const upcoming = items.filter((r) => ["scheduled", "snoozed", "sent"].includes(r.status));
  const done = items.filter((r) => ["done", "cancelled"].includes(r.status));
  return (
    <> <PageHeader title="Pengingat" />
    <main className="mx-auto max-w-3xl px-4 py-8">
      {notifs.some((n) => !n.is_read) ? <section aria-labelledby="notif" className="mt-6">
        <h2 id="notif" className="text-xl font-bold">Notifikasi</h2>
        <ul className="mt-3 flex flex-col gap-2">{notifs.filter((n) => !n.is_read).map((n) => <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card bg-warn-50 p-4 text-warn-800">
          <span><strong>{n.title}</strong> — {n.body}</span><Button variant="secondary" onClick={() => readNotif(n.id)}>Tandai Dibaca</Button></li>)}</ul></section> : null}
      <section aria-labelledby="baru" className="mt-8">
        <h2 id="baru" className="text-xl font-bold">Buat Pengingat</h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Judul pengingat" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <TextField label="Waktu" type="datetime-local" required value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="rtype">Jenis</label>
            <select id="rtype" className="min-h-12 rounded-btn border border-line bg-white px-3" value={form.reminderType} onChange={(e) => setForm({ ...form, reminderType: e.target.value })}>
              <option value="measurement">Pengukuran berkala</option><option value="medication">Minum obat</option><option value="follow_up">Kontrol / tindak lanjut</option><option value="custom">Lainnya</option></select></div>
          <div className="flex items-end"><Button type="submit">Buat Pengingat</Button></div>
        </form>
        {notice ? <p role="status" className="mt-3 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
        {error ? <p role="alert" className="mt-3 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      </section>
      <section aria-labelledby="mendatang" className="mt-8">
        <h2 id="mendatang" className="text-xl font-bold">Mendatang &amp; Jatuh Tempo</h2>
        {upcoming.length ? <ul className="mt-3 flex flex-col gap-2">{upcoming.map((r) => <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-line bg-white p-4">
          <span><strong>{r.title}</strong> — {formatDateTime(r.scheduled_at)} <span className="text-sm text-ink-500">({r.status === "sent" ? "Jatuh tempo" : r.status === "snoozed" ? "Ditunda" : "Terjadwal"})</span></span>
          <span className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => act(r.id, "snooze")}>Tunda 1 Hari</Button><Button onClick={() => act(r.id, "done")}>Selesai</Button><Button variant="danger" onClick={() => act(r.id, "cancel")}>Batalkan</Button></span></li>)}</ul>
          : <p className="mt-3 text-ink-600">Tidak ada pengingat aktif.</p>}
      </section>
      {done.length ? <section aria-labelledby="selesai" className="mt-8"><h2 id="selesai" className="text-xl font-bold">Selesai &amp; Dibatalkan</h2>
        <ul className="mt-3 flex flex-col gap-2">{done.map((r) => <li key={r.id} className="rounded-card border border-line bg-white p-4 text-ink-600">{r.title} — {formatDateTime(r.scheduled_at)} ({r.status === "done" ? "Selesai" : "Dibatalkan"})</li>)}</ul></section> : null}
    </main></>
  );
}
