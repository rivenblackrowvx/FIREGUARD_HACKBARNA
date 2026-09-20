import { useEffect, useRef } from 'react';
import { playTimeline } from '../lib/actions';
import { fmt } from '../lib/geo';
import { selectedAnalysis, selectedFire, useStore } from '../lib/store';
import { EVENT_COLOR, EVENT_ICON, I } from './Icons';

// The Fire Intelligence Timeline: DETECT → CONFIRM → PREDICT → PROTECT.
export function Timeline() {
  const fire = useStore(selectedFire);
  const a = useStore(selectedAnalysis);
  const cursor = useStore((s) => s.timelineCursor);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current?.children[Math.max(0, cursor - 1)] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [cursor]);

  if (!fire || !a) return null;
  const shown = Math.min(cursor, a.timeline.length);
  return (
    <section className="timeline glass" aria-label="Fire intelligence timeline">
      <div className="timeline-head">
        <span className="eyebrow">Fire intelligence timeline</span>
        <span className="dim" style={{ fontSize: 11 }}>DETECT → CONFIRM → PREDICT → PROTECT</span>
        <button className="play" style={{ marginLeft: 'auto' }} onClick={playTimeline}><I.play width={10} height={10} /> REPLAY ON MAP</button>
      </div>
      <div className="tl-track" ref={track}>
        {a.timeline.map((ev, i) => (
          <div key={i} className={`tl-ev${i < shown ? ' on' : ''}${i === shown - 1 ? ' last' : ''}`} style={{ '--c': EVENT_COLOR[ev.kind] } as React.CSSProperties}>
            <span className="node" />
            <div className="when">{fmt.time(ev.t)}</div>
            <div className="what"><span className="ico">{EVENT_ICON[ev.kind]}</span>{ev.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
