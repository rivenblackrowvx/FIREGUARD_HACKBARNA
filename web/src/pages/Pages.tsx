import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DRILL_HW_STEPS, DRILL_OFF, DRILL_STEPS, resetDrill, runDrill, setFuel } from '../lib/actions';
import { compass } from '../lib/geo';
import { fetchRoads, osm } from '../lib/data';
import { FUELS, deadFuelMoisture } from '../lib/spread';
import { selectedAnalysis, selectedFire, setState, useStore } from '../lib/store';
import type { Asset } from '../lib/types';
import { AssetList, KIND_COLOR, RiskBlock, SpreadBlock, ValuesGrid, WeatherBlock, WhyList, WindArrow } from '../components/Blocks';
import { FireList, LayerToggles } from '../components/Shell';
import { HistoryPlayer } from '../components/HistoryPlayer';

export function Sheet({ eyebrow, title, sub, children, wide }: { eyebrow: string; title: string; sub?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section className={`sheet glass${wide ? ' wide' : ''}`}>
      <div className="sheet-head"><div className="eyebrow">{eyebrow}</div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      <div className="sheet-body">{children}</div>
    </section>
  );
}

function NeedFire({ what }: { what: string }) {
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>Select a fire to see its {what}.</p>
      <FireList compact />
    </>
  );
}

