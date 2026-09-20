// Demo scenario used when live credentials are not configured. Every record
// produced here carries `demo: true` and the UI labels it DEMO.
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

// Ignition points in places with real wildfire history.
const SCENARIO = [
  { name: 'Sierra de la Culebra', region: 'Zamora', lat: 41.93, lon: -6.36, ageH: 30, frp: 420, drift: 60 },
  { name: 'Valdeorras', region: 'Ourense', lat: 42.39, lon: -7.02, ageH: 14, frp: 190, drift: 95 },
  { name: 'Ribera d\'Ebre', region: 'Tarragona', lat: 41.2, lon: 0.6, ageH: 7, frp: 260, drift: 130 },
  { name: 'Sierra Bermeja', region: 'Málaga', lat: 36.52, lon: -5.2, ageH: 20, frp: 150, drift: 20 },
  { name: 'Las Hurdes', region: 'Cáceres', lat: 40.39, lon: -6.24, ageH: 5, frp: 80, drift: 45 },
  { name: 'Bejís', region: 'Castellón', lat: 39.9, lon: -0.71, ageH: 3, frp: 55, drift: 110 },
  { name: 'Arafo', region: 'Tenerife', lat: 28.35, lon: -16.43, ageH: 11, frp: 120, drift: 250 },
  { name: 'Doñana', region: 'Huelva', lat: 37.13, lon: -6.55, ageH: 2, frp: 25, drift: 300 },
];

const SOURCES = ['VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'VIIRS_SNPP_NRT', 'MODIS_AQUA_NRT', 'MODIS_TERRA_NRT', 'MTG_FCI'];

export function demoHotspots(now = Date.now()) {
  const hour = Math.floor(now / 3600_000);
  const out = [];
  SCENARIO.forEach((f, i) => {
    const r = rng(i * 7919 + 13);
    const start = (hour - f.ageH) * 3600_000;
    const passes = Math.max(3, Math.round(f.ageH * 1.3));
    const rad = (f.drift * Math.PI) / 180;
    for (let p = 0; p < passes; p++) {
      const t = start + (p / (passes - 1)) * (now - start - 10 * 60_000);
      const k = p / (passes - 1);
      const reach = 0.004 + k * 0.016 * Math.sqrt(f.ageH / 10);
      const n = 2 + Math.round(k * 6 * r());
      for (let j = 0; j < n; j++) {
        const spread = reach * (0.3 + r());
        const jitter = (r() - 0.5) * 1.1;
        out.push({
          id: `demo.${i}.${p}.${j}`,
          lat: f.lat + Math.cos(rad + jitter) * spread * 0.75,
          lon: f.lon + Math.sin(rad + jitter) * spread,
          t: new Date(t).toISOString(),
          source: SOURCES[(p + j) % SOURCES.length],
          confidence: r() > 0.25 ? 'HIGH' : 'MEDIUM',
          frp: Math.round((f.frp / 3.5) * (0.25 + 0.9 * k) * (0.4 + r())),
          cluster: `demo-cluster-${i}`,
          active: true,
          name: f.name,
          region: f.region,
          demo: true,
        });
      }
    }
  });
  return out;
}

// Geostationary MTG FRP pixels every 10 minutes over the last 12 h.
export function demoMtg(now = Date.now()) {
  const slot = Math.floor(now / 600_000) * 600_000;
  const out = [];
  SCENARIO.forEach((f, i) => {
    const r = rng(i * 104729 + 7);
    for (let s = 72; s >= 0; s--) {
      const t = slot - s * 600_000;
      const age = (t - (now - f.ageH * 3600_000)) / 3600_000;
      if (age < 0) continue;
      const diurnal = 0.6 + 0.4 * Math.sin(((new Date(t).getUTCHours() - 9) / 24) * 2 * Math.PI);
      const frp = f.frp * Math.min(1, age / 4 + 0.15) * diurnal * (0.7 + 0.6 * r());
      out.push({
        lat: f.lat + (r() - 0.5) * 0.03,
        lon: f.lon + (r() - 0.5) * 0.03,
        frp: Math.round(frp * 10) / 10,
        frpUnc: Math.round(frp * 0.18 * 10) / 10,
        confidence: Math.round((0.7 + 0.3 * r()) * 100) / 100,
        t: new Date(t).toISOString(),
        demo: true,
      });
    }
  });
  return out;
}
