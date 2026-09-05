/**
 * Three.js scene: dark void, fog, lights, bloom, orbit controls, camera presets.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
  private readonly clock = new THREE.Clock();
  private _dt = 1 / 60;
  autoOrbit = true;
  private reducedMotion: boolean;
  private boundsHelper: THREE.LineSegments | null = null;
  private helpersShown = true;
  private gridSize = 24;
  private pendingOrbit: boolean | null = null;

  constructor(canvas: HTMLCanvasElement, opts: SceneOptions) {
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
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x111a34);
    this.scene.fog = new THREE.FogExp2(0x0a1022, 0.012);

    this.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(30, 20, 35);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = this.autoOrbit;
    this.controls.autoRotateSpeed = 0.55;

    const amb = new THREE.HemisphereLight(0xa9bad5, 0x100a10, 1.08);
    const keySun = new THREE.DirectionalLight(0xffc3a0, 2.45);
    keySun.position.set(18, 28, 24);
    const faceFill = new THREE.DirectionalLight(0xdce8ff, 1.18);
    faceFill.position.set(-16, 7, 20);
    const key = new THREE.PointLight(0xff7138, 72, 120, 2);
    key.position.set(20, 30, 15);
    const fill = new THREE.PointLight(0x42d9ff, 48, 100, 2);
    fill.position.set(-25, 10, -20);
    const rim = new THREE.DirectionalLight(0x7188ff, 1.15);
    rim.position.set(-10, -20, 30);

    this.scene.add(this.environmentRenderer.group, amb, keySun, faceFill, key, fill, rim, this.root);

    if (!this.reducedMotion) {
      this.setupBloom();
    }

    window.addEventListener('resize', this.onResize);
  }

  private setupBloom(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.48,
      0.34,
      0.82,
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
    if (this.boundsHelper) {
      this.root.remove(this.boundsHelper);
      this.boundsHelper.geometry.dispose();
      (this.boundsHelper.material as THREE.Material).dispose();
    }
    const box = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(box);
    this.boundsHelper = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x28364b, transparent: true, opacity: 0.28 }),
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
  }

  /** Fit live cells into roughly 58% of the viewport, independent of grid size. */
  frameContent(grid: { size: number; cells: ArrayLike<number> }): boolean {
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
    this.frameBounds(min, max);
    return found;
  }

  frameBounds(min: THREE.Vector3, max: THREE.Vector3): void {
    this.director.cancel();
    this.pendingOrbit = null;
    this.controls.autoRotate = this.autoOrbit;
    const center = min.clone().add(max).multiplyScalar(0.5);
    const radius = Math.max(0.9, min.distanceTo(max) * 0.5);
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * this.camera.aspect);
    const limitingFov = Math.min(verticalFov, horizontalFov);
    const distance = radius / (Math.tan(limitingFov * 0.5) * 0.58);
    const direction = this.camera.position.clone().sub(this.controls.target);
    if (direction.lengthSq() < 0.001) direction.set(1, 0.7, 1);
    direction.normalize();
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.bloomPass?.resolution.set(w, h);
  };

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.controls.dispose();
    this.disposeComposer();
    this.environmentRenderer.dispose();
    this.environmentRenderer.group.clear();
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
