"""Catalonia main road network (motorway → secondary) from OpenStreetMap, as a
static fallback for when the live Overpass API is overloaded."""
import json
import sys
from pathlib import Path

from shapely.geometry import LineString

sys.path.insert(0, str(Path(__file__).parent))
from fetch_osm import run  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "roads"
OUT.mkdir(parents=True, exist_ok=True)
Q = ('[out:json][timeout:300];'
     'way["highway"~"^(motorway|trunk|primary|secondary)$"](40.5,0.15,42.9,3.35);out geom tags;')

data = run(Q)
roads = []
for w in data["elements"]:
    pts = [(g["lon"], g["lat"]) for g in w.get("geometry", [])]
    if len(pts) < 2:
        continue
    line = LineString(pts).simplify(0.0002)
    t = w.get("tags", {})
    roads.append({"ref": t.get("ref") or t.get("name") or "road", "kind": t["highway"],
                  "coords": [[round(x, 5), round(y, 5)] for x, y in line.coords]})
(OUT / "catalonia.json").write_text(json.dumps(roads, ensure_ascii=False, separators=(",", ":")))
print("roads", len(roads))
