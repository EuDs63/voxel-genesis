import * as THREE from 'three';

export type EnvironmentId = 'aurora' | 'dawn' | 'blueprint';

/** Quiet studio surfaces keep the silhouette suspended in an unbroken light field. */
export class EnvironmentRenderer {
  readonly group = new THREE.Group();
  private current: EnvironmentId = 'aurora';
  private worldSize = 24;

  constructor() {
    this.group.name = 'environment';
    this.rebuild();
  }

  get environment(): EnvironmentId {
    return this.current;
  }

  setEnvironment(id: EnvironmentId): void {
    if (id === this.current) return;
    this.current = id;
    this.rebuild();
  }

  updateBounds(size: number): void {
    this.worldSize = Math.max(1, size);
    this.rebuild();
  }

  dispose(): void {
    disposeChildren(this.group);
  }

  private rebuild(): void {
    disposeChildren(this.group);
    this.group.clear();
    const tint = this.current === 'dawn' ? 0xb4a89d : this.current === 'blueprint' ? 0x8ba4ce : 0x8aa9ce;
    // Two feathered, texture-only pools suggest reflected light and contact.
    // Unlike a ground plane, they never produce a hard horizon during orbiting.
    this.addPool(tint, this.worldSize * 1.55, 0.24, -this.worldSize * 0.44);
    this.addPool(tint, this.worldSize * 0.9, 0.1, -this.worldSize * 0.439);
    if (this.current === 'blueprint') this.buildBlueprint();
  }

  private addPool(color: number, span: number, opacity: number, height: number): void {
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(span, span),
      new THREE.MeshBasicMaterial({
        color,
        map: makeSoftPoolTexture(),
        transparent: true,
        opacity,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = height;
    pool.renderOrder = -1;
    this.group.add(pool);
  }

  private buildBlueprint(): void {
    const span = this.worldSize * 2.2;
    const grid = new THREE.GridHelper(span, 32, 0x7695c2, 0xa0b7d8);
    grid.position.y = -this.worldSize * 0.443;
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    for (const material of materials) {
      material.transparent = true;
      material.opacity = 0.13;
      material.depthWrite = false;
      material.fog = true;
      material.toneMapped = false;
    }
    this.group.add(grid);
  }
}

/** A smooth, finite shadow: both value and derivative approach zero at its edge. */
function makeSoftPoolTexture(): THREE.DataTexture {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const radius = Math.hypot((x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1);
      const falloff = Math.max(0, 1 - radius * radius);
      const index = (x + y * size) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 255;
      pixels[index + 3] = Math.round(falloff * falloff * falloff * 255);
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function disposeChildren(root: THREE.Object3D): void {
  root.traverse((object) => {
    const renderable = object as THREE.Mesh;
    renderable.geometry?.dispose();
    const materials = Array.isArray(renderable.material) ? renderable.material : renderable.material ? [renderable.material] : [];
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}
