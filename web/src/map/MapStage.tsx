import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useLocation } from 'react-router-dom';
import { gencat, osm } from '../lib/data';
import { circle, fmt } from '../lib/geo';
import { nearestTower, sensorsAround, TOWERS } from '../lib/network';
import { getState, setState, subscribe, type State } from '../lib/store';
import { DRILL_OFF, selectFire } from '../lib/actions';
import type { Fire, LngLat } from '../lib/types';
import { WindCanvas } from './WindCanvas';
import { SENSOR_NODES, DRONES } from '../lib/hardware';

if (import.meta.env.PROD) maplibregl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');

const STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const SPAIN: [LngLat, LngLat] = [[-10.2, 35.6], [5.2, 44.1]];
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const fc = (features: GeoJSON.Feature[]): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features });
const pt = (c: LngLat, properties: Record<string, unknown> = {}): GeoJSON.Feature => ({ type: 'Feature', geometry: { type: 'Point', coordinates: c }, properties });

const RISK_COLOR: Record<string, string> = { LOW: '#e8c547', MODERATE: '#ff9f1c', HIGH: '#ff5a1f', EXTREME: '#ff2d2d' };

// Esri World Imagery under the dark style's labels and borders.
function addSatellite(map: MLMap) {
  const baseIds = map.getStyle().layers.map((l) => l.id);
  map.addSource('satellite', {
    type: 'raster', tileSize: 256, maxzoom: 19,
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Imagery © Esri, Maxar, Earthstar Geographics',
  });
  const firstBase = map.getStyle().layers.find((l) => l.type !== 'background')?.id;
  map.addLayer({ id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' },
    paint: { 'raster-brightness-max': 0.72, 'raster-saturation': -0.25, 'raster-contrast': 0.08 } }, firstBase);
  // Base layers that would cover the imagery (land, water, roads, buildings).
  return baseIds.filter((id) => {
    const l = map.getLayer(id)!;
    return l.type === 'fill' || l.type === 'fill-extrusion' || (l.type === 'line' && !/boundary|admin/.test(id));
  });
}

function setBasemap(map: MLMap, covering: string[], mode: 'dark' | 'satellite') {
  const sat = mode === 'satellite';
  map.setLayoutProperty('satellite', 'visibility', sat ? 'visible' : 'none');
  for (const id of covering) map.setLayoutProperty(id, 'visibility', sat ? 'none' : 'visible');
  for (const l of map.getStyle().layers) {
    if (l.type !== 'symbol' || !l.id.startsWith('place')) continue;
    map.setPaintProperty(l.id, 'text-color', sat ? '#e4e4e7' : '#6b6f78');
    map.setPaintProperty(l.id, 'text-halo-color', sat ? 'rgba(0,0,0,0.75)' : '#000000');
  }
}

