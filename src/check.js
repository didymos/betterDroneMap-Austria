// Live-Koordinaten-Check: Punktabfrage mit Vollpräzision + clientseitiger Point-in-Polygon-Test (turf).
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { pointBBox } from './geo.js';
import { matchesCategory } from './sources.js';

const isPolygonal = (f) => f.geometry && /Polygon$/.test(f.geometry.type);

function describe(source, f) {
  const p = f.properties || {};
  const fl = source.fields || {};
  return {
    layer: source.id,
    layerLabel: source.label,
    name: p[fl.name] ?? '(unbenannt)',
    category: p[fl.type] ?? p[fl.category] ?? null,
    lower: p[fl.lower] ?? null,
    upper: p[fl.upper] ?? null,
    feature: f,
  };
}

/**
 * Prüft einen Punkt gegen alle Quellen – unabhängig von der Layer-Sichtbarkeit.
 * Status: 'restricted' (≥1 Treffer) | 'incomplete' (kein Treffer, aber Quelle fehlt/fehlerhaft/abgeschnitten) | 'clear'
 */
export async function checkPoint(lngLat, sources, { signal } = {}) {
  const pt = [lngLat.lng, lngLat.lat];
  const box = pointBBox(pt);
  const hits = [];
  const problems = [];

  await Promise.all(
    Object.values(sources).map(async (source) => {
      if (!source.adapter) {
        problems.push({ layer: source.label, message: 'Quelle nicht konfiguriert' });
        return;
      }
      try {
        const { features, truncated } = await source.adapter(box, { signal, precise: true });
        if (truncated) problems.push({ layer: source.label, message: 'Antwort abgeschnitten (Server-Limit)' });
        for (const f of features) {
          if (!isPolygonal(f) || !matchesCategory(f, source)) continue;
          if (booleanPointInPolygon(pt, f)) hits.push(describe(source, f));
        }
      } catch (err) {
        if (signal?.aborted) throw err;
        problems.push({ layer: source.label, message: err.message });
      }
    }),
  );

  const status = hits.length ? 'restricted' : problems.length ? 'incomplete' : 'clear';
  return { status, hits, problems, point: pt };
}
