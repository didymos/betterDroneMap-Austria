// Erzeugt Demo-GeoJSON (frei erfundene Näherungen, KEINE realen Grenzen).
import { writeFileSync } from 'node:fs';

const circle = (lon, lat, rKm, n = 48) => {
  const ring = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    ring.push([+(lon + (rKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)).toFixed(5), +(lat + (rKm / 110.57) * Math.sin(a)).toFixed(5)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
};
const poly = (ring) => ({ type: 'Polygon', coordinates: [[...ring, ring[0]]] });
const fc = (features) => ({ type: 'FeatureCollection', features });
const f = (id, geometry, properties) => ({ type: 'Feature', id, geometry, properties: { demo: true, ...properties } });

writeFileSync('public/demo/airspace.geojson', JSON.stringify(fc([
  f(1, circle(16.57, 48.11, 12), { name: 'DEMO CTR Wien', type: 'CTR', lower_limit: 'GND', upper_limit: '3500 ft AMSL' }),
  f(2, circle(13.0, 47.8, 9), { name: 'DEMO CTR Salzburg', type: 'CTR', lower_limit: 'GND', upper_limit: '3000 ft AMSL' }),
  f(3, circle(14.35, 48.24, 5), { name: 'DEMO Flugbeschränkungsgebiet', type: 'TRA', lower_limit: 'GND', upper_limit: 'FL 100' }),
])));

writeFileSync('public/demo/environment.geojson', JSON.stringify(fc([
  f(1, poly([[12.35, 47.05], [12.95, 47.0], [13.1, 47.15], [12.7, 47.25], [12.4, 47.18]]), { name: 'DEMO Nationalpark Hohe Tauern', kategorie: 'Nationalpark' }),
  f(2, poly([[14.5, 47.5], [14.75, 47.52], [14.7, 47.62], [14.48, 47.6]]), { name: 'DEMO Nationalpark Gesäuse', kategorie: 'Nationalpark' }),
  f(3, circle(14.55, 48.4, 6), { name: 'DEMO Naturschutzgebiet', kategorie: 'Naturschutzgebiet' }),
  f(4, circle(15.5, 47.0, 6), { name: 'DEMO Landschaftsschutzgebiet', kategorie: 'Landschaftsschutzgebiet' }),
])));
