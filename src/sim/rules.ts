/**
 * B/S (Birth/Survive) rule parsing and named presets for 26-neighbor Moore CA.
 * Presets favor sparse breathing / crystal dynamics over instant fill.
 */

export interface Rule {
  /** Neighbor counts that birth a dead cell */
  birth: ReadonlySet<number>;
  /** Neighbor counts that keep a live cell alive */
  survive: ReadonlySet<number>;
  /** Display name */
  name: string;
  /** Canonical B/S notation e.g. "B4/S4-5" */
  notation: string;
}

export interface RulePreset {
  id: string;
  name: string;
  notation: string;
  description: string;
}

/**
 * Named presets tuned for interesting long-lived 3D Moore dynamics.
 * Avoid broad birth ranges that flood a 24³ volume in a few generations.
 */
export const RULE_PRESETS: readonly RulePreset[] = [
  {
    id: 'ember-breath',
    name: 'Ember Breath',
    notation: 'B4/S4-5',
    description: 'Sparse embers that pulse, die back, and rekindle — rarely floods the void',
  },
  {
    id: 'crystal-veins',
    name: 'Crystal Veins',
    notation: 'B5/S5-6',
    description: 'Angular crystalline filaments that etch lattice veins without packing solid',
  },
  {
    id: 'nebula-drift',
    name: 'Nebula Drift',
    notation: 'B10-12/S9-14',
    description: 'Soft volumetric mist that slowly morphs and stays sparse',
  },
  {
    id: 'coral-scaffold',
    name: 'Coral Scaffold',
    notation: 'B6/S5-7',
    description: 'Open reef scaffolds with hollow cores — growth without instant fill',
  },
  {
    id: 'pyro-bloom',
    name: 'Pyro Bloom',
    notation: 'B5/S4-6',
    description: 'Brief explosive flares that settle into rocky, airy forms',
  },
  {
    id: 'void-whisper',
    name: 'Void Whisper',
    notation: 'B7/S6-8',
    description: 'Filamentary whispers — delicate and slow, almost secretive',
  },
] as const;

export const DEFAULT_RULE_ID = 'ember-breath';

/**
 * Parse a count list like "4-6", "5-8,10", "13", "0-26".
 * Ranges are inclusive. Duplicates ignored.
 */
export function parseCountList(raw: string): Set<number> {
  const result = new Set<number>();
  const trimmed = raw.trim();
  if (!trimmed) return result;

  for (const part of trimmed.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
    if (rangeMatch) {
      const a = Number(rangeMatch[1]);
      const b = Number(rangeMatch[2]);
      if (!Number.isInteger(a) || !Number.isInteger(b)) {
        throw new Error(`Invalid range: ${token}`);
      }
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let n = lo; n <= hi; n++) {
        if (n < 0 || n > 26) throw new Error(`Neighbor count out of range 0-26: ${n}`);
        result.add(n);
      }
      continue;
    }
    if (!/^\d+$/.test(token)) throw new Error(`Invalid count token: ${token}`);
    const n = Number(token);
    if (n < 0 || n > 26) throw new Error(`Neighbor count out of range 0-26: ${n}`);
    result.add(n);
  }
  return result;
}

/**
 * Parse B/S notation: "B4-6/S5-7", "b4,5,6/s5-7", optional spaces.
 * Case-insensitive. Requires both B and S sections separated by /.
 */
export function parseRuleNotation(notation: string, name = 'Custom'): Rule {
  const cleaned = notation.trim().replace(/\s+/g, '');
  const match = /^B([0-9,\-]*)\/S([0-9,\-]*)$/i.exec(cleaned);
  if (!match) {
    throw new Error(`Invalid B/S notation: "${notation}". Expected e.g. B4-6/S5-7`);
  }
  const birth = parseCountList(match[1] ?? '');
  const survive = parseCountList(match[2] ?? '');
  const canonical = formatNotation(birth, survive);
  return { birth, survive, name, notation: canonical };
}

/** Format sets into canonical B…/S… notation with compact ranges. */
export function formatNotation(birth: ReadonlySet<number>, survive: ReadonlySet<number>): string {
  return `B${compactCounts(birth)}/S${compactCounts(survive)}`;
}

function compactCounts(set: ReadonlySet<number>): string {
  if (set.size === 0) return '';
  const nums = [...set].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = nums[0]!;
  let prev = nums[0]!;
  for (let i = 1; i <= nums.length; i++) {
    const cur = nums[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}-${prev}`);
    if (cur !== undefined) {
      start = cur;
      prev = cur;
    }
  }
  return parts.join(',');
}

export function ruleFromPreset(preset: RulePreset): Rule {
  return parseRuleNotation(preset.notation, preset.name);
}

export function getPresetById(id: string): RulePreset | undefined {
  return RULE_PRESETS.find((p) => p.id === id);
}

export function getDefaultRule(): Rule {
  const preset = getPresetById(DEFAULT_RULE_ID)!;
  return ruleFromPreset(preset);
}

/** Apply rule: should a cell with `neighbors` live next gen given current alive state? */
export function shouldLive(alive: boolean, neighbors: number, rule: Rule): boolean {
  return alive ? rule.survive.has(neighbors) : rule.birth.has(neighbors);
}
