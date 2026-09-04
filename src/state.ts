import { parseRuleNotation } from './sim/rules'

export interface SerializedState {
  size: number
  density: number
  rule: string
  generation: number
  cells: string
}

function encodeCells(cells: Uint8Array): string {
  let binary = ''
  for (const value of cells) {
    binary += String.fromCharCode(value)
  }
  return btoa(binary)
}

function decodeCells(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const cells = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    cells[i] = binary.charCodeAt(i)
  }
  return cells
}

export function toSerializedState(input: Omit<SerializedState, 'cells'> & { cells: Uint8Array }): SerializedState {
  return {
    ...input,
    cells: encodeCells(input.cells),
  }
}

export function fromSerializedState(state: SerializedState): SerializedState & { cellBuffer: Uint8Array } {
  parseRuleNotation(state.rule)
  if (!Number.isInteger(state.size) || state.size < 4 || state.size > 48) {
    throw new Error('Invalid grid size in serialized state')
  }

  const cellBuffer = decodeCells(state.cells)
  if (cellBuffer.length !== state.size * state.size * state.size) {
    throw new Error('Serialized cells do not match grid dimensions')
  }

  return { ...state, cellBuffer }
}

export function writeHashState(state: SerializedState): void {
  const encoded = encodeURIComponent(JSON.stringify(state))
  window.location.hash = `state=${encoded}`
}

export function readHashState(): (SerializedState & { cellBuffer: Uint8Array }) | null {
  const hash = window.location.hash.replace(/^#/, '')
  if (!hash.startsWith('state=')) return null

  try {
    const value = decodeURIComponent(hash.slice('state='.length))
    const parsed = JSON.parse(value) as SerializedState
    return fromSerializedState(parsed)
  } catch {
    return null
  }
}
