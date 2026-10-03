// BBox-Hilfsfunktionen. BBox = [minLon, minLat, maxLon, maxLat] (EPSG:4326).

export function geometryBBox(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0];
      if (c[0] > maxX) maxX = c[0];
      if (c[1] < minY) minY = c[1];
      if (c[1] > maxY) maxY = c[1];
    } else {
      for (const x of c) walk(x);
    }
  };
  if (geometry?.coordinates) walk(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export const bboxIntersects = (a, b) =>
  a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export const bboxCovers = (outer, inner) =>
  outer[0] <= inner[0] && outer[1] <= inner[1] && outer[2] >= inner[2] && outer[3] >= inner[3];

export function padBBox([x1, y1, x2, y2], ratio) {
  const dx = (x2 - x1) * ratio;
  const dy = (y2 - y1) * ratio;
  return [x1 - dx, y1 - dy, x2 + dx, y2 + dy];
}

// ~1 m Box um einen Punkt (für Punktabfragen mit Vollpräzision).
export function pointBBox([lon, lat], eps = 1e-5) {
  return [lon - eps, lat - eps, lon + eps, lat + eps];
}

export const fmtBBox = (b, digits = 6) => b.map((v) => v.toFixed(digits)).join(',');
