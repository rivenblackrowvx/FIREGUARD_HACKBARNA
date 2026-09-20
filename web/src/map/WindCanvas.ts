import type { Map as MLMap } from 'maplibre-gl';

export interface WindSample { lat: number; lon: number; wind_speed_10m: number; wind_direction_10m: number }

// Animated wind particles advected by an inverse-distance-weighted wind field.
export class WindCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: { x: number; y: number; age: number }[] = [];
  private raf = 0;
  private samples: WindSample[] = [];
  private local: { kmh: number; dir: number; center: [number, number] } | null = null;
  enabled = true;

  constructor(private map: MLMap) {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'wind-canvas';
    map.getCanvasContainer().appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    map.on('resize', () => this.resize());
    map.on('movestart', () => this.clear());
    this.loop();
  }

  setSamples(s: WindSample[]) { this.samples = s; }
  setLocal(l: { kmh: number; dir: number; center: [number, number] } | null) { this.local = l; }

  private resize() {
    const r = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = this.map.getContainer();
    this.canvas.width = w * r;
    this.canvas.height = h * r;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(r, 0, 0, r, 0, 0);
    const n = Math.round((w * h) / 2600);
    this.particles = Array.from({ length: n }, () => ({ x: Math.random() * w, y: Math.random() * h, age: Math.random() * 80 }));
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private windAt(x: number, y: number): [number, number] | null {
    const ll = this.map.unproject([x, y]);
    let u = 0, v = 0, wsum = 0;
    if (this.local && this.map.getZoom() > 8) {
      const s = this.local.kmh, d = (this.local.dir * Math.PI) / 180;
      return [-s * Math.sin(d), s * Math.cos(d)];
    }
    for (const p of this.samples) {
      const d2 = (p.lat - ll.lat) ** 2 + (p.lon - ll.lng) ** 2;
      if (d2 > 9) continue;
      const w = 1 / (d2 + 0.05);
      const dir = (p.wind_direction_10m * Math.PI) / 180;
      // direction is where wind comes FROM → particles move the opposite way
      u += -p.wind_speed_10m * Math.sin(dir) * w;
      v += p.wind_speed_10m * Math.cos(dir) * w;
      wsum += w;
    }
    return wsum ? [u / wsum, v / wsum] : null;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const { clientWidth: w, clientHeight: h } = this.map.getContainer();
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    if (!this.enabled || (!this.samples.length && !this.local)) return;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = 'rgba(210, 225, 255, 0.34)';
    ctx.beginPath();
    for (const p of this.particles) {
      const wv = this.windAt(p.x, p.y);
      if (!wv || p.age++ > 90) {
        p.x = Math.random() * w; p.y = Math.random() * h; p.age = 0;
        continue;
      }
      const k = 0.055;
      const nx = p.x + wv[0] * k, ny = p.y - wv[1] * k;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(nx, ny);
      p.x = nx; p.y = ny;
      if (p.x < 0 || p.y < 0 || p.x > w || p.y > h) { p.x = Math.random() * w; p.y = Math.random() * h; p.age = 0; }
    }
    ctx.stroke();
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    this.canvas.remove();
  }
}
