import { Grid3D } from '../sim/grid';
import { applySeed } from '../sim/seeds';
import { getPresetById, parseRuleNotation, ruleFromPreset, type Rule } from '../sim/rules';
import type { CameraPresetId } from '../render/camera';

export interface FeaturedScene {
  id: string; seedId: string; ruleId: string; camera: CameraPresetId; speed: number;
  nameKey: string; hintKey: string; descriptionKey: string; ruleNotation?: string;
  /** Grid resolution chosen for the physical thickness of this specimen. */
  size?: number;
}

export const FEATURED_SCENES: readonly FeaturedScene[] = [
  { id: 'continuum', seedId: 'torus-knot', ruleId: 'nebula-drift', ruleNotation: 'B10/S10-26', camera: 'hero', speed: 3, size: 40, nameKey: 'featured.continuum', hintKey: 'featured.continuumHint', descriptionKey: 'featured.continuumDescription' },
  { id: 'torus', seedId: 'ember-ring', ruleId: 'pyro-bloom', ruleNotation: 'B3/S4-6', camera: 'hero', speed: 5, nameKey: 'featured.torus', hintKey: 'featured.torusHint', descriptionKey: 'featured.torusDescription' },
  { id: 'menger', seedId: 'menger-frame', ruleId: 'ember-breath', camera: 'hero', speed: 4, nameKey: 'featured.menger', hintKey: 'featured.mengerHint', descriptionKey: 'featured.mengerDescription' },
  { id: 'wave', seedId: 'wave-sheet', ruleId: 'pyro-bloom', camera: 'hero', speed: 4, nameKey: 'featured.wave', hintKey: 'featured.waveHint', descriptionKey: 'featured.waveDescription' },
];

export const DEFAULT_FEATURED_SCENE = FEATURED_SCENES[0]!;

export function getFeaturedRule(feature: FeaturedScene): Rule {
  // Catalog starting shapes need different conditions to remain observable.
  if (feature.ruleNotation) return parseRuleNotation(feature.ruleNotation, feature.id);
  const preset = getPresetById(feature.ruleId);
  if (!preset) throw new Error(`Unknown featured rule: ${feature.ruleId}`);
  return ruleFromPreset(preset);
}

export function drawSeedPreview(canvas: HTMLCanvasElement, seedId: string): void {
  const size = FEATURED_SCENES.find((scene) => scene.seedId === seedId)?.size ?? 24;
  const grid = new Grid3D(size); applySeed(grid, seedId);
  drawGridPreview(canvas, grid);
}

export function drawGridPreview(canvas: HTMLCanvasElement, grid: Grid3D): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
  const cells: Array<{ x: number; y: number; z: number }> = [];
  for (let z = 0; z < grid.size; z++) for (let y = 0; y < grid.size; y++) for (let x = 0; x < grid.size; x++) if (grid.isAlive(x,y,z)) cells.push({x,y,z});
  cells.sort((a,b) => (a.x+a.y+a.z)-(b.x+b.y+b.z));
  const projected = cells.map((p) => ({ p, x: (p.x-p.z) * .866, y: (p.x+p.z)*.5-p.y }));
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  if (projected.length) {
    minX = maxX = projected[0]!.x;
    minY = maxY = projected[0]!.y;
    for (const point of projected) {
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
  }
  const padding = Math.min(w, h) * .15;
  const scale = Math.min((w - padding * 2) / Math.max(2, maxX - minX + 1.74), (h - padding * 2) / Math.max(2, maxY - minY + 2));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  const face = (points: ReadonlyArray<readonly [number, number]>, color: string): void => {
    ctx.fillStyle = color; ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.closePath(); ctx.fill();
  };
  for (const item of projected) {
    const px = w / 2 + (item.x-centerX)*scale, py = h / 2 + (item.y-centerY)*scale;
    const s = scale * .91, dx = s * .866, dy = s * .5;
    const light = item.p.y / Math.max(1, grid.size - 1);
    face([[px-dx,py-dy],[px,py],[px,py+s],[px-dx,py+dy]], `hsl(210 44% ${47 + light * 24}%)`);
    face([[px,py],[px+dx,py-dy],[px+dx,py+dy],[px,py+s]], `hsl(205 56% ${66 + light * 17}%)`);
    face([[px,py-s],[px+dx,py-dy],[px,py],[px-dx,py-dy]], `hsl(207 48% ${83 + light * 13}%)`);
  }
}
