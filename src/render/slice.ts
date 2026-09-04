/**
 * Editable slice plane for 3D paint/erase with snap-to-grid hover feedback.
 */

import * as THREE from 'three';

export type SliceAxis = 'x' | 'y' | 'z';

export class SlicePlane {
  readonly group = new THREE.Group();
  readonly planeMesh: THREE.Mesh;
  readonly helper: THREE.LineSegments;
  /** Snap-to-grid cell highlight (wire box) */
  readonly hoverMesh: THREE.Mesh;
  readonly hoverCross: THREE.LineSegments;
  axis: SliceAxis = 'y';
  /** Index along axis in grid coords */
  index = 0;
  private gridSize = 24;
  visible = true;
  private hoverCell: { x: number; y: number; z: number } | null = null;
  private brushRadius = 0;
  private paintFlash = 0;

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

    // Unit cube highlight — scaled to brush footprint
    const hoverGeo = new THREE.BoxGeometry(1, 1, 1);
    this.hoverMesh = new THREE.Mesh(
      hoverGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff6b2d,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.hoverMesh.visible = false;

    // Crosshair on the slice through the hovered cell
    const crossPositions = new Float32Array([
      -0.5, 0, 0, 0.5, 0, 0, 0, -0.5, 0, 0, 0.5, 0,
    ]);
    const crossGeo = new THREE.BufferGeometry();
    crossGeo.setAttribute('position', new THREE.BufferAttribute(crossPositions, 3));
    this.hoverCross = new THREE.LineSegments(
      crossGeo,
      new THREE.LineBasicMaterial({ color: 0xff6b2d, transparent: true, opacity: 0.9 }),
    );
    this.hoverCross.visible = false;

    this.group.add(this.planeMesh);
    this.group.add(this.helper);
    this.group.add(this.hoverMesh);
    this.group.add(this.hoverCross);
  }

  setGridSize(size: number): void {
    this.gridSize = size;
    this.index = Math.min(this.index, size - 1);
    this.layout();
  }

  setAxis(axis: SliceAxis): void {
    this.axis = axis;
    this.layout();
    this.refreshHoverVisual();
  }

  setIndex(i: number): void {
    this.index = Math.max(0, Math.min(this.gridSize - 1, i));
    this.layout();
    this.refreshHoverVisual();
  }

  nudge(delta: number): void {
    this.setIndex(this.index + delta);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.group.visible = v;
    if (!v) this.clearHover();
  }

  setBrushRadius(r: number): void {
    this.brushRadius = Math.max(0, Math.floor(r));
    this.refreshHoverVisual();
  }

  /** Flash the highlight briefly after a paint stroke. */
  flashPaint(): void {
    this.paintFlash = 0.22;
  }

  /** Tick hover flash animation (dt in seconds). */
  update(dt: number): void {
    if (this.paintFlash > 0) {
      this.paintFlash = Math.max(0, this.paintFlash - dt);
      const mat = this.hoverMesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.35 + (this.paintFlash / 0.22) * 0.45;
      mat.color.setHex(this.paintFlash > 0 ? 0xffaa44 : 0xff6b2d);
    }
  }

  clearHover(): void {
    this.hoverCell = null;
    this.hoverMesh.visible = false;
    this.hoverCross.visible = false;
  }

  setHoverCell(cell: { x: number; y: number; z: number } | null): void {
    if (
      cell &&
      this.hoverCell &&
      cell.x === this.hoverCell.x &&
      cell.y === this.hoverCell.y &&
      cell.z === this.hoverCell.z
    ) {
      return;
    }
    this.hoverCell = cell;
    this.refreshHoverVisual();
  }

  getHoverCell(): { x: number; y: number; z: number } | null {
    return this.hoverCell;
  }

  private refreshHoverVisual(): void {
    if (!this.hoverCell || !this.visible) {
      this.hoverMesh.visible = false;
      this.hoverCross.visible = false;
      return;
    }
    const half = (this.gridSize - 1) / 2;
    const { x, y, z } = this.hoverCell;
    const r = this.brushRadius;
    const span = 1 + r * 2;

    // Position at cell center in world coords
    this.hoverMesh.position.set(x - half, y - half, z - half);
    if (this.axis === 'x') this.hoverMesh.scale.set(0.92, span, span);
    else if (this.axis === 'y') this.hoverMesh.scale.set(span, 0.92, span);
    else this.hoverMesh.scale.set(span, span, 0.92);
    this.hoverMesh.visible = true;

    // Crosshair sits on the plane, sized to brush
    this.hoverCross.position.copy(this.hoverMesh.position);
    this.hoverCross.rotation.copy(this.planeMesh.rotation);
    const crossSpan = this.gridSize * 0.35;
    if (this.axis === 'y') {
      this.hoverCross.scale.set(crossSpan, 1, crossSpan);
    } else if (this.axis === 'x') {
      this.hoverCross.scale.set(crossSpan, 1, crossSpan);
    } else {
      this.hoverCross.scale.set(crossSpan, 1, crossSpan);
    }
    this.hoverCross.visible = true;
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
   * Raycast against slice plane → snapped grid cell on the plane, or null.
   */
  hitToCell(raycaster: THREE.Raycaster): { x: number; y: number; z: number } | null {
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
    this.hoverMesh.geometry.dispose();
    (this.hoverMesh.material as THREE.Material).dispose();
    this.hoverCross.geometry.dispose();
    (this.hoverCross.material as THREE.Material).dispose();
  }
}
