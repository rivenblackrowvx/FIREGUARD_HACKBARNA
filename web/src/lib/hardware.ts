import type { LngLat } from './types';

export type SensorStatus = 'ONLINE' | 'WARNING' | 'OFFLINE';
export type SmokeLevel = 'NORMAL' | 'ELEVATED' | 'HIGH';
export type SignalState = 'POSSIBLE FIRE' | 'HIGH-CONFIDENCE FIRE SIGNAL' | 'PENDING' | 'UNCONFIRMED';

export interface SensorNode {
  id: string;
  region: string;
  lngLat: LngLat;
  status: SensorStatus;
  temp: number;
  humidity: number;
  smoke: SmokeLevel;
  battery: number;
  signal: number; // dBm
  lastSignal: number; // seconds ago
  anomaly?: 'TEMP' | 'HUMIDITY' | 'SMOKE' | 'BATTERY';
}

export const SENSOR_NODES: SensorNode[] = [
  { id: 'ESP32-FG-001', region: 'Gredos', lngLat: [-5.25, 40.25], status: 'ONLINE', temp: 38.4, humidity: 21, smoke: 'NORMAL', battery: 91, signal: -54, lastSignal: 4 },
  { id: 'ESP32-FG-002', region: 'Guadarrama', lngLat: [-3.95, 40.82], status: 'ONLINE', temp: 35.1, humidity: 24, smoke: 'NORMAL', battery: 84, signal: -58, lastSignal: 6 },
  { id: 'ESP32-FG-003', region: 'Monfragüe', lngLat: [-5.85, 39.82], status: 'ONLINE', temp: 41.2, humidity: 15, smoke: 'NORMAL', battery: 76, signal: -62, lastSignal: 9 },
  { id: 'ESP32-FG-004', region: 'Sierra de las Nieves', lngLat: [-4.95, 36.65], status: 'ONLINE', temp: 39.8, humidity: 17, smoke: 'NORMAL', battery: 88, signal: -51, lastSignal: 3 },
  { id: 'ESP32-FG-005', region: 'Sierra Morena Norte', lngLat: [-4.10, 38.50], status: 'ONLINE', temp: 37.5, humidity: 19, smoke: 'NORMAL', battery: 79, signal: -59, lastSignal: 7 },
  { id: 'ESP32-FG-006', region: 'Sierra de Cazorla', lngLat: [-2.95, 37.90], status: 'WARNING', temp: 43.8, humidity: 12, smoke: 'ELEVATED', battery: 52, signal: -66, lastSignal: 22, anomaly: 'SMOKE' },
  { id: 'ESP32-FG-007', region: 'Sierra de Alcaraz', lngLat: [-2.30, 38.60], status: 'ONLINE', temp: 36.9, humidity: 22, smoke: 'NORMAL', battery: 83, signal: -57, lastSignal: 5 },
  { id: 'ESP32-FG-008', region: 'Serranía de Cuenca', lngLat: [-2.10, 40.10], status: 'ONLINE', temp: 34.2, humidity: 26, smoke: 'NORMAL', battery: 90, signal: -55, lastSignal: 4 },
  { id: 'ESP32-FG-009', region: 'Sierra del Segura', lngLat: [-2.30, 38.30], status: 'ONLINE', temp: 38.7, humidity: 18, smoke: 'NORMAL', battery: 81, signal: -60, lastSignal: 8 },
  { id: 'ESP32-FG-010', region: 'Sierra Espuña', lngLat: [-1.85, 37.85], status: 'ONLINE', temp: 40.3, humidity: 14, smoke: 'NORMAL', battery: 74, signal: -63, lastSignal: 11 },
  { id: 'ESP32-FG-011', region: 'Sierra de Mariola', lngLat: [-0.65, 38.75], status: 'ONLINE', temp: 42.0, humidity: 11, smoke: 'NORMAL', battery: 69, signal: -61, lastSignal: 13 },
  { id: 'ESP32-FG-012', region: 'Serra de Prades', lngLat: [1.03, 41.32], status: 'ONLINE', temp: 36.4, humidity: 23, smoke: 'NORMAL', battery: 86, signal: -56, lastSignal: 5 },
  { id: 'ESP32-FG-013', region: 'Montseny', lngLat: [2.44, 41.78], status: 'ONLINE', temp: 33.8, humidity: 27, smoke: 'NORMAL', battery: 92, signal: -52, lastSignal: 3 },
  { id: 'ESP32-FG-014', region: 'Les Gavarres', lngLat: [2.99, 41.90], status: 'ONLINE', temp: 35.5, humidity: 25, smoke: 'NORMAL', battery: 85, signal: -57, lastSignal: 6 },
  { id: 'ESP32-FG-015', region: 'Serra de Tramuntana', lngLat: [2.70, 39.75], status: 'ONLINE', temp: 39.2, humidity: 16, smoke: 'NORMAL', battery: 78, signal: -64, lastSignal: 10 },
  { id: 'ESP32-FG-016', region: 'Els Ports', lngLat: [0.31, 40.80], status: 'ONLINE', temp: 37.0, humidity: 20, smoke: 'NORMAL', battery: 80, signal: -58, lastSignal: 7 },
  { id: 'ESP32-FG-017', region: 'Calderona', lngLat: [-0.45, 39.70], status: 'ONLINE', temp: 41.5, humidity: 13, smoke: 'NORMAL', battery: 73, signal: -59, lastSignal: 12 },
  { id: 'ESP32-FG-018', region: 'Sierra de Culebra', lngLat: [-6.30, 41.87], status: 'ONLINE', temp: 32.9, humidity: 29, smoke: 'NORMAL', battery: 89, signal: -53, lastSignal: 4 },
  { id: 'ESP32-FG-019', region: 'Peña Trevinca', lngLat: [-6.79, 42.24], status: 'OFFLINE', temp: 0, humidity: 0, smoke: 'NORMAL', battery: 31, signal: -97, lastSignal: 412, anomaly: 'BATTERY' },
  { id: 'ESP32-FG-020', region: 'Sierra de Gata', lngLat: [-6.60, 40.25], status: 'ONLINE', temp: 38.1, humidity: 21, smoke: 'NORMAL', battery: 87, signal: -55, lastSignal: 5 },
  { id: 'ESP32-FG-021', region: 'Gredos', lngLat: [-5.30, 40.21], status: 'WARNING', temp: 47.2, humidity: 18, smoke: 'ELEVATED', battery: 87, signal: -61, lastSignal: 12, anomaly: 'TEMP' },
  { id: 'ESP32-FG-022', region: 'Sierra Bermeja', lngLat: [-5.20, 36.55], status: 'ONLINE', temp: 39.4, humidity: 15, smoke: 'NORMAL', battery: 77, signal: -62, lastSignal: 9 },
  { id: 'ESP32-FG-023', region: 'Collserola', lngLat: [2.08, 41.39], status: 'ONLINE', temp: 34.0, humidity: 26, smoke: 'NORMAL', battery: 88, signal: -51, lastSignal: 3 },
  { id: 'ESP32-FG-024', region: 'Sierra de Guara', lngLat: [-0.14, 42.27], status: 'ONLINE', temp: 33.5, humidity: 28, smoke: 'NORMAL', battery: 90, signal: -54, lastSignal: 4 },
  { id: 'ESP32-FG-025', region: 'Montsec', lngLat: [0.80, 42.05], status: 'ONLINE', temp: 34.7, humidity: 24, smoke: 'NORMAL', battery: 82, signal: -56, lastSignal: 6 },
  { id: 'ESP32-FG-026', region: 'Valle de Arán', lngLat: [0.75, 42.72], status: 'ONLINE', temp: 29.8, humidity: 34, smoke: 'NORMAL', battery: 93, signal: -50, lastSignal: 2 },
  { id: 'ESP32-FG-027', region: 'Picos de Europa', lngLat: [-4.85, 43.12], status: 'ONLINE', temp: 28.4, humidity: 36, smoke: 'NORMAL', battery: 91, signal: -52, lastSignal: 3 },
  { id: 'ESP32-FG-028', region: 'Los Alcornocales', lngLat: [-5.60, 36.45], status: 'ONLINE', temp: 40.6, humidity: 14, smoke: 'NORMAL', battery: 75, signal: -61, lastSignal: 9 },
  { id: 'ESP32-FG-029', region: 'Sierra Nevada', lngLat: [-3.38, 37.05], status: 'ONLINE', temp: 36.2, humidity: 19, smoke: 'NORMAL', battery: 84, signal: -57, lastSignal: 5 },
  { id: 'ESP32-FG-030', region: 'Cabo de Gata', lngLat: [-2.10, 36.85], status: 'WARNING', temp: 44.5, humidity: 9, smoke: 'ELEVATED', battery: 48, signal: -72, lastSignal: 31, anomaly: 'SMOKE' },
  { id: 'ESP32-FG-031', region: 'Sierra Morena Sur', lngLat: [-6.10, 37.50], status: 'ONLINE', temp: 37.9, humidity: 20, smoke: 'NORMAL', battery: 79, signal: -59, lastSignal: 7 },
  { id: 'ESP32-FG-032', region: 'Anaga', lngLat: [-16.20, 28.53], status: 'ONLINE', temp: 30.2, humidity: 31, smoke: 'NORMAL', battery: 86, signal: -55, lastSignal: 6 },
  { id: 'ESP32-FG-033', region: 'Teide', lngLat: [-16.63, 28.27], status: 'ONLINE', temp: 29.0, humidity: 33, smoke: 'NORMAL', battery: 89, signal: -53, lastSignal: 4 },
  { id: 'ESP32-FG-034', region: 'Gran Canaria', lngLat: [-15.60, 27.95], status: 'ONLINE', temp: 31.7, humidity: 30, smoke: 'NORMAL', battery: 82, signal: -58, lastSignal: 7 },
  { id: 'ESP32-FG-035', region: 'Lanzarote', lngLat: [-13.60, 29.00], status: 'ONLINE', temp: 30.5, humidity: 29, smoke: 'NORMAL', battery: 90, signal: -54, lastSignal: 5 },
  { id: 'ESP32-FG-036', region: 'Fuerteventura', lngLat: [-14.30, 28.30], status: 'ONLINE', temp: 31.1, humidity: 28, smoke: 'NORMAL', battery: 85, signal: -56, lastSignal: 6 },
];

