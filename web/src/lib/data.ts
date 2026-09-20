import { distanceKm, pointInRing } from './geo';
import type { Fire, Hotspot, LngLat, MtgPixel, Weather } from './types';

export type Row = [number, number, string, (number | string)?];

const once = new Map<string, Promise<unknown>>();
function load<T>(url: string, fallback: T): Promise<T> {
  if (!once.has(url)) {
    once.set(url, fetch(url).then((r) => (r.ok ? r.json() : fallback)).catch(() => fallback));
  }
  return once.get(url) as Promise<T>;
}

export const osm = {
  hospitals: () => load<Row[]>('/data/osm/hospitals.json', []),
  schools: () => load<Row[]>('/data/osm/schools.json', []),
  places: () => load<Row[]>('/data/osm/places.json', []),
  infrastructure: () => load<Row[]>('/data/osm/infrastructure.json', []),
};

export const gencat = {
  perimeters: () => load<GeoJSON.FeatureCollection>('/data/gencat/perimeters.geojson', { type: 'FeatureCollection', features: [] }),
  zones: () => load<GeoJSON.FeatureCollection>('/data/gencat/zones.geojson', { type: 'FeatureCollection', features: [] }),
};

export interface CameraFrame { file: string; date: string; boxes: number[][]; w: number; h: number }
export interface Camera { camera: string; partner: string; frames: CameraFrame[] }
export const cameras = () => load<Camera[]>('/data/cameras/manifest.json', []);

export async function fetchHotspots(): Promise<{ live: boolean; source: string; hotspots: Hotspot[] }> {
  try {
    const r = await fetch('/api/hotspots');
    return await r.json();
  } catch {
    return { live: false, source: 'offline', hotspots: [] };
  }
}

export async function fetchMtg(): Promise<{ live: boolean; source: string; pixels: MtgPixel[] }> {
  try {
    const r = await fetch('/api/mtg-frp');
    return await r.json();
  } catch {
    return { live: false, source: 'offline', pixels: [] };
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<Weather> {
  try {
    const r = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
    const b = await r.json();
    if (!b.live) throw new Error(b.error);
    const h = b.hourly;
    return {
      live: true,
      temp: b.current.temperature_2m,
      rh: b.current.relative_humidity_2m,
      windKmh: b.current.wind_speed_10m,
      windDir: b.current.wind_direction_10m,
      gustKmh: b.current.wind_gusts_10m,
      vpd: h.vapour_pressure_deficit?.[0],
      hourly: h.time.map((t: string, i: number) => ({
        t,
        temp: h.temperature_2m[i],
        rh: h.relative_humidity_2m[i],
        windKmh: h.wind_speed_10m[i],
        windDir: h.wind_direction_10m[i],
        gustKmh: h.wind_gusts_10m[i],
        precipProb: h.precipitation_probability?.[i] ?? 0,
      })),
    };
  } catch {
    // Offline fallback: a hot, dry, windy afternoon. Flagged live=false.
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      t: new Date(Date.now() + i * 3600_000).toISOString(),
      temp: 31 - Math.abs(i - 3) * 0.6, rh: 22 + Math.abs(i - 3) * 1.5, windKmh: 26 + Math.sin(i / 3) * 6,
      windDir: 300 + i * 2, gustKmh: 42, precipProb: 0,
    }));
    return { live: false, temp: 31, rh: 22, windKmh: 26, windDir: 300, gustKmh: 42, hourly };
  }
}

export const ROAD_RADIUS = 10000;

export async function fetchRoads(lat: number, lon: number, rMeters = ROAD_RADIUS, timeoutMs = 8000): Promise<{ ref: string; kind: string; coords: LngLat[] }[]> {
  try {
    // Bounded wait: the server keeps querying Overpass and caches for the next analysis.
    const r = await fetch(`/api/roads?lat=${lat}&lon=${lon}&r=${rMeters}`, { signal: AbortSignal.timeout(timeoutMs) });
    return (await r.json()).roads ?? [];
  } catch {
    return [];
  }
}

// ——— Hotspots → fires ———
const CONF: Record<string, number> = { HIGH: 0.95, MEDIUM: 0.75, LOW: 0.45, h: 0.95, n: 0.75, l: 0.45 };

