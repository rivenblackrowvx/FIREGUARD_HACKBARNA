// Fire analysis pipeline: weather → spread → values at risk → risk score → timeline.
import { bearing, compass, distanceKm, distanceToRingKm, fmt } from './geo';
import { fetchRoads, fetchWeather, historicalContext, osm, type Row } from './data';
import { FUELS, deadFuelMoisture, simulateSpread, type FuelModel } from './spread';
import type { Asset, Fire, LngLat, Risk, RiskFactor, Spread, TimelineEvent, Weather } from './types';

// Towns as discs; denser cores for bigger cities (inhabitants per km²).
export function townRadiusKm(pop: number) {
  const density = pop >= 100_000 ? 12_000 : pop >= 20_000 ? 6_000 : 3_000;
  return Math.max(0.25, Math.sqrt(pop / density / Math.PI));
}

// People inside the footprint or within 500 m of it: sample a 200 m grid and
// sum each town's uniform density over the cells that fall inside its disc.
function peopleExposed(ring: LngLat[], towns: Asset[]) {
  const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const pad = 0.012;
  const [w, e, s, n] = [Math.min(...lons) - pad, Math.max(...lons) + pad, Math.min(...lats) - pad, Math.max(...lats) + pad];
  const stepLat = 0.0018, stepLon = 0.0018 / Math.cos((s * Math.PI) / 180);
  const cellKm2 = 0.2 * 0.2;
  const discs = towns.map((t) => ({ c: [t.lon, t.lat] as LngLat, r: townRadiusKm(t.population ?? 0), pop: t.population ?? 0 }))
    .filter((t) => t.pop > 0);
  let people = 0;
  for (let la = s; la <= n; la += stepLat) {
    for (let lo = w; lo <= e; lo += stepLon) {
      const p: LngLat = [lo, la];
      let density = 0;
      for (const t of discs) {
        if (distanceKm(p, t.c) <= t.r) density = Math.max(density, t.pop / (Math.PI * t.r * t.r));
      }
      if (density && distanceToRingKm(p, ring) <= 0.5) people += density * cellKm2;
    }
  }
  return people;
}

