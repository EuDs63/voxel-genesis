/**
 * Three.js scene: dark void, fog, lights, bloom, orbit controls, camera presets.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private readonly clock = new THREE.Clock();
  private _dt = 1 / 60;
  autoOrbit = true;
  private reducedMotion: boolean;
  private boundsHelper: THREE.LineSegments | null = null;
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
    this.renderer.toneMappingExposure = 1.15;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050508);
    this.scene.fog = new THREE.FogExp2(0x050508, 0.018);

    this.camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 500);
    this.camera.position.set(28, 22, 34);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.minDistance = 8;
    this.controls.maxDistance = 120;
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = this.autoOrbit;
    this.controls.autoRotateSpeed = 0.55;

    const amb = new THREE.AmbientLight(0x1a2030, 0.55);
    const key = new THREE.PointLight(0xff7a3d, 0.6, 120, 2);
    key.position.set(20, 30, 15);
    const fill = new THREE.PointLight(0x3de0ff, 0.35, 100, 2);
    fill.position.set(-25, 10, -20);
    const rim = new THREE.DirectionalLight(0x6a7cff, 0.35);
    rim.position.set(-10, -20, 30);

    this.scene.add(amb, key, fill, rim, this.root);

    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshBasicMaterial({
        color: 0x0a1020,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    disk.rotation.x = -Math.PI / 2;
    disk.position.y = -14;
    this.scene.add(disk);

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
      0.72,
      0.55,
      0.72,
    );
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  setBloom(enabled: boolean): void {
    if (this.reducedMotion) return;
    if (enabled && !this.composer) this.setupBloom();
    if (!enabled) {
      this.composer = null;
      this.bloomPass = null;
    }
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
    if (this.boundsHelper) {
      this.root.remove(this.boundsHelper);
      this.boundsHelper.geometry.dispose();
      (this.boundsHelper.material as THREE.Material).dispose();
    }
    const box = new THREE.BoxGeometry(size, size, size);
    const edges = new THREE.EdgesGeometry(box);
    this.boundsHelper = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x1a2233, transparent: true, opacity: 0.35 }),
    );
    this.root.add(this.boundsHelper);
    const dist = size * 1.85;
    this.controls.minDistance = size * 0.4;
    this.controls.maxDistance = size * 6;
    if (this.camera.position.length() < dist * 0.5) {
      this.camera.position.set(dist * 0.7, dist * 0.55, dist * 0.85);
    }
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
    this.renderer.dispose();
  }
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
