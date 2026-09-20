// LSA SAF — MTG Fire Radiative Power (MTFRPPixel, LSA-509) 2026 archive.
// https://datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MTG/MTFRPPixel/NATIVE/2026/
// Files are 10-minute CSV lists of fire pixels. Downloads need a free LSA SAF
// account (HTTP Basic auth): set LSASAF_USER / LSASAF_PASS.
//
//   node server/mtg.js --download [hours]   caches the latest N hours locally
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const BASE = 'https://datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MTG/MTFRPPixel/NATIVE';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = path.join(ROOT, 'data', 'cache', 'mtg');
const SPAIN = { w: -18.3, s: 27.5, e: 4.6, n: 43.9 };

export function mtgConfigured() {
  return Boolean(process.env.LSASAF_USER && process.env.LSASAF_PASS);
}

const pad = (n) => String(n).padStart(2, '0');
function fileFor(d) {
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}`;
  const dir = `${d.getUTCFullYear()}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
  return { name: `LSA-509_MTG_MTFRPPIXEL-ListProduct_MTG-FD_${stamp}.csv.gz`, dir };
}

async function download(d) {
  const { name, dir } = fileFor(d);
  const dst = path.join(CACHE, name);
  if (fs.existsSync(dst)) return dst;
  const auth = Buffer.from(`${process.env.LSASAF_USER}:${process.env.LSASAF_PASS}`).toString('base64');
  const res = await fetch(`${BASE}/${dir}/${name}`, { headers: { Authorization: `Basic ${auth}` } });
  if (res.status === 401) throw new Error('LSA SAF credentials rejected');
  if (!res.ok) return null;
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
  return dst;
}

// Every 30 min over the last `hours` (slots are published ~20 min late).
export async function syncLatest(hours = 12) {
  const now = Date.now() - 30 * 60_000;
  const slot = new Date(Math.floor(now / 600_000) * 600_000);
  const got = [];
  for (let i = 0; i < hours * 2; i++) {
    const d = new Date(slot.getTime() - i * 30 * 60_000);
    const f = await download(d).catch((e) => {
      if (e.message.includes('rejected')) throw e;
      return null;
    });
    if (f) got.push(f);
  }
  return got;
}

// Header names differ slightly between product versions; match loosely.
function parseCsv(text, stampFromName) {
  const lines = text.split(/\r?\n/).filter((l) => l && !l.startsWith('#'));
  const header = lines.shift().split(/[,;]/).map((h) => h.trim().toUpperCase());
  const col = (re) => header.findIndex((h) => re.test(h));
  const iLat = col(/^LAT/), iLon = col(/^LON/), iFrp = col(/^FRP$/), iConf = col(/CONF/);
  const iUnc = col(/FRP_UNC/), iTime = col(/TIME|DATE/);
  if (iLat < 0 || iLon < 0 || iFrp < 0) return [];
  const out = [];
  for (const line of lines) {
    const c = line.split(/[,;]/);
    const lat = +c[iLat], lon = +c[iLon];
    if (!(lat >= SPAIN.s && lat <= SPAIN.n && lon >= SPAIN.w && lon <= SPAIN.e)) continue;
    out.push({
      lat, lon, frp: +c[iFrp],
      frpUnc: iUnc >= 0 ? +c[iUnc] : null,
      confidence: iConf >= 0 ? +c[iConf] : null,
      t: iTime >= 0 && c[iTime] ? c[iTime] : stampFromName,
    });
  }
  return out;
}

export function readCached() {
  if (!fs.existsSync(CACHE)) return [];
  const files = fs.readdirSync(CACHE).filter((f) => f.endsWith('.csv.gz')).sort();
  return files.flatMap((f) => {
    const m = f.match(/_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\.csv\.gz$/);
    const stamp = m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00Z` : null;
    try {
      return parseCsv(zlib.gunzipSync(fs.readFileSync(path.join(CACHE, f))).toString(), stamp);
    } catch {
      return [];
    }
  });
}

if (process.argv.includes('--download')) {
  if (!mtgConfigured()) {
    console.error('Set LSASAF_USER and LSASAF_PASS in .env (free account at https://datalsasaf.lsasvcs.ipma.pt)');
    process.exit(1);
  }
  const hours = Number(process.argv[process.argv.indexOf('--download') + 1]) || 12;
  const files = await syncLatest(hours);
  console.log(`cached ${files.length} MTG FRP files → ${CACHE}; ${readCached().length} Spain fire pixels`);
}
