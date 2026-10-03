import { describe, expect, it } from 'vitest';
import { bboxCovers, bboxIntersects, geometryBBox, padBBox, pointBBox } from '../src/geo.js';

describe('geo', () => {
  it('bbox of MultiPolygon', () => {
    const g = { type: 'MultiPolygon', coordinates: [[[[1, 2], [3, 2], [3, 5], [1, 2]]], [[[10, 0], [11, 0], [11, 1], [10, 0]]]] };
    expect(geometryBBox(g)).toEqual([1, 0, 11, 5]);
  });
  it('intersects / covers', () => {
    expect(bboxIntersects([0, 0, 2, 2], [1, 1, 3, 3])).toBe(true);
    expect(bboxIntersects([0, 0, 1, 1], [2, 2, 3, 3])).toBe(false);
    expect(bboxCovers([0, 0, 10, 10], [1, 1, 2, 2])).toBe(true);
    expect(bboxCovers([0, 0, 10, 10], [1, 1, 12, 2])).toBe(false);
  });
  it('pad / point box', () => {
    expect(padBBox([0, 0, 10, 10], 0.5)).toEqual([-5, -5, 15, 15]);
    const b = pointBBox([14, 48]);
    expect(b[0]).toBeLessThan(14);
    expect(b[2]).toBeGreaterThan(14);
  });
});
