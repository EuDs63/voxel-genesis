/**
 * Editable slice plane for 3D paint/erase.
 */

import * as THREE from 'three';

export type SliceAxis = 'x' | 'y' | 'z';

export class SlicePlane {
  readonly group = new THREE.Group();
  readonly planeMesh: THREE.Mesh;
  readonly helper: THREE.LineSegments;
  axis: SliceAxis = 'y';
  /** Index along axis in grid coords */
  index = 0;
  private gridSize = 24;
  visible = true;

  constructor() {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x3de0ff,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.planeMesh = new THREE.Mesh(geo, mat);

    const edges = new THREE.EdgesGeometry(geo);
    this.helper = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x3de0ff, transparent: true, opacity: 0.55 }),
    );

    this.group.add(this.planeMesh);
    this.group.add(this.helper);
  }

  setGridSize(size: number): void {
    this.gridSize = size;
    this.index = Math.min(this.index, size - 1);
    this.layout();
  }

  setAxis(axis: SliceAxis): void {
    this.axis = axis;
    this.layout();
  }

  setIndex(i: number): void {
    this.index = Math.max(0, Math.min(this.gridSize - 1, i));
    this.layout();
  }

  nudge(delta: number): void {
    this.setIndex(this.index + delta);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.group.visible = v;
  }

  layout(): void {
    const s = this.gridSize;
    const half = (s - 1) / 2;
    const extent = s;
    this.planeMesh.scale.set(1, 1, 1);
    this.planeMesh.rotation.set(0, 0, 0);
    this.planeMesh.position.set(0, 0, 0);

    // PlaneGeometry is XY; orient to axis
    if (this.axis === 'y') {
      this.planeMesh.scale.set(extent, extent, 1);
      this.planeMesh.rotation.x = -Math.PI / 2;
      this.planeMesh.position.set(0, this.index - half, 0);
    } else if (this.axis === 'x') {
      this.planeMesh.scale.set(extent, extent, 1);
      this.planeMesh.rotation.y = Math.PI / 2;
      this.planeMesh.position.set(this.index - half, 0, 0);
    } else {
      this.planeMesh.scale.set(extent, extent, 1);
      this.planeMesh.position.set(0, 0, this.index - half);
    }
    this.helper.position.copy(this.planeMesh.position);
    this.helper.rotation.copy(this.planeMesh.rotation);
    this.helper.scale.copy(this.planeMesh.scale);
  }

  /**
   * Raycast against slice plane → grid cell on the plane, or null.
   */
  hitToCell(
    raycaster: THREE.Raycaster,
  ): { x: number; y: number; z: number } | null {
    if (!this.visible) return null;
    const hits = raycaster.intersectObject(this.planeMesh, false);
    if (!hits.length) return null;
    const p = hits[0]!.point;
    const half = (this.gridSize - 1) / 2;
    let x = Math.round(p.x + half);
    let y = Math.round(p.y + half);
    let z = Math.round(p.z + half);
    if (this.axis === 'x') x = this.index;
    if (this.axis === 'y') y = this.index;
    if (this.axis === 'z') z = this.index;
    const s = this.gridSize;
    if (x < 0 || y < 0 || z < 0 || x >= s || y >= s || z >= s) return null;
    return { x, y, z };
  }

  dispose(): void {
    this.planeMesh.geometry.dispose();
    (this.planeMesh.material as THREE.Material).dispose();
    this.helper.geometry.dispose();
    (this.helper.material as THREE.Material).dispose();
  }
}
