import { useSyncExternalStore } from 'react';
import type { Analysis } from './analysis';
import type { Fire, Hotspot, LngLat, MtgPixel } from './types';

export type LayerKey =
  | 'hotspots' | 'mtg' | 'wind' | 'spread' | 'cameras' | 'sensors'
  | 'hospitals' | 'schools' | 'roads' | 'infrastructure' | 'population'
  | 'history' | 'zones' | 'drones';

export interface DrillDroneState {
  from: LngLat;
  to: LngLat;
  at: number; // dispatch timestamp (ms) — flight animation anchor
  dur: number;
}

export interface DrillState {
  step: number; // -1 idle, running up to off.done, done == off.done
  fireId: string | null;
  point: LngLat;
  hw: boolean; // hardware-verification phase (Esp32 alert → drone verifies) active
  drone: DrillDroneState | null;
}

export interface State {
  loading: boolean;
  hotspots: Hotspot[];
  fires: Fire[];
  feeds: { deepfire: { live: boolean; source: string }; mtg: { live: boolean; source: string } };
  mtg: MtgPixel[];
  selectedId: string | null;
  analyses: Record<string, Analysis>;
  analyzing: Record<string, boolean>;
  layers: Record<LayerKey, boolean>;
  horizon: number; // index into spread steps shown as "focus"
  historyYear: number | null; // animation cursor for Catalan fire history
  drill: DrillState;
  timelineCursor: number; // number of timeline events revealed (for animation)
  flyTo: { center: LngLat; zoom: number; at: number } | null;
  alert: { title: string; body: string; level: string } | null;
  fuelId: string;
  basemap: 'dark' | 'satellite';
}

let state: State = {
  loading: true,
  hotspots: [],
  fires: [],
  feeds: { deepfire: { live: false, source: '' }, mtg: { live: false, source: '' } },
  mtg: [],
  selectedId: null,
  analyses: {},
  analyzing: {},
  layers: {
    hotspots: true, mtg: true, wind: true, spread: true, cameras: true, sensors: true,
    hospitals: true, schools: true, roads: true, infrastructure: true, population: true,
    history: false, zones: false, drones: true,
  },
  horizon: 4,
  historyYear: null,
  drill: { step: -1, fireId: null, point: [2.095, 41.428], hw: false, drone: null },
  timelineCursor: 99,
  flyTo: null,
  alert: null,
  fuelId: 'SH5',
  basemap: 'dark',
};

const listeners = new Set<() => void>();

export function getState() {
  return state;
}

export function setState(patch: Partial<State> | ((s: State) => Partial<State>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(sel: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => sel(state));
}

export const selectedFire = (s: State) => s.fires.find((f) => f.id === s.selectedId) ?? null;
export const selectedAnalysis = (s: State) => (s.selectedId ? s.analyses[s.selectedId] ?? null : null);

if (import.meta.env.DEV) (window as unknown as { __fg: typeof getState }).__fg = getState;
