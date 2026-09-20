import { useEffect, useState } from 'react';

export const LEVEL_COLOR: Record<string, string> = { LOW: '#e8c547', MODERATE: '#ff9f1c', HIGH: '#ff5a1f', EXTREME: '#ff2d2d' };

function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

// 270° arc gauge for the 0–100 FireGuard risk score.
export function RiskGauge({ score, level, size = 132 }: { score: number; level: string; size?: number }) {
  const v = useCountUp(score);
  const r = size / 2 - 9;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const color = LEVEL_COLOR[level] ?? '#ff5a1f';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Risk ${score} of 100, ${level}`}>
      <defs>
        <filter id="glow"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>
      <g transform={`rotate(135 ${size / 2} ${size / 2})`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(arc * v) / 100} ${c}`} strokeLinecap="round" filter="url(#glow)" opacity="0.6" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${(arc * v) / 100} ${c}`} strokeLinecap="round" />
      </g>
      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" fill="#f4f4f5" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize={size * 0.29} fontWeight="500" letterSpacing="-2">{v}</text>
      <text x="50%" y="68%" textAnchor="middle" fill={color} fontFamily="Inter, system-ui, sans-serif" fontSize="9.5" fontWeight="600" letterSpacing="2">{level}</text>
      <text x="50%" y="90%" textAnchor="middle" fill="#6b6b74" fontFamily="Inter, system-ui, sans-serif" fontSize="8.5" letterSpacing="1.5">RISK SCORE</text>
    </svg>
  );
}

export function MiniGauge({ score, level }: { score?: number; level?: string }) {
  const r = 16, c = 2 * Math.PI * r, arc = c * 0.75;
  const color = level ? LEVEL_COLOR[level] : '#3f3f46';
  return (
    <svg className="mini-gauge" viewBox="0 0 40 40" aria-label={score != null ? `Risk ${score}` : 'Analysing'}>
      <g transform="rotate(135 20 20)">
        <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" strokeDasharray={`${arc} ${c}`} strokeLinecap="round" />
        {score != null && <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${(arc * score) / 100} ${c}`} strokeLinecap="round" />}
      </g>
      <text x="50%" y="54%" textAnchor="middle" dominantBaseline="middle" fill="#f4f4f5" fontFamily="JetBrains Mono, ui-monospace, monospace" fontSize="11">{score ?? '·'}</text>
    </svg>
  );
}
