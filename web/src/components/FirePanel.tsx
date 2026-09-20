import { selectFire } from '../lib/actions';
import { fmt } from '../lib/geo';
import { selectedAnalysis, selectedFire, useStore } from '../lib/store';
import { AssetList, DetectionBlock, RiskBlock, SpreadBlock, ValuesGrid, WeatherBlock } from './Blocks';
import { I } from './Icons';

export function FirePanel() {
  const fire = useStore(selectedFire);
  const a = useStore(selectedAnalysis);
  if (!fire) return null;
  return (
    <aside className="panel glass" key={fire.id} aria-label={`Fire ${fire.name}`}>
      <div className="panel-head">
        <div className="pill-row">
          <span className="badge fire">● ACTIVE FIRE</span>
          {fire.drill ? <span className="badge demo">SYNTHETIC DRILL</span> : fire.demo ? <span className="badge demo">DEMO DATA</span> : <span className="badge live">LIVE · DEEPFIRE</span>}
        </div>
        <h2>{fire.name}</h2>
        <div className="muted" style={{ fontSize: 12 }}>{fire.region} · <span className="mono">{fire.lat.toFixed(4)}, {fire.lon.toFixed(4)}</span></div>
        <div className="dim" style={{ fontSize: 11.5, marginTop: 2 }}>Detected {fmt.time(fire.detectedAt)} · last seen {fmt.ago(fire.lastSeen)}</div>
        <button className="close" onClick={() => selectFire(null)} aria-label="Close"><I.close /></button>
      </div>
      <div className="panel-body">
        {!a ? (
          <div className="section"><span className="spinner" /> <span className="muted" style={{ marginLeft: 8 }}>Running weather, spread and exposure models…</span></div>
        ) : (
          <>
            <div className="section fade-in"><h3>FireGuard risk</h3><RiskBlock a={a} /></div>
            <div className="section fade-in">
              <h3>Values at risk <span className="aside dim">3 h forecast · people within 500 m</span></h3>
              <ValuesGrid a={a} />
              <AssetList a={a} limit={6} />
            </div>
            <div className="section fade-in"><h3>Fire spread <span className="aside dim">Rothermel · Huygens (ELMFIRE workflow)</span></h3><SpreadBlock a={a} /></div>
            <div className="section fade-in">
              <h3>Weather <span className={`aside ${a.weather.live ? 'dim' : ''}`} style={{ color: a.weather.live ? undefined : 'var(--ember)' }}>{a.weather.live ? 'Live forecast' : fire.drill ? 'Drill scenario weather' : 'Fallback weather'}</span></h3>
              <WeatherBlock a={a} />
            </div>
          </>
        )}
        <div className="section"><h3>Detection</h3><DetectionBlock fire={fire} /></div>
        {a?.history && (
          <div className="section">
            <h3>Historical context · Catalonia</h3>
            <div className="grid2">
              <div className="stat"><div className="k">Fire-regime zone</div><div className="v">ZHR {a.history.zone.zhr}<small>danger {a.history.zone.danger}/5</small></div></div>
              <div className="stat"><div className="k">Past fires ≤ 10 km</div><div className="v">{a.history.firesWithin10km}<small>{fmt.ha(a.history.burnedHa)}</small></div></div>
            </div>
            {a.history.largest && <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>Largest nearby: <b style={{ color: 'var(--ink)', fontWeight: 500 }}>{a.history.largest.name}</b> ({a.history.largest.year}) · {fmt.ha(a.history.largest.ha)}</div>}
          </div>
        )}
      </div>
    </aside>
  );
}