export function CommandCenter() {
  return (
    <Sheet eyebrow="Command center" title="Situation" sub="Every fire, ranked by FireGuard risk. Click one to open its intelligence panel.">
      <FireList />
      <div style={{ marginTop: 22 }}><HistoryPlayer /></div>
      <div style={{ marginTop: 22 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Map layers</div>
        <LayerToggles />
      </div>
    </Sheet>
  );
}

export function Fires() {
  const fires = useStore((s) => s.fires);
  const feeds = useStore((s) => s.feeds);
  return (
    <Sheet eyebrow="Fires" title={`${fires.length} active fires`} sub={<>Hotspots clustered into fires · source: {feeds.deepfire.source}</>}>
      <FireList />
    </Sheet>
  );
}

export function SpreadPage() {
  const fire = useStore(selectedFire);
  const a = useStore(selectedAnalysis);
  const fuelId = useStore((s) => s.fuelId);
  return (
    <Sheet eyebrow="Spread" title="Fire spread forecast" sub="Rothermel surface spread → wind-driven ellipses → Huygens front propagation, following the ELMFIRE modelling workflow.">
      {!fire || !a ? <NeedFire what="spread forecast" /> : (
        <>
          <div className="eyebrow" style={{ marginBottom: 8 }}>{fire.name}</div>
          <SpreadBlock a={a} />
          <div style={{ marginTop: 20 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Fuel model</div>
            <div style={{ display: 'grid', gap: 4 }}>
              {FUELS.map((f) => (
                <button key={f.id} className={`fire-row${f.id === fuelId ? ' on' : ''}`} style={{ gridTemplateColumns: '1fr', padding: '8px 10px' }} onClick={() => setFuel(f.id)}>
                  <span style={{ fontSize: 12 }}>{f.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="legend" style={{ marginTop: 20 }}>
            <div className="row"><span className="sw" style={{ background: 'rgba(255,59,31,0.6)', border: '1.5px solid #ff4b2b' }} /><span><b>OBSERVED</b> — satellite detections, buffered by pixel size</span></div>
            <div className="row"><span className="sw" style={{ background: 'rgba(255,106,31,0.2)', border: '1.5px solid #ff7a2f' }} /><span><b>MODELLED</b> — +15 / +30 min under current weather</span></div>
            <div className="row"><span className="sw" style={{ background: 'rgba(255,154,60,0.09)', border: '1.5px dashed #ffb05c' }} /><span><b>FORECAST</b> — +1 h / +3 h driven by hourly wind forecast</span></div>
          </div>
          <p className="dim" style={{ fontSize: 11.5, marginTop: 18 }}>
            Dead fuel moisture {(a.spread.moisture * 100).toFixed(1)}% (Simard EMC). Length-to-breadth {a.spread.lb.toFixed(1)} (Anderson 1983). Terrain and fuel heterogeneity approximated with a smooth stochastic field — no DEM or fuel raster is loaded.
          </p>
        </>
      )}
    </Sheet>
  );
}

export function RiskPage() {
  const fire = useStore(selectedFire);
  const a = useStore(selectedAnalysis);
  return (
    <Sheet eyebrow="Risk" title="FireGuard risk score" sub="0–100, combining intensity, wind, dryness, population, infrastructure, proximity, spread and history.">
      {fire && a ? (
        <>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{fire.name}</div>
          <RiskBlock a={a} />
          <div className="eyebrow" style={{ marginTop: 22 }}>Why the risk is {a.risk.level.toLowerCase()}</div>
          <WhyList a={a} limit={5} />
          <div style={{ height: 22 }} />
        </>
      ) : null}
      <div className="eyebrow" style={{ marginBottom: 6 }}>All fires</div>
      <FireList compact />
      <div className="eyebrow" style={{ marginTop: 22, marginBottom: 8 }}>Weights</div>
      <div className="legend">
        {[['Intensity (FRP)', 16], ['Wind & gusts', 15], ['Dryness (fuel moisture)', 15], ['Population exposed', 14], ['Infrastructure', 12], ['Spread (3 h area)', 12], ['Proximity to towns', 10], ['Historical fire regime', 6]].map(([k, w]) => (
          <div className="row" key={k}><span className="mono" style={{ width: 30, color: 'var(--ink)' }}>{w}%</span><span>{k}</span></div>
        ))}
      </div>
    </Sheet>
  );
}

interface GridCell { lat: number; lon: number; wind_speed_10m: number; wind_direction_10m: number; temperature_2m: number; relative_humidity_2m: number }

export function WeatherPage() {
  const fire = useStore(selectedFire);
  const a = useStore(selectedAnalysis);
  const [grid, setGrid] = useState<GridCell[]>([]);
  useEffect(() => { fetch('/api/wind-grid').then((r) => r.json()).then((b) => setGrid(b.grid ?? [])).catch(() => {}); }, []);
  // Fire-weather index: hot + dry + windy (0–100), per grid cell.
  const ranked = useMemo(() => grid.map((c) => {
    const m = deadFuelMoisture(c.temperature_2m, c.relative_humidity_2m);
    const fwi = Math.round(100 * Math.min(1, 0.45 * Math.min(1, (0.16 - m) / 0.12) + 0.35 * Math.min(1, c.wind_speed_10m / 40) + 0.2 * Math.min(1, Math.max(0, c.temperature_2m - 15) / 20)));
    return { ...c, fwi, m };
  }).sort((x, y) => y.fwi - x.fwi), [grid]);
  const [names, setNames] = useState<Record<string, string>>({});
  useEffect(() => {
    osm.places().then((rows) => {
      const big = rows.filter((r) => Number(r[3]) >= 10000);
      const out: Record<string, string> = {};
      for (const c of grid) {
        let best = '', bd = 0.6;
        for (const r of big) { const d = Math.hypot(r[0] - c.lon, r[1] - c.lat); if (d < bd) { bd = d; best = r[2]; } }
        out[`${c.lat},${c.lon}`] = best;
      }
      setNames(out);
    });
  }, [grid]);
  const place = (c: GridCell) => names[`${c.lat},${c.lon}`] ? `Near ${names[`${c.lat},${c.lon}`]}` : `${c.lat.toFixed(1)}°N ${Math.abs(c.lon).toFixed(1)}°${c.lon < 0 ? 'W' : 'E'}`;
  return (
    <Sheet eyebrow="Weather" title="Fire weather" sub="Temperature, humidity and wind drive fuel moisture, spread and risk. Wind particles on the map show the live 10 m wind field.">
      {fire && a && (
        <div style={{ marginBottom: 24 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>{fire.name}</div>
          <WeatherBlock a={a} />
        </div>
      )}
      <div className="eyebrow" style={{ marginBottom: 8 }}>Worst fire-weather across Spain now</div>
      {!ranked.length ? <div className="empty"><span className="spinner" /> Loading wind field…</div> : (
        <div style={{ display: 'grid', gap: 2 }}>
          {ranked.slice(0, 10).map((c) => (
            <button key={`${c.lat},${c.lon}`} className="fire-row" style={{ gridTemplateColumns: '38px 1fr auto' }} onClick={() => setState({ flyTo: { center: [c.lon, c.lat], zoom: 7.5, at: Date.now() } })}>
              <span className="mono" style={{ fontSize: 16, color: c.fwi > 60 ? 'var(--high)' : c.fwi > 40 ? 'var(--moderate)' : 'var(--ink-2)' }}>{c.fwi}</span>
              <span><div style={{ fontSize: 12 }}>{place(c)}</div><div className="meta">{Math.round(c.temperature_2m)}°C · {Math.round(c.relative_humidity_2m)}% RH · fuel {(c.m * 100).toFixed(0)}%</div></span>
              <span className="mono" style={{ fontSize: 12 }}><WindArrow dir={c.wind_direction_10m} /> {Math.round(c.wind_speed_10m)} km/h {compass(c.wind_direction_10m)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="dim" style={{ fontSize: 11.5, marginTop: 16 }}>Fire-weather index here is FireGuard's own 0–100 blend of fuel dryness (45%), wind (35%) and heat (20%).</p>
    </Sheet>
  );
}

export function ValuesPage() {
  const fire = useStore(selectedFire);
  const a = useStore(selectedAnalysis);
  const [kind, setKind] = useState<Asset['kind'] | 'all'>('all');
  return (
    <Sheet eyebrow="Values at risk" title="What could be affected" sub="Assets inside or within 1 km of the forecast perimeters, with ETA, distance and downwind exposure.">
      {!fire || !a ? <NeedFire what="values at risk" /> : (
        <>
          <div className="eyebrow" style={{ marginBottom: 10 }}>{fire.name}</div>
          <ValuesGrid a={a} />
          <div className="seg" style={{ marginTop: 16 }}>
            {(['all', 'place', 'hospital', 'school', 'infrastructure'] as const).map((k) => (
              <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>
                {k !== 'all' && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: 3, background: KIND_COLOR[k], marginRight: 5 }} />}
                {k === 'all' ? 'All' : k === 'place' ? 'Towns' : k === 'infrastructure' ? 'Critical' : `${k[0].toUpperCase()}${k.slice(1)}s`}
              </button>
            ))}
          </div>
          <AssetList a={a} limit={40} kinds={kind === 'all' ? undefined : [kind]} />
          {a.roads.some((r) => r.etaMin != null) && (
            <>
              <div className="eyebrow" style={{ marginTop: 18, marginBottom: 6 }}>Roads cut by forecast</div>
              {[...new Map(a.roads.filter((r) => r.etaMin != null).map((r) => [r.ref, r])).values()].sort((x, y) => x.etaMin! - y.etaMin!).map((r) => (
                <div className="asset" key={r.ref}><span className="sw" style={{ background: '#ffb347' }} /><span>{r.ref} <span className="sub">· {r.kind}</span></span><span className="eta">ETA {r.etaMin} min</span></div>
              ))}
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

export function Simulation() {
  const drill = useStore((s) => s.drill);
  const a = useStore((s) => s.analyses.drill);
  const [liveWx, setLiveWx] = useState(false);
  // Warm the server's Overpass cache so roads are ready when the drill runs.
  useEffect(() => { fetchRoads(drill.point[1], drill.point[0], undefined, 60_000); }, [drill.point]);
  const off = DRILL_OFF[drill.hw ? 'hw' : 'classic'];
  const steps = drill.hw ? DRILL_HW_STEPS : DRILL_STEPS;
  const running = drill.step >= 0 && drill.step < off.done;
  return (
    <Sheet eyebrow="Simulation" title="Live fire drill" sub="Injects a synthetic fire and runs the full pipeline: detect → confirm → predict → protect. Click the map to choose the ignition point.">
      {drill.hw && <div className="badge live" style={{ marginBottom: 10 }}>HARDWARE PHASE · ESP32 MESH + DRONE VERIFICATION</div>}
      <div className="stat" style={{ marginBottom: 14 }}>
        <div className="k">Ignition point</div>
        <div className="v" style={{ fontSize: 13 }}>{drill.point[1].toFixed(4)}, {drill.point[0].toFixed(4)}</div>
      </div>
      <div className="seg" style={{ marginBottom: 14 }}>
        <button className={!liveWx ? 'on' : ''} onClick={() => setLiveWx(false)}>Worst case · mistral</button>
        <button className={liveWx ? 'on' : ''} onClick={() => setLiveWx(true)}>Live weather</button>
      </div>
      <button className="btn primary big" onClick={() => runDrill(undefined, liveWx)} disabled={running}>
        {running ? <><span className="spinner" /> DRILL RUNNING</> : drill.step === off.done ? 'RUN AGAIN' : '▶  START LIVE FIRE DRILL'}
      </button>
      <div className="steps">
        {steps.map((label, i) => {
          const idx = i === steps.length - 1 ? off.done : i;
          const state = drill.step > idx || drill.step === off.done ? 'done' : drill.step === idx ? 'active' : '';
          return (
            <div key={label} className={`step ${state}`}>
              <span className="n">{state === 'done' ? '✓' : i + 1}</span>
              <span>{label}</span>
              {state === 'active' && <span className="spinner" />}
            </div>
          );
        })}
      </div>
      {a && drill.step >= off.risk && (
        <div className="fade-in">
          <RiskBlock a={a} />
          {drill.step >= off.values && <div style={{ marginTop: 16 }}><ValuesGrid a={a} /></div>}
        </div>
      )}
      {drill.step >= 0 && <button className="btn" style={{ marginTop: 16, width: '100%' }} onClick={resetDrill}>End drill</button>}
      <p className="dim" style={{ fontSize: 11.5, marginTop: 16 }}>All drill detections are synthetic and labelled DRILL. Smoke frame from the Pyronear PYRO-SDIS dataset; sensors and camera positions are demo placements.</p>
    </Sheet>
  );
}
