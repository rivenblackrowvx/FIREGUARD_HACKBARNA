import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  ACTIVE_SIGNALS, COMPONENTS, CORRELATION_HIGH, CORRELATION_LOW, DESIGN_PRINCIPLES, DRONES, DRONE_SOFTWARE,
  HARDWARE_SOFTWARE_FLOW, LIVE_EVENTS, NODE_SOFTWARE, SENSOR_NODES, SOFTWARE_STACK, SOFTWARE_SUMMARY,
  SOURCE_PIPELINE, UNCONFIRMED_TIMELINE, VERIFIED_TIMELINE,
} from '../lib/hardware';
import type { SensorNode } from '../lib/hardware';
import { setState, useStore } from '../lib/store';
import { Sheet } from './Pages';

const DOT = { ONLINE: '#34d399', WARNING: '#ffb347', OFFLINE: '#6b6b74' };

function Block({ title, sub, children, className = '' }: { title: string; sub?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`hw-block${className ? ` ${className}` : ''}`}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>{title}</div>
      {sub && <p className="dim" style={{ marginTop: 0, fontSize: 11.5 }}>{sub}</p>}
      {children}
    </div>
  );
}

function Card({ title, children, sub }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="hw-card">
      <div className="hw-card-head">{title}{sub && <span className="dim">{sub}</span>}</div>
      {children}
    </div>
  );
}

function Gauge({ value, color }: { value: number; color?: string }) {
  return (
    <svg className="gauge" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
      <circle cx="18" cy="18" r="15" fill="none" stroke={color ?? '#ff8a3d'} strokeWidth="4" strokeLinecap="round"
        strokeDasharray={`${(value / 100) * 94} 94`} transform="rotate(-90 18 18)" />
    </svg>
  );
}

