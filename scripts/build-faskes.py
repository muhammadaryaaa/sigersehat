#!/usr/bin/env python3
"""Pipeline data fasilitas kesehatan Provinsi Lampung dari OpenStreetMap (Overpass API).

Menarik faskes per kabupaten/kota (area administratif OSM), menormalkan kolom,
membuang duplikat, memvalidasi koordinat di dalam bbox Lampung, dan menulis
migrasi SQL + laporan JSON. Tidak ada data yang dikarang: nama/alamat/telepon/
jam buka hanya dari tag OSM; alamat kosong diganti keterangan faktual.

Sumber: OpenStreetMap (ODbL) via Overpass API (mirror kumi.systems bila
overpass-api.de penuh). Tanggal pengambilan dicatat di laporan.
"""
import json, re, sys, time, urllib.request, urllib.parse, math
from pathlib import Path

ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]
UA = {"User-Agent": "SIGERSEHAT-BuildFaskes/1.0 (platform kesehatan Lampung; data OSM ODbL)"}
FETCH_DATE = "2026-11-25"
BBOX = (-6.2, -3.8, 103.5, 106.2)  # lat_min, lat_max, lng_min, lng_max Lampung (longgar)

REGIONS = [
    ("reg-1801", "Lampung Selatan", ["Lampung Selatan", "Kabupaten Lampung Selatan"]),
    ("reg-1802", "Lampung Timur", ["Lampung Timur", "Kabupaten Lampung Timur"]),
    ("reg-1803", "Lampung Tengah", ["Lampung Tengah", "Kabupaten Lampung Tengah"]),
    ("reg-1804", "Lampung Utara", ["Lampung Utara", "Kabupaten Lampung Utara"]),
    ("reg-1805", "Lampung Barat", ["Lampung Barat", "Kabupaten Lampung Barat"]),
    ("reg-1806", "Tulang Bawang", ["Tulang Bawang", "Kabupaten Tulang Bawang"]),
    ("reg-1807", "Tanggamus", ["Tanggamus", "Kabupaten Tanggamus"]),
    ("reg-1808", "Way Kanan", ["Way Kanan", "Kabupaten Way Kanan"]),
    ("reg-1809", "Pesawaran", ["Pesawaran", "Kabupaten Pesawaran"]),
    ("reg-1810", "Pringsewu", ["Pringsewu", "Kabupaten Pringsewu"]),
    ("reg-1811", "Mesuji", ["Mesuji", "Kabupaten Mesuji"]),
    ("reg-1812", "Tulang Bawang Barat", ["Tulang Bawang Barat", "Kabupaten Tulang Bawang Barat"]),
    ("reg-1813", "Pesisir Barat", ["Pesisir Barat", "Kabupaten Pesisir Barat"]),
    ("reg-1871", "Bandar Lampung", ["Bandar Lampung", "Kota Bandar Lampung"]),
    ("reg-1872", "Metro", ["Metro", "Kota Metro"]),
]

# Titik kurasi manual (migrasi 0016/0017) — titik massal dalam radius ini dibuang (kurasi menang)
CURATED = [
    (-5.3959139, 105.2522711), (-5.4429868, 105.2664999), (-5.4225736, 105.2696731),
    (-5.4052479, 105.3025252), (-5.3921715, 105.2625518), (-5.4135242, 105.2676474),
    (-5.3920686, 105.2764638), (-5.1161008, 105.3106847), (-4.5466298, 105.2215431),
    (-5.3688079, 104.9373583), (-5.4251412, 105.2511403),
]

def haversine_m(a, b):
    R = 6371000
    dlat = math.radians(b[0] - a[0]); dlng = math.radians(b[1] - a[1])
    h = math.sin(dlat / 2) ** 2 + math.cos(math.radians(a[0])) * math.cos(math.radians(b[0])) * math.sin(dlng / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))

def overpass(query: str) -> dict:
    body = urllib.parse.urlencode({"data": query}).encode()
    last = None
    for attempt in range(3):
        for ep in ENDPOINTS:
            try:
                req = urllib.request.Request(ep, data=body, headers=UA)
                with urllib.request.urlopen(req, timeout=150) as r:
                    return json.loads(r.read().decode())
            except Exception as e:  # coba endpoint/percobaan berikutnya
                last = e
        time.sleep(15 * (attempt + 1))
    raise RuntimeError(f"Overpass gagal: {last}")

def map_type(tags: dict) -> str | None:
    name = (tags.get("name") or "").lower()
    if "puskesmas" in name: return "puskesmas"
    if "pustu" in name or "pondok bersalin" in name: return "pustu"
    if "posyandu" in name: return "posyandu"
    amenity = tags.get("amenity", "")
    health = tags.get("healthcare", "")
    if amenity == "hospital" or health == "hospital": return "rumah_sakit"
    if amenity == "pharmacy" or health == "pharmacy": return "apotek"
    if health in ("laboratory", "medical_laboratory") or amenity == "laboratory": return "laboratorium"
    if amenity in ("clinic", "doctors", "dentist") or health: return "klinik"
    return None