function tuneBasemap(map: MLMap) {
  for (const layer of map.getStyle().layers) {
    if (layer.type === 'background') map.setPaintProperty(layer.id, 'background-color', '#060607');
    if (layer.id.includes('water') && layer.type === 'fill') map.setPaintProperty(layer.id, 'fill-color', '#0b0d10');
    if (layer.type === 'symbol' && /poi|housenumber|road_label|highway/.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none');
    if (layer.type === 'symbol' && layer.id.startsWith('place')) map.setPaintProperty(layer.id, 'text-color', '#6b6f78');
  }
}

function addLayers(map: MLMap) {
  const src = (id: string) => map.addSource(id, { type: 'geojson', data: EMPTY });
  ['zones', 'history', 'population', 'osm-hospitals', 'osm-schools', 'osm-infra', 'roads', 'spread', 'mtg', 'hotspots',
    'assets', 'towers', 'cones', 'sensors', 'pulses', 'impact'].forEach(src);
  ['hw-sensors', 'hw-drones', 'hw-drone-path'].forEach(src);

  // Catalan fire-regime zones & historical perimeters
  map.addLayer({ id: 'zones-fill', type: 'fill', source: 'zones', paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'danger'], 0, '#1b1d22', 2, '#3a2418', 4, '#6b2a12', 5, '#8f2b0e'],
    'fill-opacity': 0.35 } });
  map.addLayer({ id: 'zones-line', type: 'line', source: 'zones', paint: { 'line-color': '#ffffff', 'line-opacity': 0.08, 'line-width': 0.6 } });
  map.addLayer({ id: 'history-fill', type: 'fill', source: 'history', paint: {
    'fill-color': ['interpolate', ['linear'], ['get', 'age'], 0, '#ff7a3d', 10, '#b8431c', 40, '#5a2412'],
    'fill-opacity': ['interpolate', ['linear'], ['get', 'age'], 0, 0.75, 5, 0.45, 40, 0.25] } });
  map.addLayer({ id: 'history-line', type: 'line', source: 'history', paint: { 'line-color': '#ff8a50', 'line-opacity': 0.35, 'line-width': 0.5 } });

  // Population (towns sized by inhabitants)
  map.addLayer({ id: 'population', type: 'circle', source: 'population', minzoom: 6, paint: {
    'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'pop']], 10, 1, 100, 3, 1000, 14],
    'circle-color': '#7aa2ff', 'circle-opacity': 0.08, 'circle-stroke-color': '#7aa2ff', 'circle-stroke-opacity': 0.25, 'circle-stroke-width': 0.5 } });

  // Roads near the selected fire
  map.addLayer({ id: 'roads', type: 'line', source: 'roads', paint: {
    'line-color': ['case', ['has', 'eta'], '#ffb347', '#8a8f99'],
    'line-width': ['case', ['has', 'eta'], 2.2, 1], 'line-opacity': ['case', ['has', 'eta'], 0.95, 0.35] } });

  // Fire spread: OBSERVED solid core, MODELLED solid edge, FORECAST dashed edge.
  map.addLayer({ id: 'spread-fill', type: 'fill', source: 'spread', paint: {
    'fill-color': ['match', ['get', 'prov'], 'OBSERVED', '#ff3b1f', 'MODELLED', '#ff6a1f', '#ff9a3c'],
    'fill-opacity': ['match', ['get', 'prov'], 'OBSERVED', 0.55, 'MODELLED', 0.2, 0.09] } });
  map.addLayer({ id: 'spread-line', type: 'line', source: 'spread', filter: ['!=', ['get', 'prov'], 'FORECAST'], paint: {
    'line-color': ['match', ['get', 'prov'], 'OBSERVED', '#ff4b2b', '#ff7a2f'], 'line-width': 1.6 } });
  map.addLayer({ id: 'spread-line-fc', type: 'line', source: 'spread', filter: ['==', ['get', 'prov'], 'FORECAST'], paint: {
    'line-color': '#ffb05c', 'line-width': 1.4, 'line-dasharray': [2, 2] } });
  map.addLayer({ id: 'spread-label', type: 'symbol', source: 'spread', filter: ['!=', ['get', 'prov'], 'OBSERVED'], layout: {
    'symbol-placement': 'line', 'text-field': ['get', 'label'], 'text-size': 10, 'text-font': ['Open Sans Semibold'], 'text-letter-spacing': 0.1 },
    paint: { 'text-color': '#ffd2a8', 'text-halo-color': '#060607', 'text-halo-width': 1.5 } });

  // Global OSM layers (only when zoomed in)
  map.addLayer({ id: 'osm-infra', type: 'circle', source: 'osm-infra', minzoom: 12, paint: {
    'circle-radius': 2.5, 'circle-color': '#b58cff', 'circle-opacity': 0.6 } });
  map.addLayer({ id: 'osm-schools', type: 'circle', source: 'osm-schools', minzoom: 12, paint: {
    'circle-radius': 2.5, 'circle-color': '#5cc8ff', 'circle-opacity': 0.6 } });
  map.addLayer({ id: 'osm-hospitals', type: 'circle', source: 'osm-hospitals', minzoom: 7, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2, 12, 4.5], 'circle-color': '#ffffff', 'circle-stroke-color': '#ff4d6d', 'circle-stroke-width': 1.5 } });

  // Satellite: MTG geostationary FRP pixels + polar-orbit hotspots
  map.addLayer({ id: 'mtg', type: 'circle', source: 'mtg', paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, ['*', 0.6, ['sqrt', ['get', 'frp']]], 10, ['*', 2.4, ['sqrt', ['get', 'frp']]]],
    'circle-color': '#ffcf70', 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 5, ['*', 0.25, ['get', 'recency']], 9, ['*', 0.07, ['get', 'recency']]], 'circle-blur': 0.6 } });
  map.addLayer({ id: 'hotspots-heat', type: 'heatmap', source: 'hotspots', maxzoom: 9, paint: {
    'heatmap-weight': ['interpolate', ['linear'], ['get', 'frp'], 0, 0.2, 200, 1],
    'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 9, 2],
    'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 14, 9, 30],
    'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,0,0)', 0.2, 'rgba(120,20,0,0.5)', 0.5, '#d9360f', 0.8, '#ff8c2a', 1, '#ffe6a0'],
    'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.9, 9, 0] } });
  map.addLayer({ id: 'hotspots', type: 'circle', source: 'hotspots', minzoom: 7, paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 7, 2, 13, 7],
    'circle-color': ['interpolate', ['linear'], ['get', 'ageH'], 0, '#fff2c2', 3, '#ff9a3c', 12, '#e0401a', 48, '#6e2210'],
    'circle-stroke-color': '#060607', 'circle-stroke-width': 1, 'circle-opacity': 0.95 } });

  // Values at risk for the selected fire
  map.addLayer({ id: 'assets-halo', type: 'circle', source: 'assets', filter: ['has', 'eta'], paint: {
    'circle-radius': 13, 'circle-color': '#ff2d55', 'circle-opacity': 0.18, 'circle-stroke-color': '#ff2d55', 'circle-stroke-width': 1, 'circle-stroke-opacity': 0.6 } });
  map.addLayer({ id: 'assets', type: 'circle', source: 'assets', paint: {
    'circle-radius': ['match', ['get', 'kind'], 'hospital', 6, 'place', 4, 4],
    'circle-color': ['match', ['get', 'kind'], 'hospital', '#ffffff', 'school', '#5cc8ff', 'infrastructure', '#b58cff', 'place', '#7aa2ff', '#fff'],
    'circle-stroke-color': ['match', ['get', 'kind'], 'hospital', '#ff4d6d', '#060607'], 'circle-stroke-width': 1.5 } });
  map.addLayer({ id: 'assets-label', type: 'symbol', source: 'assets', filter: ['all', ['has', 'eta'], ['in', ['get', 'kind'], ['literal', ['hospital', 'place']]]], layout: {
    'text-field': ['concat', ['get', 'name'], '\n', 'ETA ', ['to-string', ['get', 'eta']], ' min'], 'text-size': 10.5,
    'text-font': ['Open Sans Semibold'], 'text-offset': [0, 1.4], 'text-anchor': 'top', 'text-max-width': 12 },
    paint: { 'text-color': '#ffe3e8', 'text-halo-color': '#060607', 'text-halo-width': 1.4 } });

  // Detection network
  map.addLayer({ id: 'cones', type: 'fill', source: 'cones', paint: { 'fill-color': '#9fd4ff', 'fill-opacity': 0.12 } });
  map.addLayer({ id: 'cones-line', type: 'line', source: 'cones', paint: { 'line-color': '#9fd4ff', 'line-opacity': 0.5, 'line-width': 1 } });
  map.addLayer({ id: 'towers', type: 'circle', source: 'towers', minzoom: 5, paint: {
    'circle-radius': 4, 'circle-color': '#0c0f14', 'circle-stroke-color': ['case', ['get', 'active'], '#9fd4ff', '#56606e'], 'circle-stroke-width': 1.6 } });
  map.addLayer({ id: 'sensors', type: 'circle', source: 'sensors', paint: {
    'circle-radius': ['case', ['get', 'alarm'], 5, 3], 'circle-color': ['case', ['get', 'alarm'], '#ff4b2b', '#34d399'],
    'circle-stroke-color': '#060607', 'circle-stroke-width': 1 } });
  map.addLayer({ id: 'pulses', type: 'circle', source: 'pulses', paint: {
    'circle-radius': ['get', 'r'], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': ['get', 'color'],
    'circle-stroke-width': 1.5, 'circle-stroke-opacity': ['get', 'o'] } });

  // Hardware & verification: fixed ESP32 sensor mesh + drone positions + flight paths
  map.addLayer({ id: 'hw-drone-path', type: 'line', source: 'hw-drone-path', paint: {
    'line-color': '#7cc4ff', 'line-width': 1.4, 'line-dasharray': [2, 1.5], 'line-opacity': 0.55 } });
  map.addLayer({ id: 'hw-drones', type: 'circle', source: 'hw-drones', paint: {
    'circle-radius': ['case', ['get', 'flight'], 7, 5], 'circle-color': '#0b1c2b',
    'circle-stroke-color': ['case', ['get', 'flight'], '#7cc4ff', '#9fd4ff'], 'circle-stroke-width': 1.8 } });
  map.addLayer({ id: 'hw-drones-halo', type: 'circle', source: 'hw-drones', filter: ['==', ['get', 'flight'], 1], paint: {
    'circle-radius': 12, 'circle-color': '#7cc4ff', 'circle-opacity': 0.14 } });
  map.addLayer({ id: 'hw-sensors', type: 'circle', source: 'hw-sensors', paint: {
    'circle-radius': ['case', ['get', 'warning'], 4.5, 3], 'circle-color': ['match', ['get', 'status'], 'WARNING', '#ffb347', 'OFFLINE', '#6b6b74', '#34d399'],
    'circle-stroke-color': '#060607', 'circle-stroke-width': 1 } });
}

