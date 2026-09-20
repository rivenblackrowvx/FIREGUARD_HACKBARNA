import { useEffect, useState } from 'react';
import { cameras, type Camera, type CameraFrame } from '../lib/data';
import { compass } from '../lib/geo';
import { TOWERS } from '../lib/network';
import { setState } from '../lib/store';
import { Sheet } from './Pages';

// Demo inference: the dataset's human smoke annotations are replayed as model
// output. Confidence is a deterministic function of box size, not a model score.
function detections(f: CameraFrame) {
  return f.boxes.map(([x, y, w, h]) => ({ x, y, w, h, conf: Math.min(0.97, 0.58 + Math.sqrt(w * h) * 3.2) }));
}

const FOV = 87; // degrees, typical Pyronear camera
const azimuth = (i: number) => (i * 67 + 140) % 360;

function CameraCard({ cam, index }: { cam: Camera; index: number }) {
  const [k, setK] = useState(() => cam.frames.findIndex((f) => f.boxes.length) >= 0 ? cam.frames.findIndex((f) => f.boxes.length) : 0);
  useEffect(() => {
    const t = setInterval(() => setK((v) => (v + 1) % cam.frames.length), 4200 + index * 150);
    return () => clearInterval(t);
  }, [cam.frames.length, index]);
  const frame = cam.frames[k];
  const dets = detections(frame);
  const best = dets.sort((a, b) => b.conf - a.conf)[0];
  const tower = TOWERS[index % TOWERS.length];
  const bearing = best ? (azimuth(index) + (best.x - 0.5) * FOV + 360) % 360 : null;
  return (
    <article className="cam">
      <div className="cam-img">
        <img src={`/data/cameras/${frame.file}`} alt={`Camera ${cam.camera} frame ${frame.date}`} loading="lazy" />
        <div className="scan" />
        {dets.map((d, i) => (
          <div key={`${k}-${i}`} className="box" style={{ left: `${(d.x - d.w / 2) * 100}%`, top: `${(d.y - d.h / 2) * 100}%`, width: `${d.w * 100}%`, height: `${d.h * 100}%` }}>
            <span>SMOKE {Math.round(d.conf * 100)}%</span>
          </div>
        ))}
        <div className="overlay"><span className="rec" /><span>{cam.camera.toUpperCase()}</span><span style={{ marginLeft: 'auto', opacity: 0.8 }}>{frame.date.replace('T', ' ').replace(/-(\d\d)-(\d\d)$/, ':$1:$2')}</span></div>
      </div>
      <div className="cam-meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {best ? <span className="badge fire">● SMOKE {Math.round(best.conf * 100)}%</span> : <span className="badge">CLEAR</span>}
          <span className="badge demo">DEMO INFERENCE</span>
          <span className="dim" style={{ marginLeft: 'auto', fontSize: 11 }}>{cam.partner}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          {best ? <>Possible fire at bearing <b className="mono">{Math.round(bearing!)}° {compass(bearing!)}</b> from <button style={{ textDecoration: 'underline', textUnderlineOffset: 3 }} onClick={() => setState({ flyTo: { center: tower.lngLat, zoom: 10, at: Date.now() } })}>{tower.name}</button></> : <span className="muted">No smoke in this frame · {tower.name}</span>}
        </div>
        <div>
          <div className="eyebrow" style={{ marginBottom: 4 }}>Detection history</div>
          <div className="cam-hist">
            {cam.frames.map((f, i) => <i key={i} className={`${f.boxes.length ? 'smoke' : ''}${i === k ? ' cur' : ''}`} onClick={() => setK(i)} title={f.date} />)}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Cameras() {
  const [list, setList] = useState<Camera[]>([]);
  useEffect(() => { cameras().then(setList); }, []);
  const smoke = list.reduce((a, c) => a + c.frames.filter((f) => f.boxes.length).length, 0);
  const total = list.reduce((a, c) => a + c.frames.length, 0);
  return (
    <Sheet wide eyebrow="Cameras" title="Smoke detection network"
      sub={<>Camera → AI smoke detection → confidence → possible fire location. {list.length} cameras · {smoke}/{total} frames with smoke. Imagery: Pyronear PYRO-SDIS (Hugging Face). Detections replay dataset annotations and are labelled DEMO; tower locations are demo placements.</>}>
      {!list.length ? <div className="empty">No camera frames found — run <code>scripts/fetch_pyro_sdis.py</code></div> : (
        <div className="cam-grid">{list.map((c, i) => <CameraCard key={c.camera} cam={c} index={i} />)}</div>
      )}
    </Sheet>
  );
}
