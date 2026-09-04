export type SeedCell = [number, number, number]

export interface SeedPreset {
  name: string
  description: string
  cells: SeedCell[]
}

export const SEED_PRESETS: SeedPreset[] = [
  {
    name: 'Ember Cross',
    description: 'A dense orthogonal cross that quickly blossoms into layered shells.',
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [-1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [0, 0, 1],
      [0, 0, -1],
      [1, 1, 0],
      [-1, -1, 0],
      [1, -1, 0],
      [-1, 1, 0],
    ],
  },
  {
    name: 'Twin Helix',
    description: 'Two offset spirals that create braided growth fronts.',
    cells: [
      [-2, -2, -2],
      [-1, -1, -1],
      [0, 0, 0],
      [1, 1, 1],
      [2, 2, 2],
      [-2, 2, -1],
      [-1, 1, 0],
      [0, 0, 1],
      [1, -1, 2],
      [2, -2, 1],
      [0, 1, -1],
      [1, 0, -2],
    ],
  },
  {
    name: 'Cathedral Ring',
    description: 'A ring-and-spire arrangement that pulses through radial waves.',
    cells: [
      [0, 0, 0],
      [2, 0, 0],
      [-2, 0, 0],
      [0, 2, 0],
      [0, -2, 0],
      [1, 1, 0],
      [1, -1, 0],
      [-1, 1, 0],
      [-1, -1, 0],
      [0, 0, 2],
      [0, 0, -2],
      [2, 0, 1],
      [-2, 0, -1],
      [0, 2, -1],
      [0, -2, 1],
    ],
  },
]

export function stampSeed(size: number, cells: SeedCell[]): SeedCell[] {
  const center = Math.floor(size / 2)
  return cells
    .map(([x, y, z]) => [x + center, y + center, z + center] as SeedCell)
    .filter(([x, y, z]) => x >= 0 && y >= 0 && z >= 0 && x < size && y < size && z < size)
}
