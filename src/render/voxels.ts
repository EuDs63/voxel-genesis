/**
 * InstancedMesh voxel renderer — one draw call for all live cells.
 */

import * as THREE from 'three';
import type { Grid3D } from '../sim/grid';
import { ageToColor } from './colors';

export class VoxelRenderer {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly geometry: THREE.BoxGeometry;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly capacity: number;
  private readonly instanceCells: Uint32Array;
  private gridSize = 0;

  constructor(maxInstances: number, cellGap = 0.18) {
    this.capacity = Math.max(1, maxInstances);
    this.instanceCells = new Uint32Array(this.capacity);
    this.geometry = new THREE.BoxGeometry(1 - cellGap, 1 - cellGap, 1 - cellGap);
    // A low emissive floor preserves saturation while lighting gives each cube
    // readable bright, midtone, and shadow faces.
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.48,
      metalness: 0.08,
      emissive: 0x211511,
      emissiveIntensity: 0.18,
      transparent: true,
      toneMapped: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  sync(grid: Grid3D): number {
    const s = grid.size;
    this.gridSize = s;
    const half = (s - 1) / 2;
    const cells = grid.cells;
    let count = 0;

    for (let z = 0; z < s; z++) {
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const age = cells[x + y * s + z * s * s]!;
          if (age === 0) continue;
          if (count >= this.capacity) break;
          this.dummy.position.set(x - half, y - half, z - half);
          const scale = age === 1 ? 0.55 : age === 2 ? 0.78 : age === 3 ? 0.92 : 1.0;
          this.dummy.scale.setScalar(scale);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(count, this.dummy.matrix);
          ageToColor(age, this.color);
          this.mesh.setColorAt(count, this.color);
          this.instanceCells[count] = x + y * s + z * s * s;
          count++;
        }
      }
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return count;
  }

  /** Resolve an InstancedMesh raycast hit back to its simulation cell. */
  cellAtInstance(instanceId: number): { x: number; y: number; z: number } | null {
    if (!Number.isInteger(instanceId) || instanceId < 0 || instanceId >= this.mesh.count || this.gridSize <= 0) {
      return null;
    }
    const s = this.gridSize;
    const flat = this.instanceCells[instanceId]!;
    const z = Math.floor(flat / (s * s));
    const rest = flat - z * s * s;
    const y = Math.floor(rest / s);
    return { x: rest - y * s, y, z };
  }

  /** Fade and scale hooks used while crossing between adjacent universes. */
  setOpacity(opacity: number): void {
    const value = THREE.MathUtils.clamp(opacity, 0, 1);
    this.material.opacity = value;
    this.material.depthWrite = value > 0.72;
    this.mesh.visible = value > 0.001;
  }

  resetTransform(): void {
    this.mesh.position.set(0, 0, 0);
    this.mesh.scale.setScalar(1);
    this.setOpacity(1);
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
