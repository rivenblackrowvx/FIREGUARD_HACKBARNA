// Fire-spread model, following the ELMFIRE workflow (elmfire.io):
//   Rothermel (1972) surface rate of spread
//   → Anderson (1983) length-to-breadth ratio for the wind-driven ellipse
//   → Huygens-principle front propagation (Richards 1990 marker method)
// with dead fuel moisture from temperature/RH (Simard 1968 EMC) and hourly
// forecast wind, so the perimeter stretches and bends as the wind changes.
import { fromLocal, ringAreaHa, toLocal } from './geo';
import type { Hotspot, LngLat, Spread, SpreadStep, Weather } from './types';

export interface FuelModel {
  id: string;
  label: string;
  load: number; // total fine fuel load, tons/acre
  sav: number; // characteristic surface-area-to-volume, 1/ft
  depth: number; // fuel bed depth, ft
  mx: number; // moisture of extinction, fraction
  waf: number; // wind adjustment factor 10 m → midflame
}

// Scott & Burgan (2005) models common in Mediterranean Spain.
export const FUELS: FuelModel[] = [
  { id: 'SH5', label: 'SH5 · Mediterranean shrubland (matorral)', load: 5.7, sav: 900, depth: 6, mx: 0.15, waf: 0.4 },
  { id: 'GR2', label: 'GR2 · Dry grass', load: 1.1, sav: 2000, depth: 1, mx: 0.15, waf: 0.4 },
  { id: 'TU5', label: 'TU5 · Pine forest with shrub understory', load: 7.0, sav: 1300, depth: 1, mx: 0.25, waf: 0.2 },
  { id: 'TL8', label: 'TL8 · Long-needle pine litter', load: 5.8, sav: 1800, depth: 0.3, mx: 0.35, waf: 0.1 },
];

// Simard (1968) equilibrium moisture content, % → 1-h dead fuel moisture fraction.
export function deadFuelMoisture(tempC: number, rh: number) {
  const T = tempC * 1.8 + 32;
  let emc;
  if (rh < 10) emc = 0.03229 + 0.281073 * rh - 0.000578 * rh * T;
  else if (rh < 50) emc = 2.22749 + 0.160107 * rh - 0.01478 * T;
  else emc = 21.0606 + 0.005565 * rh * rh - 0.00035 * rh * T - 0.483199 * rh;
  return Math.max(0.02, (emc + 1) / 100);
}

// Rothermel head rate of spread (m/min) for 10-m wind km/h and slope (tan).
export function rothermel(fuel: FuelModel, moisture: number, wind10Kmh: number, slopeTan = 0) {
  const w0 = fuel.load * 0.0459137; // lb/ft²
  const sigma = fuel.sav;
  const rhoP = 32, St = 0.0555, Se = 0.01, h = 8000;
  const wn = w0 * (1 - St);
  const rhoB = w0 / fuel.depth;
  const beta = rhoB / rhoP;
  const betaOp = 3.348 * sigma ** -0.8189;
  const A = 133 * sigma ** -0.7913;
  const gMax = sigma ** 1.5 / (495 + 0.0594 * sigma ** 1.5);
  const gamma = gMax * (beta / betaOp) ** A * Math.exp(A * (1 - beta / betaOp));
  const rm = Math.min(1, moisture / fuel.mx);
  const etaM = Math.max(0, 1 - 2.59 * rm + 5.11 * rm ** 2 - 3.52 * rm ** 3);
  const etaS = 0.174 * Se ** -0.19;
  const IR = gamma * wn * h * etaM * etaS;
  const xi = Math.exp((0.792 + 0.681 * sigma ** 0.5) * (beta + 0.1)) / (192 + 0.2595 * sigma);
  const C = 7.47 * Math.exp(-0.133 * sigma ** 0.55);
  const B = 0.02526 * sigma ** 0.54;
  const E = 0.715 * Math.exp(-3.59e-4 * sigma);
  const U = Math.min(wind10Kmh * fuel.waf * 54.68, 0.9 * IR); // ft/min, with wind limit
  const phiW = C * U ** B * (beta / betaOp) ** -E;
  const phiS = 5.275 * beta ** -0.3 * slopeTan ** 2;
  const eps = Math.exp(-138 / sigma);
  const Qig = 250 + 1116 * moisture;
  const R = (IR * xi * (1 + phiW + phiS)) / (rhoB * eps * Qig);
  return { rosMpm: R * 0.3048, midflameMph: (U / 88), IR };
}

