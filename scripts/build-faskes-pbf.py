#!/usr/bin/env python3
"""Pipeline faskes Lampung dari ekstrak OSM Geofabrik (Sumatra) — jalur cadangan
bila Overpass API penuh. Mengurai PBF lokal dengan pyosmium:
- poligon batas 15 kabupaten/kota dari relasi administratif OSM (point-in-polygon),
- fasilitas dari node & way bertanda amenity/healthcare/Puskesmas/Pustu/Posyandu,
- normalisasi + dedupe + validasi bbox yang sama dengan build-faskes.py.
Relasi fasilitas (gedung RS yang dipetakan sebagai relasi) dilewati — rumah sakit
besarnya sudah tercakup titik kurasi manual 0016/0017; dicatat di laporan.
Sumber data tetap OpenStreetMap (ODbL), berkas ekstrak Geofabrik.
"""
import json, math, re, sys
sys.path.insert(0, "/home/hatch/.local/lib/python3.12/site-packages")
import osmium
from pathlib import Path

PBF = "/tmp/sumatra.osm.pbf"
FETCH_DATE = "2026-11-25"
BBOX = (-6.2, -3.8, 103.5, 106.2)
REGION_NAMES = {
    "Lampung Selatan": "reg-1801", "Lampung Timur": "reg-1802", "Lampung Tengah": "reg-1803",
    "Lampung Utara": "reg-1804", "Lampung Barat": "reg-1805", "Tulang Bawang": "reg-1806",
    "Tanggamus": "reg-1807", "Way Kanan": "reg-1808", "Pesawaran": "reg-1809",
    "Pringsewu": "reg-1810", "Mesuji": "reg-1811", "Tulang Bawang Barat": "reg-1812",
    "Pesisir Barat": "reg-1813", "Bandar Lampung": "reg-1871", "Metro": "reg-1872",
}
CURATED = [(-5.3959139, 105.2522711), (-5.4429868, 105.2664999), (-5.4225736, 105.2696731),
           (-5.4052479, 105.3025252), (-5.3921715, 105.2625518), (-5.4135242, 105.2676474),
           (-5.3920686, 105.2764638), (-5.1161008, 105.3106847), (-4.5466298, 105.2215431),
           (-5.3688079, 104.9373583), (-5.4251412, 105.2511403)]

def haversine_m(a, b):
    R = 6371000
    dlat = math.radians(b[0] - a[0]); dlng = math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

# ---------- Pass 1: kumpulkan relasi batas + way yang dirujuk ----------
class BoundaryRefs(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rel_ways = {}   # region_name -> set(way_id) outer
        self.way_nodes = {}  # way_id -> [node_id]
    def relation(self, r):
        tags = dict(r.tags)
        name = tags.get("name", "")
        if tags.get("boundary") == "administrative" and name in REGION_NAMES and tags.get("admin_level") in ("5", "6"):
            outer = {m.ref for m in r.members if m.type == "w" and m.role in ("outer", "")}
            if outer: self.rel_ways[name] = outer
    def way(self, w):
        # diisi pada pass terpisah di bawah (satu handler tidak bisa dua kali jalan efektif)
        pass

refs = BoundaryRefs()
for _o in osmium.FileProcessor(PBF).with_filter(osmium.filter.EntityFilter(osmium.osm.RELATION)):
    refs.relation(_o)
wanted_ways = set().union(*refs.rel_ways.values()) if refs.rel_ways else set()
print(f"relasi batas ditemukan: {len(refs.rel_ways)} wilayah, {len(wanted_ways)} way batas", flush=True)

class WayNodes(osmium.SimpleHandler):
    def __init__(self): super().__init__(); self.map = {}
    def way(self, w):
        if w.id in wanted_ways: self.map[w.id] = [n.ref for n in w.nodes]
wn = WayNodes()
for _o in osmium.FileProcessor(PBF).with_filter(osmium.filter.EntityFilter(osmium.osm.WAY)):
    wn.way(_o)

class NodeCoords(osmium.SimpleHandler):
    def __init__(self, wanted): super().__init__(); self.wanted = wanted; self.coords = {}
    def node(self, n):
        if n.id in self.wanted: self.coords[n.id] = (n.location.lat, n.location.lon)
wanted_nodes = set()
for ids in wn.map.values(): wanted_nodes.update(ids)
nc = NodeCoords(wanted_nodes)
for _o in osmium.FileProcessor(PBF).with_filter(osmium.filter.EntityFilter(osmium.osm.NODE)):
    nc.node(_o)

def stitch_rings(way_ids):
    segs = []
    for wid in way_ids:
        pts = [nc.coords[nid] for nid in wn.map.get(wid, []) if nid in nc.coords]
        if len(pts) >= 2: segs.append(pts)
    rings = []
    while segs:
        ring = segs.pop(0)
        changed = True
        while changed and ring[0] != ring[-1]:
            changed = False
            for i, seg in enumerate(segs):
                if seg[0] == ring[-1]: ring += seg[1:]; segs.pop(i); changed = True; break
                if seg[-1] == ring[-1]: ring += seg[::-1][1:]; segs.pop(i); changed = True; break
                if seg[-1] == ring[0]: ring = seg[:-1] + ring; segs.pop(i); changed = True; break
                if seg[0] == ring[0]: ring = seg[::-1][:-1] + ring; segs.pop(i); changed = True; break
        if len(ring) >= 4: rings.append(ring)
    return rings

POLYGONS = {}
for name, wids in refs.rel_ways.items():
    rings = stitch_rings(wids)
    if rings: POLYGONS[name] = rings
print(f"poligon wilayah utuh: {len(POLYGONS)}", flush=True)

def point_in_ring(lat, lng, ring):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][1], ring[i][0]
        xj, yj = ring[j][1], ring[j][0]
        if ((yi > lat) != (yj > lat)) and (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi): inside = not inside
        j = i
    return inside

