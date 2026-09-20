import { analyzeFire } from './analysis';
import { cameras, clusterFires, fetchHotspots, fetchMtg, fetchRoads, fetchWeather, nearestPlace, ROAD_RADIUS } from './data';
import { FUELS } from './spread';
import { getState, setState } from './store';
import type { Fire, Hotspot, LngLat, Weather } from './types';

export async function loadFeeds() {
  const [hs, mtg] = await Promise.all([fetchHotspots(), fetchMtg()]);
  const fires = await clusterFires(hs.hotspots);
  const drill = getState().fires.filter((f) => f.drill);
  setState({
    loading: false,
    hotspots: hs.hotspots,
    fires: [...drill, ...fires],
    mtg: mtg.pixels,
    feeds: { deepfire: { live: hs.live, source: hs.source }, mtg: { live: mtg.live, source: mtg.source } },
  });
}

export async function analyze(fire: Fire, weather?: Weather, force = false) {
  const s = getState();
  if (!force && (s.analyses[fire.id] || s.analyzing[fire.id])) return s.analyses[fire.id];
  setState((st) => ({ analyzing: { ...st.analyzing, [fire.id]: true } }));
  const fuel = FUELS.find((f) => f.id === getState().fuelId) ?? FUELS[0];
  const a = await analyzeFire(fire, fuel, weather ?? getState().analyses[fire.id]?.weather);
  setState((st) => ({ analyses: { ...st.analyses, [fire.id]: a }, analyzing: { ...st.analyzing, [fire.id]: false } }));
  // Overpass can be slower than the analysis budget: wait for the server to
  // finish caching the road network once, then re-run with roads included.
  if (!a.roads.length && !roadRetry.has(fire.id)) {
    roadRetry.add(fire.id);
    fetchRoads(fire.lat, fire.lon, ROAD_RADIUS, 60_000).then((roads) => {
      if (roads.length && getState().fires.some((f) => f.id === fire.id)) analyze(fire, a.weather, true);
    });
  }
  return a;
}

const roadRetry = new Set<string>();

export function selectFire(id: string | null, fly = true) {
  const fire = getState().fires.find((f) => f.id === id);
  setState({ selectedId: id, timelineCursor: 99 });
  if (!fire) return;
  if (fly) setState({ flyTo: { center: [fire.lon, fire.lat], zoom: 10.6, at: Date.now() } });
  analyze(fire);
}

export async function setFuel(fuelId: string) {
  setState({ fuelId });
  const s = getState();
  const fire = s.fires.find((f) => f.id === s.selectedId);
  if (fire) await analyze(fire, undefined, true);
}

export function playTimeline() {
  const s = getState();
  const a = s.selectedId ? s.analyses[s.selectedId] : null;
  if (!a) return;
  setState({ timelineCursor: 0, horizon: 0 });
  a.timeline.forEach((ev, i) => {
    setTimeout(() => {
      setState({ timelineCursor: i + 1 });
      if (ev.kind === 'spread') animateHorizons();
      if (ev.lngLat && ev.kind === 'impact') setState({ flyTo: { center: ev.lngLat, zoom: 11.2, at: Date.now() } });
    }, 900 * (i + 1));
  });
}

export function animateHorizons() {
  for (let i = 0; i <= 4; i++) setTimeout(() => setState({ horizon: i }), i * 650);
}

// ——— LIVE FIRE DRILL ———
export const DRILL_STEPS = [
  'Synthetic ignition',
  'Satellite detection',
  'Smoke detection',
  'Sensor confirmation',
  'Risk assessment',
  'Spread forecast',
  'Values at risk',
  'Alert issued',
];