// Anderson (1983) ellipse length-to-breadth from midflame wind (mph).
export function lengthToBreadth(midflameMph: number) {
  const lb = 0.936 * Math.exp(0.2566 * midflameMph) + 0.461 * Math.exp(-0.1548 * midflameMph) - 0.397;
  return Math.min(6, Math.max(1, lb));
}

// Smooth pseudo-random field standing in for fuel/terrain heterogeneity.
function heterogeneity(x: number, y: number, seed: number) {
  const s = (a: number, b: number) => Math.sin(a * 0.00041 + seed) * Math.cos(b * 0.00053 - seed * 0.7);
  return 1 + 0.18 * s(x, y) + 0.1 * s(y * 2.3, x * 1.9) + 0.06 * s(x * 5.1 + y, y * 4.7);
}

function convexHull(pts: [number, number][]) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: [number, number][] = [], upper: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  for (const q of p.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

// Resample a closed polygon to n equally spaced vertices (counter-clockwise).
function resample(pts: [number, number][], n: number): [number, number][] {
  const closed = [...pts, pts[0]];
  const seg = closed.slice(1).map((p, i) => Math.hypot(p[0] - closed[i][0], p[1] - closed[i][1]));
  const total = seg.reduce((a, b) => a + b, 0);
  const out: [number, number][] = [];
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (i < seg.length - 1 && acc + seg[i] < target) acc += seg[i++];
    const t = seg[i] ? (target - acc) / seg[i] : 0;
    out.push([closed[i][0] + t * (closed[i + 1][0] - closed[i][0]), closed[i][1] + t * (closed[i + 1][1] - closed[i][1])]);
  }
  let area = 0;
  for (let k = 0, j = n - 1; k < n; j = k++) area += (out[j][0] - out[k][0]) * (out[j][1] + out[k][1]);
  return area < 0 ? out.reverse() : out;
}

// Initial OBSERVED perimeter: hull of recent detections, buffered by half a
// VIIRS pixel (~190 m), or a small circle for a single point.
function observedFront(origin: LngLat, hotspots: Hotspot[]): [number, number][] {
  const pts = hotspots.map((h) => toLocal(origin, [h.lon, h.lat]));
  const hull = pts.length >= 3 ? convexHull(pts) : pts.length ? pts : [[0, 0] as [number, number]];
  const buffered: [number, number][] = [];
  const cx = hull.reduce((a, p) => a + p[0], 0) / hull.length;
  const cy = hull.reduce((a, p) => a + p[1], 0) / hull.length;
  for (let k = 0; k < 90; k++) {
    const a = (k / 90) * 2 * Math.PI;
    const d: [number, number] = [Math.cos(a), Math.sin(a)];
    let best = -Infinity;
    for (const p of hull) best = Math.max(best, (p[0] - cx) * d[0] + (p[1] - cy) * d[1]);
    buffered.push([cx + d[0] * (best + 190), cy + d[1] * (best + 190)]);
  }
  return buffered;
}

export interface SpreadInput {
  ignition: LngLat;
  hotspots: Hotspot[];
  weather: Weather;
  fuel?: FuelModel;
  windOverride?: { kmh: number; dir: number };
  horizons?: number[];
  // Built-up areas (towns as discs) where fuel is mostly non-burnable.
  urban?: { c: LngLat; rKm: number }[];
}

export const HORIZONS = [15, 30, 60, 180];

