import { describe, it, expect } from 'vitest';
import { Grid3D } from '../src/sim/grid';
import { encodeCells, decodeCells, snapshotToJSON, parseSnapshotJSON, applySnapshot } from '../src/sim/share';

describe('Grid3D', () => {
  it('tracks population on set/toggle/clear', () => {
    const g = new Grid3D(8);
    expect(g.population).toBe(0);
    g.set(1, 1, 1, 1);
    expect(g.population).toBe(1);
    g.set(1, 1, 1, 5);
    expect(g.population).toBe(1);
    g.toggle(1, 1, 1);
    expect(g.population).toBe(0);
    g.toggle(2, 2, 2);
    expect(g.population).toBe(1);
    g.clear();
    expect(g.population).toBe(0);
  });

  it('rejects invalid sizes', () => {
    expect(() => new Grid3D(2)).toThrow();
    expect(() => new Grid3D(100)).toThrow();
  });

  it('resolveCoord wrap and clamp', () => {
    const g = new Grid3D(5);
    expect(g.resolveCoord(-1, 'wrap')).toBe(4);
    expect(g.resolveCoord(5, 'wrap')).toBe(0);
    expect(g.resolveCoord(-1, 'clamp')).toBeNull();
    expect(g.resolveCoord(2, 'clamp')).toBe(2);
  });

  it('randomize is deterministic with fixed rng', () => {
    let i = 0;
    const seq = [0.01, 0.5, 0.02, 0.9, 0.03];
    const rng = () => seq[i++ % seq.length]!;
    const g = new Grid3D(4);
    g.randomize(0.1, rng);
    expect(g.population).toBeGreaterThan(0);
  });
});

describe('share encode/decode', () => {
  it('round-trips cells', () => {
    const g = new Grid3D(6);
    g.set(1, 2, 3, 4);
    g.set(0, 0, 0, 1);
    const enc = encodeCells(g);
    const h = new Grid3D(6);
    decodeCells(enc, h);
    expect(h.get(1, 2, 3)).toBe(4);
    expect(h.get(0, 0, 0)).toBe(1);
    expect(h.population).toBe(2);
  });

  it('round-trips snapshot JSON', () => {
    const g = new Grid3D(8);
    g.set(4, 4, 4, 2);
    const snap = {
      v: 1 as const,
      size: 8,
      generation: 12,
      rule: 'B4-6/S5-7',
      ruleName: 'Ember Bloom',
      boundary: 'clamp' as const,
      seedName: 'Test',
      cells: encodeCells(g),
    };
    const json = snapshotToJSON(snap);
    const parsed = parseSnapshotJSON(json);
    const applied = applySnapshot(parsed);
    expect(applied.generation).toBe(12);
    expect(applied.rule.notation).toBe('B4-6/S5-7');
    expect(applied.grid.get(4, 4, 4)).toBe(2);
  });
});
