"""Convert Gencat (Interior / Bombers) datasets into simplified GeoJSON.

- pericat.kml  -> historical fire perimeters of Catalonia (1986-present)
- ZHR2014.zip  -> homogeneous fire-regime zones (risk zones)
"""
import io
import json
import re
import zipfile
from pathlib import Path

import shapefile
from pyproj import Transformer
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw" / "gencat"
OUT = ROOT / "web" / "public" / "data" / "gencat"
OUT.mkdir(parents=True, exist_ok=True)


def rnd(geom, nd=5):
    return json.loads(json.dumps(mapping(geom)), parse_float=lambda s: round(float(s), nd))


def perimeters():
    kml = (RAW / "pericat.kml").read_text(encoding="utf-8")
    feats = []
    for pm in re.findall(r"<Placemark>(.*?)</Placemark>", kml, re.S):
        props = dict(re.findall(r'<SimpleData name="([^"]+)">([^<]*)</SimpleData>', pm))
        polys = []
        for poly in re.findall(r"<Polygon>(.*?)</Polygon>", pm, re.S):
            rings = []
            for ring in re.findall(r"<coordinates>(.*?)</coordinates>", poly, re.S):
                pts = [tuple(map(float, c.split(",")[:2])) for c in ring.split()]
                if len(pts) >= 4:
                    rings.append(pts)
            if rings:
                polys.append(Polygon(rings[0], rings[1:]))
        if not polys:
            continue
        geom = MultiPolygon(polys).buffer(0).simplify(0.0004, preserve_topology=True)
        if geom.is_empty:
            continue
        ha = float(props.get("HECTARES") or 0)
        c = geom.representative_point()
        feats.append({"type": "Feature", "geometry": rnd(geom), "properties": {
            "id": props.get("ID_ACTU"), "name": props.get("NOM_FOC", "").strip(),
            "ha": round(ha, 1), "year": int(props.get("ANY") or 0),
            "date": props.get("DATAI"), "zhr": props.get("ZHR"),
            "synoptic": props.get("EXTEN_SINO"), "lon": round(c.x, 4), "lat": round(c.y, 4)}})
    feats.sort(key=lambda f: f["properties"]["year"])
    (OUT / "perimeters.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print("perimeters", len(feats))


def zones():
    z = zipfile.ZipFile(RAW / "ZHR2014.zip")
    r = shapefile.Reader(shp=io.BytesIO(z.read("ZHR.shp")), dbf=io.BytesIO(z.read("ZHR.dbf")), shx=io.BytesIO(z.read("ZHR.shx")))
    prj = z.read("ZHR.prj").decode()
    tr = Transformer.from_crs("EPSG:25831" if "31N" in prj else prj, "EPSG:4326", always_xy=True)
    fields = [f[0] for f in r.fields[1:]]
    feats = []
    for sr in r.iterShapeRecords():
        props = dict(zip(fields, sr.record))
        geom = transform(tr.transform, shape(sr.shape.__geo_interface__)).simplify(0.001, preserve_topology=True)
        feats.append({"type": "Feature", "geometry": rnd(geom, 4), "properties": {
            "zhr": str(props["ZHR"]), "ha": round(props["Hectares"]), "danger": props["PERILL_IND"],
            "exposure": props["PERILL_EXP"], "nfr40": props["NFR_40"], "nfr60": props["NFR_60"]}})
    (OUT / "zones.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats}, ensure_ascii=False, separators=(",", ":")))
    print("zones", len(feats))


if __name__ == "__main__":
    perimeters()
    zones()
