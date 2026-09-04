/**
 * Bounded 3D cellular grid with age tracking.
 * Cells are Uint8Array: 0 = dead, 1-255 = age (capped).
 */

export type BoundaryMode = 'clamp' | 'wrap';

export interface GridSize {
  size: number;
}

export class Grid3D {
  readonly size: number;
  /** Flat buffer: index = x + y*size + z*size*size */
  cells: Uint8Array;
  population = 0;

  constructor(size: number, cells?: Uint8Array) {
    if (!Number.isInteger(size) || size < 4 || size > 64) {
      throw new Error(`Grid size must be integer 4-64, got ${size}`);
    }
    this.size = size;
    const volume = size * size * size;
    if (cells) {
      if (cells.length !== volume) throw new Error('cells length mismatch');
      this.cells = cells;
      this.recount();
    } else {
      this.cells = new Uint8Array(volume);
      this.population = 0;
    }
  }

  get volume(): number {
    return this.size * this.size * this.size;
  }

  index(x: number, y: number, z: number): number {
    const s = this.size;
    return x + y * s + z * s * s;
  }

  inBounds(x: number, y: number, z: number): boolean {
    const s = this.size;
    return x >= 0 && y >= 0 && z >= 0 && x < s && y < s && z < s;
  }

  get(x: number, y: number, z: number): number {
    if (!this.inBounds(x, y, z)) return 0;
    return this.cells[this.index(x, y, z)]!;
  }

  isAlive(x: number, y: number, z: number): boolean {
    return this.get(x, y, z) > 0;
  }

  set(x: number, y: number, z: number, age: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    const prev = this.cells[i]!;
    const next = age <= 0 ? 0 : Math.min(255, age);
    if (prev === 0 && next > 0) this.population++;
    else if (prev > 0 && next === 0) this.population--;
    this.cells[i] = next;
  }

  toggle(x: number, y: number, z: number): void {
    if (!this.inBounds(x, y, z)) return;
    const i = this.index(x, y, z);
    if (this.cells[i]! > 0) {
      this.cells[i] = 0;
      this.population--;
    } else {
      this.cells[i] = 1;
      this.population++;
    }
  }

  clear(): void {
    this.cells.fill(0);
    this.population = 0;
  }

  recount(): void {
    let pop = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i]! > 0) pop++;
    }
    this.population = pop;
  }

  clone(): Grid3D {
    return new Grid3D(this.size, this.cells.slice());
  }

  /** Copy alive ages into another same-size grid. */
  copyTo(target: Grid3D): void {
    if (target.size !== this.size) throw new Error('size mismatch');
    target.cells.set(this.cells);
    target.population = this.population;
  }

  /** Randomize with given density (0-1). Ages start at 1. Deterministic if rng provided. */
  randomize(density: number, rng: () => number = Math.random): void {
    const d = Math.min(1, Math.max(0, density));
    this.cells.fill(0);
    let pop = 0;
    for (let i = 0; i < this.cells.length; i++) {
      if (rng() < d) {
        this.cells[i] = 1;
        pop++;
      }
    }
    this.population = pop;
  }

  /** Resolve neighbor coordinate under boundary mode. Returns null if clamped out. */
  resolveCoord(v: number, mode: BoundaryMode): number | null {
    const s = this.size;
    if (mode === 'wrap') {
      return ((v % s) + s) % s;
    }
    if (v < 0 || v >= s) return null;
    return v;
  }
}
