import * as THREE from 'three';
import { Grid3D, type BoundaryMode } from './sim/grid';
import { stepInPlace } from './sim/ca';
import {
  RULE_PRESETS,
  DEFAULT_RULE_ID,
  getDefaultRule,
  getPresetById,
  parseRuleNotation,
  ruleFromPreset,
  type Rule,
} from './sim/rules';
import { SEEDS, DEFAULT_SEED_ID, applySeed, getSeedById } from './sim/seeds';
import {
  SYMMETRY_OPTIONS,
  expandSymmetry,
  brushCellsOnSlice,
  type SymmetryMode,
} from './sim/symmetry';
import {
  type AppSnapshot,
  encodeCells,
  applySnapshot,
  writeHash,
  readHash,
  snapshotToJSON,
  parseSnapshotJSON,
} from './sim/share';
import { GenesisScene, prefersReducedMotion } from './render/scene';
import { VoxelRenderer } from './render/voxels';
import { TrailRenderer } from './render/trails';
import { SlicePlane, type SliceAxis } from './render/slice';
import { CAMERA_PRESETS, type CameraPresetId } from './render/camera';
const HINT_KEY = 'voxel-genesis-hint-dismissed';
export type InteractionMode = 'orbit' | 'paint';
export class App {
  private scene: GenesisScene;
  private voxels: VoxelRenderer;
  private trails: TrailRenderer;
  private slice: SlicePlane;
  private grid: Grid3D;
  private scratch: Grid3D;
  private rule: Rule;
  private boundary: BoundaryMode = 'clamp';
  private generation = 0;
  private playing = false;
  private speed = 8;
  private density = 0.08;
  private seedName = 'Genesis Spark';
  private seedId = DEFAULT_SEED_ID;
  private accum = 0;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private painting = false;
  private paintErase = false;
  private reducedMotion: boolean;
  private trailsEnabled = true;
  private toastTimer = 0;
  private symmetry: SymmetryMode = 'none';
  private brushRadius = 0;
  private interactionMode: InteractionMode = 'orbit';
  private lastPaintKey = '';
  constructor(canvas: HTMLCanvasElement) {
    this.reducedMotion = prefersReducedMotion();
    this.scene = new GenesisScene(canvas, { reducedMotion: this.reducedMotion });
    this.grid = new Grid3D(24);
    this.scratch = new Grid3D(24);
    this.rule = getDefaultRule();
    this.voxels = new VoxelRenderer(24 * 24 * 24);
    this.trails = new TrailRenderer(5, 30000);
    this.slice = new SlicePlane();
    this.slice.setGridSize(24);
    this.slice.setIndex(12);
    this.scene.root.add(this.voxels.mesh);
    this.scene.root.add(this.trails.mesh);
    this.scene.root.add(this.slice.group);
    this.scene.updateBounds(24);
    if (this.reducedMotion) {
      this.trails.setEnabled(false);
      this.trailsEnabled = false;
      this.scene.setBloom(false);
      this.scene.setAutoOrbit(false);
    }
    if (window.matchMedia('(pointer: coarse)').matches) {
      this.interactionMode = 'orbit';
    }
    this.bindUI();
    this.bindInput(canvas);
    this.tryLoadHash() || this.plantDefault();
    this.syncUI();
    this.applyInteractionMode();
    this.voxels.sync(this.grid);
    this.showFirstHint();
    this.loop();
  }
  private plantDefault(): void {
    applySeed(this.grid, DEFAULT_SEED_ID);
    this.seedId = DEFAULT_SEED_ID;
    this.seedName = getSeedById(DEFAULT_SEED_ID)!.name;
    this.generation = 0;
    this.rule = getDefaultRule();
  }
  private tryLoadHash(): boolean {
    const snap = readHash();
    if (!snap) return false;
    try {
      this.loadSnapshot(snap);
      this.toast('Loaded shared state');
      return true;
    } catch {
      return false;
    }
  }
  private loadSnapshot(snap: AppSnapshot): void {
    const applied = applySnapshot(snap);
    this.rebuildGrid(applied.grid.size);
    applied.grid.copyTo(this.grid);
    this.rule = applied.rule;
    this.generation = applied.generation;
    this.boundary = applied.boundary;
    this.seedName = applied.seedName;
    if (snap.density != null) this.density = snap.density;
    if (snap.speed != null) this.speed = snap.speed;
    this.trails.clear();
    this.voxels.sync(this.grid);
    this.syncUI();
  }
  private rebuildGrid(size: number): void {
    this.grid = new Grid3D(size);
    this.scratch = new Grid3D(size);
    this.slice.setGridSize(size);
    this.slice.setIndex(Math.floor(size / 2));
    this.scene.updateBounds(size);
    const vol = size * size * size;
    this.scene.root.remove(this.voxels.mesh);
    this.voxels.dispose();
    this.voxels = new VoxelRenderer(vol);
    this.scene.root.add(this.voxels.mesh);
    this.trails.clear();
  }
  private makeSnapshot(): AppSnapshot {
    return {
      v: 1,
      size: this.grid.size,
      generation: this.generation,
      rule: this.rule.notation,
      ruleName: this.rule.name,
      boundary: this.boundary,
      seedName: this.seedName,
      cells: encodeCells(this.grid),
      density: this.density,
      speed: this.speed,
      playing: this.playing,
    };
  }
  private bindUI(): void {
    const $ = (id: string) => document.getElementById(id)!;
    const presetSel = $('rule-preset') as HTMLSelectElement;
    for (const p of RULE_PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name}  (${p.notation})`;
      presetSel.appendChild(opt);
    }
    presetSel.value = DEFAULT_RULE_ID;
    const seedSel = $('seed-select') as HTMLSelectElement;
    for (const s of SEEDS) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      seedSel.appendChild(opt);
    }
    seedSel.value = DEFAULT_SEED_ID;
    const symSel = $('symmetry') as HTMLSelectElement;
    for (const s of SYMMETRY_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.label;
      symSel.appendChild(opt);
    }
    symSel.value = 'none';
    symSel.onchange = () => {
      this.symmetry = symSel.value as SymmetryMode;
      this.toast(`Symmetry: ${SYMMETRY_OPTIONS.find((o) => o.id === this.symmetry)?.label}`);
    };
    const camRow = $('camera-presets');
    for (const p of CAMERA_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cam-preset';
      btn.dataset.preset = p.id;
      btn.textContent = p.label;
      btn.onclick = () => this.goCamera(p.id);
      camRow.appendChild(btn);
    }
    $('btn-play').onclick = () => this.togglePlay();
    $('btn-step').onclick = () => this.doStep();
    $('btn-reset').onclick = () => this.reset();
    $('btn-rand').onclick = () => this.randomize();
    $('btn-seed').onclick = () => {
      this.plantSeed(seedSel.value);
    };
    seedSel.onchange = () => {
      const s = getSeedById(seedSel.value);
      $('seed-desc').textContent = s?.description ?? '';
    };
    seedSel.dispatchEvent(new Event('change'));
    presetSel.onchange = () => {
      const p = getPresetById(presetSel.value);
      if (!p) return;
      this.rule = ruleFromPreset(p);
      ($('rule-custom') as HTMLInputElement).value = p.notation;
      this.syncUI();
      this.toast(`${p.name}`);
    };
    $('btn-apply-rule').onclick = () => {
      const raw = ($('rule-custom') as HTMLInputElement).value;
      try {
        this.rule = parseRuleNotation(raw, 'Custom');
        presetSel.value = '';
        this.syncUI();
        this.toast(`Rule ${this.rule.notation}`);
      } catch (e) {
        this.toast(e instanceof Error ? e.message : 'Invalid rule');
      }
    };
    const speed = $('speed') as HTMLInputElement;
    speed.oninput = () => {
      this.speed = Number(speed.value);
      $('speed-val').textContent = String(this.speed);
    };
    const size = $('size') as HTMLInputElement;
    size.onchange = () => {
      this.resizeWorld(Number(size.value));
    };
    size.oninput = () => {
      $('size-val').textContent = size.value;
    };
    const dens = $('density') as HTMLInputElement;
    dens.oninput = () => {
      this.density = Number(dens.value);
      $('density-val').textContent = this.density.toFixed(2);
    };
    ($('boundary') as HTMLSelectElement).onchange = (e) => {
      this.boundary = (e.target as HTMLSelectElement).value as BoundaryMode;
    };
    const slice = $('slice') as HTMLInputElement;
    slice.oninput = () => {
      this.slice.setIndex(Number(slice.value));
      $('slice-val').textContent = slice.value;
    };
    const brush = $('brush') as HTMLInputElement;
    brush.oninput = () => {
      this.brushRadius = Number(brush.value);
      this.slice.setBrushRadius(this.brushRadius);
      $('brush-val').textContent = String(this.brushRadius * 2 + 1);
    };
    this.slice.setBrushRadius(this.brushRadius);
    const setAxis = (axis: SliceAxis) => {
      this.slice.setAxis(axis);
      document.querySelectorAll('.axis').forEach((b) => b.classList.remove('active'));
      $(`axis-${axis}`).classList.add('active');
    };
    $('axis-x').onclick = () => setAxis('x');
    $('axis-y').onclick = () => setAxis('y');
    $('axis-z').onclick = () => setAxis('z');
    $('btn-slice-toggle').onclick = () => this.toggleSlice();
    $('btn-orbit').onclick = () => {
      const on = !this.scene.autoOrbit;
      this.scene.setAutoOrbit(on);
      $('btn-orbit').classList.toggle('on', on);
    };
    $('btn-trails').onclick = () => {
      this.trailsEnabled = !this.trailsEnabled;
      this.trails.setEnabled(this.trailsEnabled);
      $('btn-trails').classList.toggle('on', this.trailsEnabled);
    };
    $('btn-bloom').onclick = () => {
      const btn = $('btn-bloom');
      const on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);
      this.scene.setBloom(on);
    };
    if (this.reducedMotion) {
      $('btn-orbit').classList.remove('on');
      $('btn-trails').classList.remove('on');
      $('btn-bloom').classList.remove('on');
    }
    $('btn-export').onclick = () => this.exportJSON();
    $('btn-import').onclick = () => $('import-file').click();
    $('import-file').onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        this.loadSnapshot(parseSnapshotJSON(text));
        this.toast('Imported');
      } catch {
        this.toast('Import failed');
      }
    };
    $('btn-share').onclick = async () => {
      writeHash(this.makeSnapshot());
      try {
        await navigator.clipboard.writeText(location.href);
        this.toast('URL copied');
      } catch {
        this.toast('Hash updated - copy address bar');
      }
    };
    $('btn-panel').onclick = () => {
      $('panel').classList.toggle('collapsed');
    };
    $('btn-dismiss-hint').onclick = () => this.dismissHint();
    $('btn-mode-orbit').onclick = () => this.setInteractionMode('orbit');
    $('btn-mode-paint').onclick = () => this.setInteractionMode('paint');
    $('btn-mode-fab').onclick = () => {
      this.setInteractionMode(this.interactionMode === 'paint' ? 'orbit' : 'paint');
    };
    const updateDesc = () => {
      const p = getPresetById(presetSel.value);
      $('rule-desc').textContent = p?.description ?? 'Custom birth/survive rule';
    };
    presetSel.addEventListener('change', updateDesc);
    updateDesc();
  }
  private goCamera(id: CameraPresetId): void {
    if (!this.scene.applyCameraPreset(id)) return;
    document.querySelectorAll('.cam-preset').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.preset === id);
    });
    const on = this.scene.autoOrbit;
    document.getElementById('btn-orbit')?.classList.toggle('on', on);
    this.toast(CAMERA_PRESETS.find((p) => p.id === id)?.label ?? id);
  }
  private setInteractionMode(mode: InteractionMode): void {
    this.interactionMode = mode;
    this.applyInteractionMode();
    if (mode === 'paint' && !this.slice.visible) {
      this.slice.setVisible(true);
      const btn = document.getElementById('btn-slice-toggle');
      if (btn) btn.textContent = 'Hide';
    }
    this.toast(mode === 'paint' ? 'Paint mode' : 'Orbit mode');
  }
  private applyInteractionMode(): void {
    const paint = this.interactionMode === 'paint';
    document.getElementById('btn-mode-orbit')?.classList.toggle('active', !paint);
    document.getElementById('btn-mode-paint')?.classList.toggle('active', paint);
    const fab = document.getElementById('btn-mode-fab');
    if (fab) {
      fab.textContent = paint ? 'P' : 'O';
      fab.title = paint ? 'Paint mode (tap for Orbit)' : 'Orbit mode (tap for Paint)';
      fab.classList.toggle('paint-on', paint);
    }
    document.getElementById('c')?.classList.toggle('mode-paint', paint);
    document.getElementById('c')?.classList.toggle('mode-orbit', !paint);
    document.body.classList.toggle('interaction-paint', paint);
    if (!this.painting) {
      this.scene.controls.enabled = !paint || !window.matchMedia('(pointer: coarse)').matches;
      if (!window.matchMedia('(pointer: coarse)').matches) {
        this.scene.controls.enabled = true;
        this.scene.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      }
    }
  }
  private bindInput(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        this.togglePlay();
      } else if (k === 'n') this.doStep();
      else if (k === 'r') this.reset();
      else if (k === 'g') this.randomize();
      else if (k === 'p') this.toggleSlice();
      else if (k === '[') this.nudgeSlice(-1);
      else if (k === ']') this.nudgeSlice(1);
      else if (k === 'x') this.clickAxis('x');
      else if (k === 'y') this.clickAxis('y');
      else if (k === 'z') this.clickAxis('z');
      else if (k === 'o') document.getElementById('btn-orbit')?.click();
      else if (k === 't') document.getElementById('btn-trails')?.click();
      else if (k === 'm') {
        this.setInteractionMode(this.interactionMode === 'paint' ? 'orbit' : 'paint');
      } else if (k === '?' || (e.shiftKey && k === '/')) {
        document.getElementById('panel')?.classList.toggle('collapsed');
      } else if (k === '1') this.goCamera('orbit');
      else if (k === '2') this.goCamera('hero');
      else if (k === '3') this.goCamera('top');
      else if (k === '4') this.goCamera('close');
      else if (k === '5') this.goCamera('flyby');
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (!this.slice.visible) return;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      if (coarse && this.interactionMode !== 'paint') return;
      this.updatePointer(e, canvas);
      this.raycaster.setFromCamera(this.pointer, this.scene.camera);
      const cell = this.slice.hitToCell(this.raycaster);
      if (!cell) return;
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
      }
      this.scene.controls.enabled = false;
      this.painting = true;
      this.paintErase = e.shiftKey;
      this.lastPaintKey = '';
      this.paintAt(cell.x, cell.y, cell.z);
      this.slice.setHoverCell(cell);
      this.slice.flashPaint();
    });
    canvas.addEventListener('pointermove', (e) => {
      this.updatePointer(e, canvas);
      this.raycaster.setFromCamera(this.pointer, this.scene.camera);
      const cell = this.slice.hitToCell(this.raycaster);
      if (this.slice.visible) {
        this.slice.setHoverCell(cell);
      }
      if (!this.painting) return;
      if (cell) {
        this.paintAt(cell.x, cell.y, cell.z);
        this.slice.flashPaint();
      }
    });
    const endPaint = (e?: PointerEvent) => {
      if (!this.painting) return;
      this.painting = false;
      this.lastPaintKey = '';
      if (e) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
        }
      }
      this.applyInteractionMode();
      this.seedName = 'Painted';
      this.syncUI();
    };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);
    canvas.addEventListener('pointerleave', () => {
      if (!this.painting) this.slice.clearHover();
    });
  }
  private updatePointer(e: PointerEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  private paintAt(x: number, y: number, z: number): void {
    const key = `${x},${y},${z},${this.paintErase ? 0 : 1},${this.brushRadius},${this.symmetry}`;
    if (key === this.lastPaintKey) return;
    this.lastPaintKey = key;
    const brush = brushCellsOnSlice(x, y, z, this.grid.size, this.slice.axis, this.brushRadius);
    const alive = !this.paintErase;
    for (const b of brush) {
      const mirrored = expandSymmetry(b.x, b.y, b.z, this.grid.size, this.symmetry);
      for (const c of mirrored) {
        if (alive) {
          if (!this.grid.isAlive(c.x, c.y, c.z)) this.grid.set(c.x, c.y, c.z, 1);
        } else if (this.grid.isAlive(c.x, c.y, c.z)) {
          this.grid.set(c.x, c.y, c.z, 0);
        }
      }
    }
    this.voxels.sync(this.grid);
    this.syncStats();
    this.updatePaintCoordHud(x, y, z);
  }
  private updatePaintCoordHud(x: number, y: number, z: number): void {
    const el = document.getElementById('paint-coord');
    if (el) el.textContent = `${x}, ${y}, ${z}`;
  }
  private clickAxis(axis: SliceAxis): void {
    document.getElementById(`axis-${axis}`)?.click();
  }
  private toggleSlice(): void {
    const v = !this.slice.visible;
    this.slice.setVisible(v);
    const btn = document.getElementById('btn-slice-toggle');
    if (btn) btn.textContent = v ? 'Hide' : 'Show';
    if (!v) this.slice.clearHover();
  }
  private nudgeSlice(d: number): void {
    this.slice.nudge(d);
    const el = document.getElementById('slice') as HTMLInputElement;
    el.value = String(this.slice.index);
    document.getElementById('slice-val')!.textContent = String(this.slice.index);
  }
  private togglePlay(): void {
    this.playing = !this.playing;
    const btn = document.getElementById('btn-play')!;
    btn.textContent = this.playing ? 'Pause' : 'Play';
  }
  private doStep(): void {
    stepInPlace(this.grid, this.scratch, this.rule, this.boundary);
    this.generation++;
    if (this.trailsEnabled) this.trails.push(this.grid);
    this.voxels.sync(this.grid);
    this.syncStats();
  }
  private reset(): void {
    this.playing = false;
    document.getElementById('btn-play')!.textContent = 'Play';
    const id = getSeedById(this.seedId) ? this.seedId : DEFAULT_SEED_ID;
    this.plantSeed(id);
  }
  private plantSeed(id: string): void {
    if (!applySeed(this.grid, id)) return;
    this.seedId = id;
    this.seedName = getSeedById(id)!.name;
    this.generation = 0;
    this.trails.clear();
    this.voxels.sync(this.grid);
    this.syncUI();
    this.toast(this.seedName);
  }
  private randomize(): void {
    this.grid.randomize(this.density);
    this.seedName = 'Random';
    this.seedId = '';
    this.generation = 0;
    this.trails.clear();
    this.voxels.sync(this.grid);
    this.syncUI();
  }
  private resizeWorld(size: number): void {
    const wasPlaying = this.playing;
    this.playing = false;
    const old = this.grid;
    this.rebuildGrid(size);
    const oHalf = Math.floor(old.size / 2);
    const nHalf = Math.floor(size / 2);
    for (let z = 0; z < old.size; z++) {
      for (let y = 0; y < old.size; y++) {
        for (let x = 0; x < old.size; x++) {
          const age = old.get(x, y, z);
          if (!age) continue;
          const nx = x - oHalf + nHalf;
          const ny = y - oHalf + nHalf;
          const nz = z - oHalf + nHalf;
          this.grid.set(nx, ny, nz, age);
        }
      }
    }
    this.voxels.sync(this.grid);
    const slice = document.getElementById('slice') as HTMLInputElement;
    slice.max = String(size - 1);
    slice.value = String(Math.floor(size / 2));
    document.getElementById('slice-val')!.textContent = slice.value;
    document.getElementById('size-val')!.textContent = String(size);
    this.syncUI();
    this.playing = wasPlaying;
    if (wasPlaying) document.getElementById('btn-play')!.textContent = 'Pause';
  }
  private exportJSON(): void {
    const blob = new Blob([snapshotToJSON(this.makeSnapshot())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voxel-genesis-gen${this.generation}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast('Exported JSON');
  }
  private syncUI(): void {
    document.getElementById('rule-notation')!.textContent = this.rule.notation;
    (document.getElementById('rule-custom') as HTMLInputElement).value = this.rule.notation;
    (document.getElementById('boundary') as HTMLSelectElement).value = this.boundary;
    (document.getElementById('speed') as HTMLInputElement).value = String(this.speed);
    document.getElementById('speed-val')!.textContent = String(this.speed);
    (document.getElementById('density') as HTMLInputElement).value = String(this.density);
    document.getElementById('density-val')!.textContent = this.density.toFixed(2);
    (document.getElementById('size') as HTMLInputElement).value = String(this.grid.size);
    document.getElementById('size-val')!.textContent = String(this.grid.size);
    const preset = RULE_PRESETS.find((p) => p.notation === this.rule.notation);
    const sel = document.getElementById('rule-preset') as HTMLSelectElement;
    if (preset) sel.value = preset.id;
    const seedSel = document.getElementById('seed-select') as HTMLSelectElement;
    if (this.seedId && getSeedById(this.seedId)) seedSel.value = this.seedId;
    this.syncStats();
  }
  private syncStats(): void {
    document.getElementById('stat-gen')!.textContent = String(this.generation);
    document.getElementById('stat-pop')!.textContent = String(this.grid.population);
    document.getElementById('stat-rule')!.textContent = this.rule.notation;
    document.getElementById('stat-seed')!.textContent = this.seedName;
  }
  private showFirstHint(): void {
    try {
      if (localStorage.getItem(HINT_KEY) === '1') {
        document.getElementById('first-hint')?.classList.add('hidden');
      }
    } catch {
    }
  }
  private dismissHint(): void {
    document.getElementById('first-hint')?.classList.add('hidden');
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
    }
  }
  private toast(msg: string): void {
    const el = document.getElementById('toast')!;
    el.textContent = msg;
    el.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2200);
  }
  private loop = (): void => {
    requestAnimationFrame(this.loop);
    const dt = this.scene.delta;
    if (this.playing) {
      this.accum += dt;
      const interval = 1 / Math.max(0.5, this.speed);
      while (this.accum >= interval) {
        this.accum -= interval;
        this.doStep();
        if (this.accum > interval * 3) this.accum = 0;
      }
    }
    this.slice.update(dt);
    this.scene.render();
  };
}
