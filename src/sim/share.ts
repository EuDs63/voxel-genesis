/**
 * Shareable state via URL hash and JSON export/import.
 * Base64 helpers work in both browser and Node (vitest).
 */

import type { BoundaryMode } from './grid';
import { Grid3D } from './grid';
import { parseRuleNotation, type Rule } from './rules';
import type { ColorPaletteId } from '../render/colors';
import { validateInterventionIndices } from './interventions';
import type { EnvironmentId } from '../render/environments';

export interface AppSnapshot {
  v: 1 | 2;
  size: number;
  generation: number;
  rule: string;
  ruleName: string;
  boundary: BoundaryMode;
  seedName: string;
  cells: string;
  density?: number;
  speed?: number;
  playing?: boolean;
  seedId?: string;
  sliceAxis?: 'x' | 'y' | 'z';
  sliceIndex?: number;
  sliceVisible?: boolean;
  /** Serialized v2 snapshot of this experiment's restart point (never nested). */
  restart?: string;
  palette?: ColorPaletteId;
  environment?: EnvironmentId;
  sources?: number[];
  barriers?: number[];
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63]! + B64[(triple >> 12) & 63]!;
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63]! : '=';
    out += i + 2 < bytes.length ? B64[triple & 63]! : '=';
  }
  return out;
}

function base64ToBytes(b64: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(b64) || b64.length % 4 === 1) throw new Error('Invalid base64');
  const clean = b64.replace(/=+$/, '');
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]!);
    const b = B64.indexOf(clean[i + 1]!);
    const c = i + 2 < clean.length ? B64.indexOf(clean[i + 2]!) : 0;
    const d = i + 3 < clean.length ? B64.indexOf(clean[i + 3]!) : 0;
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    out.push((triple >> 16) & 255);
    if (i + 2 < clean.length) out.push((triple >> 8) & 255);
    if (i + 3 < clean.length) out.push(triple & 255);
  }
  return new Uint8Array(out);
}

export function btoaUrl(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function atobUrl(str: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(str) || str.length % 4 === 1) throw new Error('Invalid base64url');
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
  return new TextDecoder().decode(base64ToBytes(b64));
}

export function encodeCells(grid: Grid3D): string {
  const parts: string[] = [];
  const s = grid.size;
  const cells = grid.cells;
  for (let z = 0; z < s; z++) {
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const age = cells[x + y * s + z * s * s]!;
        if (age > 0) parts.push(`${x},${y},${z},${age}`);
      }
    }
  }
  return btoaUrl(parts.join(';'));
}

export function decodeCells(encoded: string, grid: Grid3D): void {
  grid.clear();
  if (!encoded) return;
  const raw = atobUrl(encoded);
  if (!raw) return;
  for (const part of raw.split(';')) {
    if (!part) continue;
    const bits = part.split(',');
    const x = Number(bits[0]);
    const y = Number(bits[1]);
    const z = Number(bits[2]);
    const age = Number(bits[3] ?? 1);
    if (![x, y, z, age].every(Number.isInteger) || age < 1 || age > 255 ||
        x < 0 || y < 0 || z < 0 || x >= grid.size || y >= grid.size || z >= grid.size) {
      throw new Error('Invalid cell data');
    }
    grid.set(x, y, z, age);
  }
}

export function snapshotToJSON(snap: AppSnapshot): string {
  return JSON.stringify(snap);
}

export function parseSnapshotJSON(json: string): AppSnapshot {
  if (json.length > 2_000_000) throw new Error('Snapshot too large');
  const data = JSON.parse(json) as AppSnapshot;
  if (!data || (data.v !== 1 && data.v !== 2) || !Number.isInteger(data.size) ||
      data.size < 4 || data.size > 64 || typeof data.rule !== 'string' ||
      typeof data.cells !== 'string' || !Number.isInteger(data.generation) || data.generation < 0 ||
      (data.boundary !== 'clamp' && data.boundary !== 'wrap') ||
      (data.density != null && (!Number.isFinite(data.density) || data.density < 0 || data.density > 1)) ||
      (data.speed != null && (!Number.isFinite(data.speed) || data.speed < 0.5 || data.speed > 60)) ||
      (data.seedName != null && (typeof data.seedName !== 'string' || data.seedName.length > 80)) ||
      (data.seedId != null && (typeof data.seedId !== 'string' || data.seedId.length > 80)) ||
      (data.playing != null && typeof data.playing !== 'boolean') ||
      (data.sliceVisible != null && typeof data.sliceVisible !== 'boolean') ||
      (data.palette != null && !['ember', 'glacier', 'orchid'].includes(data.palette)) ||
      (data.environment != null && !['aurora', 'dawn', 'blueprint'].includes(data.environment)) ||
      (data.sliceAxis != null && !['x', 'y', 'z'].includes(data.sliceAxis)) ||
      (data.sliceIndex != null && (!Number.isInteger(data.sliceIndex) || data.sliceIndex < 0 || data.sliceIndex >= data.size))) {
    throw new Error('Invalid snapshot');
  }
  applySnapshot(data);
  validateInterventionIndices(data.size, data.sources, data.barriers);
  if (data.restart != null) {
    if (typeof data.restart !== 'string' || data.restart.length > 2_000_000) throw new Error('Invalid restart state');
    const restart = parseSnapshotJSON(data.restart);
    if (restart.restart != null) throw new Error('Nested restart state');
  }
  return data;
}

export function applySnapshot(
  snap: AppSnapshot,
): { grid: Grid3D; rule: Rule; generation: number; boundary: BoundaryMode; seedName: string } {
  const grid = new Grid3D(snap.size);
  decodeCells(snap.cells, grid);
  const rule = parseRuleNotation(snap.rule, snap.ruleName || 'Custom');
  return {
    grid,
    rule,
    generation: snap.generation ?? 0,
    boundary: snap.boundary === 'wrap' ? 'wrap' : 'clamp',
    seedName: snap.seedName || 'Custom',
  };
}

export function writeHash(snap: AppSnapshot): void {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  const hash = btoaUrl(snapshotToJSON(snap));
  history.replaceState(null, '', `${location.pathname}${location.search}#v${snap.v}.${hash}`);
}

export function readHash(): AppSnapshot | null {
  if (typeof location === 'undefined') return null;
  const hash = location.hash.replace(/^#/, '');
  if (!hash.startsWith('v1.') && !hash.startsWith('v2.')) return null;
  try {
    return parseSnapshotJSON(atobUrl(hash.slice(3)));
  } catch {
    return null;
  }
}
