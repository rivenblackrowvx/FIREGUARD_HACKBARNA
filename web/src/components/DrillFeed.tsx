import { useEffect, useState } from 'react';
import { cameras, type CameraFrame } from '../lib/data';
import { nearestTower } from '../lib/network';
import { useStore } from '../lib/store';
import { DRILL_OFF } from '../lib/actions';

// Detection cards shown while the drill runs. In the hardware phase (Sant Cugat
// del Vallès) the ESP32 mesh alerts first and a drone verifies the signal before
// the standard satellite → camera → sensor pipeline takes over.
export function DrillFeed() {
  const step = useStore((s) => s.drill.step);
  const hw = useStore((s) => s.drill.hw);
  const fire = useStore((s) => s.fires.find((f) => f.drill));
  const [frame, setFrame] = useState<CameraFrame | null>(null);
  const off = DRILL_OFF[hw ? 'hw' : 'classic'];
  useEffect(() => {
    if (!fire?.smoke) return;
    cameras().then((cs) => setFrame(cs.flatMap((c) => c.frames).find((f) => f.file === fire.smoke!.frame) ?? null));
  }, [fire?.smoke]);
  if (!fire || step < 1 || step > off.sensor) return null;
  const tower = nearestTower([fire.lon, fire.lat]);
  return (
    <div className="drill-feed glass" key={step}>
      {hw && step === 1 && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--ok)' }}>📡</div>
          <div>
            <div className="eyebrow" style={{ color: 'var(--ok)' }}>ESP32 mesh · ground alert</div>
            <div className="df-t">Temperature anomaly — {fire.name.replace('DRILL · ', '')} / Collserola</div>
            <div className="mono muted" style={{ fontSize: 11.5 }}>T +14.2 °C · CO 38 ppm · RH 11% &nbsp; signal → FireGuard validated</div>
          </div>
        </div>
      )}
      {hw && step === 2 && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(124,196,255,0.12)', color: '#7cc4ff' }}>✈️</div>
          <div>
            <div className="eyebrow" style={{ color: '#7cc4ff' }}>Drone dispatched</div>
            <div className="df-t">DRONE-FG-01 · Collserola base → {fire.name.replace('DRILL · ', '')}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>Verifying the ESP32 signal is not a false positive.</div>
          </div>
        </div>
      )}
      {hw && step === 3 && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(124,196,255,0.12)', color: '#7cc4ff' }}>✈️</div>
          <div>
            <div className="eyebrow" style={{ color: '#7cc4ff' }}>Drone en route</div>
            <div className="df-t">Aerial approach — flyover in progress</div>
            <div className="muted" style={{ fontSize: 11.5 }}>RGB + thermal scan of the reported coordinate.</div>
          </div>
        </div>
      )}
      {hw && step === 4 && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--ok)' }}>✅</div>
          <div>
            <div className="eyebrow" style={{ color: 'var(--ok)' }}>Drone on station</div>
            <div className="df-t">Visual confirmation — not a false positive</div>
            <div className="muted" style={{ fontSize: 11.5 }}>Smoke plume + heat signature observed from the air. Escalating to the full pipeline.</div>
          </div>
        </div>
      )}
      {hw && step === 5 && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(159,243,255,0.12)', color: '#9ff3ff' }}>📶</div>
          <div>
            <div className="eyebrow" style={{ color: '#9ff3ff' }}>Drone → FireGuard · uplink</div>
            <div className="df-t">Aerial signal transmitted — verification complete</div>
            <div className="muted" style={{ fontSize: 11.5 }}>Telemetry + vision analysis sent. Incident promoted to satellite / camera confirmation.</div>
          </div>
        </div>
      )}
      {step === off.sat && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(255,209,102,0.12)', color: '#ffd166' }}>🛰</div>
          <div>
            <div className="eyebrow" style={{ color: '#ffd166' }}>Satellite detection</div>
            <div className="df-t">MTG-FCI geostationary hotspot · 40 MW</div>
            <div className="muted" style={{ fontSize: 11.5 }}>10-min FRP pixel over {fire.name.replace('DRILL · ', '')} · polar pass (VIIRS) scheduled in 2 min</div>
          </div>
        </div>
      )}
      {step === off.smoke && (
        <div className="df-row" style={{ alignItems: 'stretch' }}>
          {frame && (
            <div className="cam-img" style={{ width: 240, flex: 'none', borderRadius: 10 }}>
              <img src={`/data/cameras/${frame.file}`} alt="Smoke detection frame" />
              <div className="scan" />
              {frame.boxes.map(([x, y, w, h], i) => (
                <div key={i} className="box" style={{ left: `${(x - w / 2) * 100}%`, top: `${(y - h / 2) * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }}><span>SMOKE 91%</span></div>
              ))}
            </div>
          )}
          <div>
            <div className="eyebrow" style={{ color: 'var(--sky)' }}>AI smoke detection</div>
            <div className="df-t">Camera {tower.id} · {tower.name}</div>
            <div className="muted" style={{ fontSize: 11.5 }}>Smoke plume, confidence 91%. Bearing cross-checked with drone + satellite hotspot.</div>
            <div className="pill-row" style={{ marginTop: 8 }}><span className="badge demo">DEMO INFERENCE · PYRO-SDIS FRAME</span></div>
          </div>
        </div>
      )}
      {step === off.sensor && (
        <div className="df-row">
          <div className="df-ico" style={{ background: 'rgba(52,211,153,0.12)', color: 'var(--ok)' }}>📡</div>
          <div>
            <div className="eyebrow" style={{ color: 'var(--ok)' }}>Ground sensor confirmation</div>
            <div className="df-t">3 of 7 sensors in alarm</div>
            <div className="mono muted" style={{ fontSize: 11.5 }}>S-1 +14.2 °C · CO 38 ppm · RH 11% &nbsp; S-2 +9.8 °C · CO 21 ppm</div>
          </div>
        </div>
      )}
    </div>
  );
}