def compose_address(tags: dict, region_name: str) -> str:
    if tags.get("addr:full"): return tags["addr:full"]
    parts = []
    street = " ".join(x for x in [tags.get("addr:street", ""), tags.get("addr:housenumber", "")] if x).strip()
    if street: parts.append(street)
    for k in ("addr:suburb", "addr:village", "addr:city"):
        if tags.get(k) and tags[k] not in parts: parts.append(tags[k])
    if tags.get("addr:postcode"): parts.append(tags["addr:postcode"])
    if not parts:
        return f"Alamat rinci belum tercantum di OpenStreetMap — {region_name}, Lampung"
    if region_name not in " ".join(parts): parts.append(region_name)
    parts.append("Lampung")
    return ", ".join(parts)

def main():
    all_rows, report = [], {}
    seen_osm, seen_fuzzy = set(), {}
    skipped = {"noname": 0, "notype": 0, "outbbox": 0, "near_curated": 0, "fuzzy_dup": 0}
    for region_id, region_name, area_names in REGIONS:
        elements, used_area = [], None
        for area_name in area_names:
            q = f"""[out:json][timeout:120];
area[name="{area_name}"]->.a;
( nwr[amenity~"^(hospital|clinic|doctors|dentist|pharmacy)$"](area.a);
  nwr[healthcare](area.a);
  nwr[name~"Puskesmas|Pustu|Posyandu",i](area.a); );
out center tags;"""
            data = overpass(q)
            if data.get("elements"):
                elements, used_area = data["elements"], area_name
                break
            elements = data.get("elements", [])
            used_area = area_name
        count = 0
        for el in elements:
            tags = el.get("tags", {})
            name = (tags.get("name") or "").strip()
            lat = el.get("lat") or (el.get("center") or {}).get("lat")
            lng = el.get("lon") or (el.get("center") or {}).get("lon")
            if not name: skipped["noname"] += 1; continue
            if lat is None or lng is None: continue
            ftype = map_type(tags)
            if not ftype: skipped["notype"] += 1; continue
            if not (BBOX[0] <= lat <= BBOX[1] and BBOX[2] <= lng <= BBOX[3]): skipped["outbbox"] += 1; continue
            osm_key = f"{el['type']}/{el['id']}"
            if osm_key in seen_osm: continue
            seen_osm.add(osm_key)
            if any(haversine_m((lat, lng), c) < 150 for c in CURATED): skipped["near_curated"] += 1; continue
            fuzzy = (re.sub(r"[^a-z0-9]", "", name.lower()), round(lat, 3), round(lng, 3))
            if fuzzy in seen_fuzzy: skipped["fuzzy_dup"] += 1; continue
            seen_fuzzy[fuzzy] = osm_key
            phone = tags.get("contact:phone") or tags.get("phone")
            services = None
            if tags.get("opening_hours"): services = f"Jam buka (per OpenStreetMap): {tags['opening_hours']}"
            all_rows.append({
                "id": f"osm-{el['type']}-{el['id']}", "name": name, "type": ftype,
                "address": compose_address(tags, region_name), "region_id": region_id, "region": region_name,
                "lat": round(lat, 7), "lng": round(lng, 7), "phone": phone, "services": services,
                "source_url": f"https://www.openstreetmap.org/{osm_key}",
            })
            count += 1
        report[region_name] = count
        print(f"{region_name}: {count} titik (area: {used_area})", flush=True)
        time.sleep(2)
    # SQL
    def esc(s): return s.replace("'", "''") if s else None
    lines = [f"-- 0018: Impor massal fasilitas kesehatan se-Lampung dari OpenStreetMap (Overpass), diambil {FETCH_DATE}.",
             "-- Sumber ODbL; setiap baris membawa URL elemen OSM. Titik kurasi manual 0016/0017 tetap dipertahankan",
             "-- dan titik massal dalam radius 150 m dari titik kurasi dibuang. Telepon/jam hanya dari tag OSM."]
    for r in all_rows:
        phone = f"'{esc(r['phone'])}'" if r["phone"] else "NULL"
        services = f"'{esc(r['services'])}'" if r["services"] else "NULL"
        lines.append(
            "INSERT OR IGNORE INTO facilities (id, name, facility_type, address, region_id, latitude, longitude, phone, emergency_phone, has_igd, services, source_name, source_url, verification_status, verified_at) VALUES "
            f"('{r['id']}', '{esc(r['name'])}', '{r['type']}', '{esc(r['address'])}', '{r['region_id']}', {r['lat']}, {r['lng']}, {phone}, NULL, NULL, {services}, 'OpenStreetMap (impor massal Overpass)', '{r['source_url']}', 'verified', '{FETCH_DATE}');")
    out_sql = Path(__file__).resolve().parent.parent / "apps/api/src/db/migrations/0018_facilities_osm_lampung.sql"
    out_sql.write_text("\n".join(lines) + "\n")
    rep = {"tanggal_ambil": FETCH_DATE, "sumber": "OpenStreetMap via Overpass API (ODbL)",
           "total": len(all_rows), "per_wilayah": report, "dilewati": skipped,
           "per_jenis": {}}
    for r in all_rows: rep["per_jenis"][r["type"]] = rep["per_jenis"].get(r["type"], 0) + 1
    rep_path = Path(__file__).resolve().parent / "faskes-report.json"
    rep_path.write_text(json.dumps(rep, indent=2, ensure_ascii=False))
    print(json.dumps(rep, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    main()
