import type { Rule } from './rules'

export interface StepResult {
  generation: number
  population: number
}

export class VoxelAutomaton {
  readonly size: number
  readonly cells: Uint8Array
  readonly ages: Uint16Array
  readonly ghosts: Uint8Array

  private readonly nextCells: Uint8Array
  private readonly nextAges: Uint16Array
  private readonly nextGhosts: Uint8Array

  generation = 0
  population = 0

  constructor(size: number, public rule: Rule, public ghostFrames = 6) {
    this.size = size
    const total = size * size * size
    this.cells = new Uint8Array(total)
    this.ages = new Uint16Array(total)
    this.ghosts = new Uint8Array(total)
    this.nextCells = new Uint8Array(total)
    this.nextAges = new Uint16Array(total)
    this.nextGhosts = new Uint8Array(total)
  }

  index(x: number, y: number, z: number): number {
    return x + y * this.size + z * this.size * this.size
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.size && y < this.size && z < this.size
  }

  get(x: number, y: number, z: number): 0 | 1 {
    if (!this.inBounds(x, y, z)) return 0
    return this.cells[this.index(x, y, z)] as 0 | 1
  }

  set(x: number, y: number, z: number, alive: boolean): void {
    if (!this.inBounds(x, y, z)) return
    const idx = this.index(x, y, z)
    const next = alive ? 1 : 0
    if (this.cells[idx] === next) return

    if (next === 1) {
      this.population += 1
      this.ages[idx] = 1
      this.ghosts[idx] = 0
    } else {
      this.population -= 1
      this.ages[idx] = 0
      this.ghosts[idx] = this.ghostFrames
    }

    this.cells[idx] = next
  }

  clear(): void {
    this.cells.fill(0)
    this.ages.fill(0)
    this.ghosts.fill(0)
    this.generation = 0
    this.population = 0
  }

  randomize(density: number, rng: () => number = Math.random): void {
    this.clear()
    const threshold = Math.max(0, Math.min(1, density))
    for (let i = 0; i < this.cells.length; i += 1) {
      if (rng() < threshold) {
        this.cells[i] = 1
        this.ages[i] = 1
        this.population += 1
      }
    }
  }

  countNeighbors(x: number, y: number, z: number): number {
    let count = 0
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue
          if (this.get(x + dx, y + dy, z + dz)) count += 1
        }
      }
    }
    return count
  }

  step(): StepResult {
    let population = 0
    for (let z = 0; z < this.size; z += 1) {
      for (let y = 0; y < this.size; y += 1) {
        for (let x = 0; x < this.size; x += 1) {
          const idx = this.index(x, y, z)
          const neighbors = this.countNeighbors(x, y, z)
          const alive = this.cells[idx] === 1
          const survives = alive && this.rule.survive.has(neighbors)
          const born = !alive && this.rule.birth.has(neighbors)
          const nextAlive = survives || born

          this.nextCells[idx] = nextAlive ? 1 : 0
          if (nextAlive) {
            population += 1
            this.nextAges[idx] = alive ? this.ages[idx] + 1 : 1
            this.nextGhosts[idx] = 0
          } else {
            this.nextAges[idx] = 0
            this.nextGhosts[idx] = alive
              ? this.ghostFrames
              : this.ghosts[idx] > 0
                ? this.ghosts[idx] - 1
                : 0
          }
        }
      }
    }

    this.cells.set(this.nextCells)
    this.ages.set(this.nextAges)
    this.ghosts.set(this.nextGhosts)
    this.population = population
    this.generation += 1

    return { generation: this.generation, population }
  }

  loadCells(cells: Uint8Array): void {
    const expected = this.cells.length
    if (cells.length !== expected) {
      throw new Error(`Cell buffer length mismatch: expected ${expected}, got ${cells.length}`)
    }

    this.cells.set(cells)
    this.ages.fill(0)
    this.ghosts.fill(0)
    this.population = 0

    for (let i = 0; i < this.cells.length; i += 1) {
      if (this.cells[i] === 1) {
        this.population += 1
        this.ages[i] = 1
      }
    }
  }
}
