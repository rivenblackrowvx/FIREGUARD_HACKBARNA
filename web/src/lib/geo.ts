import type { LngLat } from './types';

const R = 6371008.8;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceKm(a: LngLat, b: LngLat) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return (2 * R * Math.asin(Math.sqrt(h))) / 1000;
}

export function bearing(a: LngLat, b: LngLat) {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

// Local equirectangular frame in metres around an origin — accurate enough
// at fire scale (< 50 km).
export function toLocal(origin: LngLat, p: LngLat): [number, number] {
  const x = rad(p[0] - origin[0]) * R * Math.cos(rad(origin[1]));
  const y = rad(p[1] - origin[1]) * R;
  return [x, y];
}

export function fromLocal(origin: LngLat, [x, y]: [number, number]): LngLat {
  return [origin[0] + deg(x / (R * Math.cos(rad(origin[1])))), origin[1] + deg(y / R)];
}

export function pointInRing(p: LngLat, ring: LngLat[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function ringAreaHa(origin: LngLat, ring: LngLat[]) {
  const pts = ring.map((p) => toLocal(origin, p));
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  return Math.abs(a / 2) / 10_000;
}

// Minimal distance from point to ring edge, km (0 if inside).
export function distanceToRingKm(p: LngLat, ring: LngLat[]) {
  if (pointInRing(p, ring)) return 0;
  const o = ring[0];
  const q = toLocal(o, p);
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = toLocal(o, ring[i]), b = toLocal(o, ring[i + 1]);
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy));
  }
  return best / 1000;
}

export function circle(center: LngLat, radiusKm: number, n = 64): LngLat[] {
  const ring: LngLat[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    ring.push(fromLocal(center, [Math.sin(a) * radiusKm * 1000, Math.cos(a) * radiusKm * 1000]));
  }
  return ring;
}

export function compass(deg: number) {
  return ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(deg / 22.5) % 16];
}

export const fmt = {
  int: (n: number) => Math.round(n).toLocaleString('en-US'),
  km: (n: number) => (n < 1 ? `${Math.round(n * 1000)} m` : `${n.toFixed(n < 10 ? 1 : 0)} km`),
  ha: (n: number) => (n < 1 ? `${n.toFixed(2)} ha` : n < 100 ? `${n.toFixed(1)} ha` : `${fmt.int(n)} ha`),
  time: (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  ago: (t: number) => {
    const m = Math.round((Date.now() - t) / 60_000);
    if (m < 1) return 'now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    return h < 48 ? `${h} h ${m % 60} min ago` : `${Math.floor(h / 24)} d ago`;
  },
};
