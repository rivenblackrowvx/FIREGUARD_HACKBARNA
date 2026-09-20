# FireGuard — Wildfire Intelligence for Spain

A real-time wildfire command center: satellite hotspots, geostationary fire
radiative power, AI smoke detection, weather, fire-spread modelling and Catalan
wildfire history on one map.

**DETECT → CONFIRM → PREDICT → PROTECT**

## Run

```bash
npm install
cp .env.example .env        # add credentials (optional — demo data otherwise)
npm run dev                 # web on http://localhost:5173, API on :8787
```

Production: `npm run build && npm start` (serves `web/dist` + API on `$PORT`).

## Credentials (`.env`, server-side only)

| Variable | Source | Without it |
|---|---|---|
| `DEEPFIRE_CLIENT_ID`, `DEEPFIRE_CLIENT_SECRET` | app.deepfire.co → Settings → API clients | Demo hotspot scenario (labelled DEMO) |
| `LSASAF_USER`, `LSASAF_PASS` | free account at datalsasaf.lsasvcs.ipma.pt | Demo MTG FRP pixels (labelled DEMO) |

`npm run fetch:mtg -- 12` caches the latest 12 h of MTG FRP-Pixel files into `data/cache/mtg/`.

## Data sources

| Layer | Source | How it is used |
|---|---|---|
| Hotspots | Deepfire Hotspots API (OGC Features) | All Spain incl. Canaries, active + last 72 h, clustered into fires |
| Fire radiative power | LSA SAF MTG MTFRPPixel 2026 archive | 10-min FRP pixels, intensity + temporal evolution |
| Smoke | Pyronear PYRO-SDIS (Hugging Face) | 72 frames / 12 cameras; annotations replayed as **demo inference** |
| Weather | Open-Meteo (WeatherNext-shaped adapter) | T, RH, 10 m wind, gusts, 24 h hourly forecast, Spain wind field |
| Fire spread | ELMFIRE workflow, reimplemented | Rothermel ROS → Anderson L:B ellipse → Huygens front, hourly wind, urban non-fuel |
| Catalonia | Gencat Interior (pericat.kml, ZHR2014) | 1,097 historical perimeters, fire-regime danger zones, history replay |
| Values at risk | OpenStreetMap | Hospitals, schools, towns + population, substations/plants, roads |

WeatherNext 2 is distributed via Google Earth Engine / BigQuery and needs a GCP
project; until one is connected the same variables come from Open-Meteo.
Camera tower and ground-sensor positions are demo placements.

## Data preparation (already run; outputs in `web/public/data/`)

```bash
python3 -m venv .venv && .venv/bin/pip install pyshp pyproj shapely
.venv/bin/python scripts/prep_gencat.py      # needs data/raw/gencat/{pericat.kml,ZHR2014.zip}
.venv/bin/python scripts/fetch_osm.py        # hospitals, schools, places, infrastructure
.venv/bin/python scripts/fetch_pyro_sdis.py  # camera frames + smoke boxes
.venv/bin/python scripts/fetch_roads.py      # Catalonia roads fallback → data/roads/
```

## Models

- **Spread** (`web/src/lib/spread.ts`): Rothermel (1972) with Scott & Burgan fuels
  (SH5, GR2, TU5, TL8), Simard EMC dead-fuel moisture, Anderson (1983) length-to-breadth,
  Richards-style marker propagation. OBSERVED = hotspot hull; MODELLED = +15/+30 min;
  FORECAST = +1/+3 h on hourly forecast wind. Towns act as near non-burnable fuel.
- **Risk** (`web/src/lib/analysis.ts`): 0–100 weighted score — intensity 16, wind 15,
  dryness 15, population 14, infrastructure 12, spread 12, proximity 10, history 6.
- **Values at risk**: assets inside or within 1 km of each forecast perimeter get an ETA;
  people are counted on a 200 m grid within 500 m of the 3 h footprint.

## The demo

Open **LIVE FIRE DRILL**, click the map to choose an ignition point (default: Collserola),
and press start: synthetic ignition → MTG detection → smoke camera → sensor confirmation →
risk → spread → values at risk → alert. Everything in the drill is labelled synthetic.
