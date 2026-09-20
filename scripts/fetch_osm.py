"""Fetch values-at-risk layers for Spain from OpenStreetMap (Overpass API).

Outputs compact JSON files in web/public/data/osm/.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "web" / "public" / "data" / "osm"
OUT.mkdir(parents=True, exist_ok=True)

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

AREA = 'area["ISO3166-1"="ES"][admin_level=2]->.es;'

QUERIES = {
    "hospitals": f'[out:json][timeout:300];{AREA}nwr["amenity"="hospital"](area.es);out center tags;',
    "schools": f'[out:json][timeout:300];{AREA}nwr["amenity"="school"](area.es);out center tags;',
    "places": f'[out:json][timeout:300];{AREA}node["place"~"^(city|town|village)$"](area.es);out;',
    "infrastructure": f'[out:json][timeout:300];{AREA}(nwr["power"~"^(substation|plant)$"](area.es);nwr["man_made"="water_works"](area.es);nwr["amenity"="fire_station"](area.es););out center tags;',
}


def run(query):
    body = urllib.parse.urlencode({"data": query}).encode()
    for ep in ENDPOINTS:
        try:
            req = urllib.request.Request(ep, data=body, headers={"User-Agent": "FireGuard-hackathon/1.0"})
            with urllib.request.urlopen(req, timeout=400) as r:
                return json.load(r)
        except Exception as e:  # try next mirror
            print(f"  {ep} failed: {e}", file=sys.stderr)
            time.sleep(3)
    raise RuntimeError("all overpass endpoints failed")


def coords(el):
    if "lat" in el:
        return el["lon"], el["lat"]
    c = el.get("center")
    return (c["lon"], c["lat"]) if c else (None, None)


def pop(v):
    try:
        return int(str(v).replace(".", "").replace(",", "").replace(" ", "").split(";")[0])
    except ValueError:
        return None


def main(names):
    for name in names:
        dst = OUT / f"{name}.json"
        if dst.exists():
            print(f"{name}: cached")
            continue
        print(f"{name}: querying…")
        data = run(QUERIES[name])
        rows = []
        for el in data["elements"]:
            lon, lat = coords(el)
            if lon is None:
                continue
            t = el.get("tags", {})
            row = [round(lon, 5), round(lat, 5), t.get("name", "")]
            if name == "places":
                # Estimate by place type when OSM has no population tag.
                p = pop(t.get("population")) or {"city": 50000, "town": 5000, "village": 400}[t["place"]]
                row.append(p)
            elif name == "infrastructure":
                kind = t.get("power") or ("water" if t.get("man_made") else "fire_station")
                row.append(kind)
            elif name == "hospitals":
                row.append(t.get("emergency", ""))
            rows.append(row)
        dst.write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))
        print(f"{name}: {len(rows)} features")


if __name__ == "__main__":
    main(sys.argv[1:] or list(QUERIES))