// ——— #66 OVERVIEW ———
export function HardwareOverview() {
  const online = SENSOR_NODES.filter((n) => n.status === 'ONLINE').length;
  const warning = SENSOR_NODES.filter((n) => n.status === 'WARNING').length;
  const offline = SENSOR_NODES.filter((n) => n.status === 'OFFLINE').length;
  const dronesAvailable = DRONES.filter((d) => d.status === 'AVAILABLE').length;
  const dronesInFlight = DRONES.filter((d) => d.status === 'IN FLIGHT').length;
  const dronesMaint = DRONES.filter((d) => d.status === 'MAINTENANCE').length;
  return (
    <Sheet wide eyebrow="Hardware & verification" title="Hardware network"
      sub="Aerial + ground detection chain: cheap sensors detect early, FireGuard correlates the evidence, drones verify, the operator sees the complete chain.">
      <div className="hw-cards">
        <Card title="Hardware network" sub="36 sensor nodes">
          <div className="hw-grid3">
            <div className="stat"><div className="k">Total</div><div className="v">{SENSOR_NODES.length}<small>nodes</small></div></div>
            <div className="stat"><div className="k">Online</div><div className="v" style={{ color: online === 0 ? 'var(--red)' : 'var(--ok)' }}>{online}</div></div>
            <div className="stat"><div className="k">Warning</div><div className="v" style={{ color: 'var(--ember)' }}>{warning}</div></div>
            <div className="stat"><div className="k">Offline</div><div className="v">{offline}</div></div>
            <div className="stat"><div className="k">Firmware</div><div className="v" style={{ fontSize: 12 }}>v2.4.1</div></div>
            <div className="stat"><div className="k">Uplink</div><div className="v" style={{ fontSize: 12 }}>LoRa mesh</div></div>
          </div>
        </Card>
        <Card title="Drone verification" sub="Autonomous fleet">
          <div className="hw-grid3">
            <div className="stat"><div className="k">Available</div><div className="v" style={{ color: 'var(--ok)' }}>{dronesAvailable}</div></div>
            <div className="stat"><div className="k">In flight</div><div className="v" style={{ color: 'var(--fire-2)' }}>{dronesInFlight}</div></div>
            <div className="stat"><div className="k">Maintenance</div><div className="v">{dronesMaint}</div></div>
            <div className="stat"><div className="k">Visual verify</div><div className="v">92<small>%</small></div></div>
            <div className="stat"><div className="k">Thermal</div><div className="v" style={{ fontSize: 12 }}>available</div></div>
            <div className="stat"><div className="k">Link</div><div className="v" style={{ fontSize: 12 }}>stable</div></div>
          </div>
        </Card>
        <Card title="Active signals" sub="Correlated episodes">
          <div className="hw-grid3">
            <div className="stat"><div className="k">Signals</div><div className="v">{ACTIVE_SIGNALS.length}</div></div>
            <div className="stat"><div className="k">Drone queued</div><div className="v">1</div></div>
            <div className="stat"><div className="k">Correlation</div><div className="v">94<small>%</small></div></div>
            <div className="stat"><div className="k">Verified fires</div><div className="v">2</div></div>
            <div className="stat"><div className="k">Unconfirmed</div><div className="v">1</div></div>
            <div className="stat"><div className="k">Window</div><div className="v" style={{ fontSize: 12 }}>72 h</div></div>
          </div>
        </Card>
        <Card title="Signal confidence" sub="Overall hardware readiness">
          <div className="hw-gauge-row">
            <div className="hw-gauge"><Gauge value={87} /><span>Hardware</span></div>
            <div className="hw-gauge"><Gauge value={71} color="#9fd4ff" /><span>Coverage</span></div>
            <div className="hw-gauge"><Gauge value={94} color="#34d399" /><span>Verification</span></div>
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Block title="Concept" sub="Early detection is the first line of defence — verification is the second.">
          <div className="hw-funnel">
            {['LOW-COST SENSOR', 'EARLY SIGNAL', 'FIREGUARD', 'SIGNAL CORRELATION', 'DRONE VERIFICATION', 'VISUAL CONFIRMATION', 'OPERATOR'].map((step, i) => (
              <div key={step} className="hw-funnel-step">
                <span className="n">{i + 1}</span><span>{step}</span>
                {i < 6 && <span className="arr">↓</span>}
              </div>
            ))}
          </div>
        </Block>
        <Block title="Final hardware experience" sub="The operator sees the complete physical detection chain at a glance.">
          <div className="hw-stack">
            <div className="sw-row">ESP32 SENSOR NETWORK <span className="mono dim">detects</span></div>
            <div className="sw-arrow">▲</div>
            <div className="sw-row">SENSOR CORRELATION <span className="mono dim">correlates</span></div>
            <div className="sw-arrow">▲</div>
            <div className="sw-row">FIREGUARD INTELLIGENCE <span className="mono dim">analyses</span></div>
            <div className="sw-arrow">▲</div>
            <div className="sw-row">DRONE VERIFICATION <span className="mono dim">verifies</span></div>
            <div className="sw-arrow">▲</div>
            <div className="sw-row strong">WILDFIRE <span className="mono dim">confirmed</span></div>
          </div>
        </Block>
      </div>

      <div className="hw-pipeline">
        <div className="eyebrow" style={{ marginBottom: 8 }}>Physics chain</div>
        <div className="hw-pipe">CHEAP SENSORS → CORRELATION → DRONE → OPERATOR</div>
      </div>
    </Sheet>
  );
}

