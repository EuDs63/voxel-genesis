/**
 * Shareable state via URL hash and JSON export/import.
 * Base64 helpers work in both browser and Node (vitest).
 */

import type { BoundaryMode } from './grid';
import { Grid3D } from './grid';
import { parseRuleNotation, type Rule } from './rules';

export interface AppSnapshot {
  v: 1;
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
    if ([x, y, z, age].every((n) => Number.isFinite(n))) {
      grid.set(x, y, z, age);
    }
  }
}

export function snapshotToJSON(snap: AppSnapshot): string {
  return JSON.stringify(snap);
}

export function parseSnapshotJSON(json: string): AppSnapshot {
  const data = JSON.parse(json) as AppSnapshot;
  if (!data || data.v !== 1 || typeof data.size !== 'number' || typeof data.rule !== 'string') {
    throw new Error('Invalid snapshot');
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
  history.replaceState(null, '', `${location.pathname}${location.search}#v1.${hash}`);
}

export function readHash(): AppSnapshot | null {
  if (typeof location === 'undefined') return null;
  const hash = location.hash.replace(/^#/, '');
  if (!hash.startsWith('v1.')) return null;
  try {
    return parseSnapshotJSON(atobUrl(hash.slice(3)));
  } catch {
    return null;
  }
}
