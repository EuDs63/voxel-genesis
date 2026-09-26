/**
 * InstancedMesh voxel renderer — one draw call for all live cells.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Grid3D } from '../sim/grid';
import { ageToColor, COLOR_PALETTES, getColorPalette } from './colors';

export class VoxelRenderer {
  readonly mesh: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly crystalTint = new THREE.Color();
  private readonly geometry: RoundedBoxGeometry;
  private readonly material: THREE.MeshPhysicalMaterial;
  private readonly capacity: number;
  private readonly instanceCells: Uint32Array;
  private readonly spreadMatrix = new THREE.Matrix4();
  private gridSize = 0;
  private currentSpread = 1;
  private targetSpread = 1;

  constructor(maxInstances: number, cellGap = 0.045) {
    this.capacity = Math.max(1, maxInstances);
    this.instanceCells = new Uint32Array(this.capacity);
    // One shared bevel gives every cell a slim, silver-catching edge without
    // adding draw calls. The broad faces remain flat enough to read as voxels.
    this.geometry = new RoundedBoxGeometry(1 - cellGap, 1 - cellGap, 1 - cellGap, 2, 0.14);
    this.material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.075,
      metalness: 0.18,
      transmission: 0.72,
      thickness: 1.45,
      attenuationColor: 0x82c9f5,
      attenuationDistance: 3.2,
      ior: 1.5,
      clearcoat: 1,
      clearcoatRoughness: 0.035,
      iridescence: 0.08,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [100, 180],
      envMapIntensity: 1.55,
      transparent: true,
      toneMapped: true,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
  }

  sync(grid: Grid3D): number {
    const s = grid.size;
    this.gridSize = s;
    const half = (s - 1) / 2;
    const cells = grid.cells;
    this.crystalTint.setHex(COLOR_PALETTES[getColorPalette()].ancient);
    let count = 0;

    for (let z = 0; z < s; z++) {
      for (let y = 0; y < s; y++) {
        for (let x = 0; x < s; x++) {
          const age = cells[x + y * s + z * s * s]!;
          if (age === 0) continue;
          if (count >= this.capacity) break;
          this.dummy.position.set(x - half, y - half, z - half).multiplyScalar(this.currentSpread);
          const scale = age === 1 ? 0.97 : age === 2 ? 0.98 : age === 3 ? 0.99 : 1.0;
          this.dummy.scale.setScalar(scale);
          this.dummy.updateMatrix();
          this.mesh.setMatrixAt(count, this.dummy.matrix);
          ageToColor(age, this.color);
          // The gentle face-to-face variation reads as depth inside a crystal.
          // It remains deterministic when the same specimen is revisited.
          const mineral = Math.sin(x * 1.73 + z * 2.17 + y * 0.43) * 0.035;
          const ice = THREE.MathUtils.clamp(0.035 + (y / Math.max(1, s - 1)) * 0.3 + (z / Math.max(1, s - 1)) * 0.07 + Math.sin(x * 0.31 + y * 0.18) * 0.13, 0.02, 0.64);
          this.color.lerp(this.crystalTint, ice);
          this.color.multiplyScalar(0.82 + (y / Math.max(1, s - 1)) * 0.2 + mineral);
          this.mesh.setColorAt(count, this.color);
          this.instanceCells[count] = x + y * s + z * s * s;
          count++;
        }
      }
    }

    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
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

  /** Expand the crystal without touching its cellular state or age history. */
  setSpread(value: number, immediate = false): void {
    this.targetSpread = THREE.MathUtils.clamp(value, 1, 1.4);
    if (immediate) {
      this.currentSpread = this.targetSpread;
      this.applySpread();
    }
  }

  update(dt: number): void {
    if (this.currentSpread === this.targetSpread) return;
    this.currentSpread = THREE.MathUtils.lerp(this.currentSpread, this.targetSpread, 1 - Math.exp(-Math.min(dt, 0.1) * 7));
    if (Math.abs(this.currentSpread - this.targetSpread) < 0.0001) this.currentSpread = this.targetSpread;
    this.applySpread();
  }

  private applySpread(): void {
    const size = this.gridSize;
    if (!size || !this.mesh.count) return;
    const half = (size - 1) / 2;
    for (let instance = 0; instance < this.mesh.count; instance++) {
      const flat = this.instanceCells[instance]!;
      const z = Math.floor(flat / (size * size));
      const rest = flat - z * size * size;
      const y = Math.floor(rest / size);
      const x = rest - y * size;
      this.mesh.getMatrixAt(instance, this.spreadMatrix);
      this.spreadMatrix.setPosition((x - half) * this.currentSpread, (y - half) * this.currentSpread, (z - half) * this.currentSpread);
      this.mesh.setMatrixAt(instance, this.spreadMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    // InstancedMesh raycasting uses this sphere before testing each actual cube.
    this.mesh.computeBoundingSphere();
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