export interface Analysis {
  weather: Weather;
  spread: Spread;
  assets: Asset[];
  roads: { ref: string; kind: string; coords: LngLat[]; etaMin: number | null }[];
  exposure: { people: number; schools: number; hospitals: number; roads: number; critical: number };
  history: Awaited<ReturnType<typeof historicalContext>>;
  risk: Risk;
  timeline: TimelineEvent[];
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

const ASSET_BUFFER_KM = 1; // an asset within 1 km of a forecast perimeter counts as reached

function etaFor(p: LngLat, spread: Spread) {
  for (const s of spread.steps.slice(1)) if (distanceToRingKm(p, s.ring) <= ASSET_BUFFER_KM) return s.minutes;
  return null;
}

function nearbyRows(rows: Row[], c: LngLat, km: number) {
  const dLat = km / 111, dLon = km / (111 * Math.cos((c[1] * Math.PI) / 180));
  return rows.filter((r) => Math.abs(r[0] - c[0]) < dLon && Math.abs(r[1] - c[1]) < dLat && distanceKm(c, [r[0], r[1]]) <= km);
}

async function valuesAtRisk(fire: Fire, spread: Spread) {
  const c: LngLat = [fire.lon, fire.lat];
  const [hospitals, schools, places, infra] = await Promise.all([osm.hospitals(), osm.schools(), osm.places(), osm.infrastructure()]);
  const outer = spread.steps[spread.steps.length - 1].ring;
  const make = (kind: Asset['kind'], r: Row): Asset => {
    const p: LngLat = [r[0], r[1]];
    const b = bearing(c, p);
    const diff = Math.abs(((b - spread.headingDeg + 540) % 360) - 180);
    return {
      kind, name: r[2] || (kind === 'school' ? 'School' : kind === 'hospital' ? 'Hospital' : kind === 'infrastructure' ? `Power ${r[3]}`.replace('Power water', 'Water works') : 'Unnamed'),
      lon: r[0], lat: r[1],
      population: kind === 'place' ? Number(r[3]) : undefined,
      sub: kind === 'infrastructure' ? String(r[3]) : kind === 'hospital' && r[3] === 'yes' ? 'Emergency dept.' : undefined,
      distanceKm: distanceToRingKm(p, outer) === 0 ? 0 : distanceKm(c, p),
      bearing: b,
      downwind: clamp(Math.cos(((180 - diff) * Math.PI) / 180)),
      etaMin: etaFor(p, spread),
    };
  };
  const R = 20;
  const assets = [
    ...nearbyRows(hospitals, c, R).map((r) => make('hospital', r)),
    ...nearbyRows(schools, c, R).map((r) => make('school', r)),
    ...nearbyRows(places, c, R).map((r) => make('place', r)),
    ...nearbyRows(infra, c, R).filter((r) => r[3] !== 'fire_station').map((r) => make('infrastructure', r)),
  ].sort((a, b) => (a.etaMin ?? 9999) - (b.etaMin ?? 9999) || a.distanceKm - b.distanceKm);
  return assets;
}

function roadEta(coords: LngLat[], spread: Spread) {
  for (const s of spread.steps.slice(1)) {
    if (coords.some((p, i) => i % 2 === 0 && distanceToRingKm(p, s.ring) <= 0.2)) return s.minutes;
  }
  return null;
}

function scoreRisk(fire: Fire, w: Weather, spread: Spread, exposure: Analysis['exposure'], assets: Asset[], history: Analysis['history']): Risk {
  const m = deadFuelMoisture(w.temp, w.rh);
  const area3h = spread.steps[spread.steps.length - 1].areaHa;
  const growth = Math.max(0, area3h - spread.steps[0].areaHa);
  // Nearest town of 500+ inhabitants, measured from the fire's current position.
  const nearestPlace = assets.filter((a) => a.kind === 'place' && (a.population ?? 0) >= 500)
    .map((a) => ({ ...a, d: distanceKm([fire.lon, fire.lat], [a.lon, a.lat]) })).sort((a, b) => a.d - b.d)[0];
  const f = (key: RiskFactor['key'], label: string, value: number, detail: string): RiskFactor => ({ key, label, value: clamp(value), detail });
  const factors: RiskFactor[] = [
    f('intensity', 'Intensity', Math.log10(fire.frp + 1) / Math.log10(2000), `${fmt.int(fire.frp)} MW radiative power`),
    f('wind', 'Wind', (w.windKmh + 0.35 * Math.max(0, w.gustKmh - w.windKmh)) / 45, `${Math.round(w.windKmh)} km/h from ${compass(w.windDir)}, gusts ${Math.round(w.gustKmh)}`),
    f('dryness', 'Dryness', (0.14 - m) / 0.1 * 0.8 + clamp((w.temp - 20) / 20) * 0.2, `${Math.round(w.rh)}% RH · ${Math.round(w.temp)}°C · fuel moisture ${(m * 100).toFixed(1)}%`),
    f('population', 'Population', Math.log10(exposure.people + 1) / Math.log10(30000), `${fmt.int(exposure.people)} people in the 3 h footprint`),
    f('infrastructure', 'Infrastructure', (exposure.hospitals * 5 + exposure.schools * 1.5 + Math.min(exposure.critical, 6) + exposure.roads * 0.5) / 16,
      `${exposure.hospitals} hospitals · ${exposure.schools} schools · ${exposure.critical} critical · ${exposure.roads} roads`),
    f('proximity', 'Proximity', nearestPlace ? 1 - nearestPlace.d / 12 : 0, nearestPlace ? `${fmt.km(nearestPlace.d)} to ${nearestPlace.name}` : 'No town within 20 km'),
    f('spread', 'Spread', Math.log10(growth + 1) / Math.log10(8000), `+${fmt.ha(growth)} forecast in 3 h`),
    f('history', 'History', history ? history.zone.danger / 5 * 0.6 + clamp(history.firesWithin10km / 25) * 0.4 : 0.35,
      history ? `Zone ZHR ${history.zone.zhr} · ${history.firesWithin10km} past fires within 10 km` : 'Outside Catalan historical record'),
  ];
  const W: Record<RiskFactor['key'], number> = { intensity: 0.16, wind: 0.15, dryness: 0.15, population: 0.14, infrastructure: 0.12, proximity: 0.1, spread: 0.12, history: 0.06 };
  const score = Math.round(100 * factors.reduce((a, x) => a + x.value * W[x.key], 0));
  return {
    score,
    level: score >= 75 ? 'EXTREME' : score >= 58 ? 'HIGH' : score >= 35 ? 'MODERATE' : 'LOW',
    factors,
  };
}

export function factorLevel(v: number) {
  return v >= 0.75 ? 'EXTREME' : v >= 0.55 ? 'HIGH' : v >= 0.3 ? 'MEDIUM' : 'LOW';
}

function buildTimeline(fire: Fire, a: Omit<Analysis, 'timeline'>): TimelineEvent[] {
  const t0 = fire.detectedAt;
  const c: LngLat = [fire.lon, fire.lat];
  const ev: TimelineEvent[] = [];
  const first = fire.hotspots[0];
  ev.push({ t: t0, kind: 'satellite', text: `Satellite hotspot · ${first?.source?.replace(/_/g, ' ') ?? 'satellite'}`, lngLat: c });
  if (fire.smoke) ev.push({ t: t0 + 60_000, kind: 'smoke', text: `Smoke detected · camera ${fire.smoke.camera} · ${Math.round(fire.smoke.confidence * 100)}%`, lngLat: c });
  if (fire.drill) ev.push({ t: t0 + 120_000, kind: 'sensor', text: 'Ground sensor anomaly · +14 °C, CO spike', lngLat: c });
  const confirmT = fire.hotspots.length > 1 ? +new Date(fire.hotspots[1].t) : t0 + 180_000;
  ev.push({ t: Math.max(confirmT, t0 + 180_000), kind: 'confirmed', text: `Fire confirmed · ${fire.sources.length} source${fire.sources.length > 1 ? 's' : ''} · ${Math.round(fire.confidence * 100)}% confidence`, lngLat: c });
  const tNow = Math.max(fire.lastSeen, ev[ev.length - 1].t);
  ev.push({ t: tNow + 120_000, kind: 'wind', text: `Wind ${Math.round(a.weather.windKmh)} km/h from ${compass(a.weather.windDir)} · spread heading ${compass(a.spread.headingDeg)}` });
  ev.push({ t: tNow + 240_000, kind: 'spread', text: `Spread model · ${fmt.ha(a.spread.steps[a.spread.steps.length - 1].areaHa)} in 3 h` });
  const firstHospital = a.assets.find((x) => x.kind === 'hospital' && x.etaMin != null);
  const firstPlace = a.assets.find((x) => x.kind === 'place' && x.etaMin != null);
  const firstSchool = a.assets.find((x) => x.kind === 'school' && x.etaMin != null);
  let k = 0;
  for (const asset of [firstPlace, firstSchool, firstHospital]) {
    if (!asset) continue;
    ev.push({
      t: tNow + (300 + 60 * k++) * 1000, kind: 'impact',
      text: `${asset.kind === 'hospital' ? 'Hospital' : asset.kind === 'school' ? 'School' : asset.name} enters impact zone · ETA ${asset.etaMin} min`,
      lngLat: [asset.lon, asset.lat],
    });
  }
  ev.push({ t: tNow + (300 + 60 * k) * 1000, kind: 'alert', text: `FireGuard risk ${a.risk.score} · ${a.risk.level}` });
  return ev;
}

export async function analyzeFire(fire: Fire, fuel: FuelModel = FUELS[0], weather?: Weather): Promise<Analysis> {
  const w = weather ?? (await fetchWeather(fire.lat, fire.lon));
  const recent = fire.hotspots.filter((h) => +new Date(h.t) >= fire.lastSeen - 3 * 3600_000);
  const places = await osm.places();
  const urban = places.filter((r) => Number(r[3]) >= 2000 && Math.abs(r[0] - fire.lon) < 0.35 && Math.abs(r[1] - fire.lat) < 0.3)
    .map((r) => ({ c: [r[0], r[1]] as LngLat, rKm: townRadiusKm(Number(r[3])) }));
  const spread = simulateSpread({ ignition: [fire.lon, fire.lat], hotspots: recent, weather: w, fuel, urban });
  const [assets, rawRoads, history] = await Promise.all([
    valuesAtRisk(fire, spread),
    fetchRoads(fire.lat, fire.lon),
    historicalContext([fire.lon, fire.lat]),
  ]);
  const byRef = new Map<string, { ref: string; kind: string; coords: LngLat[]; etaMin: number | null }>();
  for (const r of rawRoads) {
    const eta = roadEta(r.coords, spread);
    const prev = byRef.get(r.ref);
    if (!prev || (eta ?? 9e9) < (prev.etaMin ?? 9e9)) byRef.set(r.ref, { ...r, etaMin: eta });
  }
  const roads = rawRoads.map((r) => ({ ...r, etaMin: roadEta(r.coords, spread) }));
  const reached = assets.filter((x) => x.etaMin != null);
  const outer = spread.steps[spread.steps.length - 1].ring;
  const people = peopleExposed(outer, assets.filter((x) => x.kind === 'place'));
  const exposure = {
    people: Math.round(people),
    schools: reached.filter((x) => x.kind === 'school').length,
    hospitals: reached.filter((x) => x.kind === 'hospital').length,
    roads: [...byRef.values()].filter((r) => r.etaMin != null).length,
    critical: reached.filter((x) => x.kind === 'infrastructure').length,
  };
  const risk = scoreRisk(fire, w, spread, exposure, assets, history);
  const base = { weather: w, spread, assets, roads, exposure, history, risk };
  return { ...base, timeline: buildTimeline(fire, base) };
}