export async function nearestPlace(lon: number, lat: number) {
  const places = await osm.places();
  let best: Row | null = null, bestD = Infinity;
  for (const p of places) {
    if (Math.abs(p[0] - lon) > 0.4 || Math.abs(p[1] - lat) > 0.4) continue;
    const d = distanceKm([lon, lat], [p[0], p[1]]);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best ? { name: best[2], km: bestD } : null;
}

export async function clusterFires(hotspots: Hotspot[]): Promise<Fire[]> {
  const groups = new Map<string, Hotspot[]>();
  const loose: Hotspot[] = [];
  for (const h of hotspots) {
    if (h.cluster) groups.set(h.cluster, [...(groups.get(h.cluster) ?? []), h]);
    else loose.push(h);
  }
  // Greedy 3 km clustering for detections without a cluster id.
  for (const h of loose) {
    let placed = false;
    for (const [k, g] of groups) {
      if (k.startsWith('geo:') && distanceKm([h.lon, h.lat], [g[0].lon, g[0].lat]) < 3) { g.push(h); placed = true; break; }
    }
    if (!placed) groups.set(`geo:${h.id}`, [h]);
  }

  const fires: Fire[] = [];
  for (const [id, hs] of groups) {
    hs.sort((a, b) => +new Date(a.t) - +new Date(b.t));
    const recent = hs.filter((h) => +new Date(h.t) >= +new Date(hs[hs.length - 1].t) - 6 * 3600_000);
    const lat = recent.reduce((a, h) => a + h.lat, 0) / recent.length;
    const lon = recent.reduce((a, h) => a + h.lon, 0) / recent.length;
    const byPass = new Map<number, number>();
    for (const h of hs) {
      const t = Math.round(+new Date(h.t) / 600_000) * 600_000;
      byPass.set(t, (byPass.get(t) ?? 0) + (h.frp ?? 0));
    }
    const frpSeries = [...byPass].map(([t, frp]) => ({ t, frp })).sort((a, b) => a.t - b.t);
    const place = hs[0].name ? null : await nearestPlace(lon, lat);
    fires.push({
      id,
      name: hs[0].name ?? (place ? `Near ${place.name}` : `${lat.toFixed(2)}, ${lon.toFixed(2)}`),
      region: hs[0].region ?? (place ? `${place.km.toFixed(1)} km from town centre` : 'Spain'),
      lat, lon,
      detectedAt: +new Date(hs[0].t),
      lastSeen: +new Date(hs[hs.length - 1].t),
      frp: frpSeries[frpSeries.length - 1]?.frp ?? 0,
      frpSeries,
      confidence: Math.max(...hs.map((h) => CONF[h.confidence] ?? 0.6)),
      hotspots: hs,
      sources: [...new Set(hs.map((h) => h.source))],
      demo: Boolean(hs[0].demo),
    });
  }
  return fires.sort((a, b) => b.frp - a.frp);
}

// ——— Catalonia historical context ———
function inGeometry(p: LngLat, g: GeoJSON.Geometry) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  return polys.some((poly) => pointInRing(p, poly[0] as LngLat[]) && !poly.slice(1).some((h) => pointInRing(p, h as LngLat[])));
}

export async function historicalContext(p: LngLat) {
  if (p[0] < 0.1 || p[0] > 3.4 || p[1] < 40.4 || p[1] > 42.95) return null;
  const [zones, perims] = await Promise.all([gencat.zones(), gencat.perimeters()]);
  const zone = zones.features.find((f) => inGeometry(p, f.geometry));
  if (!zone) return null;
  const near = perims.features.filter((f) => distanceKm(p, [f.properties!.lon, f.properties!.lat]) < 10);
  const largest = [...near].sort((a, b) => b.properties!.ha - a.properties!.ha)[0];
  return {
    zone: zone.properties as { zhr: string; danger: number; exposure: number; ha: number },
    firesWithin10km: near.length,
    burnedHa: near.reduce((a, f) => a + f.properties!.ha, 0),
    largest: largest ? { name: largest.properties!.name, year: largest.properties!.year, ha: largest.properties!.ha } : null,
  };
}
