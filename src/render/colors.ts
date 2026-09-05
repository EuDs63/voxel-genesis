/** Runtime-selectable age ramps shared by living voxels and their trails. */

import * as THREE from 'three';

export type ColorPaletteId = 'ember' | 'glacier' | 'orchid';

export interface ColorPalette {
  readonly young: number;
  readonly mature: number;
  readonly ancient: number;
  readonly trail: number;
}

export const COLOR_PALETTES: Readonly<Record<ColorPaletteId, ColorPalette>> = {
  ember: { young: 0xff4b1f, mature: 0xffb14a, ancient: 0x48dcff, trail: 0x778cff },
  glacier: { young: 0x5b9dff, mature: 0x61f4ef, ancient: 0xe3fbff, trail: 0x668de8 },
  orchid: { young: 0xff4f9a, mature: 0xb77aff, ancient: 0x66e8ff, trail: 0x9a70db },
};

let currentPaletteId: ColorPaletteId = 'ember';
const _c = new THREE.Color();
const _from = new THREE.Color();
const _to = new THREE.Color();

export function setColorPalette(id: ColorPaletteId): void {
  currentPaletteId = id;
}

export function getColorPalette(): ColorPaletteId {
  return currentPaletteId;
}

/** Map age (1-255) through the active young-to-ancient ramp. */
export function ageToColor(age: number, out: THREE.Color = _c): THREE.Color {
  const t = Math.min(1, Math.max(0, (age - 1) / 55));
  const s = smooth(t);
  const palette = COLOR_PALETTES[currentPaletteId];
  const split = 0.46;
  if (s < split) {
    _from.setHex(palette.young);
    _to.setHex(palette.mature);
    out.lerpColors(_from, _to, s / split);
  } else {
    _from.setHex(palette.mature);
    _to.setHex(palette.ancient);
    out.lerpColors(_from, _to, (s - split) / (1 - split));
  }
  if (age <= 2) out.multiplyScalar(age === 1 ? 1.12 : 1.05);
  return out;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Muted ghost color derived from the active palette. */
export function trailColor(strength: number, out: THREE.Color = _c): THREE.Color {
  const s = Math.min(1, Math.max(0, strength));
  const palette = COLOR_PALETTES[currentPaletteId];
  _from.setHex(palette.trail);
  _to.setHex(palette.ancient);
  return out.lerpColors(_from, _to, 0.12 + s * 0.22);
}
