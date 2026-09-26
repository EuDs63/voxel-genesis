import * as THREE from 'three';
import { GenesisScene } from '../src/render/scene';
import { getCameraPreset } from '../src/render/camera';
import { Grid3D } from '../src/sim/grid';

function sceneHarness(aspect: number) {
  const scene = Object.create(GenesisScene.prototype) as GenesisScene;
  const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 500);
  camera.position.set(32, 22, 38);
  const controls = {
    target: new THREE.Vector3(), autoRotate: true, minDistance: 0, maxDistance: 0,
    update: vi.fn(() => { camera.lookAt(controls.target); camera.updateMatrixWorld(); }),
  };
  const director = { cancel: vi.fn() };
  Object.assign(scene, { camera, controls, director, gridSize: 24, autoOrbit: true, reducedMotion: false });
  return { scene, camera, controls, director };
}

const shapes = [
  { name: 'thin torus', min: new THREE.Vector3(-10, -1, -10), max: new THREE.Vector3(10, 1, 10) },
  { name: 'full cube away from the origin', min: new THREE.Vector3(4, -5, 8), max: new THREE.Vector3(28, 19, 32) },
];
const viewports = [{ name: 'landscape', aspect: 16 / 9 }, { name: 'portrait', aspect: 9 / 16 }];
const directions = [
  { name: 'oblique', value: new THREE.Vector3(1.55, 0.6, 0.85) },
  { name: 'exactly top down', value: new THREE.Vector3(0, 1, 0) },
];

describe('artwork camera framing', () => {
  for (const shape of shapes) for (const viewport of viewports) for (const direction of directions) {
    it(`fits the ${shape.name} in ${viewport.name} when viewed ${direction.name}`, () => {
      const { scene, camera, controls } = sceneHarness(viewport.aspect);
      // A non-default zoom also verifies framing uses the effective camera FOV.
      camera.zoom = 1.15;
      scene.frameBounds(shape.min, shape.max, direction.value);
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();

      expect(camera.position.toArray().every(Number.isFinite)).toBe(true);
      expect(camera.near).toBeGreaterThan(0);
      expect(camera.far).toBeGreaterThan(camera.near);
      expect(controls.target.distanceTo(shape.min.clone().add(shape.max).multiplyScalar(0.5))).toBeLessThan(1e-10);

      let furthestProjectedEdge = 0;
      for (const x of [shape.min.x, shape.max.x]) for (const y of [shape.min.y, shape.max.y]) for (const z of [shape.min.z, shape.max.z]) {
        const projected = new THREE.Vector3(x, y, z).project(camera);
        expect(projected.toArray().every(Number.isFinite)).toBe(true);
        // lookAt perturbs its basis slightly for a perfectly vertical camera;
        // permit 0.1% of NDC while preserving the intended 16% edge padding.
        const limit = direction.name === 'exactly top down' ? 0.841 : 0.840001;
        expect(Math.abs(projected.x)).toBeLessThanOrEqual(limit);
        expect(Math.abs(projected.y)).toBeLessThanOrEqual(limit);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
        furthestProjectedEdge = Math.max(furthestProjectedEdge, Math.abs(projected.x), Math.abs(projected.y));
      }
      // Fitting must preserve visual presence, including for the thin torus.
      expect(furthestProjectedEdge).toBeGreaterThan(0.83);
    });
  }

  it('applies a featured camera direction while framing instead of cancelling it before it moves', () => {
    const { scene, camera, controls, director } = sceneHarness(16 / 9);
    const grid = new Grid3D(24);
    grid.set(5, 10, 5, 1);
    grid.set(18, 13, 18, 1);
    const preset = getCameraPreset('hero')!;
    const expectedDirection = preset.position(grid.size).sub(preset.target(grid.size)).normalize();

    expect(scene.frameContent(grid, 'hero')).toBe(true);

    const actualDirection = camera.position.clone().sub(controls.target).normalize();
    expect(actualDirection.distanceTo(expectedDirection)).toBeLessThan(1e-10);
    expect(director.cancel).toHaveBeenCalledOnce();
    expect(controls.autoRotate).toBe(false);
  });
});