export type DroneStatus = 'AVAILABLE' | 'IN FLIGHT' | 'MAINTENANCE';

export interface Drone {
  id: string;
  status: DroneStatus;
  name: string;
  base: string;
  lngLat: LngLat;
  battery: number;
  link: string;
  target?: { id: string; region: string; lngLat: LngLat; etaSec: number; distanceKm: number };
  mission?: string;
  path?: LngLat[];
  verification?: { confidence: number; smoke: boolean; heat: boolean; aerial: string };
}

export const DRONES: Drone[] = [
  {
    id: 'DRONE-FG-01', status: 'IN FLIGHT', name: 'Vetar ala', base: 'Collserola', lngLat: [-0.51, 38.81], battery: 74, link: 'STABLE',
    mission: 'VERIFY FIRE', target: { id: 'FG-2026-0051', region: "Vall d'Albaida", lngLat: [-0.52, 38.82], etaSec: 201, distanceKm: 2.4 },
    path: [[2.08, 41.39], [-0.51, 38.81], [-0.52, 38.82]],
    verification: { confidence: 92, smoke: true, heat: true, aerial: 'LIVE' },
  },
  { id: 'DRONE-FG-02', status: 'AVAILABLE', name: 'Sima draka', base: 'Sierra Espuña', lngLat: [-1.85, 37.85], battery: 96, link: 'STABLE' },
  { id: 'DRONE-FG-03', status: 'AVAILABLE', name: 'Lume ceo', base: 'Montseny', lngLat: [2.44, 41.78], battery: 88, link: 'STABLE' },
];