export function simulateSpread({ ignition, hotspots, weather, fuel = FUELS[0], windOverride, horizons = HORIZONS, urban = [] }: SpreadInput): Spread {
  const origin = ignition;
  const N = 160;
  const dt = 2.5; // minutes
  const seed = (ignition[0] * 13.37 + ignition[1] * 7.77) % 6.28;
  let front = resample(observedFront(origin, hotspots), N);
  const towns = urban.map((u) => ({ p: toLocal(origin, u.c), r: u.rKm * 1000 }));
  // Spread multiplier: ~1 in wildland, falling to 3% inside the urban core.
  const fuelAt = (x: number, y: number) => {
    let f = 1;
    for (const t of towns) {
      const d = Math.hypot(x - t.p[0], y - t.p[1]) / t.r;
      if (d < 1.15) f = Math.min(f, d < 0.85 ? 0.03 : 0.03 + ((d - 0.85) / 0.3) * 0.97);
    }
    return f;
  };

  const windAt = (min: number) => {
    if (windOverride) return windOverride;
    const hrs = weather.hourly;
    if (!hrs.length) return { kmh: weather.windKmh, dir: weather.windDir };
    const k = Math.min(hrs.length - 1, min / 60);
    const i = Math.floor(k), j = Math.min(hrs.length - 1, i + 1), f = k - i;
    // Blend wind as vectors so direction wraps correctly.
    const vec = (h: { windKmh: number; windDir: number }) => [h.windKmh * Math.sin((h.windDir * Math.PI) / 180), h.windKmh * Math.cos((h.windDir * Math.PI) / 180)];
    const a = vec(i === 0 ? { windKmh: weather.windKmh, windDir: weather.windDir } : hrs[i]), b = vec(hrs[j]);
    const u = a[0] + (b[0] - a[0]) * f, v = a[1] + (b[1] - a[1]) * f;
    return { kmh: Math.hypot(u, v), dir: ((Math.atan2(u, v) * 180) / Math.PI + 360) % 360 };
  };
  const moistAt = (min: number) => {
    const h = weather.hourly[Math.min(weather.hourly.length - 1, Math.floor(min / 60))];
    return deadFuelMoisture(h?.temp ?? weather.temp, h?.rh ?? weather.rh);
  };

  const toRing = (pts: [number, number][]): LngLat[] => {
    const ring = pts.map((p) => fromLocal(origin, p));
    return [...ring, ring[0]];
  };

  const m0 = moistAt(0);
  const w0 = windAt(0);
  const r0 = rothermel(fuel, m0, w0.kmh);
  const observedRing = toRing(front);
  const steps: SpreadStep[] = [{
    minutes: 0, label: 'Now', ring: observedRing, areaHa: ringAreaHa(origin, observedRing),
    headRosMpm: r0.rosMpm, provenance: 'OBSERVED',
  }];

  let t = 0;
  let lastLb = lengthToBreadth(r0.midflameMph);
  const maxH = Math.max(...horizons);
  while (t < maxH) {
    const w = windAt(t);
    const m = moistAt(t);
    const { rosMpm, midflameMph } = rothermel(fuel, m, w.kmh);
    const lb = lengthToBreadth(midflameMph);
    lastLb = lb;
    const e = Math.sqrt(lb * lb - 1) / lb;
    const back = (rosMpm * (1 - e)) / (1 + e);
    const a = ((rosMpm + back) / 2) * dt;
    const b = a / lb;
    const c = ((rosMpm - back) / 2) * dt;
    const heading = ((w.dir + 180) * Math.PI) / 180; // travel direction, from north clockwise
    const wx = Math.sin(heading), wy = Math.cos(heading);

    const next: [number, number][] = front.map((p, i) => {
      const prev = front[(i - 1 + N) % N], nxt = front[(i + 1) % N];
      // Outward normal for a counter-clockwise ring.
      let nx = nxt[1] - prev[1], ny = -(nxt[0] - prev[0]);
      const len = Math.hypot(nx, ny) || 1;
      nx /= len; ny /= len;
      const nu = nx * wx + ny * wy, nv = -nx * wy + ny * wx; // wind-aligned
      const den = Math.sqrt(a * a * nu * nu + b * b * nv * nv) || 1;
      const su = (a * a * nu) / den + c, sv = (b * b * nv) / den;
      const k = heterogeneity(p[0], p[1], seed) * fuelAt(p[0], p[1]);
      return [p[0] + k * (su * wx - sv * wy), p[1] + k * (su * wy + sv * wx)];
    });
    front = resample(next, N);
    t += dt;

    const hit = horizons.find((h) => Math.abs(h - t) < dt / 2);
    if (hit) {
      const ring = toRing(front);
      steps.push({
        minutes: hit,
        label: hit < 60 ? `+${hit} min` : `+${hit / 60} h`,
        ring,
        areaHa: ringAreaHa(origin, ring),
        headRosMpm: rosMpm,
        provenance: hit <= 30 ? 'MODELLED' : 'FORECAST',
      });
    }
  }

  return {
    ignition,
    steps,
    fuel: fuel.label,
    lb: lastLb,
    moisture: m0,
    headingDeg: (w0.dir + 180) % 360,
  };
}
