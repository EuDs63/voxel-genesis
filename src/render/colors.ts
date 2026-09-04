/**
 * Age-based ember → cyan color ramp for living voxels.
 */

import * as THREE from 'three';

const _c = new THREE.Color();

/** Map age (1-255) to cinematic ember→amber→cyan. Young stay ember longer. */
export function ageToColor(age: number, out: THREE.Color = _c): THREE.Color {
  const t = Math.min(1, Math.max(0, (age - 1) / 55));
  const s = smooth(t);
  // Young ember #ff5a1f → mid amber #ffb347 → old cyan #3de8ff
  let r: number;
  let g: number;
  let b: number;
  if (s < 0.45) {
    const u = s / 0.45;
    r = lerp(1.0, 1.0, u);
    g = lerp(0.35, 0.70, u);
    b = lerp(0.12, 0.28, u);
  } else {
    const u = (s - 0.45) / 0.55;
    r = lerp(1.0, 0.24, u);
    g = lerp(0.70, 0.91, u);
    b = lerp(0.28, 1.0, u);
  }
  const boost = age <= 3 ? 1.2 : 1.0;
  return out.setRGB(Math.min(1, r * boost), Math.min(1, g * boost), Math.min(1, b * boost));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Ghost trail color — cool translucent violet-cyan. */
export function trailColor(strength: number, out: THREE.Color = _c): THREE.Color {
  const s = Math.min(1, Math.max(0, strength));
  return out.setRGB(0.45 + 0.15 * s, 0.35 + 0.25 * s, 0.95);
}
