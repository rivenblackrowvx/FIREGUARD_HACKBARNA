import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { selectFire } from '../lib/actions';
import { fmt } from '../lib/geo';
import { setState, useStore, type LayerKey } from '../lib/store';
import type { Fire } from '../lib/types';
import { LEVEL_COLOR, MiniGauge } from './Gauge';
import { I } from './Icons';

const NAV = [
  { to: '/', label: 'COMMAND CENTER', icon: I.command },
  { to: '/fires', label: 'FIRES', icon: I.fire, count: true },
  { to: '/spread', label: 'SPREAD', icon: I.spread },
  { to: '/risk', label: 'RISK', icon: I.risk },
  { to: '/cameras', label: 'CAMERAS', icon: I.camera },
  { to: '/weather', label: 'WEATHER', icon: I.weather },
  { to: '/values', label: 'VALUES AT RISK', icon: I.shield },
  { to: '/sources', label: 'DATA SOURCES', icon: I.data },
];

const HW_NAV = [
  { to: '/hardware/network', label: 'Sensor Network' },
  { to: '/hardware/components', label: 'Hardware Components' },
  { to: '/hardware/software', label: 'Software Stack' },
  { to: '/hardware/drone', label: 'Drone Verification' },
  { to: '/hardware/live', label: 'Live Signals' },
];

function HardwareNav() {
  const { pathname } = useLocation();
  const open = pathname.startsWith('/hardware');
  return (
    <>
      <NavLink to="/hardware" className={open ? 'active' : ''}>
        <I.hardware />HARDWARE &amp; VERIFICATION
      </NavLink>
      {open && (
        <div className="hw-subnav">
          {HW_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={pathname === n.to ? 'active' : ''}>
              <span className="hw-subnav-arrow">▾</span>{n.label}
            </NavLink>
          ))}
        </div>
      )}
    </>
  );
}

export function Rail() {
  const fires = useStore((s) => s.fires.length);
  const feeds = useStore((s) => s.feeds);
  const wx = useStore((s) => Object.values(s.analyses).some((a) => a.weather.live));
  const Feed = ({ name, live }: { name: string; live: boolean }) => (
    <div className="feed"><span className={`dot ${live ? 'live' : 'demo'}`} />{name}<span className={`tag ${live ? 'live' : 'demo'}`}>{live ? 'LIVE' : 'DEMO'}</span></div>
  );
  return (
    <nav className="rail glass" aria-label="Main">
      <div className="brand">
        <div className="brand-mark"><I.fire width={14} height={14} color="#fff" /></div>
        <div><div className="brand-name">FIREGUARD</div><div className="brand-sub">WILDFIRE INTELLIGENCE</div></div>
      </div>
      <div className="nav">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'}>
            <n.icon />{n.label}{n.count && fires > 0 && <span className="count">{fires}</span>}
          </NavLink>
        ))}
        <HardwareNav />
        <NavLink to="/simulation" className="drill-link"><I.drill />LIVE FIRE DRILL</NavLink>
      </div>
      <div className="rail-foot">
        <div className="eyebrow" style={{ marginBottom: 2 }}>Feeds</div>
        <Feed name="Deepfire hotspots" live={feeds.deepfire.live} />
        <Feed name="MTG FRP · LSA SAF" live={feeds.mtg.live} />
        <Feed name="Weather" live={wx} />
        <Feed name="Smoke AI" live={false} />
      </div>
    </nav>
  );
}

export function useClock() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  return now;
}

export function Strip() {
  const fires = useStore((s) => s.fires);
  const analyses = useStore((s) => s.analyses);
  const hotspots = useStore((s) => s.hotspots);
  const now = useClock();
  const scored = fires.map((f) => analyses[f.id]?.risk).filter(Boolean);
  const high = scored.filter((r) => r!.level === 'HIGH' || r!.level === 'EXTREME').length;
  const top = Math.max(0, ...scored.map((r) => r!.score));
  const people = fires.reduce((a, f) => a + (analyses[f.id]?.exposure.people ?? 0), 0);
  const frp = fires.reduce((a, f) => a + f.frp, 0);
  return (
    <header className="strip">
      <div className="headline glass">
        <h1><b>{fires.length}</b> active fire{fires.length === 1 ? '' : 's'} in Spain{scored.length > 0 && <> · <b style={{ color: high ? 'var(--extreme)' : 'var(--ink)' }}>{high}</b> high risk</>}</h1>
        <span className="clock">{new Date(now).toISOString().slice(11, 19)} UTC</span>
      </div>
      <BasemapSwitch />
      <div className="kpis glass">
        <div className="kpi"><div className="eyebrow">Top risk</div><div className="v">{top || '—'}</div></div>
        <div className="kpi"><div className="eyebrow">Hotspots 72 h</div><div className="v">{fmt.int(hotspots.length)}</div></div>
        <div className="kpi"><div className="eyebrow">Total FRP</div><div className="v">{fmt.int(frp)}<small>MW</small></div></div>
        <div className="kpi"><div className="eyebrow">People exposed</div><div className="v">{fmt.int(people)}</div></div>
      </div>
    </header>
  );
}

