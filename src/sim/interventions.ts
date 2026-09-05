import { Grid3D } from './grid';

export type InterventionKind = 'source' | 'barrier';

export class Interventions {
  readonly source: Uint8Array;
  readonly barrier: Uint8Array;
  constructor(readonly size: number) {
    const volume = size ** 3; this.source = new Uint8Array(volume); this.barrier = new Uint8Array(volume);
  }
  set(index: number, kind: InterventionKind, enabled = true): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.source.length) return;
    if (kind === 'source') { this.source[index] = enabled ? 1 : 0; if (enabled) this.barrier[index] = 0; }
    else { this.barrier[index] = enabled ? 1 : 0; if (enabled) this.source[index] = 0; }
  }
  clear(): void { this.source.fill(0); this.barrier.fill(0); }
  apply(grid: Grid3D): void {
    for (let i = 0; i < grid.cells.length; i++) {
      if (this.barrier[i]) grid.cells[i] = 0;
      else if (this.source[i]) grid.cells[i] = Math.max(1, grid.cells[i]!);
    }
    grid.recount();
  }
  indices(kind: InterventionKind): number[] {
    const cells = kind === 'source' ? this.source : this.barrier; const result: number[] = [];
    for (let i = 0; i < cells.length; i++) if (cells[i]) result.push(i);
    return result;
  }
  load(sources: readonly number[] = [], barriers: readonly number[] = []): void {
    this.clear(); for (const i of sources) this.set(i, 'source'); for (const i of barriers) this.set(i, 'barrier');
  }
  resize(size: number): Interventions {
    const next = new Interventions(size), oldHalf = Math.floor(this.size / 2), newHalf = Math.floor(size / 2);
    for (const kind of ['source', 'barrier'] as const) for (const index of this.indices(kind)) {
      const x = index % this.size, y = Math.floor(index / this.size) % this.size, z = Math.floor(index / (this.size ** 2));
      const nx = x-oldHalf+newHalf, ny = y-oldHalf+newHalf, nz = z-oldHalf+newHalf;
      if (nx>=0&&ny>=0&&nz>=0&&nx<size&&ny<size&&nz<size) next.set(nx+ny*size+nz*size*size, kind);
    }
    return next;
  }
}

export function validateInterventionIndices(size: number, sources?: unknown, barriers?: unknown): { sources: number[]; barriers: number[] } {
  const volume = size ** 3;
  const parse = (value: unknown): number[] => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.length > volume) throw new Error('Invalid interventions');
    const unique = new Set<number>();
    for (const index of value) { if (!Number.isInteger(index) || index < 0 || index >= volume) throw new Error('Invalid intervention index'); unique.add(index); }
    return [...unique];
  };
  const source = parse(sources), barrier = parse(barriers), barrierSet = new Set(barrier);
  if (source.some((index) => barrierSet.has(index))) throw new Error('Interventions must be disjoint');
  return { sources: source, barriers: barrier };
}
