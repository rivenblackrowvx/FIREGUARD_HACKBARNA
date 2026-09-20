import { useEffect, useRef, useState } from 'react';
import { gencat } from '../lib/data';
import { fmt } from '../lib/geo';
import { setState, useStore } from '../lib/store';
import { I } from './Icons';

// Animated replay of Catalonia's historical fire perimeters (Gencat, 1970–2015).
export function HistoryPlayer() {
  const year = useStore((s) => s.historyYear);
  const on = useStore((s) => s.layers.history);
  const [stats, setStats] = useState<Map<number, { n: number; ha: number }>>(new Map());
  const timer = useRef<number>(0);
  useEffect(() => {
    gencat.perimeters().then((fc) => {
      const m = new Map<number, { n: number; ha: number }>();
      for (const f of fc.features) {
        const y = f.properties!.year as number;
        const v = m.get(y) ?? { n: 0, ha: 0 };
        m.set(y, { n: v.n + 1, ha: v.ha + (f.properties!.ha as number) });
      }
      setStats(m);
    });
    return () => clearInterval(timer.current);
  }, []);

  const play = () => {
    clearInterval(timer.current);
    let y = 1970;
    setState((s) => ({ layers: { ...s.layers, history: true, zones: false }, historyYear: y, flyTo: { center: [1.55, 41.75], zoom: 7.4, at: Date.now() } }));
    timer.current = window.setInterval(() => {
      y += 1;
      setState({ historyYear: y });
      if (y >= 2015) clearInterval(timer.current);
    }, 380);
  };

  const years = [...stats.keys()].filter((y) => y >= 1970).sort();
  const max = Math.max(1, ...years.map((y) => stats.get(y)!.ha));
  const cur = year ?? 2015;
  const burned = years.filter((y) => y <= cur).reduce((a, y) => a + stats.get(y)!.ha, 0);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div className="eyebrow">Catalonia fire history</div>
        <button className="play" style={{ marginLeft: 'auto' }} onClick={play}><I.play width={10} height={10} /> PLAY 1970 → 2015</button>
      </div>
      {on && (
        <div className="fade-in" style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: 26, color: 'var(--fire-2)' }}>{cur}</span>
          <span className="muted" style={{ fontSize: 12 }}>{fmt.int(burned)} ha burned since 1970</span>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 36 }} role="img" aria-label="Hectares burned per year in Catalonia">
        {years.map((y) => (
          <button key={y} title={`${y} · ${fmt.int(stats.get(y)!.ha)} ha · ${stats.get(y)!.n} fires`}
            onClick={() => setState((s) => ({ layers: { ...s.layers, history: true }, historyYear: y }))}
            style={{ flex: 1, height: `${Math.max(4, (Math.sqrt(stats.get(y)!.ha) / Math.sqrt(max)) * 100)}%`, borderRadius: '2px 2px 0 0',
              background: on && y <= cur ? (y === cur ? '#ffb347' : '#e0401a') : 'rgba(255,255,255,0.12)', transition: 'background 0.3s' }} />
        ))}
      </div>
      <div className="mono dim" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginTop: 4 }}><span>1970</span><span>√ ha / year</span><span>2015</span></div>
    </div>
  );
}
