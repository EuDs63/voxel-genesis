export interface Rule {
  birth: Set<number>
  survive: Set<number>
  notation: string
  name?: string
}

function parseSection(section: string): Set<number> {
  const source = section.trim()
  const tokens = source.includes(',') ? source.split(',') : source.split('')
  const values = new Set<number>()

  for (const token of tokens) {
    if (!token) continue
    const value = Number.parseInt(token, 10)
    if (!Number.isInteger(value) || value < 0 || value > 26) {
      throw new Error(`Invalid neighbor count: ${token}`)
    }
    values.add(value)
  }

  return values
}

function formatSection(values: Set<number>): string {
  return [...values].sort((a, b) => a - b).join(',')
}

export function formatRuleNotation(birth: Set<number>, survive: Set<number>): string {
  return `B${formatSection(birth)}/S${formatSection(survive)}`
}

export function parseRuleNotation(input: string, name?: string): Rule {
  const normalized = input.toUpperCase().replaceAll(' ', '')
  const match = /^B([^/]+)\/S(.+)$/.exec(normalized)

  if (!match) {
    throw new Error('Rule must be in B.../S... format')
  }

  const birth = parseSection(match[1])
  const survive = parseSection(match[2])

  if (birth.size === 0 || survive.size === 0) {
    throw new Error('Birth and survival sections cannot be empty')
  }

  return {
    birth,
    survive,
    notation: formatRuleNotation(birth, survive),
    name,
  }
}

export const RULE_PRESETS: Rule[] = [
  parseRuleNotation('B6/S5,6,7', 'Nebula Bloom'),
  parseRuleNotation('B5/S4,5', 'Crystal Drift'),
  parseRuleNotation('B7/S6,7,8', 'Pulse Lattice'),
  parseRuleNotation('B6,7/S5,6,7,8', 'Aether Weave'),
]