export interface SignalReading { label: string; value: string; state: 'HIGH' | 'LOW' | 'DETECTED' | 'NONE' }

export interface ActiveSignal {
  id: string;
  nodeId: string;
  region: string;
  state: SignalState;
  confidence: number;
  readings: SignalReading[];
  satellite: boolean;
  drone: string | null;
  from: string;
  into: string;
}

export const ACTIVE_SIGNALS: ActiveSignal[] = [
  {
    id: 'SIG-0421', nodeId: 'ESP32-FG-021', region: 'Gredos', state: 'HIGH-CONFIDENCE FIRE SIGNAL', confidence: 94, satellite: true,
    drone: 'DRONE-FG-01',
    readings: [
      { label: 'TEMPERATURE', value: '47.2 °C', state: 'HIGH' },
      { label: 'HUMIDITY', value: '18 %', state: 'LOW' },
      { label: 'SMOKE', value: 'DETECTED', state: 'DETECTED' },
      { label: 'SATELLITE', value: 'HOTSPOT DETECTED', state: 'DETECTED' },
    ],
    from: '10:41', into: 'drone',
  },
  {
    id: 'SIG-0420', nodeId: 'ESP32-FG-030', region: 'Sierra de Gata', state: 'POSSIBLE FIRE', confidence: 61, satellite: false,
    drone: null,
    readings: [
      { label: 'TEMPERATURE', value: '44.5 °C', state: 'HIGH' },
      { label: 'HUMIDITY', value: '9 %', state: 'LOW' },
      { label: 'SMOKE', value: 'ELEVATED', state: 'DETECTED' },
      { label: 'SATELLITE', value: 'NO SIGNAL', state: 'NONE' },
    ],
    from: '10:38', into: 'correlation',
  },
  {
    id: 'SIG-0419', nodeId: 'ESP32-FG-006', region: 'Sierra de Cazorla', state: 'POSSIBLE FIRE', confidence: 42, satellite: false,
    drone: null,
    readings: [
      { label: 'TEMPERATURE', value: '43.8 °C', state: 'HIGH' },
      { label: 'HUMIDITY', value: '12 %', state: 'LOW' },
      { label: 'SMOKE', value: 'ELEVATED', state: 'DETECTED' },
      { label: 'SATELLITE', value: 'NO SIGNAL', state: 'NONE' },
    ],
    from: '10:29', into: 'correlation',
  },
  {
    id: 'SIG-0418', nodeId: 'ESP32-FG-036', region: 'Sierra Morena', state: 'PENDING', confidence: 18, satellite: false,
    drone: null,
    readings: [
      { label: 'TEMPERATURE', value: '31.1 °C', state: 'HIGH' },
      { label: 'HUMIDITY', value: '28 %', state: 'LOW' },
      { label: 'SMOKE', value: 'NORMAL', state: 'NONE' },
      { label: 'SATELLITE', value: 'NO SIGNAL', state: 'NONE' },
    ],
    from: '10:15', into: 'validation',
  },
];

