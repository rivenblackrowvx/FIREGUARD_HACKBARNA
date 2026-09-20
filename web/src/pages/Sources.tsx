import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { Sheet } from './Pages';

type Status = 'live' | 'demo' | 'fallback' | 'error' | 'static' | 'model' | 'pending';

function Tag({ s }: { s: Status }) {
  const map: Record<Status, [string, string]> = {
    live: ['live', 'LIVE'], demo: ['demo', 'DEMO'], fallback: ['demo', 'DEMO FALLBACK'], error: ['demo', 'ERROR · DEMO'], static: ['live', 'DOWNLOADED'], model: ['live', 'IN-APP MODEL'], pending: ['', '…'],
  };
  const [cls, label] = map[s];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function Sources() {
  const feeds = useStore((s) => s.feeds);
  const wxLive = useStore((s) => Object.values(s.analyses).some((a) => a.weather.live));
  const [status, setStatus] = useState<{ deepfire: string; mtg: string; errors: Record<string, string> } | null>(null);
  useEffect(() => { fetch('/api/status').then((r) => r.json()).then(setStatus).catch(() => {}); }, [feeds]);
  const err = (k: string) => status?.errors?.[k];

  return (
    <Sheet wide eyebrow="Data sources" title="Where every number comes from" sub="FireGuard labels each layer as LIVE, DOWNLOADED, or DEMO. Credentials stay on the server.">
      <div className="src-grid">
        <div className="src">
          <h4>🛰 Deepfire Hotspots <Tag s={feeds.deepfire.live ? 'live' : status?.deepfire === 'error' ? 'error' : 'fallback'} /></h4>
          <p>Near-real-time satellite fire detections (VIIRS, MODIS, geostationary) over all of Spain, incl. Canary Islands. Active set plus the last 72 h, clustered into fires.</p>
          <code>api.deepfire.co/ogc/features/v1/collections/deepfire:hotspots</code>
          {!feeds.deepfire.live && <p style={{ color: 'var(--ember)' }}>{err('deepfire') ?? 'Set DEEPFIRE_CLIENT_ID and DEEPFIRE_CLIENT_SECRET in .env to go live.'}</p>}
        </div>
        <div className="src">
          <h4>🔥 LSA SAF · MTG Fire Radiative Power <Tag s={feeds.mtg.live ? 'live' : status?.mtg === 'error' ? 'error' : 'fallback'} /></h4>
          <p>MTG-FCI 10-minute FRP-Pixel product (LSA-509), 2026 archive. Geostationary cadence gives fire intensity and its temporal evolution between polar passes.</p>
          <code>datalsasaf.lsasvcs.ipma.pt/PRODUCTS/MTG/MTFRPPixel/NATIVE/2026/</code>
          {!feeds.mtg.live && <p style={{ color: 'var(--ember)' }}>{err('mtg') ?? 'Archive requires a free LSA SAF account: set LSASAF_USER / LSASAF_PASS, then npm run fetch:mtg.'}</p>}
        </div>
        <div className="src">
          <h4>📷 Pyronear PYRO-SDIS <Tag s="static" /></h4>
          <p>Wildfire smoke dataset from fixed lookout cameras (YOLO annotations). 72 frames from 12 cameras sampled for the camera wall.</p>
          <code>huggingface.co/datasets/pyronear/pyro-sdis</code>
          <p style={{ color: 'var(--ember)' }}>Smoke detections replay dataset annotations as a DEMO inference layer — no model runs in the browser.</p>
        </div>
        <div className="src">
          <h4>🌡 Weather <Tag s={wxLive ? 'live' : 'pending'} /></h4>
          <p>Temperature, humidity, 10 m wind, gusts and 24 h hourly forecast per fire, plus a Spain-wide wind field for the particle animation.</p>
          <p>WeatherNext 2 (Google DeepMind) is distributed through Earth Engine / BigQuery and needs a GCP project. FireGuard's weather adapter uses the same variables; until that project is connected it is served by <b>Open-Meteo</b>.</p>
          <code>deepmind.google/science/weathernext · api.open-meteo.com</code>
        </div>
        <div className="src">
          <h4>🔴 Fire spread · ELMFIRE workflow <Tag s="model" /></h4>
          <p>Reimplemented in the browser: Rothermel (1972) surface spread with Scott &amp; Burgan fuel models, Simard dead-fuel moisture, Anderson (1983) length-to-breadth, Huygens front propagation driven by hourly wind.</p>
          <ul><li>OBSERVED — satellite hotspot hull</li><li>MODELLED — +15 / +30 min</li><li>FORECAST — +1 h / +3 h</li></ul>
          <code>elmfire.io</code>
        </div>
        <div className="src">
          <h4>🗺 Generalitat de Catalunya · Interior <Tag s="static" /></h4>
          <p>Historical fire perimeters (1,097 fires, the Bombers fire search dataset) and homogeneous fire-regime zones (ZHR 2014, danger and exposure indices).</p>
          <code>interior.gencat.cat/ca/serveis/informacio-geografica/</code>
        </div>
        <div className="src">
          <h4>🏥 Values at risk · OpenStreetMap <Tag s="static" /></h4>
          <p>Spain-wide hospitals, schools, populated places with population, power substations and plants, water works. Major roads are queried live per fire via Overpass, with a pre-downloaded Catalonia network as instant fallback.</p>
          <code>overpass-api.de · © OpenStreetMap contributors</code>
        </div>
        <div className="src">
          <h4>📡 Ground sensors &amp; camera towers <Tag s="demo" /></h4>
          <p>Sensor ring and lookout tower positions are demo placements that show how IoT and camera confirmation plug into the pipeline.</p>
        </div>
      </div>
    </Sheet>
  );
}
