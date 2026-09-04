/**
 * Voxel Genesis — application controller.
 */

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

const HINT_KEY = 'voxel-genesis-hint-dismissed';

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
  private density = 0.12;
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

    this.bindUI();
    this.bindInput(canvas);
    this.tryLoadHash() || this.plantDefault();
    this.syncUI();
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
    $('btn-play').onclick = () => this.togglePlay();
    $('btn-step').onclick = () => this.doStep();
    $('btn-reset').onclick = () => this.reset();
    $('btn-rand').onclick = () => this.randomize();
    $('btn-seed').onclick = () => { this.plantSeed(seedSel.value); };
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
    size.onchange = () => { this.resizeWorld(Number(size.value)); };
    size.oninput = () => { $('size-val').textContent = size.value; };
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
        this.toast('Hash updated — copy address bar');
      }
    };
    $('btn-panel').onclick = () => { $('panel').classList.toggle('collapsed'); };
    $('btn-dismiss-hint').onclick = () => this.dismissHint();
    const updateDesc = () => {
      const p = getPresetById(presetSel.value);
      $('rule-desc').textContent = p?.description ?? 'Custom birth/survive rule';
    };
    presetSel.addEventListener('change', updateDesc);
    updateDesc();
  }

  private bindInput(canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === ' ') { e.preventDefault(); this.togglePlay(); }
      else if (k === 'n') this.doStep();
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
      else if (k === '?' || (e.shiftKey && k === '/')) {
        document.getElementById('panel')?.classList.toggle('collapsed');
      }
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (!this.slice.visible) return;
      this.updatePointer(e, canvas);
      this.raycaster.setFromCamera(this.pointer, this.scene.camera);
      const cell = this.slice.hitToCell(this.raycaster);
      if (!cell) return;
      e.preventDefault();
      this.scene.controls.enabled = false;
      this.painting = true;
      this.paintErase = e.shiftKey;
      this.paintAt(cell.x, cell.y, cell.z);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!this.painting) return;
      this.updatePointer(e, canvas);
      this.raycaster.setFromCamera(this.pointer, this.scene.camera);
      const cell = this.slice.hitToCell(this.raycaster);
      if (cell) this.paintAt(cell.x, cell.y, cell.z);
    });
    const endPaint = () => {
      if (!this.painting) return;
      this.painting = false;
      this.scene.controls.enabled = true;
      this.seedName = 'Painted';
      this.syncUI();
    };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointerleave', endPaint);
  }

  private updatePointer(e: PointerEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private paintAt(x: number, y: number, z: number): void {
    if (this.paintErase) {
      if (this.grid.isAlive(x, y, z)) this.grid.set(x, y, z, 0);
    } else {
      if (!this.grid.isAlive(x, y, z)) this.grid.set(x, y, z, 1);
    }
    this.voxels.sync(this.grid);
    this.syncStats();
  }

  private clickAxis(axis: SliceAxis): void {
    document.getElementById(`axis-${axis}`)?.click();
  }

  private toggleSlice(): void {
    const v = !this.slice.visible;
    this.slice.setVisible(v);
    const btn = document.getElementById('btn-slice-toggle');
    if (btn) btn.textContent = v ? 'Hide' : 'Show';
  }

  private nudgeSlice(d: number): void {
    this.slice.nudge(d);
    const el = document.getElementById('slice') as HTMLInputElement;
    el.value = String(this.slice.index);
    document.getElementById('slice-val')!.textContent = String(this.slice.index);
  }

  private togglePlay(): void {
    this.playing = !this.playing;
    document.getElementById('btn-play')!.textContent = this.playing ? 'Pause' : 'Play';
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
          this.grid.set(x - oHalf + nHalf, y - oHalf + nHalf, z - oHalf + nHalf, age);
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
    } catch { /* ignore */ }
  }

  private dismissHint(): void {
    document.getElementById('first-hint')?.classList.add('hidden');
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* ignore */ }
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
    this.scene.render();
  };
}
