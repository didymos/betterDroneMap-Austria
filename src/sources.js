// Adapter: (bbox, {signal, precise}) -> {features, truncated}
import { config } from './config.js';
import { fetchJSON } from './net.js';
import { bboxIntersects, fmtBBox, geometryBBox } from './geo.js';

export function arcgisAdapter({ url, where, maxRecords, generalize }) {
  return async (bbox, { signal, precise = false } = {}) => {
    const q = new URLSearchParams({
      f: 'geojson',
      where,
      geometry: fmtBBox(bbox),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      outSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      resultRecordCount: String(maxRecords),
    });
    if (!precise) {
      q.set('maxAllowableOffset', String(generalize));
      q.set('geometryPrecision', '5');
    }
    const json = await fetchJSON(`${url.replace(/\/$/, '')}/query?${q}`, { signal });
    if (json.error) throw new Error(json.error.message || 'ArcGIS-Fehler');
    const features = json.features || [];
    const truncated =
      json.exceededTransferLimit === true ||
      json.properties?.exceededTransferLimit === true ||
      features.length >= maxRecords;
    return { features, truncated };
  };
}

export function wfsAdapter({ url, typeName, bboxCrs, maxFeatures }) {
  return async (bbox, { signal } = {}) => {
    const sep = url.includes('?') ? '&' : '?';
    const q = new URLSearchParams({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: typeName,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      count: String(maxFeatures),
      bbox: `${fmtBBox(bbox)},${bboxCrs}`,
    });
    const json = await fetchJSON(`${url}${sep}${q}`, { signal });
    const features = json.features || [];
    return { features, truncated: features.length >= maxFeatures };
  };
}

// Lokale GeoJSON-Datei (Demo): einmal laden, danach bbox-filtern.
export function staticAdapter(url) {
  let cache;
  return async (bbox, { signal } = {}) => {
    cache ??= fetchJSON(new URL(url, location.href).href, { signal }).catch((e) => {
      cache = undefined;
      throw e;
    });
    const all = (await cache).features || [];
    return { features: all.filter((f) => bboxIntersects(geometryBBox(f.geometry), bbox)), truncated: false };
  };
}

// Kategorie-Isolierung. Ohne konfiguriertes Feld/Kategorien: alles durchlassen.
export function matchesCategory(feature, { fields, categories }) {
  if (!categories?.length || !fields?.category) return true;
  const value = String(feature.properties?.[fields.category] ?? '').toLowerCase();
  return categories.some((c) => value.includes(c.toLowerCase()));
}

// Quellen-Registry. adapter=null → nicht konfiguriert.
export function buildSources() {
  const a = config.airspace;
  const e = config.environment;

  if (config.demo) {
    return {
      airspace: {
        id: 'airspace',
        label: a.label,
        adapter: staticAdapter('./demo/airspace.geojson'),
        display: 'vector',
        fields: { name: 'name', type: 'type', lower: 'lower_limit', upper: 'upper_limit' },
      },
      environment: {
        id: 'environment',
        label: e.label,
        adapter: staticAdapter('./demo/environment.geojson'),
        display: 'vector',
        fields: { name: 'name', category: 'kategorie' },
        categories: e.categories,
        minZoom: 0,
      },
    };
  }

  return {
    airspace: {
      id: 'airspace',
      label: a.label,
      adapter: a.wfs.url && a.wfs.typeName ? wfsAdapter(a.wfs) : null,
      // Darstellung per WMS (Pflicht laut Briefing); ohne WMS lazy WFS-Vektoren.
      display: a.wms.url && a.wms.layers ? 'wms' : 'vector',
      fields: a.fields,
      minZoom: 8,
    },
    environment: {
      id: 'environment',
      label: e.label,
      adapter: e.arcgis.url ? arcgisAdapter(e.arcgis) : null,
      display: 'vector',
      fields: e.fields,
      categories: e.categories,
      minZoom: e.minZoom,
    },
  };
}
