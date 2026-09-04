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
  private readonly material: THREE.MeshBasicMaterial;
  private readonly capacity: number;

  constructor(maxInstances: number, cellGap = 0.18) {
    this.capacity = Math.max(1, maxInstances);
    this.geometry = new THREE.BoxGeometry(1 - cellGap, 1 - cellGap, 1 - cellGap);
    // Unlit + bloom = vivid ember/cyan in the void (StandardMaterial washed out under dim lights)
    this.material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      toneMapped: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
  }

  sync(grid: Grid3D): number {
    const s = grid.size;
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
          count++;
        }
      }
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    return count;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.mesh.dispose();
  }
}