// Hardware-verification drill (used when the point is in the Sant Cugat del Vallès area):
// the ESP32 mesh alerts first, the drone goes to confirm it isn't a false positive,
// then the standard detect → confirm → predict → protect pipeline runs.
export const DRILL_HW_STEPS = [
  'Synthetic ignition',
  'ESP32 sensor alert',
  'Drone dispatched',
  'Drone en route',
  'Drone on station',
  'Drone communication',
  'Satellite detection',
  'Smoke detection',
  'Sensor confirmation',
  'Risk assessment',
  'Spread forecast',
  'Values at risk',
  'Alert issued',
];

export const DRILL_OFF = {
  classic: { sat: 1, smoke: 2, sensor: 3, risk: 4, spread: 5, values: 6, alert: 7, done: 8 },
  hw: { sat: 6, smoke: 7, sensor: 8, risk: 9, spread: 10, values: 11, alert: 12, done: 13 },
} as const;
export type DrillOff = (typeof DRILL_OFF)['classic'];

// Sant Cugat del Vallès city center + radius (approx 9 km) that triggers the drone-verification phase.
const SANT_CUGAT: LngLat = [2.085, 41.471];
const DRONE_BASE: LngLat = [2.08, 41.39]; // Collserola operations base
export const isSantCugatArea = (p: LngLat) => Math.hypot(p[0] - SANT_CUGAT[0], p[1] - SANT_CUGAT[1]) < 0.08;

// Worst-case Catalan scenario: dry, hot mistral (NW) wind.
export function scenarioWeather(): Weather {
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    t: new Date(Date.now() + i * 3600_000).toISOString(),
    temp: 33 - i * 0.3, rh: 19 + i * 0.6, windKmh: 30 + Math.sin(i / 2) * 4, windDir: 318 + i * 1.5,
    gustKmh: 52, precipProb: 0,
  }));
  return { live: false, temp: 33, rh: 19, windKmh: 30, windDir: 318, gustKmh: 52, vpd: 3.8, hourly };
}

let drillTimers: number[] = [];

