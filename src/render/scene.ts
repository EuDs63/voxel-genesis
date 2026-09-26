/**
 * Gallery lighting, restrained bloom, orbit controls and responsive framing.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EnvironmentRenderer, type EnvironmentId } from './environments';
import {
  CameraDirector,
  getCameraPreset,
  type CameraPresetId,
} from './camera';

export interface SceneOptions {
  reducedMotion: boolean;
}

export class GenesisScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  readonly root = new THREE.Group();
  readonly director = new CameraDirector();
  private readonly environmentRenderer = new EnvironmentRenderer();
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private studioEnvironment: THREE.WebGLRenderTarget | null = null;
  private keyLight: THREE.DirectionalLight | null = null;
  private readonly clock = new THREE.Timer();
  private _dt = 1 / 60;
  autoOrbit = true;
  private reducedMotion: boolean;
  private boundsHelper: THREE.LineSegments | null = null;
  private helpersShown = false;
  private gridSize = 24;
  private pendingOrbit: boolean | null = null;
  private readonly resizeObserver: ResizeObserver | null;

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions) {
    this.clock.connect(document);
    this.reducedMotion = opts.reducedMotion;
    this.autoOrbit = !opts.reducedMotion;
    this.director.setReducedMotion(opts.reducedMotion);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf4f7fb);
    this.scene.fog = new THREE.FogExp2(0xf4f7fb, 0.002);
    // A generated studio is captured once, providing long softbox reflections
    // on the beveled facets without downloading an HDR image or extra assets.
    const studio = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.studioEnvironment = pmrem.fromScene(studio, 0.025);
    this.scene.environment = this.studioEnvironment.texture;
    this.scene.environmentIntensity = 0.85;
    studio.dispose();
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 500);
    this.camera.position.set(32, 22, 38);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = this.autoOrbit;
    this.controls.autoRotateSpeed = 0.22;

    const amb = new THREE.HemisphereLight(0xedf6ff, 0x17417b, 0.16);
    const keySun = new THREE.DirectionalLight(0xffffff, 1.65);
    keySun.position.set(-18, 30, 24);
    keySun.castShadow = true;
    keySun.shadow.mapSize.set(1536, 1536);
    keySun.shadow.normalBias = 0.08;
    keySun.shadow.bias = -0.0002;
    this.keyLight = keySun;
    const faceFill = new THREE.DirectionalLight(0x86b6ff, 0.14);
    faceFill.position.set(24, 6, 8);
    const rim = new THREE.DirectionalLight(0xe1f7ff, 1.45);
    rim.position.set(4, 14, -24);

    this.scene.add(this.environmentRenderer.group, amb, keySun, faceFill, rim, this.root);

    window.addEventListener('resize', this.onResize);
    this.resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(this.onResize) : null;
    this.resizeObserver?.observe(canvas);
  }

  private setupBloom(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      this.renderer.getSize(new THREE.Vector2()),
      0.1,
      0.25,
      1.3,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  setBloom(enabled: boolean): void {
    if (this.reducedMotion) return;
    if (enabled && !this.composer) this.setupBloom();
    if (!enabled) this.disposeComposer();
  }

  private disposeComposer(): void {
    // EffectComposer owns its targets, while each pass owns separate GPU
    // resources (bloom alone has several render targets and shader materials).
    for (const pass of this.composer?.passes ?? []) pass.dispose();
    this.composer?.dispose();
    this.composer = null;
    this.bloomPass = null;
  }

  setAutoOrbit(on: boolean): void {
    this.autoOrbit = on && !this.reducedMotion;
    if (!this.director.isAnimating) {
      this.controls.autoRotate = this.autoOrbit;
    } else {
      this.pendingOrbit = this.autoOrbit;
    }
  }

  applyCameraPreset(id: CameraPresetId): boolean {
    const preset = getCameraPreset(id);
    if (!preset) return false;
    this.pendingOrbit = !!preset.autoOrbit && !this.reducedMotion;
    if (preset.autoOrbit && !this.reducedMotion) {
      this.autoOrbit = true;
    } else if (!preset.autoOrbit) {
      this.autoOrbit = false;
    }
    this.director.goTo(this.camera, this.controls, this.gridSize, preset, () => {
      if (this.pendingOrbit != null) {
        this.controls.autoRotate = this.pendingOrbit;
        this.autoOrbit = this.controls.autoRotate;
        this.pendingOrbit = null;
      }
    });
    return true;
  }

  updateBounds(size: number): void {
    this.gridSize = size;
    this.environmentRenderer.updateBounds(size);
    if (this.keyLight) {
      this.keyLight.position.set(-size * 0.9, size * 1.5, size * 1.2);
      const shadowCamera = this.keyLight.shadow.camera;
      shadowCamera.left = shadowCamera.bottom = -size * 0.78;
      shadowCamera.right = shadowCamera.top = size * 0.78;
      shadowCamera.near = 0.5;
      shadowCamera.far = size * 5;
      shadowCamera.updateProjectionMatrix();
    }
    if (this.boundsHelper) {
      this.root.remove(this.boundsHelper);
      this.boundsHelper.geometry.dispose();
      (this.boundsHelper.material as THREE.Material).dispose();
    }
    // Short registration marks give scale without enclosing the artwork in a cage.
    const points: number[] = [];
    const half = size / 2;
    const tick = Math.max(0.7, size * 0.055);
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) {
      const corner = [x * half, y * half, z * half];
      for (let axis = 0; axis < 3; axis++) {
        const end = [...corner];
        end[axis] -= Math.sign(end[axis]!) * tick;
        points.push(...corner, ...end);
      }
    }
    const edges = new THREE.BufferGeometry();
    edges.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    this.boundsHelper = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x859bb9, transparent: true, opacity: 0.15 }),
    );
    this.boundsHelper.visible = this.helpersShown;
    this.root.add(this.boundsHelper);
    const dist = size * 1.85;
    this.controls.minDistance = size * 0.4;
    this.controls.maxDistance = size * 6;
    if (this.camera.position.length() < dist * 0.5) {
      this.camera.position.set(dist * 0.7, dist * 0.55, dist * 0.85);
    }
  }

  get helpersVisible(): boolean {
    return this.helpersShown;
  }

  setHelpersVisible(visible: boolean): void {
    this.helpersShown = visible;
    if (this.boundsHelper) this.boundsHelper.visible = visible;
  }

  get environment(): EnvironmentId {
    return this.environmentRenderer.environment;
  }

  setEnvironment(id: EnvironmentId): void {
    this.environmentRenderer.setEnvironment(id);
    const backdrop = id === 'dawn' ? 0xf7f4f1 : id === 'blueprint' ? 0xecf2fa : 0xf4f7fb;
    this.scene.background = new THREE.Color(backdrop);
    this.scene.fog?.color.setHex(backdrop);
  }

  /** Fit live cells prominently into the actual artwork viewport. */
  frameContent(grid: { size: number; cells: ArrayLike<number> }, presetId?: CameraPresetId): boolean {
    const half = (grid.size - 1) / 2;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    let found = false;
    for (let z = 0; z < grid.size; z++) {
      for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
          if (!grid.cells[x + y * grid.size + z * grid.size * grid.size]) continue;
          min.min(new THREE.Vector3(x - half - 0.5, y - half - 0.5, z - half - 0.5));
          max.max(new THREE.Vector3(x - half + 0.5, y - half + 0.5, z - half + 0.5));
          found = true;
        }
      }
    }
    if (!found) {
      const fallback = Math.max(2, grid.size * 0.18);
      min.setScalar(-fallback);
      max.setScalar(fallback);
    }
    const preset = presetId ? getCameraPreset(presetId) : undefined;
    const direction = preset?.position(grid.size).sub(preset.target(grid.size));
    if (preset) this.autoOrbit = !!preset.autoOrbit && !this.reducedMotion;
    this.frameBounds(min, max, direction);
    return found;
  }

  frameBounds(min: THREE.Vector3, max: THREE.Vector3, preferredDirection?: THREE.Vector3): void {
    this.director.cancel();
    this.pendingOrbit = null;
    this.controls.autoRotate = this.autoOrbit;
    const center = min.clone().add(max).multiplyScalar(0.5);
    const radius = Math.max(0.9, min.distanceTo(max) * 0.5);
    const direction = preferredDirection?.clone() ?? this.camera.position.clone().sub(this.controls.target);
    if (direction.lengthSq() < 0.001) direction.set(1, 0.7, 1);
    direction.normalize();
    // Fit the projected box rather than its bounding sphere: a thin ring
    // deserves the same visual presence as a cube. Matrix4.lookAt supplies
    // the camera's actual right/up basis, including its vertical-view fallback.
    const viewBasis = new THREE.Matrix4().lookAt(direction, new THREE.Vector3(), this.camera.up);
    const right = new THREE.Vector3().setFromMatrixColumn(viewBasis, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(viewBasis, 1);
    const tanVertical = Math.tan(THREE.MathUtils.degToRad(this.camera.getEffectiveFOV()) * 0.5);
    const tanHorizontal = tanVertical * this.camera.aspect;
    const occupancy = 0.84;
    const corner = new THREE.Vector3();
    let distance = Math.max(1.8, radius * 1.05);
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) {
      corner.set(x, y, z).sub(center);
      const depth = corner.dot(direction);
      distance = Math.max(
        distance,
        Math.abs(corner.dot(right)) / (tanHorizontal * occupancy) + depth,
        Math.abs(corner.dot(up)) / (tanVertical * occupancy) + depth,
      );
    }
    this.controls.target.copy(center);
    this.camera.position.copy(center).addScaledVector(direction, distance);
    this.controls.minDistance = Math.max(1.8, radius * 1.05);
    this.controls.maxDistance = Math.max(this.gridSize * 6, distance * 3);
    // Keep near stable after framing so a later manual dolly cannot clip cells.
    this.camera.near = 0.1;
    this.camera.far = Math.max(500, distance + 220);
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  /** Advance the clock once per frame (call before render). */
  get delta(): number {
    this.clock.update();
    this._dt = this.clock.getDelta();
    return this._dt;
  }

  render(): void {
    this.director.update(this.camera, this.controls, this._dt);
    if (!this.director.isAnimating) {
      this.controls.update();
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  private onResize = (): void => {
    const w = Math.max(1, this.renderer.domElement.clientWidth);
    const h = Math.max(1, this.renderer.domElement.clientHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.bloomPass?.resolution.set(w, h);
  };

  dispose(): void {
    this.clock.dispose();
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.controls.dispose();
    this.disposeComposer();
    this.environmentRenderer.dispose();
    this.environmentRenderer.group.clear();
    this.scene.environment = null;
    this.studioEnvironment?.dispose();
    this.studioEnvironment = null;
    this.keyLight?.shadow.dispose();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      for (const material of materials) material.dispose();
    });
    this.renderer.dispose();
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
