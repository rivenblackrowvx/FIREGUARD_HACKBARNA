export type LngLat = [number, number];

export interface Hotspot {
  id: string;
  lat: number;
  lon: number;
  t: string;
  source: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  frp: number | null;
  cluster?: string;
  active?: boolean;
  name?: string;
  region?: string;
  demo?: boolean;
}

export interface MtgPixel {
  lat: number;
  lon: number;
  frp: number;
  frpUnc?: number | null;
  confidence?: number | null;
  t: string;
  demo?: boolean;
}

export interface Weather {
  live: boolean;
  temp: number;
  rh: number;
  windKmh: number;
  windDir: number; // meteorological: direction wind comes FROM, degrees
  gustKmh: number;
  vpd?: number;
  hourly: { t: string; temp: number; rh: number; windKmh: number; windDir: number; gustKmh: number; precipProb: number }[];
}

export type Provenance = 'OBSERVED' | 'MODELLED' | 'FORECAST';

export interface SpreadStep {
  minutes: number;
  label: string;
  ring: LngLat[];
  areaHa: number;
  headRosMpm: number;
  provenance: Provenance;
}

export interface Spread {
  ignition: LngLat;
  steps: SpreadStep[];
  fuel: string;
  lb: number;
  moisture: number;
  headingDeg: number; // direction the fire is travelling TO
}

export interface Asset {
  kind: 'hospital' | 'school' | 'place' | 'infrastructure' | 'road';
  name: string;
  lon: number;
  lat: number;
  population?: number;
  sub?: string;
  distanceKm: number;
  bearing: number;
  downwind: number; // 0..1 alignment with spread direction
  etaMin: number | null; // first forecast horizon that reaches it
}

export interface RiskFactor {
  key: 'intensity' | 'wind' | 'dryness' | 'population' | 'infrastructure' | 'proximity' | 'spread' | 'history';
  label: string;
  value: number; // 0..1
  detail: string;
}

export interface Risk {
  score: number;
  level: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  factors: RiskFactor[];
}

export interface TimelineEvent {
  t: number; // epoch ms
  kind: 'satellite' | 'smoke' | 'sensor' | 'confirmed' | 'wind' | 'spread' | 'impact' | 'alert';
  text: string;
  lngLat?: LngLat;
}

export interface Fire {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  detectedAt: number;
  lastSeen: number;
  frp: number; // latest max FRP (MW)
  frpSeries: { t: number; frp: number }[];
  confidence: number; // 0..1
  hotspots: Hotspot[];
  sources: string[];
  demo: boolean;
  drill?: boolean;
  smoke?: { camera: string; confidence: number; frame?: string };
}
