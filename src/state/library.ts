import { parseSnapshotJSON, snapshotToJSON, type AppSnapshot } from '../sim/share';

export const SESSION_KEY = 'voxel-genesis-session-v2';
export const LIBRARY_KEY = 'voxel-genesis-library-v1';
export const MAX_WORKS = 12;

export interface SavedWork {
  id: string;
  name: string;
  updatedAt: number;
  snapshot: AppSnapshot;
  thumbnail: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadSession(storage: StorageLike): AppSnapshot | null {
  const raw = storage.getItem(SESSION_KEY);
  return raw ? parseSnapshotJSON(raw) : null;
}

export function saveSession(storage: StorageLike, snapshot: AppSnapshot): void {
  storage.setItem(SESSION_KEY, snapshotToJSON(snapshot));
}

export function loadLibrary(storage: StorageLike): SavedWork[] {
  const raw = storage.getItem(LIBRARY_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) throw new Error('Invalid library');
  return parsed.filter((item): item is SavedWork => {
    if (!item || typeof item !== 'object') return false;
    const work = item as SavedWork;
    try {
      parseSnapshotJSON(JSON.stringify(work.snapshot));
      return typeof work.id === 'string' && typeof work.name === 'string' &&
        Number.isFinite(work.updatedAt) && typeof work.thumbnail === 'string';
    } catch { return false; }
  }).slice(0, MAX_WORKS);
}

export function writeLibrary(storage: StorageLike, works: SavedWork[]): void {
  storage.setItem(LIBRARY_KEY, JSON.stringify(works.slice(0, MAX_WORKS)));
}

export function upsertWork(storage: StorageLike, work: SavedWork): SavedWork[] {
  const current = loadLibrary(storage);
  const exists = current.some((item) => item.id === work.id);
  if (!exists && current.length >= MAX_WORKS) throw new Error('Library limit reached');
  const next = [work, ...current.filter((item) => item.id !== work.id)];
  writeLibrary(storage, next);
  return next;
}
