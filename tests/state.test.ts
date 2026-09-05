import { Grid3D } from '../src/sim/grid';
import { applySnapshot, encodeCells, parseSnapshotJSON, type AppSnapshot } from '../src/sim/share';
import { History } from '../src/state/history';
import { loadLibrary, loadSession, MAX_WORKS, saveSession, upsertWork, type SavedWork } from '../src/state/library';

function snapshot(size = 12): AppSnapshot {
  const grid = new Grid3D(size);
  grid.set(1, 2, 3, 4);
  return { v: 2, size, generation: 7, rule: 'B4/S4-5', ruleName: 'Test', boundary: 'clamp', seedName: 'Painted', seedId: '', cells: encodeCells(grid), playing: true, sliceAxis: 'z', sliceIndex: 3, sliceVisible: false };
}

class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}

describe('snapshot state', () => {
  it('strictly rejects malformed data', () => {
    expect(() => parseSnapshotJSON('{"v":2,"size":12}')).toThrow();
    expect(() => parseSnapshotJSON(JSON.stringify({ ...snapshot(), cells: '%%%bad' }))).toThrow();
    expect(() => parseSnapshotJSON(JSON.stringify({ ...snapshot(), sliceIndex: 99 }))).toThrow();
  });

  it('restores a different size and full UI state while accepting v1', () => {
    const snap = { ...snapshot(18), v: 1 as const };
    const parsed = parseSnapshotJSON(JSON.stringify(snap));
    const result = applySnapshot(parsed);
    expect(result.grid.size).toBe(18);
    expect(result.grid.get(1, 2, 3)).toBe(4);
    expect(parsed.sliceAxis).toBe('z');
    expect(parsed.playing).toBe(true);
  });

  it('round-trips a random or painted experiment restart point', () => {
    const restart = { ...snapshot(), generation: 0, seedName: 'Random' };
    const current = { ...snapshot(), generation: 12, restart: JSON.stringify(restart) };
    const parsed = parseSnapshotJSON(JSON.stringify(current));
    const initial = parseSnapshotJSON(parsed.restart!);
    expect(initial.seedName).toBe('Random');
    expect(initial.generation).toBe(0);
    expect(initial.restart).toBeUndefined();
  });

  it('accepts old snapshots without a palette and preserves a v2 palette', () => {
    expect(parseSnapshotJSON(JSON.stringify({ ...snapshot(), v: 1, palette: undefined })).palette).toBeUndefined();
    expect(parseSnapshotJSON(JSON.stringify({ ...snapshot(), palette: 'orchid' })).palette).toBe('orchid');
    expect(() => parseSnapshotJSON(JSON.stringify({ ...snapshot(), palette: 'unknown' }))).toThrow();
  });
});

describe('history and persistence', () => {
  it('undoes and redoes complete edits', () => {
    const history = new History<number>(3);
    history.push(1); history.push(2);
    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBe(1);
    expect(history.redo(1)).toBe(2);
  });

  it('saves/restores sessions and refuses to evict a full library', () => {
    const storage = new MemoryStorage();
    const snap = snapshot();
    saveSession(storage, snap);
    expect(loadSession(storage)?.generation).toBe(7);
    for (let i = 0; i < MAX_WORKS; i++) {
      const work: SavedWork = { id: String(i), name: `w${i}`, updatedAt: i, snapshot: snap, thumbnail: 'data:image/jpeg;base64,' };
      upsertWork(storage, work);
    }
    expect(loadLibrary(storage)).toHaveLength(MAX_WORKS);
    expect(() => upsertWork(storage, { id: 'new', name: 'new', updatedAt: 99, snapshot: snap, thumbnail: '' })).toThrow();
    expect(loadLibrary(storage)[MAX_WORKS - 1]?.id).toBe('0');
  });
});
