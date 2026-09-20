import { useRef, useState } from 'react';

interface Props {
  data: { t: number; v: number }[];
  height?: number;
  color?: string;
  unit: string;
  format?: (t: number) => string;
  label: string;
}

// Single-series area chart with a crosshair + tooltip.
export function AreaChart({ data, height = 84, color = '#ff7a2f', unit, format, label }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return <div className="empty">Not enough observations yet</div>;
  const W = 360, H = height, pad = { l: 2, r: 2, t: 8, b: 16 };
  const t0 = data[0].t, t1 = data[data.length - 1].t;
  const vMax = Math.max(...data.map((d) => d.v)) * 1.12 || 1;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0 || 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - v / vMax) * (H - pad.t - pad.b);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(d.t).toFixed(1)},${y(d.v).toFixed(1)}`).join('');
  const area = `${line}L${x(t1)},${H - pad.b}L${x(t0)},${H - pad.b}Z`;
  const fmtT = format ?? ((t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
  const id = `g${label.replace(/\W/g, '')}`;

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const tx = t0 + ((e.clientX - r.left) / r.width) * (t1 - t0);
    let best = 0;
    data.forEach((d, i) => { if (Math.abs(d.t - tx) < Math.abs(data[best].t - tx)) best = i; });
    setHover(best);
  };
  const h = hover != null ? data[hover] : null;
  return (
    <div style={{ position: 'relative' }}>
      <svg ref={ref} className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={label}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1={0} x2={W} y1={H - pad.b} y2={H - pad.b} stroke="rgba(255,255,255,0.08)" />
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {h && <>
          <line x1={x(h.t)} x2={x(h.t)} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.25)" vectorEffect="non-scaling-stroke" />
          <circle cx={x(h.t)} cy={y(h.v)} r="4" fill={color} stroke="#0d0e11" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </>}
      </svg>
      <div className="mono dim" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, marginTop: -12 }}><span>{fmtT(t0)}</span><span>{fmtT(t1)}</span></div>
      {h && <div className="chart-tip" style={{ left: `${(x(h.t) / W) * 100}%`, top: (y(h.v) / H) * H }}>
        <span className="mono">{Math.round(h.v).toLocaleString('en-US')} {unit}</span> <span className="dim">· {fmtT(h.t)}</span>
      </div>}
    </div>
  );
}