function BasemapSwitch() {
  const basemap = useStore((s) => s.basemap);
  return (
    <div className="seg glass basemap" role="radiogroup" aria-label="Map style">
      {(['dark', 'satellite'] as const).map((m) => (
        <button key={m} role="radio" aria-checked={basemap === m} className={basemap === m ? 'on' : ''} onClick={() => setState({ basemap: m })}>
          {m === 'dark' ? 'Dark' : 'Satellite'}
        </button>
      ))}
    </div>
  );
}

export function FireList({ compact = false }: { compact?: boolean }) {
  const fires = useStore((s) => s.fires);
  const analyses = useStore((s) => s.analyses);
  const sel = useStore((s) => s.selectedId);
  const sorted = [...fires].sort((a, b) => (analyses[b.id]?.risk.score ?? -1) - (analyses[a.id]?.risk.score ?? -1));
  if (!fires.length) return <div className="empty">No active fires detected in Spain</div>;
  return (
    <div style={{ display: 'grid', gap: 2 }}>
      {sorted.map((f: Fire) => {
        const a = analyses[f.id];
        return (
          <button key={f.id} className={`fire-row${f.id === sel ? ' on' : ''}`} onClick={() => selectFire(f.id)}>
            <MiniGauge score={a?.risk.score} level={a?.risk.level} />
            <div style={{ minWidth: 0 }}>
              <div className="name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
              <div className="meta">{f.region}{!compact && ` · ${fmt.ago(f.detectedAt)}`}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="mono" style={{ fontSize: 12 }}>{fmt.int(f.frp)} <span className="dim">MW</span></div>
              {a && <div className="mono" style={{ fontSize: 10, color: LEVEL_COLOR[a.risk.level] }}>{a.risk.level}</div>}
            </div>
          </button>
        );
      })}
    </div>
  );
}

const LAYERS: [LayerKey, string, string][] = [
  ['hotspots', 'Satellite hotspots', '#ff8c2a'],
  ['mtg', 'MTG FRP (geostationary)', '#ffcf70'],
  ['spread', 'Fire spread forecast', '#ff5a1f'],
  ['wind', 'Wind', '#c7d2fe'],
  ['cameras', 'Smoke cameras', '#9fd4ff'],
  ['sensors', 'Ground sensors', '#34d399'],
  ['hospitals', 'Hospitals', '#ff4d6d'],
  ['schools', 'Schools', '#5cc8ff'],
  ['roads', 'Roads', '#ffb347'],
  ['infrastructure', 'Critical infrastructure', '#b58cff'],
  ['population', 'Population', '#7aa2ff'],
  ['history', 'Catalan fire history', '#b8431c'],
  ['zones', 'Catalan risk zones', '#6b2a12'],
  ['drones', 'Verification drones', '#7cc4ff'],
];

export function LayerToggles() {
  const layers = useStore((s) => s.layers);
  return (
    <div>
      {LAYERS.map(([k, label, color]) => (
        <button key={k} className="toggle-row" style={{ width: '100%' }} onClick={() => setState((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } }))} role="switch" aria-checked={layers[k]}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
          <span className={layers[k] ? '' : 'dim'}>{label}</span>
          <span className={`switch${layers[k] ? ' on' : ''}`} />
        </button>
      ))}
    </div>
  );
}

export function AlertBanner() {
  const alert = useStore((s) => s.alert);
  if (!alert) return null;
  return (
    <div className="alert" role="alert">
      <div className="icon"><I.alert color="#fff" /></div>
      <div><div className="t">{alert.title}</div><div className="b">{alert.body}</div></div>
      <button className="close" style={{ position: 'static' }} onClick={() => setState({ alert: null })} aria-label="Dismiss"><I.close /></button>
    </div>
  );
}

export function Loader() {
  const loading = useStore((s) => s.loading);
  const [gone, setGone] = useState(false);
  useEffect(() => { if (!loading) { const t = setTimeout(() => setGone(true), 900); return () => clearTimeout(t); } }, [loading]);
  if (gone) return null;
  return <div className={`loader${loading ? '' : ' gone'}`}><div className="word">FIREGUARD<i /></div></div>;
}

