import { Grid3D } from '../sim/grid';
import { applySeed } from '../sim/seeds';
import type { CameraPresetId } from '../render/camera';

export interface FeaturedScene {
  id: string; seedId: string; ruleId: string; camera: CameraPresetId; speed: number;
  nameKey: string; hintKey: string;
}

export const FEATURED_SCENES: readonly FeaturedScene[] = [
  { id: 'cluster', seedId: 'genesis-spark', ruleId: 'ember-breath', camera: 'close', speed: 7, nameKey: 'featured.cluster', hintKey: 'featured.clusterHint' },
  { id: 'helix', seedId: 'spiral-helix', ruleId: 'ember-breath', camera: 'close', speed: 5, nameKey: 'featured.helix', hintKey: 'featured.helixHint' },
  { id: 'ring', seedId: 'ember-ring', ruleId: 'pyro-bloom', camera: 'top', speed: 9, nameKey: 'featured.ring', hintKey: 'featured.ringHint' },
];

export function drawSeedPreview(canvas: HTMLCanvasElement, seedId: string): void {
  const grid = new Grid3D(24); applySeed(grid, seedId);
  drawGridPreview(canvas, grid);
}

export function drawGridPreview(canvas: HTMLCanvasElement, grid: Grid3D): void {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  const w = canvas.width, h = canvas.height; ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#07101b'; ctx.fillRect(0, 0, w, h);
  const cells: Array<{ x: number; y: number; z: number }> = [];
  for (let z = 0; z < grid.size; z++) for (let y = 0; y < grid.size; y++) for (let x = 0; x < grid.size; x++) if (grid.isAlive(x,y,z)) cells.push({x,y,z});
  cells.sort((a,b) => (a.x+a.y+a.z)-(b.x+b.y+b.z));
  const c = grid.size / 2;
  const projected = cells.map((p) => ({ p, x: p.x-p.z, y: (p.x+p.z-2*p.y)*.5 }));
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  if (projected.length) {
    minX = maxX = projected[0]!.x;
    minY = maxY = projected[0]!.y;
    for (const point of projected) {
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
  }
  const scale = Math.min((w - 22) / Math.max(2, maxX - minX), (h - 18) / Math.max(2, maxY - minY));
  const centerX = (minX + maxX) / 2, centerY = (minY + maxY) / 2;
  for (const item of projected) {
    const p = item.p, px = w / 2 + (item.x-centerX)*scale, py = h / 2 + (item.y-centerY)*scale;
    ctx.fillStyle = p.y > c ? '#66e6ff' : '#ff7b42';
    const dot = Math.max(1.4, Math.min(6, scale * .48)); ctx.fillRect(px-dot/2, py-dot/2, dot, dot);
  }
}
