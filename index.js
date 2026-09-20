import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deepfireConfigured, spainHotspots } from './deepfire.js';
import { mtgConfigured, readCached, syncLatest } from './mtg.js';
import { demoHotspots, demoMtg } from './demo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const PORT = Number(process.env.PORT) || 8787;

const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  const value = await fn();
  memo.set(key, { at: Date.now(), value });
  return value;
}

const status = { deepfire: 'demo', mtg: 'demo', weather: 'pending', errors: {} };

app.get('/api/status', (_req, res) => res.json(status));

app.get('/api/hotspots', async (_req, res) => {
  if (deepfireConfigured()) {
    try {
      const hotspots = await spainHotspots();
      status.deepfire = 'live';
      delete status.errors.deepfire;
      return res.json({ live: true, source: 'Deepfire Hotspots API', hotspots });
    } catch (e) {
      status.deepfire = 'error';
      status.errors.deepfire = e.message;
      console.error(e.message);
    }
  }
  res.json({ live: false, source: 'FireGuard demo scenario', hotspots: demoHotspots() });
});

app.get('/api/mtg-frp', async (_req, res) => {
  if (mtgConfigured()) {
    try {
      await cached('mtg-sync', 10 * 60_000, () => syncLatest(12));
      const pixels = readCached();
      status.mtg = 'live';
      delete status.errors.mtg;
      return res.json({ live: true, source: 'LSA SAF MTG FRP-Pixel', pixels });
    } catch (e) {
      status.mtg = 'error';
      status.errors.mtg = e.message;
    }
  }
  const pixels = readCached();
  if (pixels.length) return res.json({ live: true, source: 'LSA SAF MTG FRP-Pixel (local cache)', pixels });
  res.json({ live: false, source: 'FireGuard demo scenario', pixels: demoMtg() });
});

// Weather: WeatherNext variables (t2m, rh, 10 m wind, gusts) served from
// Open-Meteo until a WeatherNext (Earth Engine / BigQuery) project is wired.
const HOURLY = 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability,vapour_pressure_deficit,soil_moisture_0_to_1cm';
app.get('/api/weather', async (req, res) => {
  const lat = (+req.query.lat).toFixed(2), lon = (+req.query.lon).toFixed(2);
  try {
    const body = await cached(`wx:${lat},${lon}`, 15 * 60_000, async () => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=${HOURLY.split(',').slice(0, 5).join(',')}&hourly=${HOURLY}&forecast_hours=24&wind_speed_unit=kmh&timezone=UTC`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`open-meteo ${r.status}`);
      return r.json();
    });
    status.weather = 'live';
    res.json({ live: true, ...body });
  } catch (e) {
    status.weather = 'error';
    status.errors.weather = e.message;
    res.status(502).json({ live: false, error: e.message });
  }
});

app.get('/api/wind-grid', async (_req, res) => {
  try {
    const grid = await cached('wind-grid', 30 * 60_000, async () => {
      const lats = [], lons = [];
      for (let la = 35.5; la <= 44.5; la += 1) for (let lo = -10; lo <= 5; lo += 1) { lats.push(la); lons.push(lo); }
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(',')}&longitude=${lons.join(',')}&current=wind_speed_10m,wind_direction_10m,temperature_2m,relative_humidity_2m&wind_speed_unit=kmh`;
      const r = await fetch(url);
      if (!r.ok) throw new Error(`open-meteo ${r.status}`);
      const rows = await r.json();
      return rows.map((p) => ({ lat: p.latitude, lon: p.longitude, ...p.current }));
    });
    res.json({ live: true, grid });
  } catch (e) {
    res.json({ live: false, error: e.message, grid: [] });
  }
});

// Roads near a fire from OpenStreetMap: disk cache → static Catalonia network
// (instant; live query refreshes the cache in the background) → live Overpass.
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const inflight = new Map();

function liveRoads(lat, lon, r, disk) {
  if (inflight.has(disk)) return inflight.get(disk);
  const q = `[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary|secondary)$"](around:${r},${lat},${lon});out geom tags;`;
  const p = (async () => {
    let resp;
    for (const ep of OVERPASS) {
      resp = await fetch(ep, {
        method: 'POST',
        body: new URLSearchParams({ data: q }),
        headers: { 'User-Agent': 'FireGuard-hackathon/1.0' },
        signal: AbortSignal.timeout(60_000),
      }).catch(() => null);
      if (resp?.ok) break;
    }
    if (!resp?.ok) throw new Error(`overpass ${resp?.status ?? 'unreachable'}`);
    const body = await resp.json();
    const roads = body.elements.map((w) => ({
      ref: w.tags.ref || w.tags.name || 'road',
      kind: w.tags.highway,
      coords: w.geometry.map((g) => [+g.lon.toFixed(5), +g.lat.toFixed(5)]),
    }));
    fs.mkdirSync(path.dirname(disk), { recursive: true });
    fs.writeFileSync(disk, JSON.stringify(roads));
    return roads;
  })().finally(() => inflight.delete(disk));
  inflight.set(disk, p);
  return p;
}

app.get('/api/roads', async (req, res) => {
  const lat = (+req.query.lat).toFixed(2), lon = (+req.query.lon).toFixed(2);
  const r = Math.min(+req.query.r || 10000, 25000);
  const disk = path.join(ROOT, 'data', 'cache', 'roads', `roads_${lat}_${lon}_${r}.json`);
  if (fs.existsSync(disk)) return res.json({ live: true, cached: true, roads: JSON.parse(fs.readFileSync(disk, 'utf8')) });
  const fallback = staticRoadsNear(+lat, +lon, r);
  if (fallback.length) {
    liveRoads(lat, lon, r, disk).catch(() => {});
    return res.json({ live: false, fallback: true, roads: fallback });
  }
  try {
    res.json({ live: true, roads: await liveRoads(lat, lon, r, disk) });
  } catch (e) {
    res.json({ live: false, error: e.message, roads: [] });
  }
});

let staticRoads = null;
function staticRoadsNear(lat, lon, r) {
  const file = path.join(ROOT, 'data', 'roads', 'catalonia.json');
  if (!staticRoads) staticRoads = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  const dLat = r / 111_000, dLon = r / (111_000 * Math.cos((lat * Math.PI) / 180));
  return staticRoads.filter((w) => w.coords.some(([x, y]) => Math.abs(x - lon) < dLon && Math.abs(y - lat) < dLat));
}

if (process.env.NODE_ENV === 'production') {
  const dist = path.join(ROOT, 'web', 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`FireGuard API on :${PORT}  deepfire=${deepfireConfigured() ? 'configured' : 'demo'}  mtg=${mtgConfigured() ? 'configured' : 'demo'}`);
});
