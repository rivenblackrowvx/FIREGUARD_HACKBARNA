import type { Analysis } from '../lib/analysis';
import { factorLevel } from '../lib/analysis';
import { compass, fmt } from '../lib/geo';
import { setState, useStore } from '../lib/store';
import type { Asset, Fire } from '../lib/types';
import { AreaChart } from './AreaChart';
import { RiskGauge } from './Gauge';

export const KIND_COLOR: Record<Asset['kind'], string> = {
  hospital: '#ff4d6d', school: '#5cc8ff', infrastructure: '#b58cff', place: '#7aa2ff', road: '#ffb347',
};
const KIND_LABEL: Record<Asset['kind'], string> = { hospital: 'Hospital', school: 'School', infrastructure: 'Critical asset', place: 'Town', road: 'Road' };

export function RiskBlock({ a }: { a: Analysis }) {
  return (
    <div className="risk">
      <RiskGauge score={a.risk.score} level={a.risk.level} />
      <div className="factors" aria-label="Why the risk is what it is">
        {a.risk.factors.map((f) => {
          const lvl = factorLevel(f.value);
          return (
            <div className="factor" key={f.key} title={f.detail}>
              <span className="muted">{f.label}</span>
              <span className="bar"><i className={`bg-${lvl}`} style={{ width: `${Math.max(3, f.value * 100)}%` }} /></span>
              <span className={`lvl lvl-${lvl}`}>{lvl}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WhyList({ a, limit = 4 }: { a: Analysis; limit?: number }) {
  const top = [...a.risk.factors].sort((x, y) => y.value - x.value).slice(0, limit);
  return (
    <div style={{ display: 'grid', gap: 6, marginTop: 14 }}>
      {top.map((f) => (
        <div key={f.key} style={{ display: 'flex', gap: 10, fontSize: 12 }}>
          <span className={`lvl-${factorLevel(f.value)} mono`} style={{ width: 16 }}>▲</span>
          <span><b style={{ fontWeight: 500 }}>{f.label}</b> <span className="muted">— {f.detail}</span></span>
        </div>
      ))}
    </div>
  );
}

export function ValuesGrid({ a }: { a: Analysis }) {
  const e = a.exposure;
  const cells: [number, string][] = [[e.people, 'people'], [e.schools, 'schools'], [e.hospitals, 'hospitals'], [e.roads, 'roads'], [e.critical, 'critical']];
  return (
    <div className="var-grid">
      {cells.map(([n, l]) => (
        <div key={l}><div className={`n${n > 0 ? ' hot' : ''}`}>{fmt.int(n)}</div><div className="l">{l}</div></div>
      ))}
    </div>
  );
}

export function AssetList({ a, limit = 8, kinds }: { a: Analysis; limit?: number; kinds?: Asset['kind'][] }) {
  const list = a.assets.filter((x) => (!kinds || kinds.includes(x.kind)) && (x.etaMin != null || x.kind !== 'place' || x.distanceKm < 8)).slice(0, limit);
  if (!list.length) return <div className="empty">No mapped assets within 20 km</div>;
  return (
    <div className="asset-list">
      {list.map((x, i) => (
        <button key={i} className="asset" onClick={() => setState({ flyTo: { center: [x.lon, x.lat], zoom: 13, at: Date.now() } })}>
          <span className="sw" style={{ background: KIND_COLOR[x.kind] }} />
          <span style={{ textAlign: 'left', minWidth: 0 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</div>
            <div className="sub">{KIND_LABEL[x.kind]}{x.population ? ` · ${fmt.int(x.population)} inhabitants` : ''}{x.sub ? ` · ${x.sub}` : ''} · {compass(x.bearing)}{x.downwind > 0.6 ? ' · downwind' : ''}</div>
          </span>
          {x.etaMin != null ? <span className="eta">ETA {x.etaMin} min</span> : <span className="far">{fmt.km(x.distanceKm)}</span>}
        </button>
      ))}
    </div>
  );
}

export function SpreadBlock({ a }: { a: Analysis }) {
  const horizon = useStore((s) => s.horizon);
  return (
    <>
      <div className="horizons">
        {a.spread.steps.map((st, i) => (
          <button key={st.minutes} className={`hz${i <= horizon ? ' on' : ''}`} onClick={() => setState({ horizon: i })}>
            <div className="t">{st.label}</div>
            <div className="a">{fmt.ha(st.areaHa)}</div>
          </button>
        ))}
      </div>
      <div className="pill-row" style={{ marginTop: 10 }}>
        <span className="badge OBSERVED">● OBSERVED</span>
        <span className="badge MODELLED">● MODELLED +15/30 min</span>
        <span className="badge FORECAST">○ FORECAST +1/3 h</span>
      </div>
      <div className="grid3" style={{ marginTop: 14 }}>
        <div className="stat"><div className="k">Head spread</div><div className="v">{a.spread.steps[1]?.headRosMpm.toFixed(0)}<small>m/min</small></div></div>
        <div className="stat"><div className="k">Heading</div><div className="v">{compass(a.spread.headingDeg)}<small>{Math.round(a.spread.headingDeg)}°</small></div></div>
        <div className="stat"><div className="k">Shape L:B</div><div className="v">{a.spread.lb.toFixed(1)}<small>: 1</small></div></div>
      </div>
    </>
  );
}

export function WeatherBlock({ a }: { a: Analysis }) {
  const w = a.weather;
  return (
    <>
      <div className="grid3">
        <div className="stat"><div className="k">Temperature</div><div className="v">{Math.round(w.temp)}<small>°C</small></div></div>
        <div className="stat"><div className="k">Humidity</div><div className="v">{Math.round(w.rh)}<small>%</small></div></div>
        <div className="stat"><div className="k">Fuel moisture</div><div className="v">{(a.spread.moisture * 100).toFixed(1)}<small>%</small></div></div>
        <div className="stat"><div className="k">Wind</div><div className="v">{Math.round(w.windKmh)}<small>km/h</small></div></div>
        <div className="stat"><div className="k">From</div><div className="v"><WindArrow dir={w.windDir} /> {compass(w.windDir)}</div></div>
        <div className="stat"><div className="k">Gusts</div><div className="v">{Math.round(w.gustKmh)}<small>km/h</small></div></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Wind speed · next 24 h</div>
        <AreaChart label="Wind speed forecast" unit="km/h" color="#9fd4ff" height={70}
          data={w.hourly.map((h) => ({ t: +new Date(h.t.endsWith('Z') ? h.t : `${h.t}Z`), v: h.windKmh }))} />
      </div>
    </>
  );
}

export function WindArrow({ dir, size = 14 }: { dir: number; size?: number }) {
  // Arrow points where the wind blows TO.
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${dir + 180}deg)`, verticalAlign: -2, transition: 'transform 1s' }} aria-hidden>
      <path d="M12 3v18M12 3l-5 6M12 3l5 6" stroke="#9fd4ff" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function DetectionBlock({ fire }: { fire: Fire }) {
  return (
    <>
      <div className="grid2">
        <div className="stat"><div className="k">Detected</div><div className="v">{fmt.time(fire.detectedAt)}<small>{fmt.ago(fire.detectedAt)}</small></div></div>
        <div className="stat"><div className="k">Confidence</div><div className="v">{Math.round(fire.confidence * 100)}<small>%</small></div></div>
        <div className="stat"><div className="k">Intensity (FRP)</div><div className="v">{fmt.int(fire.frp)}<small>MW</small></div></div>
        <div className="stat"><div className="k">Detections</div><div className="v">{fire.hotspots.length}<small>hotspots</small></div></div>
      </div>
      <div style={{ marginTop: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>Fire radiative power · evolution</div>
        <AreaChart label="Fire radiative power" unit="MW" data={fire.frpSeries.map((d) => ({ t: d.t, v: d.frp }))} />
      </div>
      <div className="pill-row" style={{ marginTop: 12 }}>
        {fire.sources.map((s) => <span key={s} className="badge">{s.replace(/_/g, ' ')}</span>)}
      </div>
    </>
  );
}