def region_of(lat, lng):
    for name, rings in POLYGONS.items():
        if any(point_in_ring(lat, lng, r) for r in rings): return name
    return None

# ---------- Pass 2: fasilitas ----------
def map_type(tags):
    # Jenis ditentukan dari tag amenity/healthcare lebih dulu; nama hanya
    # penentu untuk fasilitas khas Indonesia (puskesmas/pustu/posyandu) yang
    # memang tidak punya tag baku. Urutan lama (nama dulu) salah mengjeniskan
    # apotek bernama "Apotek Puskesmas ..." sebagai puskesmas.
    amenity, health = tags.get("amenity", ""), tags.get("healthcare", "")
    if amenity == "hospital" or health == "hospital": return "rumah_sakit"
    if amenity == "pharmacy" or health == "pharmacy": return "apotek"
    if health in ("laboratory", "medical_laboratory"): return "laboratorium"
    name = (tags.get("name") or "").lower()
    if "puskesmas" in name: return "puskesmas"
    if "pustu" in name or "pondok bersalin" in name: return "pustu"
    if "posyandu" in name: return "posyandu"
    if amenity in ("clinic", "doctors", "dentist") or health: return "klinik"
    return None

def interesting(tags):
    if tags.get("amenity") in ("hospital", "clinic", "doctors", "dentist", "pharmacy"): return True
    if tags.get("healthcare"): return True
    # Kecocokan nama saja tidak cukup: elemen jalan (highway) bernama
    # "Jalan/Gang Puskesmas" bukan fasilitas. Wajib ada konteks bangunan.
    if tags.get("highway"): return False
    if not (tags.get("building") or tags.get("amenity")): return False
    nm = (tags.get("name") or "").lower()
    return any(k in nm for k in ("puskesmas", "pustu", "posyandu"))

def compose_address(tags, region_name):
    if tags.get("addr:full"): return tags["addr:full"]
    parts = []
    street = " ".join(x for x in [tags.get("addr:street", ""), tags.get("addr:housenumber", "")] if x).strip()
    if street: parts.append(street)
    for k in ("addr:suburb", "addr:village", "addr:city"):
        if tags.get(k) and tags[k] not in parts: parts.append(tags[k])
    if tags.get("addr:postcode"): parts.append(tags["addr:postcode"])
    if not parts: return f"Alamat rinci belum tercantum di OpenStreetMap — {region_name}, Lampung"
    if region_name not in " ".join(parts): parts.append(region_name)
    parts.append("Lampung")
    return ", ".join(parts)

