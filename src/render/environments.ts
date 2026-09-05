import * as THREE from 'three';

export type EnvironmentId = 'aurora' | 'dawn' | 'blueprint';

/** Owns the visible, procedural world backdrop and its disposable resources. */
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
    if (this.current === 'dawn') this.buildDawn();
    else if (this.current === 'blueprint') this.buildBlueprint();
    else this.buildAurora();
  }

  private buildAurora(): void {
    this.group.add(makeSky(0x263a68, 0x192b4f, 0x111a34));
    const texture = makeCurtainTexture();
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      fog: false,
      toneMapped: false,
    });
    const curtainA = new THREE.Mesh(new THREE.PlaneGeometry(112, 70), material);
    curtainA.position.set(-8, 9, -48);
    curtainA.rotation.y = -0.18;
    const curtainB = new THREE.Mesh(new THREE.PlaneGeometry(86, 54), material.clone());
    curtainB.position.set(40, 5, 18);
    curtainB.rotation.y = -Math.PI / 2.4;
    (curtainB.material as THREE.MeshBasicMaterial).opacity = 0.2;
    this.group.add(curtainA, curtainB, makeStars(260, 0x9bcaff));
  }

  private buildDawn(): void {
    // Amber lives in the sky gradient itself, so it remains visible when the
    // camera is looking away from the directional horizon card or straight down.
    this.group.add(makeSky(0x7c8ba1, 0x625d6b, 0x75483d));
    const horizon = new THREE.Mesh(
      new THREE.PlaneGeometry(150, 42),
      new THREE.MeshBasicMaterial({
        map: makeHorizonTexture(),
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
        toneMapped: false,
      }),
    );
    horizon.position.set(0, -this.worldSize * 0.25, -55);
    this.group.add(horizon);
  }

  private buildBlueprint(): void {
    this.group.add(makeSky(0x1c5077, 0x123c62, 0x092744));
    const span = Math.max(54, this.worldSize * 3.2);
    const divisions = Math.max(18, Math.min(48, Math.round(this.worldSize * 1.4)));
    const floor = makeGrid(span, divisions, 0x42d9ef, 0x1c6583, 0.34);
    floor.position.y = -this.worldSize * 0.58;
    const back = makeGrid(span, divisions, 0x42d9ef, 0x1c6583, 0.19);
    back.rotation.x = Math.PI / 2;
    back.position.z = -this.worldSize * 0.92;
    const side = makeGrid(span, divisions, 0x42d9ef, 0x1c6583, 0.14);
    side.rotation.z = Math.PI / 2;
    side.position.x = -this.worldSize * 0.92;
    this.group.add(floor, back, side);
  }
}

function makeSky(top: number, middle: number, bottom: number): THREE.Mesh {
  const texture = makeVerticalGradient(top, middle, bottom);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 18),
    new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    }),
  );
  // Keep the viewer at the center even at the largest allowed orbit distance.
  // The sky remains a backdrop while world-space curtains, grids, and horizons
  // retain their spatial relationship to the voxel sculpture.
  sky.onBeforeRender = (_renderer, _scene, camera) => {
    sky.position.copy(camera.position);
  };
  return sky;
}

