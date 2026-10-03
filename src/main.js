import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import './style.css';
import { config } from './config.js';
import { buildSources } from './sources.js';
import { LazyLayer } from './lazy.js';
import { checkPoint } from './check.js';
import { transformRequest } from './net.js';
import { hideResult, setLayerStatus, showBanner, showResult } from './ui.js';

const sources = buildSources();
const EMPTY = { type: 'FeatureCollection', features: [] };

const map = new maplibregl.Map({
  container: 'map',
  center: config.map.center,
  zoom: config.map.zoom,
  maxBounds: config.map.maxBounds,
  transformRequest,
  attributionControl: { compact: true },
  style: {
    version: 8,
    sources: {
      basemap: { type: 'raster', tiles: config.basemap.tiles, tileSize: 256, maxzoom: 19, attribution: config.basemap.attribution },
    },
    layers: [{ id: 'basemap', type: 'raster', source: 'basemap' }],
  },
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false, positionOptions: { enableHighAccuracy: true } }), 'top-right');

const lazy = {};
let checkAbort;

function addLayers() {
  const { airspace, environment } = sources;

  // Unten: Schutzgebiete (grün)
  map.addSource('environment', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'environment-fill', type: 'fill', source: 'environment', paint: { 'fill-color': '#2e8b3d', 'fill-opacity': 0.35 } });
  map.addLayer({ id: 'environment-line', type: 'line', source: 'environment', paint: { 'line-color': '#1f6a2b', 'line-width': 1.2 } });

  // Darüber: Luftraum (rot/orange), per WMS oder lazy-Vektor
  if (airspace.display === 'wms') {
    const w = config.airspace.wms;
    const q = `SERVICE=WMS&VERSION=${w.version}&REQUEST=GetMap&FORMAT=${encodeURIComponent(w.format)}&TRANSPARENT=true&LAYERS=${encodeURIComponent(w.layers)}&STYLES=&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}`;
    const sep = w.url.includes('?') ? '&' : '?';
    map.addSource('airspace-wms', { type: 'raster', tiles: [`${w.url}${sep}${q}`], tileSize: 256 });
    map.addLayer({ id: 'airspace-wms', type: 'raster', source: 'airspace-wms', paint: { 'raster-opacity': w.opacity } });
  } else {
    map.addSource('airspace', { type: 'geojson', data: EMPTY });
    map.addLayer({
      id: 'airspace-fill', type: 'fill', source: 'airspace',
      paint: {
        'fill-color': ['match', ['get', airspace.fields.type], 'CTR', '#d62718', 'PROHIBITED', '#d62718', '#f28c1e'],
        'fill-opacity': 0.4,
      },
    });
    map.addLayer({ id: 'airspace-line', type: 'line', source: 'airspace', paint: { 'line-color': '#b3260f', 'line-width': 1.5 } });
  }

  // Oben: Treffer-Highlight
  map.addSource('hits', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'hits-line', type: 'line', source: 'hits', paint: { 'line-color': '#000', 'line-width': 3 } });
  map.addSource('pin', { type: 'geojson', data: EMPTY });
  map.addLayer({ id: 'pin', type: 'circle', source: 'pin', paint: { 'circle-radius': 7, 'circle-color': '#fff', 'circle-stroke-color': '#000', 'circle-stroke-width': 3 } });

  for (const [id, source] of Object.entries(sources)) {
    if (!source.adapter) setLayerStatus(id, { status: 'unconfigured' });
    if (id === 'airspace' && source.display === 'wms') continue; // WMS braucht kein Lazy Loading
    lazy[id] = new LazyLayer({ source, map, mapSourceId: id, onState: (s) => setLayerStatus(id, s) });
  }
  const refresh = () => Object.values(lazy).forEach((l) => l.schedule());
  map.on('moveend', refresh);
  refresh();
}

function toggle(id, visible) {
  const ids = map.getStyle().layers.map((l) => l.id).filter((l) => l.startsWith(id));
  for (const l of ids) map.setLayoutProperty(l, 'visibility', visible ? 'visible' : 'none');
  lazy[id]?.setEnabled(visible);
}
for (const id of Object.keys(sources)) {
  document.getElementById(`t-${id}`).addEventListener('change', (e) => toggle(id, e.target.checked));
}

async function runCheck(lngLat) {
  checkAbort?.abort();
  const ctl = (checkAbort = new AbortController());
  map.getSource('pin').setData({ type: 'Feature', geometry: { type: 'Point', coordinates: [lngLat.lng, lngLat.lat] } });
  try {
    const res = await checkPoint(lngLat, sources, { signal: ctl.signal });
    map.getSource('hits').setData({ type: 'FeatureCollection', features: res.hits.map((h) => h.feature) });
    showResult(res, lngLat);
    // Test-Hook
    window.__lastCheck = res.status;
  } catch (err) {
    if (!ctl.signal.aborted) throw err;
  }
}

map.on('click', (e) => runCheck(e.lngLat));
document.getElementById('result-close').addEventListener('click', () => {
  hideResult();
  map.getSource('hits').setData(EMPTY);
  map.getSource('pin').setData(EMPTY);
});

// Adresssuche (Nominatim, nur AT)
document.getElementById('search').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('q').value.trim();
  if (!q || !config.geocoder.enabled) return;
  try {
    const url = `${config.geocoder.url}?format=jsonv2&limit=1&countrycodes=at&q=${encodeURIComponent(q)}`;
    const hit = (await (await fetch(url)).json())[0];
    if (!hit) return showBanner('Adresse nicht gefunden.');
    const lngLat = { lng: +hit.lon, lat: +hit.lat };
    map.flyTo({ center: [lngLat.lng, lngLat.lat], zoom: Math.max(map.getZoom(), 14) });
    showBanner('');
    runCheck(lngLat);
  } catch {
    showBanner('Geocoder nicht erreichbar.');
  }
});

if (config.demo) {
  showBanner('<strong>Demo-Modus:</strong> Beispieldaten, keine realen Grenzen. Endpoints in <code>.env</code> setzen.');
}
map.on('load', addLayers);
window.__map = map;