function fireMarker(fire: Fire, selected: boolean, level?: string) {
  const el = document.createElement('button');
  el.className = `fire-marker${selected ? ' selected' : ''}${fire.drill ? ' drill' : ''}`;
  const size = Math.max(14, Math.min(34, 8 + Math.sqrt(fire.frp) * 1.3));
  el.style.setProperty('--s', `${size}px`);
  el.style.setProperty('--c', level ? RISK_COLOR[level] : '#ff5a1f');
  el.innerHTML = `<span class="ring"></span><span class="ring r2"></span><span class="core"></span><span class="label">${fire.name}</span>`;
  el.setAttribute('aria-label', fire.name);
  el.onclick = (e) => { e.stopPropagation(); selectFire(fire.id); };
  return el;
}

export default function MapStage() {
  const ref = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const routeRef = useRef(location.pathname);
  routeRef.current = location.pathname;

  useEffect(() => {
    const map = new maplibregl.Map({
      container: ref.current!,
      style: STYLE,
      bounds: SPAIN,
      fitBoundsOptions: { padding: { top: 90, bottom: 40, left: 620, right: 40 } },
      attributionControl: { compact: true },
      maxPitch: 60,
    });
    (window as unknown as { __map: MLMap }).__map = map;
    const wind = new WindCanvas(map);
    const markers = new Map<string, maplibregl.Marker>();
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'fg-popup', offset: 10 });
    let ready = false;
    let covering: string[] = [];
    let pulseRaf = 0;

    const set = (id: string, data: GeoJSON.FeatureCollection) => (map.getSource(id) as GeoJSONSource | undefined)?.setData(data);

    const render = (s: State, prev?: State) => {
      if (!ready) return;
      const sel = s.fires.find((f) => f.id === s.selectedId) ?? null;
      const a = sel ? s.analyses[sel.id] : null;
      const drillFire = s.fires.find((f) => f.drill);
      const off = DRILL_OFF[s.drill.hw ? 'hw' : 'classic'];

      // Fire markers
      const want = new Set(s.fires.map((f) => f.id));
      for (const [id, m] of markers) if (!want.has(id)) { m.remove(); markers.delete(id); }
      for (const f of s.fires) {
        if (f.drill && s.drill.step < 1 && s.drill.step !== -1) continue;
        const level = s.analyses[f.id]?.risk.level;
        const key = `${f.id}|${f.id === s.selectedId}|${level}|${f.frp}`;
        const existing = markers.get(f.id);
        if (existing && (existing as unknown as { _k: string })._k === key) continue;
        existing?.remove();
        const m = new maplibregl.Marker({ element: fireMarker(f, f.id === s.selectedId, level) }).setLngLat([f.lon, f.lat]).addTo(map);
        (m as unknown as { _k: string })._k = key;
        markers.set(f.id, m);
      }

      if (!prev || prev.hotspots !== s.hotspots || prev.fires !== s.fires) {
        const now = Date.now();
        const hs = s.fires.flatMap((f) => f.hotspots.filter((h) => !f.drill || s.drill.step >= off.sat));
        set('hotspots', fc(hs.map((h) => pt([h.lon, h.lat], { frp: h.frp ?? 0, ageH: Math.max(0, (now - +new Date(h.t)) / 3600_000), src: h.source, conf: h.confidence, t: h.t }))));
      }
      if (!prev || prev.mtg !== s.mtg) {
        const latest = Math.max(0, ...s.mtg.map((p) => +new Date(p.t)));
        set('mtg', fc(s.mtg.map((p) => pt([p.lon, p.lat], { frp: p.frp, recency: Math.max(0.1, 1 - (latest - +new Date(p.t)) / (12 * 3600_000)) }))));
      }

      // Spread horizons up to the current animation cursor
      const steps = a && s.layers.spread ? a.spread.steps.filter((_, i) => i <= s.horizon) : [];
      set('spread', fc([...steps].reverse().map((st) => ({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [st.ring] }, properties: { prov: st.provenance, label: `${st.label} · ${st.provenance}` } }))));

      // Values at risk
      const showAssets = a && (s.drill.step === -1 || s.drill.step >= off.values || !sel?.drill);
      set('assets', fc(showAssets ? a!.assets.filter((x) => x.etaMin != null || x.kind === 'hospital').filter((x) => s.layers[x.kind === 'place' ? 'population' : x.kind === 'hospital' ? 'hospitals' : x.kind === 'school' ? 'schools' : 'infrastructure'])
        .slice(0, 400).map((x) => pt([x.lon, x.lat], { kind: x.kind, name: x.name, ...(x.etaMin != null ? { eta: x.etaMin } : {}), dist: x.distanceKm, pop: x.population ?? 0 })) : []));
      set('roads', fc(a && s.layers.roads ? a.roads.map((r) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: r.coords }, properties: { ref: r.ref, ...(r.etaMin != null ? { eta: r.etaMin } : {}) } })) : []));

      // Detection network: towers, camera view cones, sensors
      const smokeFire = drillFire && s.drill.step >= off.smoke ? drillFire : sel?.smoke ? sel : null;
      const smokeTower = smokeFire ? nearestTower([smokeFire.lon, smokeFire.lat]) : null;
      set('towers', fc(s.layers.cameras ? TOWERS.map((t) => pt(t.lngLat, { id: t.id, name: t.name, active: t.id === smokeTower?.id })) : []));
      if (smokeFire && smokeTower && s.layers.cameras) {
        const [tx, ty] = smokeTower.lngLat;
        const ang = Math.atan2(smokeFire.lat - ty, smokeFire.lon - tx);
        const dist = Math.hypot(smokeFire.lat - ty, smokeFire.lon - tx) * 1.25;
        const cone: LngLat[] = [[tx, ty], [tx + Math.cos(ang - 0.14) * dist, ty + Math.sin(ang - 0.14) * dist], [tx + Math.cos(ang + 0.14) * dist, ty + Math.sin(ang + 0.14) * dist], [tx, ty]];
        set('cones', fc([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [cone] }, properties: {} }]));
      } else set('cones', EMPTY);
      const sensorFire = drillFire ?? sel;
      set('sensors', fc(sensorFire && s.layers.sensors ? sensorsAround([sensorFire.lon, sensorFire.lat]).map((x, i) => pt(x.lngLat, { alarm: Boolean(drillFire) && s.drill.step >= off.sensor && i < 3 })) : []));

      // Fixed hardware sensor mesh + drone fleet (hardware & verification module).
      // During the hardware drill the verification drone is animated by the pulse
      // loop, so the static fleet sources are left untouched there.
      const showHw = s.layers.drones || s.layers.sensors;
      const drillDroneActive = s.drill.hw && s.drill.drone && s.drill.step >= 2;
      set('hw-sensors', fc(showHw ? SENSOR_NODES.map((n) => pt([n.lngLat[0], n.lngLat[1]], {
        id: n.id, region: n.region,
        status: s.drill.hw && s.drill.step === 1 && n.id === 'ESP32-FG-023' ? 'WARNING' : n.status,
        warning: n.status === 'WARNING' || n.status === 'OFFLINE' || (s.drill.hw && s.drill.step === 1 && n.id === 'ESP32-FG-023') ? 1 : 0,
      })) : []));
      if (!drillDroneActive) {
        set('hw-drones', fc(showHw ? DRONES.map((d) => pt([d.lngLat[0], d.lngLat[1]], { id: d.id, status: d.status, flight: d.status === 'IN FLIGHT' ? 1 : 0 })) : []));
        set('hw-drone-path', fc(showHw ? DRONES.filter((d) => d.path && d.status === 'IN FLIGHT').flatMap((d) => [{
          type: 'Feature', geometry: { type: 'LineString', coordinates: [d.path![0], d.path![1] ?? d.lngLat, d.path![2] ?? d.lngLat] }, properties: { id: d.id },
        }]) : []));
      }

      // Wind: local wind near the selected fire
      wind.enabled = s.layers.wind;
      wind.setLocal(a ? { kmh: a.weather.windKmh, dir: a.weather.windDir, center: [sel!.lon, sel!.lat] } : null);

      // Layer visibility
      const vis = (id: string, on: boolean) => map.getLayer(id) && map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none');
      vis('hotspots', s.layers.hotspots); vis('hotspots-heat', s.layers.hotspots);
      vis('mtg', s.layers.mtg);
      vis('osm-hospitals', s.layers.hospitals); vis('osm-schools', s.layers.schools); vis('osm-infra', s.layers.infrastructure);
      vis('population', s.layers.population);
      ['history-fill', 'history-line'].forEach((l) => vis(l, s.layers.history));
      ['zones-fill', 'zones-line'].forEach((l) => vis(l, s.layers.zones));
      vis('hw-sensors', s.layers.sensors);
      vis('hw-drones', s.layers.drones);
      vis('hw-drones-halo', s.layers.drones);
      vis('hw-drone-path', s.layers.drones);

      if (!prev || prev.basemap !== s.basemap) setBasemap(map, covering, s.basemap);

      if (!prev || prev.historyYear !== s.historyYear || prev.layers.history !== s.layers.history) updateHistory(s);

      if (s.flyTo && s.flyTo !== prev?.flyTo) {
        const right = s.selectedId ? 440 : 60;
        const full = routeRef.current === '/cameras' || routeRef.current === '/sources';
        map.flyTo({ center: s.flyTo.center, zoom: s.flyTo.zoom, speed: 1.1, curve: 1.5, padding: { left: full ? 260 : 620, right, top: 100, bottom: s.selectedId ? 200 : 40 }, essential: true });
      }
    };

    let perims: GeoJSON.FeatureCollection | null = null;
    const updateHistory = async (s: State) => {
      if (!s.layers.history) return set('history', EMPTY);
      perims ??= await gencat.perimeters();
      const year = s.historyYear ?? 9999;
      const top = Math.min(year, 2015);
      set('history', fc(perims.features.filter((f) => f.properties!.year <= year && f.properties!.year >= 1970)
        .map((f) => ({ ...f, properties: { ...f.properties, age: top - f.properties!.year } }))));
    };

    // Pulsing rings for drill steps / timeline events
    const pulse = () => {
      pulseRaf = requestAnimationFrame(pulse);
      const s = getState();
      const t = performance.now() / 1000;
      const feats: GeoJSON.Feature[] = [];
      const drillFire = s.fires.find((f) => f.drill);
      const off = DRILL_OFF[s.drill.hw ? 'hw' : 'classic'];
      const add = (c: LngLat, color: string, speed: number, max: number) => {
        for (let k = 0; k < 2; k++) {
          const ph = ((t * speed + k * 0.5) % 1);
          feats.push(pt(c, { r: 6 + ph * max, o: 1 - ph, color }));
        }
      };

      // Animated verification drone: interpolate along the base→fire line.
      const drone = s.drill.drone;
      let dronePos: LngLat | null = null;
      if (drone) {
        const flying = s.drill.step >= 2 && s.drill.step < 4;
        const stationed = s.drill.step >= 4;
        if (flying) {
          const prog = Math.min(1, (Date.now() - drone.at) / drone.dur);
          dronePos = [drone.from[0] + (drone.to[0] - drone.from[0]) * prog, drone.from[1] + (drone.to[1] - drone.from[1]) * prog];
          add(dronePos, '#7cc4ff', 1.4, 60);
        }
        if (stationed) dronePos = drone.to;
        if (dronePos) {
          set('hw-drones', fc([pt(dronePos, { id: 'DRONE-FG-DRILL', status: stationed ? 'VERIFYING' : 'IN FLIGHT', flight: 1 })]));
          set('hw-drone-path', fc([{
            type: 'Feature', geometry: { type: 'LineString', coordinates: [drone.from, dronePos] }, properties: { id: 'DRONE-FG-DRILL' },
          }]));
        }
      }

      if (drillFire && s.drill.step >= 0 && s.drill.step < off.done) {
        const c: LngLat = [drillFire.lon, drillFire.lat];
        if (s.drill.hw && s.drill.step === 1) add(c, '#34d399', 1.1, 55); // ESP32 mesh alert
        if (s.drill.hw && s.drill.step === 2) add(dronePos ?? c, '#7cc4ff', 1.4, 70); // drone dispatched
        if (s.drill.hw && s.drill.step === 4) add(c, '#7cc4ff', 1.0, 60); // drone on station → confirms
        if (s.drill.hw && s.drill.step === 5) add(c, '#9ff3ff', 1.6, 90); // drone communicates with FireGuard
        if (s.drill.step === off.sat) add(c, '#ffd166', 0.8, 90);
        if (s.drill.step === off.smoke) add(c, '#9fd4ff', 0.9, 60);
        if (s.drill.step === off.sensor) add(c, '#34d399', 1.0, 50);
        if (s.drill.step >= off.risk) add(c, '#ff4b2b', 0.6, 70);
      }
      const sel = s.fires.find((f) => f.id === s.selectedId);
      const a = sel ? s.analyses[sel.id] : null;
      if (a && s.timelineCursor < a.timeline.length + 1) {
        const ev = a.timeline[s.timelineCursor - 1];
        if (ev?.lngLat) add(ev.lngLat, ev.kind === 'impact' ? '#ff2d55' : '#ffb347', 0.9, 55);
      }
      set('pulses', fc(feats));
    };

    map.on('load', async () => {
      tuneBasemap(map);
      covering = addSatellite(map);
      addLayers(map);
      ready = true;
      render(getState());
      pulse();
      fetch('/api/wind-grid').then((r) => r.json()).then((b) => wind.setSamples(b.grid ?? [])).catch(() => {});
      const [hos, sch, inf, pla, zones] = await Promise.all([osm.hospitals(), osm.schools(), osm.infrastructure(), osm.places(), gencat.zones()]);
      set('osm-hospitals', fc(hos.map((r) => pt([r[0], r[1]], { name: r[2] || 'Hospital', kind: 'Hospital' }))));
      set('osm-schools', fc(sch.map((r) => pt([r[0], r[1]], { name: r[2] || 'School', kind: 'School' }))));
      set('osm-infra', fc(inf.map((r) => pt([r[0], r[1]], { name: r[2] || String(r[3]), kind: String(r[3]).replace('_', ' ') }))));
      set('population', fc(pla.map((r) => pt([r[0], r[1]], { name: r[2], pop: Number(r[3]) }))));
      set('zones', zones);
    });

    // Tooltips
    const hoverLayers = ['hotspots', 'assets', 'osm-hospitals', 'osm-schools', 'osm-infra', 'towers', 'history-fill', 'zones-fill', 'roads', 'mtg', 'hw-sensors', 'hw-drones'];
    map.on('mousemove', (e) => {
      if (!ready) return;
      const f = map.queryRenderedFeatures(e.point, { layers: hoverLayers.filter((l) => map.getLayer(l) && map.getLayoutProperty(l, 'visibility') !== 'none') })[0];
      if (!f) { popup.remove(); map.getCanvas().style.cursor = ''; return; }
      map.getCanvas().style.cursor = 'pointer';
      const p = f.properties as Record<string, string | number>;
      let html = '';
      if (f.layer.id === 'hotspots') html = `<b>Satellite hotspot</b><span>${String(p.src).replace(/_/g, ' ')}</span><span>${fmt.int(+p.frp)} MW · ${p.conf} · ${fmt.ago(+new Date(String(p.t)))}</span>`;
      else if (f.layer.id === 'mtg') html = `<b>MTG FRP pixel</b><span>${p.frp} MW · geostationary</span>`;
      else if (f.layer.id === 'assets') html = `<b>${p.name}</b><span>${p.kind}${+p.pop ? ` · ${fmt.int(+p.pop)} people` : ''}</span><span>${p.eta != null ? `ETA ${p.eta} min` : `${fmt.km(+p.dist)} from fire`}</span>`;
      else if (f.layer.id === 'towers') html = `<b>${p.name}</b><span>Camera tower ${p.id} · demo placement</span>`;
      else if (f.layer.id === 'history-fill') html = `<b>${p.name} · ${p.year}</b><span>${fmt.ha(+p.ha)} burned</span><span>${p.synoptic ?? ''}</span>`;
      else if (f.layer.id === 'zones-fill') html = `<b>Fire-regime zone ${p.zhr}</b><span>Danger ${p.danger}/5 · exposure ${p.exposure}/5</span>`;
      else if (f.layer.id === 'hw-sensors') html = `<b>${p.id}</b><span>${p.region} · ${p.status}</span><span>ESP32 sensor node · low-cost mesh</span>`;
      else if (f.layer.id === 'hw-drones') html = `<b>${p.id}</b><span>${p.status}${p.flight ? ' · verifying fire' : ''}</span><span>Autonomous verification drone</span>`;
      else if (f.layer.id === 'roads') html = `<b>${p.ref}</b><span>${p.eta != null ? `Cut by fire in ~${p.eta} min` : 'Outside 3 h forecast'}</span>`;
      else html = `<b>${p.name}</b><span>${p.kind}</span>`;
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    });

    map.on('click', (e) => {
      if (routeRef.current === '/simulation' && getState().drill.step === -1) {
        setState((s) => ({ drill: { ...s.drill, point: [e.lngLat.lng, e.lngLat.lat] } }));
        const c: LngLat = [e.lngLat.lng, e.lngLat.lat];
        set('cones', fc([{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [circle(c, 0.4)] }, properties: {} }]));
      }
    });

    let prev = getState();
    const unsub = subscribe(() => {
      const s = getState();
      render(s, prev);
      prev = s;
    });

    return () => {
      unsub();
      cancelAnimationFrame(pulseRaf);
      wind.destroy();
      map.remove();
    };
  }, []);

  return <div ref={ref} className="map-stage" />;
}