export interface HardwareEvent { time: string; kind: string; title: string; body: string; region: string }

export const LIVE_EVENTS: HardwareEvent[] = [
  { time: '10:41', kind: 'sensor', title: 'SENSOR ALERT', body: 'ESP32-FG-021 · Temperature anomaly', region: 'Gredos' },
  { time: '10:43', kind: 'satellite', title: 'SATELLITE CORRELATION', body: 'HOTSPOT detected · Gredos', region: 'Gredos' },
  { time: '10:44', kind: 'fireguard', title: 'HIGH-CONFIDENCE SIGNAL', body: 'Correlation complete · 94%', region: 'Gredos' },
  { time: '10:45', kind: 'drone', title: 'DRONE VERIFICATION', body: 'DRONE-FG-01 → FG-2026-0051', region: "Vall d'Albaida", },
  { time: '10:49', kind: 'drone', title: 'VERIFICATION COMPLETE', body: 'DRONE-FG-01 · visual fire signature', region: "Vall d'Albaida" },
  { time: '10:50', kind: 'fireguard', title: 'INCIDENT UPGRADED', body: 'FG-2026-0051 · upgraded', region: "Vall d'Albaida" },
];

export interface TimelineEntry { time: string; icon: string; text: string }

export const VERIFIED_TIMELINE: TimelineEntry[] = [
  { time: '10:41', icon: '📡', text: 'ESP32-FG-021 · Temperature anomaly' },
  { time: '10:42', icon: '💨', text: 'Smoke sensor · Elevated reading' },
  { time: '10:43', icon: '🛰', text: 'Satellite · Hotspot detected' },
  { time: '10:44', icon: '🔥', text: 'FIREGUARD · High-confidence signal' },
  { time: '10:45', icon: '✈', text: 'DRONE-FG-01 · Verification launched' },
  { time: '10:49', icon: '✅', text: 'DRONE · Visual confirmation' },
  { time: '10:50', icon: '🚨', text: 'FIREGUARD · Incident upgraded' },
];