// ——— #70/#71/#72 SENSOR NETWORK ———
function NodeCard({ node }: { node: SensorNode }) {
  const abnorm = (m: string) => node.anomaly === m;
  return (
    <button className="hw-node" onClick={() => setState({ flyTo: { center: node.lngLat, zoom: 10.5, at: Date.now() } })} title={`Focus ${node.region} on the map`}>
      <div className="hw-node-top">
        <span className="mono" style={{ fontSize: 11 }}>{node.id}</span>
        <span className="hw-dot" style={{ background: DOT[node.status] }}>{node.status}</span>
      </div>
      <div className="hw-node-region dim">{node.region}</div>
      <div className="hw-node-metrics">
        <div className={`hw-met${abnorm('TEMP') ? ' hot' : ''}`}><span className="k">TEMP</span><span className="v">{node.temp.toFixed(1)} °C</span>{abnorm('TEMP') && <span className="badge fire">↑ ABNORMAL</span>}</div>
        <div className={`hw-met${abnorm('HUMIDITY') ? ' low' : ''}`}><span className="k">HUMIDITY</span><span className="v">{node.humidity} %</span></div>
        <div className={`hw-met${node.smoke !== 'NORMAL' ? ' warn' : ''}`}><span className="k">SMOKE</span><span className="v" style={{ color: node.smoke !== 'NORMAL' ? 'var(--ember)' : 'var(--ok)' }}>{node.smoke}</span></div>
        <div className={`hw-met${abnorm('BATTERY') ? ' low' : ''}`}><span className="k">BATTERY</span><span className="v">{node.battery} %</span></div>
        <div className={`hw-met${node.status === 'OFFLINE' ? ' low' : ''}`}><span className="k">SIGNAL</span><span className="v">{node.signal} dBm</span></div>
        <div className={`hw-met${node.status === 'OFFLINE' ? ' low' : ''}`}><span className="k">LAST SIGNAL</span><span className="v">{node.status === 'OFFLINE' ? `${Math.round(node.lastSignal / 60)} min` : `${node.lastSignal}s ago`}</span></div>
      </div>
    </button>
  );
}

