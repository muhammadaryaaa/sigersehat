import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Pratinjau peta mini untuk dashboard: petak OpenStreetMap nyata + penanda
// fasilitas nyata. Interaksi dinonaktifkan (pratinjau); peta penuh di /peta.
// Ikon didefinisikan di tingkat modul (pelajaran revisi Tahap 12: ikon di badan
// komponen menjadi undefined pada render ulang dan merusak peta).
const FACILITY_ICON = L.divIcon({ className: "siger-marker", html: "<span></span>", iconSize: [26, 26], iconAnchor: [13, 24] });

export type MiniFacility = { name: string; latitude: number; longitude: number };

export function MiniMap({ facilities }: { facilities: MiniFacility[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !facilities.length) return;
    const map = L.map(ref.current, { zoomControl: false, scrollWheelZoom: false, dragging: false, doubleClickZoom: false, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap", maxZoom: 19 }).addTo(map);
    const pts: [number, number][] = [];
    for (const f of facilities) {
      L.marker([f.latitude, f.longitude], { icon: FACILITY_ICON }).addTo(map);
      pts.push([f.latitude, f.longitude]);
    }
    if (pts.length > 1) map.fitBounds(pts, { padding: [18, 18] });
    else map.setView(pts[0], 13);
    return () => { map.remove(); };
  }, [facilities]);
  if (!facilities.length) return <p className="p-4 text-sm text-ink-600">Pratinjau peta belum dapat dimuat. Buka peta lengkap untuk melihat fasilitas.</p>;
  return <div ref={ref} className="h-44 w-full" role="img" aria-label={`Pratinjau peta dengan ${facilities.length} penanda fasilitas kesehatan di Bandar Lampung`} />;
}
