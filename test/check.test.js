import { describe, expect, it } from 'vitest';
import { checkPoint } from '../src/check.js';
import { matchesCategory } from '../src/sources.js';

const square = (x, y, s = 1) => ({ type: 'Polygon', coordinates: [[[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]]] });
const feat = (geometry, properties) => ({ type: 'Feature', geometry, properties });
const src = (id, features, extra = {}) => ({
  id, label: id, fields: { name: 'name', category: 'kat', type: 'type' },
  adapter: async () => ({ features, truncated: false }), ...extra,
});

describe('matchesCategory', () => {
  const cfg = { fields: { category: 'kat' }, categories: ['Nationalpark', 'Naturschutzgebiet'] };
  it('isoliert Kategorien (case-insensitive)', () => {
    expect(matchesCategory(feat(null, { kat: 'nationalpark' }), cfg)).toBe(true);
    expect(matchesCategory(feat(null, { kat: 'Landschaftsschutzgebiet' }), cfg)).toBe(false);
    expect(matchesCategory(feat(null, {}), cfg)).toBe(false);
  });
  it('ohne Konfiguration alles durchlassen', () => {
    expect(matchesCategory(feat(null, {}), { fields: {}, categories: [] })).toBe(true);
  });
});

describe('checkPoint', () => {
  const pt = { lng: 14.5, lat: 47.5 };
  it('Treffer → restricted', async () => {
    const r = await checkPoint(pt, {
      a: src('a', [feat(square(14, 47), { name: 'CTR X', type: 'CTR' })]),
      e: src('e', [feat(square(14, 47), { name: 'NP Y', kat: 'Nationalpark' })], { categories: ['Nationalpark'] }),
    });
    expect(r.status).toBe('restricted');
    expect(r.hits.map((h) => h.name).sort()).toEqual(['CTR X', 'NP Y']);
  });
  it('BBox-Treffer ohne PiP-Treffer → clear', async () => {
    const r = await checkPoint(pt, { a: src('a', [feat(square(20, 40), { name: 'weit weg' })]) });
    expect(r.status).toBe('clear');
  });
  it('fremde Kategorie wird ignoriert', async () => {
    const r = await checkPoint(pt, {
      e: src('e', [feat(square(14, 47), { name: 'LSG', kat: 'Landschaftsschutzgebiet' })], { categories: ['Nationalpark'] }),
    });
    expect(r.status).toBe('clear');
  });
  it('Loch im Polygon wird respektiert', async () => {
    const donut = { type: 'Polygon', coordinates: [square(14, 47, 1).coordinates[0], square(14.4, 47.4, 0.2).coordinates[0]] };
    const r = await checkPoint(pt, { a: src('a', [feat(donut, { name: 'Ring' })]) });
    expect(r.status).toBe('clear');
  });
  it('Fehler/nicht konfiguriert ohne Treffer → incomplete, nie clear', async () => {
    const failing = src('f', [], { adapter: async () => { throw new Error('CORS'); } });
    const r1 = await checkPoint(pt, { f: failing });
    expect(r1.status).toBe('incomplete');
    const r2 = await checkPoint(pt, { n: src('n', [], { adapter: null }) });
    expect(r2.status).toBe('incomplete');
  });
  it('Treffer trotz Fehler einer anderen Quelle → restricted', async () => {
    const failing = src('f', [], { adapter: async () => { throw new Error('x'); } });
    const r = await checkPoint(pt, { f: failing, a: src('a', [feat(square(14, 47), { name: 'Z' })]) });
    expect(r.status).toBe('restricted');
    expect(r.problems).toHaveLength(1);
  });
  it('abgeschnittene Antwort ohne Treffer → incomplete', async () => {
    const r = await checkPoint(pt, { a: src('a', [], { adapter: async () => ({ features: [], truncated: true }) }) });
    expect(r.status).toBe('incomplete');
  });
});
