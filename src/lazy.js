// Lazy Loading per BBox: lädt nur den sichtbaren Ausschnitt (+Puffer), dedupliziert, cached Abdeckung.
import { bboxCovers, padBBox } from './geo.js';
import { matchesCategory } from './sources.js';

const PAD = 0.5;
const MAX_FEATURES = 4000;
const DEBOUNCE_MS = 300;

export const featureKey = (f) =>
  f.id ?? `${f.properties?.name ?? ''}|${JSON.stringify(f.geometry?.coordinates?.[0]?.[0] ?? '')}`;

export class LazyLayer {
  /** @param {{source:any, map:any, mapSourceId:string, onState:(s:object)=>void}} o */
  constructor({ source, map, mapSourceId, onState }) {
    Object.assign(this, { source, map, mapSourceId, onState });
    this.features = new Map();
    this.loaded = []; // bereits vollständig geladene BBoxes
    this.abort = null;
    this.timer = null;
    this.enabled = true;
  }

  setEnabled(on) {
    this.enabled = on;
    if (on) this.schedule(0);
  }

  schedule(delay = DEBOUNCE_MS) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.update(), delay);
  }

  async update() {
    const { source, map } = this;
    if (!this.enabled || !source.adapter) return;
    if (map.getZoom() < (source.minZoom ?? 0)) {
      this.abort?.abort();
      return this.onState({ status: 'zoom', minZoom: source.minZoom });
    }
    const b = map.getBounds();
    const view = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    if (this.loaded.some((l) => bboxCovers(l, view))) {
      return this.onState({ status: 'ok', count: this.features.size, truncated: false });
    }
    const target = padBBox(view, PAD);
    this.abort?.abort();
    const ctl = (this.abort = new AbortController());
    this.onState({ status: 'loading' });
    try {
      const { features, truncated } = await source.adapter(target, { signal: ctl.signal });
      if (this.features.size > MAX_FEATURES) {
        this.features.clear();
        this.loaded = [];
      }
      for (const f of features) {
        if (matchesCategory(f, source)) this.features.set(featureKey(f), f);
      }
      // Bei Abschneiden (Server-Limit) die Abdeckung NICHT als vollständig markieren.
      if (!truncated) this.loaded.push(target);
      map.getSource(this.mapSourceId)?.setData({
        type: 'FeatureCollection',
        features: [...this.features.values()],
      });
      this.onState({ status: 'ok', count: this.features.size, truncated });
    } catch (err) {
      if (ctl.signal.aborted) return;
      this.onState({ status: 'error', message: err.message });
    }
  }
}