function makeVerticalGradient(top: number, middle: number, bottom: number): THREE.DataTexture {
  const height = 128;
  const data = new Uint8Array(height * 4);
  const a = new THREE.Color(top);
  const b = new THREE.Color(middle);
  const c = new THREE.Color(bottom);
  const color = new THREE.Color();
  const encoded = new THREE.Color();
  for (let y = 0; y < height; y++) {
    const t = y / (height - 1);
    if (t < 0.55) color.lerpColors(c, b, t / 0.55);
    else color.lerpColors(b, a, (t - 0.55) / 0.45);
    encoded.copy(color).convertLinearToSRGB();
    const offset = y * 4;
    data[offset] = Math.round(THREE.MathUtils.clamp(encoded.r, 0, 1) * 255);
    data[offset + 1] = Math.round(THREE.MathUtils.clamp(encoded.g, 0, 1) * 255);
    data[offset + 2] = Math.round(THREE.MathUtils.clamp(encoded.b, 0, 1) * 255);
    data[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, 1, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeCurtainTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(canvas.width, canvas.height);
  const teal = new THREE.Color(0x57f3e1);
  const violet = new THREE.Color(0xac76ff);
  const color = new THREE.Color();
  const encoded = new THREE.Color();
  const centers = [0.11, 0.23, 0.36, 0.5, 0.64, 0.77, 0.89];
  for (let py = 0; py < canvas.height; py++) {
    const y = py / (canvas.height - 1);
    for (let px = 0; px < canvas.width; px++) {
      const x = px / (canvas.width - 1);
      let bands = 0;
      for (let i = 0; i < centers.length; i++) {
        const width = 0.045 + (i % 3) * 0.012;
        const d = (x - centers[i]!) / width;
        bands += Math.exp(-d * d * 1.5) * (0.72 + (i % 2) * 0.24);
      }
      const upperFade = smoothstep(0.02, 0.2, y);
      const lowerEdge = 0.86 + Math.sin(x * Math.PI * 2.1) * 0.055 + Math.sin(x * Math.PI * 5.3) * 0.025;
      const lowerFade = 1 - smoothstep(lowerEdge - 0.25, lowerEdge, y);
      const sideFade = smoothstep(0, 0.12, x) * (1 - smoothstep(0.88, 1, x));
      const alpha = Math.min(0.76, (0.08 + bands * 0.4) * upperFade * lowerFade * sideFade);
      color.lerpColors(teal, violet, 0.28 + 0.32 * Math.sin(x * Math.PI * 3.2) ** 2);
      encoded.copy(color).convertLinearToSRGB();
      const offset = (px + py * canvas.width) * 4;
      image.data[offset] = Math.round(encoded.r * 255);
      image.data[offset + 1] = Math.round(encoded.g * 255);
      image.data[offset + 2] = Math.round(encoded.b * 255);
      image.data[offset + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function makeHorizonTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  const glow = ctx.createRadialGradient(128, 67, 2, 128, 67, 118);
  glow.addColorStop(0, 'rgba(255, 205, 126, .95)');
  glow.addColorStop(0.18, 'rgba(255, 161, 82, .48)');
  glow.addColorStop(0.58, 'rgba(224, 113, 73, .14)');
  glow.addColorStop(1, 'rgba(224, 113, 73, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // The radial glow still carries alpha at the canvas bounds. Mask every edge
  // so the plane cannot reveal its rectangular silhouette at oblique angles.
  ctx.globalCompositeOperation = 'destination-in';
  const verticalMask = ctx.createLinearGradient(0, 0, 0, canvas.height);
  verticalMask.addColorStop(0, 'rgba(255,255,255,0)');
  verticalMask.addColorStop(0.2, 'rgba(255,255,255,1)');
  verticalMask.addColorStop(0.72, 'rgba(255,255,255,1)');
  verticalMask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = verticalMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const horizontalMask = ctx.createLinearGradient(0, 0, canvas.width, 0);
  horizontalMask.addColorStop(0, 'rgba(255,255,255,0)');
  horizontalMask.addColorStop(0.16, 'rgba(255,255,255,1)');
  horizontalMask.addColorStop(0.84, 'rgba(255,255,255,1)');
  horizontalMask.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = horizontalMask;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGrid(size: number, divisions: number, center: number, grid: number, opacity: number): THREE.GridHelper {
  const helper = new THREE.GridHelper(size, divisions, center, grid);
  const materials = Array.isArray(helper.material) ? helper.material : [helper.material];
  for (const material of materials) {
    material.transparent = true;
    material.opacity = opacity;
    material.depthWrite = false;
    material.fog = false;
    material.toneMapped = false;
  }
  return helper;
}

function makeStars(count: number, tint: number): THREE.Points {
  const data = new Float32Array(count * 3);
  let seed = 0x4ba73d21;
  const random = (): number => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = 0; i < count; i++) {
    const radius = 64 + random() * 90;
    const theta = random() * Math.PI * 2;
    const y = random() * 2 - 1;
    const radial = Math.sqrt(1 - y * y);
    data[i * 3] = Math.cos(theta) * radial * radius;
    data[i * 3 + 1] = y * radius;
    data[i * 3 + 2] = Math.sin(theta) * radial * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(data, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: tint, size: 0.38, transparent: true, opacity: 0.52, depthWrite: false, fog: false, toneMapped: false }),
  );
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
