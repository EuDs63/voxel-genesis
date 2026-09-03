import { describe, expect, test } from 'vitest'
import { VoxelAutomaton } from './grid'
import { parseRuleNotation } from './rules'

describe('VoxelAutomaton', () => {
  test('counts 26-neighbor moore neighborhood', () => {
    const sim = new VoxelAutomaton(5, parseRuleNotation('B6/S5,6,7'))
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (dx === 0 && dy === 0 && dz === 0) continue
          sim.set(2 + dx, 2 + dy, 2 + dz, true)
        }
      }
    }

    expect(sim.countNeighbors(2, 2, 2)).toBe(26)
  })

  test('bounded edges do not wrap around', () => {
    const sim = new VoxelAutomaton(4, parseRuleNotation('B1/S1'))
    sim.set(0, 0, 0, true)
    sim.set(0, 0, 1, true)

    expect(sim.countNeighbors(0, 0, 0)).toBe(1)
    expect(sim.countNeighbors(3, 3, 3)).toBe(0)
  })

  test('stepping is deterministic with identical initial state', () => {
    const rule = parseRuleNotation('B6/S5,6,7')
    const a = new VoxelAutomaton(6, rule)
    const b = new VoxelAutomaton(6, parseRuleNotation('B6/S5,6,7'))

    const rnd = [0.1, 0.9, 0.2, 0.25, 0.7, 0.11, 0.13, 0.95]
    let index = 0
    const rng = (): number => {
      const value = rnd[index % rnd.length]
      index += 1
      return value
    }

    a.randomize(0.3, rng)
    index = 0
    b.randomize(0.3, rng)

    for (let i = 0; i < 6; i += 1) {
      a.step()
      b.step()
    }

    expect([...a.cells]).toEqual([...b.cells])
    expect(a.population).toBe(b.population)
    expect(a.generation).toBe(6)
  })
})
