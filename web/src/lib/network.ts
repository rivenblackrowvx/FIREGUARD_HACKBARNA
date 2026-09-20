// Ground detection network. Positions are DEMO placements on real lookout
// peaks; camera imagery comes from the Pyronear PYRO-SDIS dataset.
import type { LngLat } from './types';

export interface Tower { id: string; name: string; lngLat: LngLat; feed: number }

export const TOWERS: Tower[] = [
  { id: 'T-01', name: 'Tibidabo', lngLat: [2.1186, 41.4222], feed: 0 },
  { id: 'T-02', name: 'Montserrat', lngLat: [1.8104, 41.6006], feed: 1 },
  { id: 'T-03', name: 'Montseny · Turó de l\'Home', lngLat: [2.4386, 41.7753], feed: 2 },
  { id: 'T-04', name: 'Serra de Prades', lngLat: [1.0322, 41.3222], feed: 3 },
  { id: 'T-05', name: 'Els Ports', lngLat: [0.3079, 40.8047], feed: 4 },
  { id: 'T-06', name: 'Sierra de la Culebra', lngLat: [-6.3, 41.87], feed: 5 },
  { id: 'T-07', name: 'Peña Trevinca', lngLat: [-6.79, 42.24], feed: 6 },
  { id: 'T-08', name: 'Sierra de Gata', lngLat: [-6.6, 40.25], feed: 7 },
  { id: 'T-09', name: 'Sierra Bermeja', lngLat: [-5.2, 36.55], feed: 8 },
  { id: 'T-10', name: 'Calderona', lngLat: [-0.45, 39.7], feed: 9 },
  { id: 'T-11', name: 'Teide · Izaña', lngLat: [-16.5, 28.3], feed: 10 },
  { id: 'T-12', name: 'Collserola · Sant Pere Màrtir', lngLat: [2.0786, 41.3947], feed: 11 },
];

export function nearestTower(p: LngLat) {
  return TOWERS.reduce((best, t) => {
    const d = Math.hypot(t.lngLat[0] - p[0], t.lngLat[1] - p[1]);
    return d < best.d ? { t, d } : best;
  }, { t: TOWERS[0], d: Infinity }).t;
}

// A ring of IoT ground sensors (temperature / CO / humidity) around a point.
export function sensorsAround(p: LngLat, n = 7): { id: string; lngLat: LngLat }[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI + 0.4;
    const r = 0.012 + (i % 3) * 0.009;
    return { id: `S-${i + 1}`, lngLat: [p[0] + Math.cos(a) * r * 1.3, p[1] + Math.sin(a) * r] };
  });
}
