/**
 * Cinematic camera presets with optional smooth transitions.
 */

import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export type CameraPresetId = 'orbit' | 'hero' | 'top' | 'close' | 'flyby';

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  /** Relative to grid size */
  position: (size: number) => THREE.Vector3;
  target: (size: number) => THREE.Vector3;
  /** Whether auto-orbit should be enabled after arriving */
  autoOrbit?: boolean;
}

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  {
    id: 'orbit',
    label: 'Orbit',
    position: (s) => new THREE.Vector3(s * 1.15, s * 0.9, s * 1.4),
    target: () => new THREE.Vector3(0, 0, 0),
    autoOrbit: true,
  },
  {
    id: 'hero',
    label: 'Hero',
    position: (s) => new THREE.Vector3(s * 1.55, s * 0.55, s * 0.85),
    target: (s) => new THREE.Vector3(0, -s * 0.05, 0),
    autoOrbit: false,
  },
  {
    id: 'top',
    label: 'Top-down',
    position: (s) => new THREE.Vector3(0.01, s * 2.2, 0.01),
    target: () => new THREE.Vector3(0, 0, 0),
    autoOrbit: false,
  },
  {
    id: 'close',
    label: 'Close-up',
    position: (s) => new THREE.Vector3(s * 0.55, s * 0.35, s * 0.7),
    target: () => new THREE.Vector3(0, 0, 0),
    autoOrbit: false,
  },
  {
    id: 'flyby',
    label: 'Flyby',
    position: (s) => new THREE.Vector3(s * 1.8, s * 0.25, -s * 0.4),
    target: (s) => new THREE.Vector3(0, s * 0.1, 0),
    autoOrbit: false,
  },
] as const;

export function getCameraPreset(id: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.id === id);
}

export class CameraDirector {
  private active = false;
  private t = 0;
  private duration = 0.85;
  private fromPos = new THREE.Vector3();
  private toPos = new THREE.Vector3();
  private fromTarget = new THREE.Vector3();
  private toTarget = new THREE.Vector3();
  private onComplete: (() => void) | null = null;
  private reducedMotion = false;

  setReducedMotion(v: boolean): void {
    this.reducedMotion = v;
  }

  get isAnimating(): boolean {
    return this.active;
  }

  goTo(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    size: number,
    preset: CameraPreset,
    onComplete?: () => void,
  ): void {
    this.fromPos.copy(camera.position);
    this.fromTarget.copy(controls.target);
    this.toPos.copy(preset.position(size));
    this.toTarget.copy(preset.target(size));
    this.onComplete = onComplete ?? null;

    if (this.reducedMotion) {
      camera.position.copy(this.toPos);
      controls.target.copy(this.toTarget);
      controls.update();
      this.active = false;
      this.onComplete?.();
      this.onComplete = null;
      return;
    }

    this.t = 0;
    this.duration = 0.85;
    this.active = true;
    controls.autoRotate = false;
  }

  /** Call each frame with dt seconds. Returns true while animating. */
  update(camera: THREE.PerspectiveCamera, controls: OrbitControls, dt: number): boolean {
    if (!this.active) return false;
    this.t += dt;
    const u = Math.min(1, this.t / this.duration);
    // smoothstep
    const e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(this.fromPos, this.toPos, e);
    controls.target.lerpVectors(this.fromTarget, this.toTarget, e);
    controls.update();
    if (u >= 1) {
      this.active = false;
      this.onComplete?.();
      this.onComplete = null;
    }
    return this.active;
  }
}