export function SensorNetwork() {
  const online = SENSOR_NODES.filter((n) => n.status === 'ONLINE').length;
  const warning = SENSOR_NODES.filter((n) => n.status === 'WARNING').length;
  const offline = SENSOR_NODES.filter((n) => n.status === 'OFFLINE').length;
  const [sel, setSel] = useState<SensorNode | null>(SENSOR_NODES.find((n) => n.id === 'ESP32-FG-021') ?? null);
  return (
    <Sheet wide eyebrow="Sensor network" title="Low-cost wild-fire sensor mesh"
      sub="ESP32 nodes across Spanish wildlands. Telemetry from ambient temperature, humidity, smoke/gas and particulate; correlation only happens in FireGuard.">
      <div className="hw-feeds">
        <span className="badge live">● {online} ONLINE</span>
        <span className="badge" style={{ color: 'var(--ember)', borderColor: 'rgba(255,179,71,0.3)' }}>● {warning} WARNING</span>
        <span className="badge">● {offline} OFFLINE</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <Block title="Sensor nodes" sub="Each node is a dedicated sensing unit with its own uplink. Abnormal measurements highlight only the relevant signal.">
          <div className="hw-nodes">{SENSOR_NODES.map((n) => <NodeCard key={n.id} node={n} />)}</div>
        </Block>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {sel && <SignalBlock node={sel} />}
          <Block title="Signal pipeline" sub="From raw telemetry to a verification decision.">
            <div className="hw-pipe-v">
              {SOURCE_PIPELINE.map((s, i) => (
                <div key={s} className="hw-pipe-v-step"><span className="n">{i + 1}</span><span>{s}</span>{i < SOURCE_PIPELINE.length - 1 && <i>↓</i>}</div>
              ))}
            </div>
          </Block>
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <Block title="Multi-signal correlation" sub="One reading is never treated as a fire by itself — the system correlates before declaring a possible fire.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {ACTIVE_SIGNALS.slice(0, 2).map((s) => (
              <div className="hw-sig" key={s.id}>
                <div className="hw-sig-head"><span className="mono">{s.nodeId}</span><span className={`badge ${s.state.includes('HIGH') ? 'fire' : s.state === 'PENDING' ? '' : 'demo'}`}>{s.state}</span></div>
                <div className="hw-sig-readings">
                  {s.readings.map((r) => (
                    <div className="hw-read" key={r.label}>
                      <span className="k">{r.label}</span>
                      <span className={`v ${r.state === 'DETECTED' || r.state === 'HIGH' ? 'up' : r.state === 'LOW' ? 'down' : 'none'}`}>{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="hw-sig-foot"><span className="dim">Confidence</span><b className="mono" style={{ color: s.confidence > 80 ? 'var(--ok)' : s.confidence > 40 ? 'var(--ember)' : 'var(--ink-3)' }}>{s.confidence}%</b></div>
              </div>
            ))}
          </div>
        </Block>
      </div>
    </Sheet>
  );
}

function SignalBlock({ node }: { node: SensorNode }) {
  const satellite = node.id === 'ESP32-FG-021';
  const high = node.status === 'WARNING' && satellite;
  return (
    <Block title="Signal correlation" sub={node.id}>
      <div className={`hw-sig ${high ? 'lit' : ''}`}>
        <div className="hw-sig-head"><span className="mono">{node.id}</span><span className={`badge ${high ? 'fire' : 'demo'}`}>{high ? 'HIGH-CONFIDENCE FIRE SIGNAL' : 'POSSIBLE FIRE'}</span></div>
        <div className="hw-sig-readings">
          <div className="hw-read"><span className="k">TEMPERATURE</span><span className="v up">↑ HIGH</span></div>
          <div className="hw-read"><span className="k">HUMIDITY</span><span className="v down">↓ LOW</span></div>
          <div className="hw-read"><span className="k">SMOKE</span><span className="v up">↑ {node.smoke}</span></div>
          <div className="hw-read"><span className="k">SATELLITE</span><span className={`v ${satellite ? 'up' : 'none'}`}>{satellite ? 'HOTSPOT DETECTED' : 'NO SIGNAL'}</span></div>
        </div>
        <div className="hw-sig-foot"><span className="dim">STATUS</span><b style={{ color: high ? 'var(--ok)' : 'var(--ember)' }}>{high ? 'HIGH-CONFIDENCE FIRE SIGNAL' : 'POSSIBLE FIRE'}</b></div>
      </div>
    </Block>
  );
}

// ——— #67/#68/#69/#82 COMPONENTS ———
export function HardwareComponents() {
  return (
    <Sheet wide eyebrow="Hardware components" title="Reference node design"
      sub="A low-cost ESP32 network built from widely available modules. Components are declared as generic interfaces so physical models can change without touching FireGuard.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Block title="Reference block diagram" sub="How a node is wired together.">
          <div className="hw-diagram">
            <div className="hw-diagram-mcu"><span>ESP32</span><i>MAIN CONTROLLER</i></div>
            <div className="hw-diagram-line" />
            <div className="hw-diagram-sensors">
              <div className="sw">TEMPERATURE<div className="dim">SENSOR</div></div>
              <div className="sw">HUMIDITY<div className="dim">SENSOR</div></div>
              <div className="sw">SMOKE / GAS<div className="dim">SENSOR</div></div>
            </div>
            <div className="hw-diagram-line" />
            <div className="hw-diagram-sensors">
              <div className="sw optional">PM2.5<div className="dim">OPTIONAL</div></div>
              <div className="sw optional">FLAME<div className="dim">OPTIONAL</div></div>
              <div className="sw optional">CO<div className="dim">OPTIONAL</div></div>
              <div className="sw optional">GPS<div className="dim">OPTIONAL</div></div>
            </div>
            <div className="hw-diagram-line" />
            <div className="hw-diagram-sensors">
              <div className="sw power">BATTERY<div className="dim">POWER</div></div>
              <div className="sw power">SOLAR<div className="dim">CHARGING</div></div>
              <div className="sw comms">RADIO<div className="dim">COMM</div></div>
            </div>
            <div className="hw-diagram-line" />
            <div className="hw-diagram-out">FIREGUARD SIGNAL →</div>
          </div>
          <div className="hw-photo">
            <img src="/data/IMGArduino.png" alt="ESP32 Arduino reference node" loading="lazy" />
            <p className="dim">Referencia: board compatible Arduino/ESP32 — el cerebro del nodo que agrega sensores y emite la señal.</p>
          </div>
        </Block>
        <Block title="Engineering priorities" sub="Designed for realistic wild-scale deployment.">
          <div className="hw-pills">{DESIGN_PRINCIPLES.map((p) => <span key={p} className="hw-pill">{p}</span>)}</div>
          <div className="hw-note">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Node software</div>
            <div className="hw-kv">{NODE_SOFTWARE.map(([k, v]) => <div key={k}><span className="k">{k}</span><span>{v}</span></div>)}</div>
          </div>
        </Block>
      </div>
      <Block title="Component library" sub="Each card lists role, signal type, power and comms. Interfaces stay generic — swap real models freely.">
        <div className="hw-comp-grid">
          {COMPONENTS.map((c) => (
            <div className="hw-comp" key={c.name}>
              <div className="hw-comp-top"><span className="mono" style={{ fontSize: 11 }}>{c.name}</span><span className={`badge ${c.status === 'ACTIVE' ? 'live' : ''}`}>{c.group}</span></div>
              <div className="hw-comp-row"><span className="k">ROLE</span><span>{c.role}</span></div>
              <div className="hw-comp-row"><span className="k">SIGNAL</span><span>{c.signal}</span></div>
              <div className="hw-comp-row"><span className="k">POWER</span><span>{c.power}</span></div>
              <div className="hw-comp-row"><span className="k">COMMUNICATION</span><span>{c.comm}</span></div>
              <div className="hw-comp-row"><span className="k">STATUS</span><b style={{ color: c.status === 'ACTIVE' ? 'var(--ok)' : 'var(--ember)' }}>{c.status}</b></div>
            </div>
          ))}
        </div>
      </Block>
    </Sheet>
  );
}

// ——— #79/#80/#81/#82/#83 SOFTWARE STACK ———
export function SoftwareStack() {
  return (
    <Sheet wide eyebrow="Software stack" title="A simple mental model of the system"
      sub="The point is to understand the whole architecture in seconds — no documentation required.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Block title="Architecture" sub="Top to bottom.">
          <div className="hw-arch">
            {SOFTWARE_STACK.map((l) => (
              <div key={l.name} className="hw-arch-box"><b>{l.name}</b><span className="dim">{l.rows}</span></div>
            ))}
          </div>
        </Block>
        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <Block title="Hardware → software relationship" sub="The clearest view of the whole concept.">
            <div className="hw-flow-rows">
              {HARDWARE_SOFTWARE_FLOW.map((s, i) => (
                <div key={s} className="hw-flow-row"><span className="n">{i + 1}</span><span>{s}</span>{i < HARDWARE_SOFTWARE_FLOW.length - 1 && <i className="dim">↓</i>}</div>
              ))}
            </div>
          </Block>
          <Block title="Drone software" sub="Not locked to any manufacturer.">
            <div className="hw-kv">{DRONE_SOFTWARE.map(([k, v]) => <div key={k}><span className="k">{k}</span><span>{v}</span></div>)}</div>
          </Block>
        </div>
      </div>
      <Block title="Technology summary" sub="No long paragraphs.">
        <div className="hw-software-grid">
          {SOFTWARE_SUMMARY.map(([k, v]) => (
            <div className="hw-software" key={k}><span className="k">{k}</span><span>{v}</span></div>
          ))}
        </div>
      </Block>
    </Sheet>
  );
}

// ——— #73–78, 83 DRONE VERIFICATION ———
export function DroneVerification() {
  const [droneId, setDroneId] = useState<string>('DRONE-FG-01');
  const drone = DRONES.find((d) => d.id === droneId) ?? DRONES[0];
  const inFlight = DRONES.filter((d) => d.status === 'IN FLIGHT').length;
  const available = DRONES.filter((d) => d.status === 'AVAILABLE').length;
  const maint = DRONES.filter((d) => d.status === 'MAINTENANCE').length;
  return (
    <Sheet wide eyebrow="Drone verification" title="Autonomous aerial confirmation"
      sub="Drones are not the primary detector — they add an independent visual confirmation layer between a FireGuard signal and the operator's decision.">
      <div className="hw-cards">
        <Card title="Fleet" sub="DRONE VERIFICATION">
          <div className="hw-grid3">
            <div className="stat"><div className="k">Available</div><div className="v" style={{ color: 'var(--ok)' }}>{available}</div></div>
            <div className="stat"><div className="k">In flight</div><div className="v" style={{ color: 'var(--fire-2)' }}>{inFlight}</div></div>
            <div className="stat"><div className="k">Verifying</div><div className="v">{inFlight}</div></div>
            <div className="stat"><div className="k">Maintenance</div><div className="v">{maint}</div></div>
            <div className="stat"><div className="k">Battery</div><div className="v">{Math.round(DRONES.reduce((a, d) => a + d.battery, 0) / DRONES.length)}<small>% avg</small></div></div>
            <div className="stat"><div className="k">Link</div><div className="v" style={{ fontSize: 12 }}>stable</div></div>
          </div>
        </Card>
        {drone && <DroneMissionCard drone={drone} />}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Block title="Visual verification" sub="RGB + thermal available; the screen labels whether a value is camera, thermal, AI or operator.">
          <div className="hw-feed">
            <div className="hw-feed-window"><div className="hw-feed-tag">REC ● DRONE FEED <b>LIVE</b></div><div className="hw-feed-skew" /><span className="hw-feed-txt">LIVE / RECENT AERIAL VIEW</span></div>
            <div className="hw-feed-labels">
              <div><span className="k">THERMAL</span><span className="badge live">AVAILABLE</span></div>
              <div><span className="k">SMOKE</span><span className="badge fire">DETECTED</span></div>
              <div><span className="k">HEAT SIGNATURE</span><span className="badge fire">DETECTED</span></div>
              <div><span className="k">VISUAL CONFIDENCE</span><b className="mono" style={{ color: 'var(--ok)' }}>{drone.verification?.confidence ?? 85}%</b></div>
            </div>
          </div>
          <div className="hw-photo">
            <img src="/data/IMGDron.png" alt="Drone FG-01 verification unit" loading="lazy" />
            <p className="dim">Referencia: dron autónomo de verificación — cámara RGB/térmica, vuelo autónomo y telemétrica a FireGuard.</p>
          </div>
          <p className="dim" style={{ fontSize: 11, marginTop: 10 }}>Sources: camera · thermal sensor · AI analysis · operator confirmation — never collapsed into one label.</p>
        </Block>
        <Block title="Signal correlation" sub="Why confidence changes.">
          <div className="hw-corr">
            <div className="hw-corr-head"><span className="k">HIGH</span><b className="badge fire">OVERALL: HIGH CONFIDENCE</b></div>
            {CORRELATION_HIGH.map((c) => <CorrBar key={c.label} label={c.label} value={c.value} />)}
            <div className="hw-corr-divider" />
            <div className="hw-corr-head"><span className="k">FALSE POSITIVE</span><b className="badge" style={{ borderColor: 'var(--line-2)' }}>OVERALL: LOW CONFIDENCE</b></div>
            {CORRELATION_LOW.map((c) => <CorrBar key={c.label} label={c.label} value={c.value} />)}
          </div>
        </Block>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <Block title="False-positive verification" sub="An unconfirmed event is not erased — it stays in the timeline with explicit status.">
          <div className="hw-timeline">
            {UNCONFIRMED_TIMELINE.map((e) => (
              <div key={e.time} className="hw-tl"><span className="mono">{e.time}</span><span className="ico">{e.icon}</span><span>{e.text}</span></div>
            ))}
            <div className="hw-tl status"><span /><span /><b className="badge" style={{ borderColor: 'var(--line-2)' }}>STATUS · UNCONFIRMED</b></div>
          </div>
        </Block>
        <Block title="Dispatch workflow" sub="Sensor detection → AI analysis → drone observation → operator confirmation.">
          <div className="hw-flow-rows">
            {['SENSOR ALERT', 'FIREGUARD ANALYSIS', 'POSSIBLE FIRE', 'DRONE DISPATCH', 'AERIAL OBSERVATION', 'VISUAL ANALYSIS', 'CONFIRMED / UNCONFIRMED', 'OPERATOR'].map((s, i) => (
              <div key={s} className="hw-flow-row"><span className="n">{i + 1}</span><span>{s}</span>{i < 7 && <i className="dim">↓</i>}</div>
            ))}
          </div>
        </Block>
      </div>
    </Sheet>
  );
}

function DroneMissionCard({ drone }: { drone: (typeof DRONES)[0] }) {
  const focus = () => setState({ flyTo: { center: drone.target?.lngLat ?? drone.lngLat, zoom: drone.target ? 11 : 9, at: Date.now() } });
  return (
    <Card title={`${drone.id} · ${drone.name}`} sub={drone.status}>
      <div className="hw-drone">
        <div className="hw-drone-stat"><span className="k">STATUS</span><b style={{ color: drone.status === 'IN FLIGHT' ? 'var(--fire-2)' : 'var(--ok)' }}>● {drone.status}</b></div>
        {drone.mission && <div className="hw-drone-stat"><span className="k">MISSION</span><span>{drone.mission}</span></div>}
        {drone.target && (
          <>
            <div className="hw-drone-stat"><span className="k">TARGET</span><button className="hw-link" onClick={focus}>{drone.target.id} · {drone.target.region}</button></div>
            <div className="hw-drone-stat"><span className="k">DISTANCE</span><span>{drone.target.distanceKm.toFixed(1)} km</span></div>
            <div className="hw-drone-stat"><span className="k">ETA</span><span className="mono">0{Math.floor(drone.target.etaSec / 60)}:{String(drone.target.etaSec % 60).padStart(2, '0')}</span></div>
          </>
        )}
        <div className="hw-drone-stat"><span className="k">BATTERY</span><span>{drone.battery} %</span></div>
        <div className="hw-drone-stat"><span className="k">LINK</span><span style={{ color: 'var(--ok)' }}>● {drone.link}</span></div>
        <button className="btn" style={{ width: '100%', marginTop: 10 }} onClick={focus}>FOCUS ON MAP</button>
      </div>
    </Card>
  );
}

function CorrBar({ label, value }: { label: string; value: number }) {
  const high = value > 75; const mid = value > 40; const col = high ? 'var(--ok)' : mid ? 'var(--ember)' : 'var(--ink-3)';
  return (
    <div className="hw-corr-bar"><span className="k" style={{ width: 118 }}>{label}</span><span className="track"><i style={{ width: `${value}%`, background: col }} /></span><b className="mono" style={{ color: col, width: 34, textAlign: 'right' }}>{String(value).padStart(2, '0')}</b></div>
  );
}

// ——— #85/#86/#88 LIVE SIGNALS ———
export function LiveSignals() {
  return (
    <Sheet wide eyebrow="Live signals" title="Hardware events in FireGuard"
      sub="Hardware events flow through the same notification system as every other detection. Every state is explicit: DETECTED ≠ CORRELATED ≠ VERIFIED ≠ CONFIRMED.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Block title="Live hardware events" sub="Global notifications.">
          <div className="hw-live">
            {LIVE_EVENTS.map((e) => (
              <div className="hw-live-row" key={e.time}>
                <span className="mono" style={{ fontSize: 11 }}>{e.time}</span>
                <span className={`hw-live-icon ${e.kind}`}>{e.kind === 'sensor' ? '📡' : e.kind === 'satellite' ? '🛰' : e.kind === 'drone' ? '✈' : '🚨'}</span>
                <span><b>{e.title}</b><div className="dim" style={{ fontSize: 11 }}>{e.body} · {e.region}</div></span>
              </div>
            ))}
          </div>
        </Block>
        <Block title="Incident timeline" sub="A complete chain of evidence for the last verified fire.">
          <div className="hw-tl-vertical">
            <div className="hw-tl-v-head"><span className="badge fire">FG-2026-0051</span><span className="badge live">VISUALLY VERIFIED</span></div>
            {VERIFIED_TIMELINE.map((e) => (
              <div className="hw-tl-v" key={e.time}><span className="mono">{e.time}</span><span className="ico">{e.icon}</span><span>{e.text}</span></div>
            ))}
          </div>
        </Block>
      </div>
      <Block title="Operational states" sub="Never collapsed into a single confirmed status — each stage is independent.">
        <div className="hw-states">
          <div className="hw-state detected"><span className="k">DETECTED</span><p>Hardware signal arrives</p></div>
          <span className="hw-state-arrow">→</span>
          <div className="hw-state correlated"><span className="k">CORRELATED</span><p>Multiple independent signals agree</p></div>
          <span className="hw-state-arrow">→</span>
          <div className="hw-state verified"><span className="k">VISUALLY VERIFIED</span><p>Drone observed the signature</p></div>
          <span className="hw-state-arrow">→</span>
          <div className="hw-state confirmed"><span className="k">OPERATOR CONFIRMED</span><p>Human makes the final decision</p></div>
        </div>
      </Block>
    </Sheet>
  );
}