// Deepfire Hotspots API (OGC API Features). Credentials never leave the server.
// Docs: https://docs.deepfire.co/api/hotspots
const API = 'https://api.deepfire.co';

// Mainland + Balearics, and the Canary Islands.
export const SPAIN_BBOXES = [
  [-9.6, 35.8, 4.6, 43.9],
  [-18.3, 27.5, -13.3, 29.5],
];

let token = null;
let tokenExpiry = 0;
let cache = { at: 0, data: null };

export function deepfireConfigured() {
  return Boolean(process.env.DEEPFIRE_CLIENT_ID && process.env.DEEPFIRE_CLIENT_SECRET);
}

async function getToken() {
  if (token && Date.now() < tokenExpiry - 60_000) return token;
  const res = await fetch(`${API}/v1/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.DEEPFIRE_CLIENT_ID,
      client_secret: process.env.DEEPFIRE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`deepfire token ${res.status}: ${await res.text()}`);
  const body = await res.json();
  token = body.access_token;
  tokenExpiry = Date.now() + body.expires_in * 1000;
  return token;
}

async function items(bbox, filter) {
  const features = [];
  let url = new URL(`${API}/ogc/features/v1/collections/deepfire:hotspots/items`);
  url.search = new URLSearchParams({
    bbox: bbox.join(','),
    'filter-lang': 'cql2-text',
    filter,
    limit: '10000',
    f: 'application/geo+json',
  });
  const auth = { Authorization: `Bearer ${await getToken()}` };
  for (let page = 0; url && page < 10; page++) {
    const res = await fetch(url, { headers: auth });
    if (!res.ok) throw new Error(`deepfire hotspots ${res.status}: ${await res.text()}`);
    const body = await res.json();
    features.push(...body.features);
    const next = body.links?.find((l) => l.rel === 'next');
    url = next ? new URL(next.href) : null;
  }
  return features;
}

// Active hotspots plus the last 72 h, so fires carry their evolution.
export async function spainHotspots() {
  if (cache.data && Date.now() - cache.at < 5 * 60_000) return cache.data;
  const since = new Date(Date.now() - 72 * 3600_000).toISOString();
  const filter = `active = true OR observed_at >= TIMESTAMP('${since}')`;
  const all = (await Promise.all(SPAIN_BBOXES.map((b) => items(b, filter)))).flat();
  const hotspots = all
    .filter((f) => !f.properties.country || f.properties.country === 'ES')
    .map((f) => ({
      id: f.id,
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      t: f.properties.observed_at,
      source: f.properties.source,
      confidence: f.properties.confidence,
      frp: f.properties.fire_radiative_power,
      cluster: f.properties.cluster_id,
      active: f.properties.active,
    }));
  cache = { at: Date.now(), data: hotspots };
  return hotspots;
}
