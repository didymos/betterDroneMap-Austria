# Drohnenkarte Österreich (MVP)

Web-Map: basemap.at + Austro-Control-Luftraum (WMS/WFS) + Nationalparks/Naturschutzgebiete (ArcGIS REST),
mit clientseitigem Punkt-Check (Point-in-Polygon, turf) bei Klick oder Adresssuche.

## Start

```
npm install
npm run dev          # Demo-Modus, solange keine Endpoints in .env stehen (oder ?demo=1)
npm run proxy        # optional: CORS-Proxy auf :8787 (Dev-Server leitet /proxy dorthin)
npm test             # Unit-Tests (Check-Logik, BBox, Proxy-Allowlist)
npm run smoke        # Browser-Smoke-Test (Chromium, Demo-Daten)
npm start            # Build + Proxy + statische Auslieferung (PROXY_ALLOW_HOSTS setzen)
```

## Status der Endpoints — NICHT VERIFIZIERT

Die Endpoints im Briefing waren abgeschnitten (`https://austrocontrol.at`). In der Entwicklungsumgebung
war der Egress zu `*.gv.at`, `austrocontrol.at`, `umweltbundesamt.at` gesperrt (403) — kein Dienst wurde live getestet.
Vor Produktivbetrieb in `.env` eintragen und prüfen:

| Dienst | Variable | Prüfen mit |
|---|---|---|
| WMS Luftraum | `VITE_AIRSPACE_WMS_URL`, `_LAYERS` | `GetCapabilities`, CRS `EPSG:3857`, CORS-Header |
| WFS Luftraum | `VITE_AIRSPACE_WFS_URL`, `_TYPENAME`, `_FIELD_*` | `DescribeFeatureType`; `application/json` unterstützt? Achsenreihenfolge (`_BBOX_CRS`) |
| ArcGIS Schutzgebiete | `VITE_ENV_ARCGIS_URL` (…/FeatureServer/N), `_FIELD_CATEGORY`, `_CATEGORIES` | `?f=pjson`: Feldname und Werte der Kategorie |
| basemap.at | `VITE_BASEMAP_TILES` | Default `mapsneu.wien.gv.at/.../bmapgrau/...` aus Gedächtnis |

Ohne konfigurierte Quelle meldet der Check „unvollständig“, nie „frei“.

## Architektur

- `src/lazy.js` — BBox-Lazy-Loading (Debounce 300 ms, +50 % Puffer, Abdeckungs-Cache, Abort, Dedupe, Limit-Erkennung).
- `src/sources.js` — Adapter ArcGIS / WFS / statisch; Kategorie-Filter (Nationalpark, Naturschutzgebiet) zusätzlich clientseitig.
- `src/check.js` — Punktabfrage (~1 m BBox, **ohne** Generalisierung) + `booleanPointInPolygon`; unabhängig von Layer-Sichtbarkeit.
- `src/net.js` — fetch mit Timeout; Proxy-Modus `off|fallback|always`.
- `server/proxy.mjs` — Node-Proxy ohne Dependencies: https-only, Host-Allowlist, kein Redirect-Follow, 20 MB / 20 s Limit, 60 s Cache.

## Grenzen

- Darstellung nutzt generalisierte Geometrie (~55 m); der Check nutzt Vollpräzision. Kein Puffer an Grenzen.
- Rasterkacheln (WMS, basemap) brauchen CORS-Header, sonst `VITE_PROXY_MODE=always` + `VITE_PROXY_TILE_HOSTS`.
- Kein Treffer ≠ Flugfreigabe. Offizielle Quellen (dronespace.at) sind maßgeblich. Temporäre Beschränkungen (NOTAM) nur, falls im WMS/WFS enthalten.
- Nominatim-Geocoder: Nutzungsrichtlinie (1 req/s, Attribution) beachten; für Produktion eigenen Geocoder wählen.
- Bundle ~290 kB gzip (MapLibre); kein Code-Splitting.