export async function runDrill(point?: LngLat, useLiveWeather = false) {
  drillTimers.forEach(clearTimeout);
  roadRetry.delete('drill');
  drillTimers = [];
  const p = point ?? getState().drill.point;
  const hw = isSantCugatArea(p);
  const now = Date.now();
  const place = await nearestPlace(p[0], p[1]);
  const cams = await cameras();
  const cam = cams.find((c) => c.frames.some((f) => f.boxes.length)) ?? cams[0];
  const frame = cam?.frames.find((f) => f.boxes.length) ?? cam?.frames[0];
  const mk = (dx: number, dy: number, dt: number, frp: number, source: string): Hotspot => ({
    id: `drill.${dx}.${dy}`, lat: p[1] + dy, lon: p[0] + dx, t: new Date(now + dt).toISOString(),
    source, confidence: 'HIGH', frp, cluster: 'drill', active: true,
  });
  const fire: Fire = {
    id: 'drill',
    name: `DRILL · ${place?.name ?? 'Synthetic fire'}`,
    region: hw ? 'Sant Cugat del Vallès — hardware-verification exercise' : 'Synthetic exercise — not a real incident',
    lat: p[1], lon: p[0],
    detectedAt: now, lastSeen: now + 180_000,
    frp: 185,
    frpSeries: [{ t: now, frp: 40 }, { t: now + 60_000, frp: 95 }, { t: now + 120_000, frp: 140 }, { t: now + 180_000, frp: 185 }],
    confidence: 0.97,
    hotspots: [mk(0, 0, 0, 40, 'MTG_FCI'), mk(0.002, -0.0015, 120_000, 95, 'VIIRS_NOAA21_NRT'), mk(0.0035, -0.003, 180_000, 140, 'VIIRS_NOAA20_NRT')],
    sources: ["ESP32 mesh", 'MTG_FCI', 'VIIRS_NOAA21_NRT', 'VIIRS_NOAA20_NRT', 'Pyronear camera', 'Ground sensor'],
    demo: true,
    drill: true,
    smoke: cam ? { camera: cam.camera, confidence: 0.91, frame: frame?.file } : undefined,
  };

  setState((s) => ({
    fires: [fire, ...s.fires.filter((f) => !f.drill)],
    selectedId: null,
    analyses: Object.fromEntries(Object.entries(s.analyses).filter(([k]) => k !== 'drill')),
    drill: { step: 0, fireId: 'drill', point: p, hw, drone: null },
    alert: null,
    horizon: 0,
    timelineCursor: 0,
    flyTo: { center: p, zoom: 12.4, at: Date.now() },
  }));

  const weatherP = useLiveWeather ? fetchWeather(p[1], p[0]) : Promise.resolve(scenarioWeather());
  const analysisP = weatherP.then((w) => analyze(fire, w, true));
  const at = (ms: number, fn: () => void) => drillTimers.push(window.setTimeout(fn, ms));
  const STEP = 1700;
  const off = hw ? DRILL_OFF.hw : DRILL_OFF.classic;

  // 1 · Arduino/ESP32 sensor mesh signals the system (hardware drill only)
  if (hw) at(STEP, () => setState({ drill: { ...getState().drill, step: 1 } }));

  // 2–5 · Drone dispatched → en route → on station → communicates with FireGuard.
  // The mark moves along a straight path; MapStage pulses render its live position.
  if (hw) {
    at(STEP * 2, () => {
      const drone = { from: DRONE_BASE, to: p, at: Date.now(), dur: STEP * 2 };
      setState({ drill: { ...getState().drill, step: 2, drone } });
    });
    at(STEP * 3, () => setState({ drill: { ...getState().drill, step: 3 } }));
    at(STEP * 4, () => setState({ drill: { ...getState().drill, step: 4 } }));
    at(STEP * 5, () => setState({ drill: { ...getState().drill, step: 5 } }));
  }

  // 6+ · pipeline carries on exactly as before (satellite → smoke → sensor → risk → spread → values → alert)
  at(STEP * off.sat, async () => {
    await analysisP;
    setState({ drill: { ...getState().drill, step: off.sat } });
  });
  at(STEP * (off.smoke), async () => {
    await analysisP;
    setState({ drill: { ...getState().drill, step: off.smoke } });
  });
  at(STEP * off.sensor, async () => {
    await analysisP;
    setState({ drill: { ...getState().drill, step: off.sensor } });
  });
  at(STEP * off.risk, async () => {
    await analysisP;
    setState({ drill: { ...getState().drill, step: off.risk, drone: null }, selectedId: 'drill', timelineCursor: 4 });
  });
  at(STEP * off.spread, async () => {
    await analysisP;
    setState({ drill: { ...getState().drill, step: off.spread }, timelineCursor: 6, flyTo: { center: [p[0] + 0.03, p[1] - 0.025], zoom: 11.7, at: Date.now() } });
    animateHorizons();
  });
  at(STEP * off.values, async () => {
    await analysisP;
    setState({ drill: { ...getState().drill, step: off.values }, timelineCursor: 20 });
  });
  at(STEP * (off.done - 0.5), async () => {
    const a = await analysisP;
    const e = a.exposure;
    setState({
      drill: { ...getState().drill, step: off.done },
      alert: {
        level: a.risk.level,
        title: `${a.risk.level} RISK · ${fire.name.replace('DRILL · ', '')}`,
        body: `${e.people.toLocaleString('en-US')} people · ${e.schools} schools · ${e.hospitals} hospitals · ${e.roads} roads · ${e.critical} critical assets within the 3 h forecast`,
      },
    });
  });
}

export function resetDrill() {
  drillTimers.forEach(clearTimeout);
  setState((s) => ({
    fires: s.fires.filter((f) => !f.drill),
    selectedId: s.selectedId === 'drill' ? null : s.selectedId,
    drill: { ...s.drill, step: -1, fireId: null, drone: null },
    alert: null,
  }));
}