export const UNCONFIRMED_TIMELINE: TimelineEntry[] = [
  { time: '10:41', icon: '📡', text: 'GROUND SENSOR ALERT' },
  { time: '10:43', icon: '🛰', text: 'SATELLITE CORRELATION' },
  { time: '10:46', icon: '✈', text: 'DRONE DISPATCHED' },
  { time: '10:49', icon: '✔', text: 'NO FIRE VISUALLY OBSERVED' },
];

export const CORRELATION_HIGH = [
  { label: 'GROUND SENSOR', value: 87 },
  { label: 'SATELLITE', value: 94 },
  { label: 'WEATHER', value: 91 },
  { label: 'DRONE VISUAL', value: 92 },
];

export const CORRELATION_LOW = [
  { label: 'GROUND SENSOR', value: 83 },
  { label: 'SATELLITE', value: 41 },
  { label: 'WEATHER', value: 22 },
  { label: 'DRONE VISUAL', value: 8 },
];

export interface ComponentSpec {
  name: string;
  role: string;
  signal: string;
  power: string;
  comm: string;
  status: 'ACTIVE' | 'OPTIONAL';
  group: 'REQUIRED' | 'OPTIONAL' | 'COMMUNICATION' | 'POWER';
}

export const COMPONENTS: ComponentSpec[] = [
  { name: 'ESP32', role: 'Main controller', signal: 'Sensor aggregation', power: 'Low', comm: 'Wi-Fi / LoRa / radio', status: 'ACTIVE', group: 'REQUIRED' },
  { name: 'Temperature sensor', role: 'Digital temperature', signal: '°C reading', power: 'Very low', comm: 'I²C / 1-Wire', status: 'ACTIVE', group: 'REQUIRED' },
  { name: 'Humidity sensor', role: 'Relative humidity', signal: '% RH', power: 'Very low', comm: 'I²C', status: 'ACTIVE', group: 'REQUIRED' },
  { name: 'Smoke / gas sensor', role: 'Smoke or gas detection', signal: 'Gas / smoke index', power: 'Low', comm: 'Analog / I²C', status: 'ACTIVE', group: 'REQUIRED' },
  { name: 'PM2.5 sensor', role: 'Particulate matter', signal: 'µg/m³', power: 'Medium', comm: 'UART / I²C', status: 'OPTIONAL', group: 'OPTIONAL' },
  { name: 'Flame sensor', role: 'Flame detection', signal: 'Flame / IR', power: 'Low', comm: 'Digital', status: 'OPTIONAL', group: 'OPTIONAL' },
  { name: 'CO sensor', role: 'Carbon monoxide', signal: 'ppm CO', power: 'Low', comm: 'Analog / I²C', status: 'OPTIONAL', group: 'OPTIONAL' },
  { name: 'GPS module', role: 'Location / time', signal: 'Position fix', power: 'Medium', comm: 'UART', status: 'OPTIONAL', group: 'OPTIONAL' },
  { name: 'Battery', role: 'Energy storage', signal: 'SoC state', power: '—', comm: 'I²C fuel gauge', status: 'ACTIVE', group: 'POWER' },
  { name: 'Solar charging', role: 'Harvest + charge', signal: 'Charge status', power: 'Source', comm: 'MPPT output', status: 'ACTIVE', group: 'POWER' },
  { name: 'LoRa radio', role: 'Long-range link', signal: 'Packet uplink', power: 'Medium', comm: 'Wi-Fi / LoRa / cell', status: 'ACTIVE', group: 'COMMUNICATION' },
];

