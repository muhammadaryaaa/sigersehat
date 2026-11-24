import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type Device = { id: string; device_label: string; device_type: string; computed_status: string; last_seen_at: string | null; readings_count: number; last_reading: { measured_at: string; spo2_percent: number | null; heart_rate_bpm: number | null; temperature_c: number | null } | null };
const TYPE_LABEL: Record<string, string> = { max30102: "MAX30102 (SpO2 & denyut)", temperature: "Sensor suhu", simulator: "Simulator (SIMULASI)", other: "Lainnya" };

export function IotPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [form, setForm] = useState({ deviceLabel: "", deviceType: "simulator" });
  const [newToken, setNewToken] = useState<{ id: string; token: string } | null>(null);
  const [sim, setSim] = useState({ spo2: "98", hr: "72", temp: "36.6" });
  const [simDevice, setSimDevice] = useState("");
  const [notice, setNotice] = useState(""); const [error, setError] = useState("");
  const load = useCallback(() => { apiFetch<Device[]>("/api/v1/iot/devices").then((ds) => { setDevices(ds); const s = ds.find((d) => d.device_type === "simulator" && d.computed_status !== "revoked"); if (s) setSimDevice(s.id); }).catch(() => setError("Perangkat tidak dapat dimuat.")); }, []);
  useEffect(() => { load(); }, [load]);
  async function register(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    try {
      const r = await apiMutate<{ device_id: string; device_token: string; warning: string }>("/api/v1/iot/devices", "POST", form);
      setNewToken({ id: r.device_id, token: r.device_token });
      setNotice(`${r.warning} Untuk simulator di halaman ini, token dipakai langsung pada pengiriman data uji di bawah.`);
      setForm({ deviceLabel: "", deviceType: "simulator" }); load();
    } catch (err) { setError(err instanceof ApiClientError ? err.message : "Perangkat tidak dapat didaftarkan."); }
  }
  async function revoke(id: string) {
    try { await apiMutate(`/api/v1/iot/devices/${id}/revoke`, "POST", {}); setNotice("Perangkat dicabut. Tokennya tidak lagi diterima."); load(); }
    catch { setError("Perangkat tidak dapat dicabut."); }
  }
  async function sendSimulation(e: FormEvent) {
    e.preventDefault(); setError(""); setNotice("");
    if (!newToken || newToken.id !== simDevice) { setError("Pengiriman simulasi dari halaman ini memakai token perangkat simulator yang baru Anda buat (token hanya tampil sekali). Buat perangkat simulator baru bila token sudah hilang."); return; }
    try {
      const res = await fetch("/api/v1/iot/readings", { method: "POST", headers: { "Content-Type": "application/json", "X-Device-Token": newToken.token },
        body: JSON.stringify({ spo2Percent: Number(sim.spo2), heartRateBpm: Number(sim.hr), temperatureC: Number(sim.temp), idempotencyKey: `sim-${Date.now()}` }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Pengiriman gagal.");
      setNotice("Data SIMULASI terkirim dan tersimpan sebagai pengukuran berlabel SIMULASI — lihat di SIGERMONITOR. Ini bukan pengukuran perangkat nyata.");
      load();
    } catch (err) { setError(err instanceof Error ? err.message : "Pengiriman simulasi gagal."); }
  }
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold">Perangkat IoT</h1>
      <p className="mt-2 text-ink-600">Alur data: sensor → ESP32 → internet → API SIGERSEHAT → basis data → tampil di SIGERMONITOR. Perangkat dikenali lewat token unik; hanya hash token yang disimpan server.</p>
      <p className="mt-2 rounded-card bg-warn-50 p-3 text-warn-800">Sensor prototipe (mis. MAX30102) <strong>bukan</strong> perangkat medis tervalidasi. Nilai dari perangkat/simulasi bersifat pemantauan awal, bukan dasar diagnosis.</p>
      {notice ? <p role="status" className="mt-4 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-card bg-danger-50 p-3 text-danger-700">{error}</p> : null}
      <section aria-labelledby="daftar" className="mt-6">
        <h2 id="daftar" className="text-xl font-bold">Perangkat Saya</h2>
        {devices.length ? <ul className="mt-3 flex flex-col gap-2">{devices.map((d) => <li key={d.id} className="rounded-card border border-line bg-white p-4">
          <p><strong>{d.device_label}</strong> — {TYPE_LABEL[d.device_type] ?? d.device_type} • Status: <strong>{d.computed_status}</strong></p>
          <p className="mt-1 text-sm text-ink-600">Terakhir terlihat: {d.last_seen_at ?? "belum pernah"} • Total data masuk: {d.readings_count}
            {d.last_reading ? ` • Terakhir: SpO2 ${d.last_reading.spo2_percent ?? "-"}%, denyut ${d.last_reading.heart_rate_bpm ?? "-"} bpm, suhu ${d.last_reading.temperature_c ?? "-"} °C (${d.last_reading.measured_at})` : ""}</p>
          {d.device_type === "simulator" ? <p className="mt-1 font-semibold text-warn-800">SIMULASI — data dari perangkat ini selalu berlabel simulasi.</p> : null}
          {d.computed_status !== "revoked" ? <Button variant="danger" onClick={() => revoke(d.id)}>Cabut Perangkat</Button> : null}
        </li>)}</ul> : <p className="mt-2 text-ink-600">Belum ada perangkat terdaftar.</p>}
      </section>
      <section aria-labelledby="baru" className="mt-8">
        <h2 id="baru" className="text-xl font-bold">Daftarkan Perangkat</h2>
        <form onSubmit={register} className="mt-3 flex flex-col gap-4">
          <TextField label="Label perangkat" required value={form.deviceLabel} onChange={(e) => setForm({ ...form, deviceLabel: e.target.value })} placeholder="mis. Simulator Demo, ESP32 Kamar" />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="dt">Jenis</label>
            <select id="dt" className="min-h-12 rounded-btn border border-line bg-white px-3" value={form.deviceType} onChange={(e) => setForm({ ...form, deviceType: e.target.value })}>
              <option value="simulator">Simulator (SIMULASI)</option><option value="max30102">MAX30102 (SpO2 &amp; denyut)</option>
              <option value="temperature">Sensor suhu</option><option value="other">Lainnya</option></select></div>
          <Button type="submit">Daftarkan &amp; Buat Token</Button>
        </form>
        {newToken ? <div className="mt-3 rounded-card bg-info-50 p-4 text-info-800">
          <p className="font-bold">Token perangkat (tampil satu kali):</p>
          <p className="mt-1 break-all font-mono text-sm">{newToken.token}</p>
          <p className="mt-1 text-sm">Masukkan token ini ke firmware ESP32 sebagai header X-Device-Token. Token tidak disimpan di browser.</p>
        </div> : null}
      </section>
      <section aria-labelledby="sim" className="mt-8">
        <h2 id="sim" className="text-xl font-bold">Simulator Data (SIMULASI)</h2>
        <p className="mt-1 text-ink-600">Kirim data uji melalui jalur ingest yang sama persis dengan perangkat fisik, memakai token simulator yang baru dibuat di atas. Hasilnya masuk ke <Link className="inline-block py-1 font-semibold text-brand-700 underline" to="/pantau">SIGERMONITOR</Link> dengan label SIMULASI.</p>
        <form onSubmit={sendSimulation} className="mt-3 grid gap-4 sm:grid-cols-3">
          <TextField label="SpO2 (%)" type="number" value={sim.spo2} onChange={(e) => setSim({ ...sim, spo2: e.target.value })} />
          <TextField label="Denyut (bpm)" type="number" value={sim.hr} onChange={(e) => setSim({ ...sim, hr: e.target.value })} />
          <TextField label="Suhu (°C)" type="number" step="0.1" value={sim.temp} onChange={(e) => setSim({ ...sim, temp: e.target.value })} />
          <div className="sm:col-span-3"><Button type="submit">Kirim Data SIMULASI</Button></div>
        </form>
      </section>
    </main>
  );
}