class Facilities(osmium.SimpleHandler):
    def __init__(self): super().__init__(); self.rows = []; self.skipped_rel = 0
    def _add(self, osm_id, tags, lat, lng):
        if not (BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lng <= BBOX[3]): return
        name = (tags.get("name") or "").strip()
        if not name: return
        ftype = map_type(tags)
        if not ftype: return
        region = region_of(lat, lng)
        if not region: return
        phone = tags.get("contact:phone") or tags.get("phone")
        services = f"Jam buka (per OpenStreetMap): {tags['opening_hours']}" if tags.get("opening_hours") else None
        self.rows.append({"id": osm_id, "name": name, "type": ftype, "address": compose_address(tags, region),
                          "region_id": REGION_NAMES[region], "region": region, "lat": round(lat, 7), "lng": round(lng, 7),
                          "phone": phone, "services": services,
                          "source_url": f"https://www.openstreetmap.org/{osm_id}"})
    def node(self, n):
        tags = dict(n.tags)
        if interesting(tags): self._add(f"node/{n.id}", tags, n.location.lat, n.location.lon)
    def way(self, w):
        tags = dict(w.tags)
        if not interesting(tags): return
        pts = [(n.location.lat, n.location.lon) for n in w.nodes if n.location.valid()]
        if not pts: return
        lat = sum(p[0] for p in pts) / len(pts); lng = sum(p[1] for p in pts) / len(pts)
        self._add(f"way/{w.id}", tags, lat, lng)

fac = Facilities()
for _o in osmium.FileProcessor(PBF).with_locations():
    if isinstance(_o, osmium.osm.Node): fac.node(_o)
    elif isinstance(_o, osmium.osm.Way): fac.way(_o)
print(f"fasilitas mentah dari PBF: {len(fac.rows)}", flush=True)

# dedupe + buang dekat kurasi
seen, rows, skipped = set(), [], {"near_curated": 0, "fuzzy_dup": 0}
for r in fac.rows:
    if any(haversine_m((r["lat"], r["lng"]), c) < 150 for c in CURATED): skipped["near_curated"] += 1; continue
    fuzzy = (re.sub(r"[^a-z0-9]", "", r["name"].lower()), round(r["lat"], 3), round(r["lng"], 3))
    if fuzzy in seen: skipped["fuzzy_dup"] += 1; continue
    seen.add(fuzzy); rows.append(r)

def esc(s): return s.replace("'", "''") if s else None
lines = [f"-- 0018: Impor massal fasilitas kesehatan se-Lampung dari OpenStreetMap (ekstrak Geofabrik Sumatra), diambil {FETCH_DATE}.",
         "-- Sumber ODbL; setiap baris membawa URL elemen OSM. Titik kurasi manual 0016/0017 dipertahankan;",
         "-- titik massal dalam radius 150 m dari titik kurasi dibuang. Telepon/jam hanya dari tag OSM."]
for r in rows:
    phone = f"'{esc(r['phone'])}'" if r["phone"] else "NULL"
    services = f"'{esc(r['services'])}'" if r["services"] else "NULL"
    lines.append("INSERT OR IGNORE INTO facilities (id, name, facility_type, address, region_id, latitude, longitude, phone, emergency_phone, has_igd, services, source_name, source_url, verification_status, verified_at) VALUES "
                 f"('osm-{r['id'].replace('/', '-')}', '{esc(r['name'])}', '{r['type']}', '{esc(r['address'])}', '{r['region_id']}', {r['lat']}, {r['lng']}, {phone}, NULL, NULL, {services}, 'OpenStreetMap (impor massal Geofabrik)', '{r['source_url']}', 'verified', '{FETCH_DATE}');")
out_sql = Path(__file__).resolve().parent.parent / "apps/api/src/db/migrations/0018_facilities_osm_lampung.sql"
out_sql.write_text("\n".join(lines) + "\n")
rep = {"tanggal_ambil": FETCH_DATE, "sumber": "OpenStreetMap via ekstrak Geofabrik Sumatra (ODbL)",
       "total": len(rows), "per_wilayah": {}, "per_jenis": {}, "dilewati": skipped,
       "wilayah_tanpa_poligon": sorted(set(REGION_NAMES) - set(POLYGONS))}
for r in rows:
    rep["per_wilayah"][r["region"]] = rep["per_wilayah"].get(r["region"], 0) + 1
    rep["per_jenis"][r["type"]] = rep["per_jenis"].get(r["type"], 0) + 1
Path(__file__).resolve().parent.joinpath("faskes-report.json").write_text(json.dumps(rep, indent=2, ensure_ascii=False))
print(json.dumps(rep, indent=2, ensure_ascii=False))
