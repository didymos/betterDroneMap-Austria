// Zentrale Konfiguration. Endpoints kommen aus VITE_*-Variablen (siehe .env.example).
// Die Endpoints im Briefing waren abgeschnitten ("https://austrocontrol.at"); echte URLs
// müssen gegen die Dienst-Capabilities verifiziert werden und werden bewusst NICHT geraten.
const env = import.meta.env;
const list = (v, fallback) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : fallback);

const params = new URLSearchParams(globalThis.location?.search ?? '');

export const config = {
  map: {
    center: [13.35, 47.6],
    zoom: 7,
    maxBounds: [[8.0, 45.5], [18.5, 49.5]],
  },

  // basemap.at (CC BY 4.0), WMTS/XYZ, EPSG:3857. Host/Layer-Namen: Stand Wissen, nicht live geprüft.
  basemap: {
    tiles: list(env.VITE_BASEMAP_TILES, [
      'https://mapsneu.wien.gv.at/basemap/bmapgrau/normal/google3857/{z}/{y}/{x}.png',
    ]),
    attribution: 'Grundkarte: <a href="https://www.basemap.at" target="_blank" rel="noopener">basemap.at</a> (CC BY 4.0)',
  },

  // Austro Control: WMS = Darstellung, WFS = Abfrage (Punkt-Check).
  airspace: {
    label: 'Luftraum (Austro Control)',
    wms: {
      url: env.VITE_AIRSPACE_WMS_URL || '',
      layers: env.VITE_AIRSPACE_WMS_LAYERS || '',
      version: '1.3.0',
      format: 'image/png',
      opacity: 0.6,
    },
    wfs: {
      url: env.VITE_AIRSPACE_WFS_URL || '',
      typeName: env.VITE_AIRSPACE_WFS_TYPENAME || '',
      // GeoServer: "EPSG:4326" in bbox = lon/lat; "urn:ogc:def:crs:EPSG::4326" = lat/lon.
      bboxCrs: env.VITE_AIRSPACE_WFS_BBOX_CRS || 'EPSG:4326',
      maxFeatures: 2000,
    },
    fields: {
      name: env.VITE_AIRSPACE_FIELD_NAME || 'name',
      type: env.VITE_AIRSPACE_FIELD_TYPE || 'type',
      lower: env.VITE_AIRSPACE_FIELD_LOWER || 'lower_limit',
      upper: env.VITE_AIRSPACE_FIELD_UPPER || 'upper_limit',
    },
  },

  // Umweltbundesamt / data.gv.at: ArcGIS REST FeatureServer-Layer (…/FeatureServer/<id>).
  environment: {
    label: 'Nationalpark / Naturschutzgebiet',
    arcgis: {
      url: env.VITE_ENV_ARCGIS_URL || '',
      where: env.VITE_ENV_ARCGIS_WHERE || '1=1',
      maxRecords: 1000,
      // Display-Generalisierung in Grad (~55 m); Punktabfrage läuft ohne.
      generalize: 0.0005,
    },
    // Kategorie-Isolierung (case-insensitive, Teilstring) – clientseitig als zweite Absicherung.
    fields: {
      name: env.VITE_ENV_FIELD_NAME || 'name',
      category: env.VITE_ENV_FIELD_CATEGORY || 'kategorie',
    },
    categories: list(env.VITE_ENV_CATEGORIES, ['Nationalpark', 'Naturschutzgebiet']),
    minZoom: 8,
  },

  // CORS-Fallback über server/proxy.mjs. mode: off | fallback | always
  proxy: {
    url: env.VITE_PROXY_URL || '/proxy',
    mode: env.VITE_PROXY_MODE || 'fallback',
    tileHosts: list(env.VITE_PROXY_TILE_HOSTS, []),
  },

  geocoder: {
    url: 'https://nominatim.openstreetmap.org/search',
    enabled: env.VITE_GEOCODER !== 'off',
  },

  // Demo-Modus: lokale Beispieldaten (keine realen Grenzen). Automatisch, wenn nichts konfiguriert ist.
  demo:
    params.has('demo') ||
    !(env.VITE_AIRSPACE_WMS_URL || env.VITE_AIRSPACE_WFS_URL || env.VITE_ENV_ARCGIS_URL),
};
