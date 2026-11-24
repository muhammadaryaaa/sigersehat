import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Ikon penanda CSS murni, dibuat sekali di tingkat modul. Ikon bawaan Leaflet
// berupa berkas gambar yang jalurnya rusak saat dibundel Vite; dan ikon yang
// dibuat di dalam komponen bisa bernilai undefined pada render ulang saat
// data tiba — itulah penyebab crash "createIcon" di produksi (24 Nov 2026).
const FACILITY_ICON = L.divIcon({ className: "siger-marker", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 24], popupAnchor: [0, -24] });
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

type Facility = { id: string; name: string; facility_type: string; address: string; region_name: string; latitude: number; longitude: number; phone: string | null; emergency_phone: string | null; services: string | null; source_name: string; verified_at: string };
const TYPE_LABEL: Record<string, string> = { rumah_sakit: "Rumah Sakit", puskesmas: "Puskesmas", klinik: "Klinik", laboratorium: "Laboratorium", apotek: "Apotek", pustu: "Pustu", posyandu: "Posyandu" };

export function MapPage() {
  const { me } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [q, setQ] = useState(""); const [type, setType] = useState("");
  const [selected, setSelected] = useState<Facility | null>(null);
  const [notice, setNotice] = useState("");
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locMsg, setLocMsg] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current).setView([-5.2, 105.1], 8);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; kontributor OpenStreetMap", maxZoom: 19 }).addTo(map);
    mapObj.current = map; markers.current = L.layerGroup().addTo(map);
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(); if (q) params.set("q", q); if (type) params.set("type", type);
    apiFetch<Facility[]>(`/api/v1/facilities?${params}`).then(setFacilities).catch(() => {});
  }, [q, type]);
  useEffect(() => {
    if (!markers.current || !mapObj.current) return;
    markers.current.clearLayers();
    for (const f of facilities) {
      const m = L.marker([f.latitude, f.longitude], { icon: FACILITY_ICON }).bindPopup(`<strong>${f.name}</strong><br/>${f.address}`);
      m.on("click", () => setSelected(f));
      markers.current.addLayer(m);
    }
  }, [facilities]);

  function distanceKm(f: Facility): number | null {
    if (!myPos) return null;
    const R = 6371, dLat = (f.latitude - myPos.lat) * Math.PI / 180, dLng = (f.longitude - myPos.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(myPos.lat * Math.PI / 180) * Math.cos(f.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  function nearMe() {
    setLocMsg("Lokasi Anda hanya dipakai di perangkat ini untuk mengurutkan fasilitas terdekat; tidak dikirim atau disimpan.");
    if (!navigator.geolocation) { setLocMsg("Perangkat ini tidak menyediakan lokasi. Daftar tetap dapat dicari manual."); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setMyPos(p); mapObj.current?.setView([p.lat, p.lng], 12); },
      () => setLocMsg("Izin lokasi tidak diberikan. Daftar tetap dapat dicari manual tanpa lokasi."),
      { timeout: 10000 },
    );
  }
  const shown = myPos ? [...facilities].sort((a, b) => (distanceKm(a) ?? 0) - (distanceKm(b) ?? 0)) : facilities;
  const lastVerified = facilities.reduce((acc, f) => (f.verified_at > acc ? f.verified_at : acc), "");

  async function report(f: Facility) {
    const desc = prompt(`Laporkan koreksi untuk ${f.name} (jelaskan data yang keliru dan seharusnya):`);
    if (!desc) return;
    try { await apiMutate(`/api/v1/facilities/${f.id}/report`, "POST", { description: desc }); setNotice("Laporan koreksi terkirim dan akan diperiksa administrator."); }
    catch (err) { setNotice(err instanceof ApiClientError ? err.message : "Laporan tidak dapat dikirim."); }
  }
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold">Peta Fasilitas Kesehatan</h1>
      <p className="mt-2 text-ink-600">Menampilkan <strong>sebagian fasilitas kesehatan terpilih</strong> yang telah diverifikasi satu per satu — ini bukan direktori lengkap seluruh Lampung. Untuk fasilitas lain di Lampung, gunakan pencarian di <a className="font-semibold text-brand-800 underline" href="https://www.openstreetmap.org" target="_blank" rel="noreferrer">OpenStreetMap</a>.</p>
      {lastVerified ? <p className="mt-1 text-sm text-ink-500">Data terakhir diverifikasi: {lastVerified.slice(0, 10)}. Menemukan data yang keliru? Buka fasilitasnya lalu gunakan tombol Laporkan Koreksi.</p> : null}
      <div className="mt-3">
        <Button type="button" variant="secondary" onClick={nearMe}>Dekat saya</Button>
        {locMsg ? <p className="mt-2 text-sm text-ink-600" role="status">{locMsg}</p> : null}
      </div>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row" role="search">
        <TextField label="Cari fasilitas" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. puskesmas, RSUD" />
        <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="ft">Jenis</label>
          <select id="ft" className="min-h-12 rounded-btn border border-line bg-white px-3" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Semua jenis</option>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
      </div>
      {notice ? <p role="status" className="mt-3 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div ref={mapRef} className="h-96 rounded-card border border-line lg:col-span-3" role="application" aria-label="Peta fasilitas kesehatan Lampung" />
        <div className="lg:col-span-2">
          <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
            {shown.map((f) => <li key={f.id}>
              <button className={`w-full rounded-card border p-3 text-left ${selected?.id === f.id ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`} onClick={() => { setSelected(f); mapObj.current?.setView([f.latitude, f.longitude], 14); }}>
                <strong>{f.name}</strong><br /><span className="text-sm text-ink-600">{TYPE_LABEL[f.facility_type]} • {f.region_name}{distanceKm(f) !== null ? ` • ±${distanceKm(f)!.toFixed(1)} km` : ""}</span>
              </button></li>)}
          </ul>
          {!shown.length ? <p className="text-ink-600">Tidak ada fasilitas terverifikasi yang cocok. Coba kata kunci lain.</p> : null}
        </div>
      </div>
      {selected ? <section aria-labelledby="detail" className="mt-4 rounded-card border border-line bg-white p-5">
        <h2 id="detail" className="text-xl font-bold">{selected.name}</h2>
        <p className="mt-1">{selected.address}</p>
        <p className="mt-1 text-sm text-ink-600">{TYPE_LABEL[selected.facility_type]} • {selected.region_name}</p>
        {selected.phone ? <p className="mt-1">Telepon: {selected.phone}</p> : <p className="mt-1 text-ink-600">Nomor telepon belum terverifikasi — kami tidak menampilkan nomor yang belum pasti.</p>}
        {selected.services ? <p className="mt-1">Layanan: {selected.services}</p> : null}
        <p className="mt-1 text-sm text-ink-500">Sumber: {selected.source_name}, terverifikasi {selected.verified_at}</p>
        <p className="mt-3 flex flex-wrap gap-2">
          <a className="rounded-btn bg-brand-600 px-4 py-2 font-semibold text-white" href={`https://www.openstreetmap.org/directions?to=${selected.latitude}%2C${selected.longitude}`} target="_blank" rel="noreferrer">Petunjuk Lokasi (OpenStreetMap)</a>
          {me ? <Button variant="secondary" onClick={() => report(selected)}>Laporkan Koreksi</Button> : null}
        </p>
      </section> : null}
    </main>
  );
}
