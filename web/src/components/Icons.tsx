import type { SVGProps } from 'react';

const base = (d: React.ReactNode) => (p: SVGProps<SVGSVGElement>) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>{d}</svg>
);

export const I = {
  command: base(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /></>),
  fire: base(<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-6 0 2 1 3 2 3 0-3 0-6 1-8z" />),
  spread: base(<><path d="M4 18c2-6 6-10 16-12" /><path d="M4 18c4-2 9-3 13-2" strokeDasharray="2 3" /><circle cx="4" cy="18" r="1.6" /></>),
  risk: base(<><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-5" /><circle cx="12" cy="16" r="1" /></>),
  camera: base(<><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 11l5-3v8l-5-3" /></>),
  weather: base(<><path d="M3 8h11a3 3 0 1 0-3-3" /><path d="M3 12h15a3 3 0 1 1-3 3" /><path d="M3 16h7" /></>),
  shield: base(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>),
  drill: base(<><circle cx="12" cy="12" r="9" /><path d="M10 8l6 4-6 4z" fill="currentColor" /></>),
  data: base(<><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" /><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" /></>),
  close: base(<path d="M6 6l12 12M18 6L6 18" />),
  play: base(<path d="M8 5l11 7-11 7z" fill="currentColor" />),
  alert: base(<><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.5" /></>),
  wind: base(<><path d="M3 9h12a3 3 0 1 0-3-3" /><path d="M3 14h16a3 3 0 1 1-3 3" /></>),
  sat: base(<><path d="M7 7l3 3M4 10l3-3 3 3-3 3zM14 14l3 3M14 20l3-3 3 3-3 3z" /><path d="M10 10l4 4" /><path d="M15 5a4 4 0 0 1 4 4" /></>),
  layers: base(<><path d="M12 3l9 5-9 5-9-5z" /><path d="M3 13l9 5 9-5" /></>),
  history: base(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /><path d="M12 7v5l3 2" /></>),
  hardware: base(<><path d="M5 21h14" /><path d="M7 21v-5m10 5v-5" /><path d="M4.5 16h15l-2-4h-11z" /><path d="M9 9l1.5 3M12 5l.5 4M15 9l-1.5 3" /><path d="M3 7h18" /></>),
  sensor: base(<><circle cx="12" cy="5" r="1.5" /><path d="M12 5v16" /><path d="M8 10v8M16 10v8M12 21h8M12 21H4" /></>),
  drone: base(<><circle cx="12" cy="12" r="2.5" /><path d="M8 8l-3-2M16 8l3-2M8 16l-3 2M16 16l3 2" /><path d="M12 9.5v5M9.5 12h5" /></>),
  cpu: base(<><rect x="6" y="6" width="12" height="12" rx="2" /><rect x="10" y="10" width="4" height="4" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" /></>),
};

export const EVENT_ICON: Record<string, string> = {
  satellite: '🛰', smoke: '📷', sensor: '📡', confirmed: '🔥', wind: '💨', spread: '🔴', impact: '🏥', alert: '⚠️',
};
export const EVENT_COLOR: Record<string, string> = {
  satellite: '#ffd166', smoke: '#9fd4ff', sensor: '#34d399', confirmed: '#ff5a1f', wind: '#c7d2fe', spread: '#ff3b1f', impact: '#ff2d55', alert: '#ff2d2d',
};
