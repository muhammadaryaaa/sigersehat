import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDateTime } from "../lib/format";
import { apiFetch } from "../lib/api";
import { useAuth } from "../lib/auth";
import { Activity, Baby, Bell, BookOpen, ClipboardCheck, Cpu, Heart, History, MapPin, MessagesSquare, Salad, ShieldCheck, UserRound, Users } from "lucide-react";

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
  const { me } = useAuth();
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { apiFetch<Dash>("/api/v1/dashboard/masyarakat").then(setData).catch(() => setError("Data beranda tidak dapat dimuat. Coba muat ulang halaman.")); }, []);
  const MODULES = [
    { to: "/skrining", icon: ClipboardCheck, name: "Periksa Risiko", desc: "Skrining IMT, tekanan darah, gula darah, dan risiko diabetes." },
    { to: "/pantau", icon: Activity, name: "Catat & Pantau", desc: "Catat pengukuran berkala dan lihat grafik perkembangan Anda." },
    { to: "/pengingat", icon: Bell, name: "Pengingat", desc: "Jadwal obat, kontrol, imunisasi, dan kunjungan kehamilan." },
    { to: "/riwayat", icon: History, name: "Riwayat Kesehatan", desc: "Garis waktu gabungan skrining, pengukuran, dan imunisasi." },
    { to: "/edukasi", icon: BookOpen, name: "Edukasi", desc: "Artikel dan kuis kesehatan bersumber Kemenkes & WHO." },
    { to: "/tanya", icon: MessagesSquare, name: "Tanya AI", desc: "Penjelasan hasil skrining dan edukasi dari sumber terkurasi." },
    { to: "/keluarga", icon: Users, name: "Keluarga", desc: "Profil anak, lansia, dan anggota keluarga yang Anda kelola." },
    { to: "/perempuan", icon: Heart, name: "Kesehatan Perempuan", desc: "Catatan siklus, kehamilan, dan jadwal kunjungan ANC." },
    { to: "/tumbuh", icon: Baby, name: "Tumbuh Kembang", desc: "Status gizi anak dan jadwal imunisasi Kemenkes." },
    { to: "/lansia", icon: UserRound, name: "Lansia", desc: "Jadwal obat dan target kesehatan anggota keluarga lansia." },
    { to: "/gizi", icon: Salad, name: "Gizi Harian", desc: "Target garam, gula, sayur-buah, dan air dengan data TKPI." },
    { to: "/peta", icon: MapPin, name: "Peta Faskes", desc: "Rumah sakit, puskesmas, dan klinik terverifikasi di Lampung." },
    { to: "/izin", icon: ShieldCheck, name: "Izin & Nakes", desc: "Atur siapa tenaga kesehatan yang boleh melihat data Anda." },
    { to: "/iot", icon: Cpu, name: "Perangkat IoT", desc: "Daftarkan perangkat pemantau dan kirim data simulasi berlabel." },
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Halo, {me?.profile?.full_name ?? "Pengguna"}</h1>
      <p className="mt-1 text-ink-600">Semua layanan SIGERSEHAT terhubung dalam satu akun — hasil skrining mengalir ke pemantauan, pengingat, dan penjelasan edukasi.</p>
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
          {data.next_reminders.length ? <ul className="mt-3 flex flex-col gap-2">{data.next_reminders.map((r) => <li key={r.id} className="rounded-card border border-line bg-white p-4">{r.title} — {formatDateTime(r.scheduled_at)}</li>)}</ul>
            : <p className="mt-3 text-ink-600">Tidak ada pengingat terjadwal. {data.last_screening ? `Skrining terakhir: risiko ${data.last_screening.risk_category}.` : "Skrining berkala membantu memantau risiko Anda."}</p>}
          {data.unread_notifications ? <p className="mt-2 text-sm">Notifikasi belum dibaca: {data.unread_notifications}</p> : null}
        </section>
        <section aria-labelledby="keluarga" className="mt-8">
          <h2 id="keluarga" className="text-xl font-bold">Keluargaku</h2>
          <ul className="mt-3 flex flex-wrap gap-2">{data.family_profiles.map((p) => <li key={p.id} className="rounded-full bg-brand-50 px-4 py-2 font-medium text-brand-800">{p.full_name} ({p.relation === "self" ? "Saya" : p.relation})</li>)}</ul>
        </section>
      </> : null}
      <section aria-labelledby="semua-modul" className="mt-10">
        <h2 id="semua-modul" className="text-xl font-bold">Semua Layanan</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <li key={m.to}>
              <Link to={m.to} className="flex h-full gap-3 rounded-card border border-line bg-white p-4 hover:border-brand-600">
                <m.icon className="mt-0.5 shrink-0 text-brand-700" size={22} aria-hidden="true" />
                <span><span className="font-bold">{m.name}</span><span className="mt-0.5 block text-sm text-ink-600">{m.desc}</span></span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
