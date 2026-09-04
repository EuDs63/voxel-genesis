/**
 * Time-trail ghosts — fading translucent voxels of recent generations.
 * THE surprise feature: afterimages of life in the void.
 */

import * as THREE from 'three';
import type { Grid3D } from '../sim/grid';
import { trailColor } from './colors';

interface TrailFrame {
  /** Sparse list of [x,y,z] in grid coords */
  positions: Float32Array;
  count: number;
  /** 1 = freshest */
  strength: number;
}

export class TrailRenderer {
  readonly mesh: THREE.InstancedMesh;
  private readonly frames: TrailFrame[] = [];
  private readonly maxFrames: number;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private capacity: number;
  private gridSize = 24;

  constructor(maxFrames = 5, maxInstances = 20000) {
    this.maxFrames = maxFrames;
    this.capacity = maxInstances;
    const geo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxInstances);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.visible = true;
  }

  setEnabled(on: boolean): void {
    this.mesh.visible = on;
    if (!on) this.clear();
  }

  clear(): void {
    this.frames.length = 0;
    this.mesh.count = 0;
  }

  /** Capture current live cells as a new trail frame (call after step). */
  push(grid: Grid3D): void {
    this.gridSize = grid.size;
    const s = grid.size;
    const cells = grid.cells;
    const pop = grid.population;
    const positions = new Float32Array(pop * 3);
    let n = 0;
    for (let z = 0; z < s; z++) {
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          if (cells[x + y * s + z * s * s]! > 0) {
            positions[n++] = x;
            positions[n++] = y;
            positions[n++] = z;
          }
        }
      }
    }
    const count = n / 3;
    // Decay existing
    for (const f of this.frames) f.strength *= 0.62;
    this.frames.unshift({ positions, count, strength: 1 });
    while (this.frames.length > this.maxFrames) this.frames.pop();
    // Drop very faint
    while (this.frames.length && this.frames[this.frames.length - 1]!.strength < 0.08) {
      this.frames.pop();
    }
    this.rebuild();
  }

  private rebuild(): void {
    const half = (this.gridSize - 1) / 2;
    let idx = 0;
    for (let fi = this.frames.length - 1; fi >= 0; fi--) {
      const frame = this.frames[fi]!;
      // Skip the freshest frame (current gen is drawn by VoxelRenderer)
      if (fi === 0) continue;
      const s = frame.strength;
      trailColor(s, this.color);
      // Bake opacity into color brightness for additive
      this.color.multiplyScalar(0.25 + 0.55 * s);
      for (let i = 0; i < frame.count; i++) {
        if (idx >= this.capacity) break;
        const x = frame.positions[i * 3]!;
        const y = frame.positions[i * 3 + 1]!;
        const z = frame.positions[i * 3 + 2]!;
        this.dummy.position.set(x - half, y - half, z - half);
        this.dummy.scale.setScalar(0.7 + 0.3 * s);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(idx, this.dummy.matrix);
        this.mesh.setColorAt(idx, this.color);
        idx++;
      }
    }
    this.mesh.count = idx;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.dispose();
  }
}
