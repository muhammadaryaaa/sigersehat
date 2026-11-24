import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Ikon penanda CSS murni, dibuat sekali di tingkat modul. Ikon bawaan Leaflet
// berupa berkas gambar yang jalurnya rusak saat dibundel Vite; dan ikon yang
// dibuat di dalam komponen bisa bernilai undefined pada render ulang saat
// data tiba — itulah penyebab crash "createIcon" di produksi (24 Nov 2026).
const FACILITY_ICON = L.divIcon({ className: "siger-marker", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 24], popupAnchor: [0, -24] });
function clusterIcon(count: number) {
  return L.divIcon({ className: "siger-cluster", html: `<span>${count}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] });
}
import { apiFetch, ApiClientError } from "../lib/api";
import { apiMutate, useAuth } from "../lib/auth";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";
import { PageHeader } from "../components/ui/PageHeader";

type Facility = { id: string; name: string; facility_type: string; address: string; region_id: string; region_name: string; latitude: number; longitude: number; phone: string | null; emergency_phone: string | null; services: string | null; source_name: string; source_url: string | null; verified_at: string };
type Region = { id: string; name: string; type: string };
type Stats = { total: number; by_region: { region_id: string; region_name: string; n: number }[]; by_type: { facility_type: string; n: number }[]; data_updated: string | null };
const TYPE_LABEL: Record<string, string> = { rumah_sakit: "Rumah Sakit", puskesmas: "Puskesmas", klinik: "Klinik", laboratorium: "Laboratorium", apotek: "Apotek", pustu: "Pustu", posyandu: "Posyandu" };

export function MapPage() {
  const { me } = useAuth();
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState(""); const [type, setType] = useState(""); const [regionId, setRegionId] = useState("");
  const [selected, setSelected] = useState<Facility | null>(null);
  const [notice, setNotice] = useState("");
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locMsg, setLocMsg] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState(""); const [reportEmail, setReportEmail] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markers = useRef<L.LayerGroup | null>(null);
  const facilitiesRef = useRef<Facility[]>([]);
  facilitiesRef.current = facilities;

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;
    const map = L.map(mapRef.current).setView([-5.05, 105.35], 8);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; kontributor OpenStreetMap", maxZoom: 19 }).addTo(map);
    mapObj.current = map; markers.current = L.layerGroup().addTo(map);
    map.on("zoomend moveend", () => renderMarkers());
  }, []);

  // Klaster grid sederhana: pada zoom rendah titik dikelompokkan per sel peta
  // agar ratusan penanda tetap ringan di ponsel; zoom >= 13 tampil per titik.
  function renderMarkers() {
    const map = mapObj.current, group = markers.current;
    if (!map || !group) return;
    group.clearLayers();
    const list = facilitiesRef.current;
    const zoom = map.getZoom();
    if (zoom >= 13) {
      for (const f of list) {
        const m = L.marker([f.latitude, f.longitude], { icon: FACILITY_ICON }).bindPopup(`<strong>${f.name}</strong><br/>${f.address}`);
        m.on("click", () => setSelected(f));
        group.addLayer(m);
      }
      return;
    }
    const cell = 360 / Math.pow(2, zoom) * 0.9;
    const cells = new Map<string, Facility[]>();
    for (const f of list) {
      const key = `${Math.floor(f.latitude / cell)}:${Math.floor(f.longitude / cell)}`;
      const arr = cells.get(key) ?? []; arr.push(f); cells.set(key, arr);
    }
    for (const arr of cells.values()) {
      const lat = arr.reduce((a, f) => a + f.latitude, 0) / arr.length;
      const lng = arr.reduce((a, f) => a + f.longitude, 0) / arr.length;
      if (arr.length === 1) {
        const f = arr[0];
        const m = L.marker([f.latitude, f.longitude], { icon: FACILITY_ICON }).bindPopup(`<strong>${f.name}</strong><br/>${f.address}`);
        m.on("click", () => setSelected(f));
        group.addLayer(m);
      } else {
        const m = L.marker([lat, lng], { icon: clusterIcon(arr.length) });
        m.on("click", () => map.flyTo([lat, lng], Math.min(15, zoom + 3), { duration: 0.6 }));
        group.addLayer(m);
      }
    }
  }
  useEffect(() => { renderMarkers(); }, [facilities]);

  useEffect(() => { apiFetch<Region[]>("/api/v1/regions").then(setRegions).catch(() => {}); apiFetch<Stats>("/api/v1/facilities/stats").then(setStats).catch(() => {}); }, []);
  useEffect(() => {
    const params = new URLSearchParams(); if (q) params.set("q", q); if (type) params.set("type", type); if (regionId) params.set("regionId", regionId); params.set("limit", "2000");
    apiFetch<Facility[]>(`/api/v1/facilities?${params}`).then(setFacilities).catch(() => {});
  }, [q, type, regionId]);

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
      (pos) => { const p = { lat: pos.coords.latitude, lng: pos.coords.longitude }; setMyPos(p); mapObj.current?.flyTo([p.lat, p.lng], 12, { duration: 0.8 }); },
      () => setLocMsg("Izin lokasi tidak diberikan. Daftar tetap dapat dicari manual tanpa lokasi."),
      { timeout: 10000 },
    );
  }
  const shown = myPos ? [...facilities].sort((a, b) => (distanceKm(a) ?? 0) - (distanceKm(b) ?? 0)) : facilities;
  const gmapsDir = (f: Facility) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${f.latitude},${f.longitude}`)}`;
  const gmapsOpen = (f: Facility) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${f.latitude},${f.longitude}`)}`;

  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    try {
      if (me) await apiMutate(`/api/v1/facilities/${selected.id}/report`, "POST", { description: reportText });
      else await apiFetch(`/api/v1/facilities/${selected.id}/report-guest`, { method: "POST", body: JSON.stringify({ description: reportText, email: reportEmail || undefined }) });
      setNotice("Laporan terkirim dan akan diperiksa administrator. Terima kasih.");
      setReportOpen(false); setReportText("");
    } catch (err) { setNotice(err instanceof ApiClientError ? err.message : "Laporan tidak dapat dikirim."); }
  }

  return (
    <>
      <PageHeader title="Peta Fasilitas Kesehatan Lampung" description="Fasilitas kesehatan dari data terbuka OpenStreetMap (lisensi ODbL) untuk seluruh 15 kabupaten/kota, ditambah titik kurasi yang diverifikasi satu per satu. Data mungkin belum mencakup semua fasilitas dan dapat berubah di lapangan." />
      <main className="mx-auto max-w-6xl px-4 py-6">
        {stats ? (
          <p className="rounded-card border border-line bg-white px-4 py-3 text-[15px] shadow-card" role="status">
            Saat ini termuat <strong>{stats.total.toLocaleString("id-ID")} fasilitas</strong>
            {stats.by_type.length ? <> ({stats.by_type.map((t) => `${TYPE_LABEL[t.facility_type] ?? t.facility_type} ${t.n}`).join(" · ")})</> : null}
            . Data diperbarui {stats.data_updated ? new Date(`${stats.data_updated}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "—"}.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={nearMe}>Dekat saya</Button>
          <p className="text-sm text-ink-600">Peta dapat dipakai tanpa izin lokasi. Lokasi hanya diminta bila kamu menekan tombol itu.</p>
        </div>
        {locMsg ? <p className="mt-2 text-sm text-ink-600" role="status">{locMsg}</p> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-3" role="search">
          <TextField label="Cari fasilitas" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="mis. puskesmas, RSUD, apotek" />
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="ft">Jenis</label>
            <select id="ft" className="min-h-12 rounded-btn border border-line bg-white px-3" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Semua jenis</option>
              {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></div>
          <div className="flex flex-col gap-1.5"><label className="text-sm font-medium" htmlFor="fr">Kabupaten/Kota</label>
            <select id="fr" className="min-h-12 rounded-btn border border-line bg-white px-3" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
              <option value="">Seluruh Lampung</option>
              {regions.map((r) => { const st = stats?.by_region.find((x) => x.region_id === r.id); return <option key={r.id} value={r.id}>{r.type === "kota" ? "Kota" : "Kab."} {r.name}{st ? ` (${st.n})` : ""}</option>; })}
            </select></div>
        </div>
        {notice ? <p role="status" className="mt-3 rounded-card bg-brand-50 p-3 text-brand-800">{notice}</p> : null}
        <div className="mt-4 grid gap-4 lg:grid-cols-5">
          <div ref={mapRef} className="h-96 rounded-card border border-line lg:col-span-3" role="application" aria-label="Peta fasilitas kesehatan Lampung" />
          <div className="lg:col-span-2">
            <p className="mb-2 text-sm text-ink-600" aria-live="polite">{shown.length} fasilitas ditampilkan{regionId ? ` di wilayah terpilih` : ""}.</p>
            <ul className="flex max-h-96 flex-col gap-2 overflow-auto">
              {shown.slice(0, 200).map((f) => <li key={f.id}>
                <button className={`w-full rounded-card border p-3 text-left transition-colors ${selected?.id === f.id ? "border-brand-600 bg-brand-50" : "border-line bg-white"}`} onClick={() => { setSelected(f); setReportOpen(false); mapObj.current?.flyTo([f.latitude, f.longitude], 14, { duration: 0.7 }); }}>
                  <strong>{f.name}</strong><br /><span className="text-sm text-ink-600">{TYPE_LABEL[f.facility_type]} • {f.region_name}{distanceKm(f) !== null ? ` • ±${distanceKm(f)!.toFixed(1)} km` : ""}</span>
                </button></li>)}
            </ul>
            {shown.length > 200 ? <p className="mt-2 text-sm text-ink-500">Menampilkan 200 pertama — persempit dengan pencarian atau filter wilayah.</p> : null}
            {!shown.length ? <p className="rounded-card border border-line bg-white p-4 text-ink-600">Tidak ada fasilitas yang cocok dengan filter ini. Coba longgarkan jenis atau wilayahnya — atau fasilitasnya memang belum terpetakan di OpenStreetMap; kamu dapat melaporkannya lewat tombol laporkan pada fasilitas terdekat.</p> : null}
          </div>
        </div>
        {selected ? <section aria-labelledby="detail" className="route-enter mt-4 rounded-card border border-line bg-white p-5 shadow-card">
          <h2 id="detail" className="text-xl font-bold">{selected.name}</h2>
          <p className="mt-1">{selected.address}</p>
          <p className="mt-1 text-sm text-ink-600">{TYPE_LABEL[selected.facility_type]} • {selected.region_name}</p>
          {selected.phone ? <p className="mt-1">Telepon: {selected.phone}</p> : <p className="mt-1 text-ink-600">Nomor telepon tidak tersedia di sumber data — kami tidak menampilkan nomor yang belum pasti.</p>}
          {selected.services ? <p className="mt-1">{selected.services}</p> : null}
          <p className="mt-1 text-sm text-ink-500">Sumber: {selected.source_url ? <a className="underline" href={selected.source_url} target="_blank" rel="noreferrer">{selected.source_name}</a> : selected.source_name} · data per {selected.verified_at}</p>
          <p className="mt-3 flex flex-wrap gap-2">
            <a className="inline-flex min-h-11 items-center rounded-btn bg-brand-700 px-4 font-semibold text-white" href={gmapsDir(selected)} target="_blank" rel="noopener noreferrer">Petunjuk arah (Google Maps)</a>
            <a className="inline-flex min-h-11 items-center rounded-btn border border-line bg-white px-4 font-semibold" href={gmapsOpen(selected)} target="_blank" rel="noopener noreferrer">Buka di Google Maps</a>
            <Button variant="secondary" onClick={() => setReportOpen(!reportOpen)}>Laporkan fasilitas keliru / belum ada</Button>
          </p>
          {reportOpen ? (
            <form onSubmit={sendReport} className="mt-4 flex flex-col gap-3 rounded-card bg-cream p-4">
              <TextField label="Jelaskan koreksinya" value={reportText} onChange={(e) => setReportText(e.target.value)} placeholder="mis. puskesmas ini sudah pindah ke Jalan …, atau jam buka berubah" />
              {!me ? <TextField label="Email (opsional, untuk tindak lanjut)" type="email" value={reportEmail} onChange={(e) => setReportEmail(e.target.value)} /> : null}
              <div><Button type="submit" disabled={reportText.trim().length < 5}>Kirim Laporan</Button></div>
            </form>
          ) : null}
        </section> : null}
      </main>
    </>
  );
}