export const SOURCE_PIPELINE = ['SENSOR', 'RAW TELEMETRY', 'VALIDATION', 'ANOMALY DETECTION', 'SIGNAL CORRELATION', 'FIRE CONFIDENCE', 'DRONE VERIFICATION'];

export const SOFTWARE_STACK = [
  { name: 'HARDWARE', rows: 'ESP32 + Sensors + Drone' },
  { name: 'COMMUNICATION', rows: 'Wi-Fi / LoRa / Cellular' },
  { name: 'FIREGUARD API', rows: 'Data ingestion + validation' },
  { name: 'INTELLIGENCE', rows: 'Anomaly + Risk + AI' },
  { name: 'VERIFICATION', rows: 'Drone + Visual Analysis' },
  { name: 'OPERATOR CENTER', rows: 'Map + Alerts + Decisions' },
];

export const HARDWARE_SOFTWARE_FLOW = ['ESP32', 'Sensors', 'Telemetry', 'FIREGUARD API', 'Risk Engine', 'Alert', 'Drone', 'Visual Verification', 'Operator'];

export const SOFTWARE_SUMMARY = [
  ['FRONTEND', 'Vite · React · TypeScript'],
  ['MAP', 'MapLibre GL'],
  ['BACKEND', 'Express API'],
  ['VALIDATION', 'Zod (ready)'],
  ['INTELLIGENCE', 'Risk Engine + AI Providers'],
  ['TELEMETRY', 'REST / MQTT-ready ingestion'],
  ['VISUALIZATION', 'SVG / charts'],
  ['MOTION', 'Framer Motion'],
  ['TESTING', 'Vitest (ready)'],
];

export const NODE_SOFTWARE = [
  ['Firmware', 'ESP32-compatible firmware'],
  ['Protocol', 'HTTP / MQTT-ready'],
  ['Data Format', 'JSON'],
  ['Validation', 'Zod'],
  ['Transport', 'Wi-Fi / LoRa-ready'],
  ['Update', 'OTA-ready'],
];

export const DRONE_SOFTWARE = [
  ['Flight Controller', 'Autonomous flight system'],
  ['Telemetry', 'Real-time position + status'],
  ['Camera', 'RGB / Thermal'],
  ['Communication', 'Telemetry link'],
  ['Verification', 'FIREGUARD verification API'],
  ['Analysis', 'Computer Vision / AI-ready'],
];

export const DESIGN_PRINCIPLES = [
  'Low cost', 'Low power', 'Easy deployment', 'Modular sensors', 'Long battery life',
  'Solar compatibility', 'Reliable communication', 'Simple maintenance', 'Replaceable components', 'Scalable deployment',
];

export const verificationState = (n: SensorNode): ActiveSignal['state'] =>
  n.status === 'OFFLINE' ? 'PENDING' : n.anomaly ? (n.smoke === 'ELEVATED' ? 'POSSIBLE FIRE' : 'POSSIBLE FIRE') : 'PENDING';