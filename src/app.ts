import * as THREE from 'three';
import { Grid3D, type BoundaryMode } from './sim/grid';
import { stepInPlace, type StepResult } from './sim/ca';
import {
  RULE_PRESETS,
  DEFAULT_RULE_ID,
  getDefaultRule,
  getPresetById,
  ruleFromPreset,
  type Rule,
} from './sim/rules';
import { SEEDS, SEED_CATALOG, DEFAULT_SEED_ID, applySeed, getSeedById } from './sim/seeds';
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
  readHash,
  snapshotToJSON,
  parseSnapshotJSON,
} from './sim/share';
import { GenesisScene, prefersReducedMotion } from './render/scene';
import { VoxelRenderer } from './render/voxels';
import { TrailRenderer } from './render/trails';
import { SlicePlane, type SliceAxis } from './render/slice';
import { CAMERA_PRESETS, type CameraPresetId } from './render/camera';
import {
  initLocale,
  t,
  syncLangToggle,
  seedNameKey,
  seedDescKey,
  symmetryKey,
  cameraKey,
  getLocale,
} from './i18n';
import { ruleConditionLabel, ruleExplanation } from './sim/rule-explanation';
import { bindAppUI } from './ui/bind-ui';
import { bindAppInput, runAppLoop } from './ui/bind-input';
import type { AppHost } from './ui/app-host';
import { History } from './state/history';
import { loadSession, saveSession, loadLibrary, upsertWork, writeLibrary, type SavedWork } from './state/library';
import { PopulationTrend } from './ui/trend';
import { FEATURED_SCENES, drawSeedPreview, drawGridPreview, type FeaturedScene } from './ui/featured-scenes';
import { COLOR_PALETTES, setColorPalette, type ColorPaletteId } from './render/colors';
import { Interventions, validateInterventionIndices, type InterventionKind } from './sim/interventions';
import { InterventionRenderer } from './render/interventions';
import type { EnvironmentId } from './render/environments';
import { createMutations, evaluateMutationAsync, type MutationCandidate } from './sim/breeding';
const HINT_KEY = 'voxel-genesis-hint-dismissed';
export type InteractionMode = 'orbit' | 'paint';
export type PaintTool = 'paint' | 'erase' | 'intervention-erase' | InterventionKind;
export class App {
  public scene: GenesisScene;
  public voxels: VoxelRenderer;
  public trails: TrailRenderer;
  public slice: SlicePlane;
  public grid: Grid3D;
  public scratch: Grid3D;
  public rule: Rule;
  public boundary: BoundaryMode = 'clamp';
  public generation = 0;
  public playing = false;
  public speed = 8;
  public density = 0.08;
  public seedName = 'Genesis Spark';
  public seedId = DEFAULT_SEED_ID;
  public accum = 0;
  public raycaster = new THREE.Raycaster();
  public pointer = new THREE.Vector2();
  public painting = false;
  public paintErase = false;
  public reducedMotion: boolean;
  public trailsEnabled = true;
  public toastTimer = 0;
  public symmetry: SymmetryMode = 'none';
  public brushRadius = 0;
  public interactionMode: InteractionMode = 'orbit';
  public lastPaintKey = '';
  public paintTool: PaintTool = 'paint';
  public history = new History<AppSnapshot>(24);
  public initialSnapshot!: AppSnapshot;
  private persistTimer = 0;
  public palette: ColorPaletteId = 'ember';
  public trend = new PopulationTrend(120);
  public lastStep: StepResult | null = null;
  private paintSliceVisible = true;
  private immersiveState: { panelCollapsed: boolean; mode: InteractionMode; sliceVisible: boolean } | null = null;
  public interventions: Interventions;
  public interventionRenderer: InterventionRenderer;
  public environment: EnvironmentId = 'aurora';
  private breedingController: AbortController | null = null;
  private mutationCandidates = new Map<string, MutationCandidate>();
  constructor(canvas: HTMLCanvasElement) {
    initLocale();
    this.reducedMotion = prefersReducedMotion();
    this.scene = new GenesisScene(canvas, { reducedMotion: this.reducedMotion });
    this.grid = new Grid3D(24);
    this.scratch = new Grid3D(24);
    this.rule = getDefaultRule();
    this.voxels = new VoxelRenderer(24 * 24 * 24);
    this.trails = new TrailRenderer(5, 30000);
    this.slice = new SlicePlane();
    this.interventions = new Interventions(24);
    this.interventionRenderer = new InterventionRenderer(24 ** 3);
    this.slice.setGridSize(24);
    this.slice.setIndex(12);
    this.scene.root.add(this.voxels.mesh);
    this.scene.root.add(this.trails.mesh);
    this.scene.root.add(this.slice.group);
    this.scene.root.add(this.interventionRenderer.group);
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
    if (window.innerWidth <= 720) document.getElementById('panel')?.classList.add('collapsed');
    window.addEventListener('pagehide', () => this.persistNow());
    const restored = this.tryLoadHash() || this.tryLoadSession();
    if (!restored) this.plantDefault();
    this.playing = false;
    if (!this.initialSnapshot) this.initialSnapshot = this.makeSnapshot(false);
    this.syncUI();
    this.applyInteractionMode();
    this.voxels.sync(this.grid);
    if (!restored) this.scene.frameContent(this.grid);
    this.resetTrend();
    this.renderFeaturedScenes();
    if (restored) document.getElementById('first-hint')?.classList.add('hidden');
    else this.showFirstHint();
    this.loop();
  }
  public displaySeedName(): string {
    if (this.seedId && getSeedById(this.seedId)) {
      return t(seedNameKey(this.seedId));
    }
    if (this.seedName === 'Painted') return t('seedName.painted');
    if (this.seedName === 'Random') return t('seedName.random');
    return this.seedName;
  }
  public fillPresetSelects(): void {
    const presetSel = document.getElementById('rule-preset') as HTMLSelectElement;
    const prevRule = presetSel.value;
    presetSel.innerHTML = '';
    for (const p of RULE_PRESETS) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = ruleConditionLabel(ruleFromPreset(p), getLocale());
      presetSel.appendChild(opt);
    }
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = t('rule.custom');
    presetSel.appendChild(customOpt);
    if (prevRule && [...presetSel.options].some((o) => o.value === prevRule)) {
      presetSel.value = prevRule;
    } else {
      presetSel.value = this.rule && !RULE_PRESETS.some((p) => p.notation === this.rule.notation) ? 'custom' : DEFAULT_RULE_ID;
    }
    const seedSel = document.getElementById('seed-select') as HTMLSelectElement;
    const prevSeed = seedSel.value;
    seedSel.innerHTML = '';
    for (const s of SEEDS) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = t(seedNameKey(s.id));
      seedSel.appendChild(opt);
    }
    if (prevSeed && [...seedSel.options].some((o) => o.value === prevSeed)) {
      seedSel.value = prevSeed;
    } else {
      seedSel.value = DEFAULT_SEED_ID;
    }
    const symSel = document.getElementById('symmetry') as HTMLSelectElement;
    const prevSym = symSel.value;
    symSel.innerHTML = '';
    for (const s of SYMMETRY_OPTIONS) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = t(symmetryKey(s.id));
      symSel.appendChild(opt);
    }
    symSel.value = prevSym || 'none';
    const camRow = document.getElementById('camera-presets')!;
    const active = camRow.querySelector('.cam-preset.active') as HTMLElement | null;
    const activeId = active?.dataset.preset;
    camRow.innerHTML = '';
    for (const p of CAMERA_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cam-preset';
      btn.dataset.preset = p.id;
      btn.textContent = t(cameraKey(p.id));
      if (activeId === p.id) btn.classList.add('active');
      btn.onclick = () => this.goCamera(p.id);
      camRow.appendChild(btn);
    }
  }
  public refreshLocalizedUI(): void {
    this.fillPresetSelects();
    const play = document.getElementById('btn-play');
    if (play) play.textContent = this.playing ? t('btn.pause') : t('btn.play');
    const sliceBtn = document.getElementById('btn-slice-toggle');
    if (sliceBtn) sliceBtn.textContent = this.slice.visible ? t('btn.hide') : t('btn.show');
    this.updateRuleDesc();
    this.updateSeedDesc();
    this.applyInteractionMode();
    this.syncStats();
    syncLangToggle();
    this.refreshLibrary();
    this.renderFeaturedScenes();
    this.renderTrend();
    this.setPalette(this.palette, false);
  }
  public updateRuleDesc(): void {
    const explanation = ruleExplanation(this.rule, getLocale());
    const empty = document.getElementById('rule-empty');
    const live = document.getElementById('rule-live');
    if (empty) empty.textContent = explanation.empty;
    if (live) live.textContent = explanation.live;
    const hud = document.getElementById('stat-rule');
    if (hud) hud.title = `${ruleConditionLabel(this.rule, getLocale())} (${this.rule.notation})`;
  }
  public updateSeedDesc(): void {
    const seedSel = document.getElementById('seed-select') as HTMLSelectElement;
    const el = document.getElementById('seed-desc');
    if (!el) return;
    const s = getSeedById(seedSel.value);
    el.textContent = s ? t(seedDescKey(s.id)) : '';
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
      this.toast(t('toast.loadedShared'));
      return true;
    } catch {
      return false;
    }
  }
  private tryLoadSession(): boolean {
    try {
      const snap = loadSession(localStorage);
      if (!snap) return false;
      this.loadSnapshot(snap, false);
      return true;
    } catch { return false; }
  }
  public loadSnapshot(snap: AppSnapshot, record = true): void {
    this.cancelBreeding(true);
    if (record && this.initialSnapshot) this.history.push(this.makeSnapshot());
    const applied = applySnapshot(snap);
    this.rebuildGrid(applied.grid.size);
    applied.grid.copyTo(this.grid);
    this.rule = applied.rule;
    this.generation = applied.generation;
    this.boundary = applied.boundary;
    this.seedName = applied.seedName;
    this.seedId = snap.seedId || '';
    const match = SEEDS.find((s) => s.name === applied.seedName);
    if (match) this.seedId = match.id;
    if (snap.density != null) this.density = snap.density;
    if (snap.speed != null) this.speed = snap.speed;
    if (snap.palette) this.setPalette(snap.palette, false);
    this.environment = snap.environment ?? 'aurora';
    this.scene.setEnvironment(this.environment);
    const marks = validateInterventionIndices(snap.size, snap.sources, snap.barriers);
    this.interventions.load(marks.sources, marks.barriers);
    this.interventionRenderer.sync(this.interventions);
    this.playing = false;
    if (snap.sliceAxis) this.slice.setAxis(snap.sliceAxis);
    this.slice.setIndex(snap.sliceIndex ?? Math.floor(applied.grid.size / 2));
    this.paintSliceVisible = snap.sliceVisible ?? true;
    this.slice.setVisible(this.interactionMode === 'paint' && this.paintSliceVisible);
    this.trails.clear();
    this.voxels.sync(this.grid);
    this.syncUI();
    this.resetTrend();
    if (snap.restart) this.initialSnapshot = parseSnapshotJSON(snap.restart);
    else this.initialSnapshot = { ...snap, playing: false, restart: undefined };
    this.schedulePersist();
    this.scene.frameContent(this.grid);
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
    this.scene.root.remove(this.interventionRenderer.group);
    this.interventionRenderer.dispose();
    this.interventions = new Interventions(size);
    this.interventionRenderer = new InterventionRenderer(vol);
    this.scene.root.add(this.interventionRenderer.group);
    this.trails.clear();
  }
  public makeSnapshot(includeRestart = true): AppSnapshot {
    const snapshot: AppSnapshot = {
      v: 2,
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
      seedId: this.seedId,
      sliceAxis: this.slice.axis,
      sliceIndex: this.slice.index,
      sliceVisible: this.interactionMode === 'paint' ? this.slice.visible : this.paintSliceVisible,
      palette: this.palette,
      environment: this.environment,
      sources: this.interventions.indices('source'),
      barriers: this.interventions.indices('barrier'),
    };
    if (includeRestart && this.initialSnapshot) snapshot.restart = snapshotToJSON({ ...this.initialSnapshot, restart: undefined });
    return snapshot;
  }
  private bindUI(): void { bindAppUI(this as unknown as AppHost); }
  public goCamera(id: CameraPresetId): void {
    if (!this.scene.applyCameraPreset(id)) return;
    document.querySelectorAll('.cam-preset').forEach((b) => {
      b.classList.toggle('active', (b as HTMLElement).dataset.preset === id);
    });
    const on = this.scene.autoOrbit;
    document.getElementById('btn-orbit')?.classList.toggle('on', on);
    this.toast(t(cameraKey(id)));
  }
  public setInteractionMode(mode: InteractionMode): void {
    if (this.interactionMode === 'paint' && mode === 'orbit') this.paintSliceVisible = this.slice.visible;
    this.interactionMode = mode;
    this.applyInteractionMode();
    this.slice.setVisible(mode === 'paint' && this.paintSliceVisible);
    const btn = document.getElementById('btn-slice-toggle');
    if (btn) btn.textContent = this.paintSliceVisible ? t('btn.hide') : t('btn.show');
    if (mode === 'paint') this.togglePlay(false);
    this.toast(mode === 'paint' ? t('toast.paintMode') : t('toast.orbitMode'));
  }
  public applyInteractionMode(): void {
    const paint = this.interactionMode === 'paint';
    document.getElementById('btn-mode-orbit')?.classList.toggle('active', !paint);
    document.getElementById('btn-mode-paint')?.classList.toggle('active', paint);
    document.getElementById('btn-tool-paint')?.classList.toggle('active', this.paintTool === 'paint');
    document.getElementById('btn-tool-erase')?.classList.toggle('active', this.paintTool === 'erase');
    document.getElementById('btn-tool-source')?.classList.toggle('active', this.paintTool === 'source');
    document.getElementById('btn-tool-barrier')?.classList.toggle('active', this.paintTool === 'barrier');
    document.getElementById('btn-tool-intervention-erase')?.classList.toggle('active', this.paintTool === 'intervention-erase');
    const fab = document.getElementById('btn-mode-fab');
    if (fab) {
      fab.textContent = paint ? `✎ ${t('mode.paint')}` : `↻ ${t('mode.orbit')}`;
      fab.title = paint ? t('mode.fabPaint') : t('mode.fabOrbit');
      fab.classList.toggle('paint-on', paint);
    }
    document.getElementById('c')?.classList.toggle('mode-paint', paint);
    document.getElementById('c')?.classList.toggle('mode-orbit', !paint);
    document.body.classList.toggle('interaction-paint', paint);
    if (!this.painting) {
      this.scene.controls.enabled = !paint || !window.matchMedia('(pointer: coarse)').matches;
      if (!window.matchMedia('(pointer: coarse)').matches) {
        this.scene.controls.enabled = true;
        this.scene.controls.mouseButtons.LEFT = paint
          ? THREE.MOUSE.ROTATE
          : THREE.MOUSE.ROTATE;
      }
    }
  }
  private bindInput(canvas: HTMLCanvasElement): void { bindAppInput(this as unknown as AppHost, canvas); }
  public updatePointer(e: PointerEvent, canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  public paintAt(x: number, y: number, z: number): void {
    const key = `${x},${y},${z},${this.paintErase ? 0 : 1},${this.brushRadius},${this.symmetry}`;
    if (key === this.lastPaintKey) return;
    this.lastPaintKey = key;
    const brush = brushCellsOnSlice(x, y, z, this.grid.size, this.slice.axis, this.brushRadius);
    const alive = !this.paintErase;
    for (const b of brush) {
      const mirrored = expandSymmetry(b.x, b.y, b.z, this.grid.size, this.symmetry);
      for (const c of mirrored) {
        const index = this.grid.index(c.x, c.y, c.z);
        if (this.paintTool === 'source' || this.paintTool === 'barrier') {
          this.interventions.set(index, this.paintTool);
        } else if (this.paintTool === 'intervention-erase') {
          this.interventions.set(index, 'source', false); this.interventions.set(index, 'barrier', false);
        } else if (alive) {
          if (!this.grid.isAlive(c.x, c.y, c.z)) this.grid.set(c.x, c.y, c.z, 1);
        } else if (this.grid.isAlive(c.x, c.y, c.z)) {
          this.grid.set(c.x, c.y, c.z, 0);
        }
      }
    }
    if (this.paintTool === 'source' || this.paintTool === 'barrier' || this.paintTool === 'intervention-erase') { this.interventions.apply(this.grid); this.voxels.sync(this.grid); }
    this.interventionRenderer.sync(this.interventions);
    this.voxels.sync(this.grid);
    this.syncStats();
    this.updatePaintCoordHud(x, y, z);
  }
  public beginEdit(): void { this.history.push(this.makeSnapshot()); }
  public finishEdit(): void {
    this.cancelBreeding(true);
    this.initialSnapshot = this.makeSnapshot(false);
    this.resetTrend();
    this.schedulePersist();
  }
  public undo(): void {
    const snap = this.history.undo(this.makeSnapshot());
    if (snap) this.loadSnapshot(snap, false);
  }
  public redo(): void {
    const snap = this.history.redo(this.makeSnapshot());
    if (snap) this.loadSnapshot(snap, false);
  }
  public setPaintTool(tool: PaintTool): void { this.paintTool = tool; this.applyInteractionMode(); }
  public updatePaintCoordHud(x: number, y: number, z: number): void {
    const el = document.getElementById('paint-coord');
    if (el) el.textContent = `${x}, ${y}, ${z}`;
  }
  public clickAxis(axis: SliceAxis): void {
    document.getElementById(`axis-${axis}`)?.click();
  }
  public toggleSlice(): void {
    const v = !this.paintSliceVisible;
    this.paintSliceVisible = v;
    this.slice.setVisible(this.interactionMode === 'paint' && v);
    const btn = document.getElementById('btn-slice-toggle');
    if (btn) btn.textContent = v ? t('btn.hide') : t('btn.show');
    if (!v || this.interactionMode !== 'paint') this.slice.clearHover();
  }
  public nudgeSlice(d: number): void {
    this.slice.nudge(d);
    const el = document.getElementById('slice') as HTMLInputElement;
    el.value = String(this.slice.index);
    document.getElementById('slice-val')!.textContent = String(this.slice.index);
  }
  public togglePlay(force?: boolean): void {
    this.playing = force ?? !this.playing;
    const btn = document.getElementById('btn-play')!;
    btn.textContent = this.playing ? t('btn.pause') : t('btn.play');
    const state = document.getElementById('play-state');
    if (state) { state.textContent = this.playing ? t('state.running') : t('state.paused'); state.classList.toggle('running', this.playing); }
    if (!this.playing) this.persistNow();
  }
  public doStep(): StepResult {
    const before = this.grid.cells.slice();
    this.interventions.apply(this.grid);
    stepInPlace(this.grid, this.scratch, this.rule, this.boundary);
    this.interventions.apply(this.grid);
    let births = 0, deaths = 0;
    for (let i = 0; i < before.length; i++) { if (!before[i] && this.grid.cells[i]) births++; else if (before[i] && !this.grid.cells[i]) deaths++; }
    const result = { births, deaths, population: this.grid.population };
    this.generation++;
    if (this.trailsEnabled) this.trails.push(this.grid);
    this.voxels.sync(this.grid);
    this.syncStats();
    this.lastStep = result;
    this.trend.push(this.generation, result);
    this.renderTrend();
    this.schedulePersist();
    return result;
  }
  public reset(): void {
    this.loadSnapshot(this.initialSnapshot);
    this.toast(t('toast.restarted'));
  }
  public restoreDefaults(): void {
    this.history.push(this.makeSnapshot());
    if (this.grid.size !== 24) this.rebuildGrid(24);
    this.density = 0.08;
    this.speed = 8;
    this.boundary = 'clamp';
    this.symmetry = 'none';
    this.brushRadius = 0;
    this.slice.setAxis('y');
    this.slice.setIndex(12);
    this.paintSliceVisible = true;
    this.slice.setVisible(this.interactionMode === 'paint');
    this.plantDefault();
    this.interventions.clear(); this.interventionRenderer.sync(this.interventions);
    this.playing = false;
    this.initialSnapshot = this.makeSnapshot(false);
    this.voxels.sync(this.grid);
    this.syncUI();
    this.resetTrend();
    this.schedulePersist();
  }
  public plantSeed(id: string): void {
    this.cancelBreeding(true);
    this.togglePlay(false);
    if (this.initialSnapshot) this.history.push(this.makeSnapshot());
    if (!applySeed(this.grid, id)) return;
    this.interventions.clear(); this.interventionRenderer.sync(this.interventions);
    this.seedId = id;
    this.seedName = getSeedById(id)!.name;
    this.generation = 0;
    this.trails.clear();
    this.voxels.sync(this.grid);
    this.syncUI();
    this.resetTrend();
    this.initialSnapshot = this.makeSnapshot(false);
    this.schedulePersist();
    this.toast(t(seedNameKey(id)));
  }
  public randomize(): void {
    this.cancelBreeding(true);
    this.history.push(this.makeSnapshot());
    this.grid.randomize(this.density);
    this.interventions.clear(); this.interventionRenderer.sync(this.interventions);
    this.seedName = 'Random';
    this.seedId = '';
    this.generation = 0;
    this.trails.clear();
    this.voxels.sync(this.grid);
    this.syncUI();
    this.resetTrend();
    this.initialSnapshot = this.makeSnapshot(false);
    this.schedulePersist();
  }
  public resizeWorld(size: number): void {
    this.cancelBreeding(true);
    this.history.push(this.makeSnapshot());
    this.playing = false;
    const old = this.grid;
    const resizedInterventions = this.interventions.resize(size);
    this.rebuildGrid(size);
    this.interventions = resizedInterventions;
    this.interventionRenderer.sync(this.interventions);
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
    this.resetTrend();
    this.playing = false;
    this.initialSnapshot = this.makeSnapshot(false);
    this.schedulePersist();
    if (size < old.size) this.toast(t('toast.sizeCropped'));
  }
  public exportJSON(): void {
    const blob = new Blob([snapshotToJSON(this.makeSnapshot())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `voxel-genesis-gen${this.generation}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    this.toast(t('toast.exported'));
  }
  public syncUI(): void {
    document.getElementById('btn-play')!.textContent = this.playing ? t('btn.pause') : t('btn.play');
    document.getElementById('btn-slice-toggle')!.textContent = this.paintSliceVisible ? t('btn.hide') : t('btn.show');
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
    sel.value = preset?.id ?? 'custom';
    const seedSel = document.getElementById('seed-select') as HTMLSelectElement;
    if (this.seedId && getSeedById(this.seedId)) seedSel.value = this.seedId;
    this.updateSeedDesc();
    this.syncStats();
    const sliceInput = document.getElementById('slice') as HTMLInputElement;
    sliceInput.max = String(this.grid.size - 1);
    sliceInput.value = String(this.slice.index);
    document.getElementById('slice-val')!.textContent = String(this.slice.index);
    document.querySelectorAll('.axis').forEach((b) => b.classList.toggle('active', b.id === `axis-${this.slice.axis}`));
    (document.getElementById('symmetry') as HTMLSelectElement).value = this.symmetry;
    const brush = document.getElementById('brush') as HTMLInputElement;
    brush.value = String(this.brushRadius);
    document.getElementById('brush-val')!.textContent = String(this.brushRadius * 2 + 1);
    this.slice.setBrushRadius(this.brushRadius);
    this.updateRuleDesc();
    this.applyInteractionMode();
    const state = document.getElementById('play-state');
    if (state) { state.textContent = this.playing ? t('state.running') : t('state.paused'); state.classList.toggle('running', this.playing); }
  }
  public syncStats(): void {
    document.getElementById('stat-gen')!.textContent = String(this.generation);
    document.getElementById('stat-pop')!.textContent = String(this.grid.population);
    document.getElementById('stat-rule')!.textContent = this.rule.notation;
    document.getElementById('stat-seed')!.textContent = this.displaySeedName();
  }
  public showFirstHint(): void {
    try {
      if (localStorage.getItem(HINT_KEY) === '1') {
        document.getElementById('first-hint')?.classList.add('hidden');
      }
    } catch {
    }
  }
  public dismissHint(): void {
    document.getElementById('first-hint')?.classList.add('hidden');
    try {
      localStorage.setItem(HINT_KEY, '1');
    } catch {
    }
  }
  public toast(msg: string): void {
    const el = document.getElementById('toast')!;
    el.textContent = msg;
    el.classList.remove('hidden');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => el.classList.add('hidden'), 2200);
  }
  public schedulePersist(): void {
    if (this.persistTimer) return;
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = 0;
      this.persistNow();
    }, 2000);
  }
  private persistNow(): void {
    if (this.persistTimer) { window.clearTimeout(this.persistTimer); this.persistTimer = 0; }
    try { saveSession(localStorage, this.makeSnapshot()); }
    catch { this.toast(t('toast.storageFailed')); }
  }
  public refreshLibrary(): void {
    const list = document.getElementById('works-list');
    if (!list) return;
    list.innerHTML = '';
    let works: SavedWork[];
    try { works = loadLibrary(localStorage); } catch { works = []; }
    for (const work of works) {
      const row = document.createElement('div'); row.className = 'work-card';
      const img = document.createElement('img'); img.src = work.thumbnail; img.alt = '';
      const name = document.createElement('span'); name.textContent = work.name;
      const open = document.createElement('button'); open.textContent = t('btn.open'); open.onclick = () => this.loadSnapshot(work.snapshot);
      const copy = document.createElement('button'); copy.textContent = t('btn.copy'); copy.onclick = () => {
        const clone = { ...work, id: crypto.randomUUID(), name: `${work.name} copy`, updatedAt: Date.now() };
        try { upsertWork(localStorage, clone); this.refreshLibrary(); } catch { this.toast(t('toast.storageFailed')); }
      };
      const del = document.createElement('button'); del.textContent = t('btn.delete'); del.onclick = () => {
        if (!window.confirm(t('library.confirmDelete'))) return;
        try { writeLibrary(localStorage, works.filter((w) => w.id !== work.id)); this.refreshLibrary(); } catch { this.toast(t('toast.storageFailed')); }
      };
      row.append(img, name, open, copy, del); list.append(row);
    }
  }
  public saveWork(): void {
    const input = document.getElementById('work-name') as HTMLInputElement;
    const name = input.value.trim() || this.displaySeedName();
    this.scene.render();
    const source = this.scene.renderer.domElement;
    const thumb = document.createElement('canvas');
    thumb.width = 240;
    thumb.height = Math.max(120, Math.round(240 * source.height / Math.max(1, source.width)));
    thumb.getContext('2d')?.drawImage(source, 0, 0, thumb.width, thumb.height);
    const work: SavedWork = { id: crypto.randomUUID(), name, updatedAt: Date.now(), snapshot: this.makeSnapshot(), thumbnail: thumb.toDataURL('image/jpeg', 0.62) };
    try { upsertWork(localStorage, work); this.refreshLibrary(); this.toast(t('toast.workSaved')); }
    catch { this.toast(t('toast.storageFailed')); }
  }
  public setEnvironment(id: EnvironmentId): void {
    this.environment = id; this.scene.setEnvironment(id);
    document.querySelectorAll<HTMLElement>('[data-environment]').forEach((el) => el.classList.toggle('active', el.dataset.environment === id));
    this.schedulePersist();
  }
  public focusArtwork(): void { this.scene.frameContent(this.grid); }
  public renderCatalog(): void {
    const host = document.getElementById('catalog-grid'); if (!host) return; host.innerHTML = '';
    for (const seed of SEED_CATALOG) {
      const card = document.createElement('button'); card.type='button'; card.className='catalog-card'; card.dataset.category=seed.category ?? 'geometry';
      card.dataset.search=`${t(seedNameKey(seed.id))} ${t(seedDescKey(seed.id))}`.toLowerCase();
      const canvas=document.createElement('canvas'); canvas.width=220; canvas.height=116;
      const copy=document.createElement('span'), title=document.createElement('strong'), desc=document.createElement('small');
      title.textContent=t(seedNameKey(seed.id)); desc.textContent=t(seedDescKey(seed.id)); copy.append(title,desc); card.append(canvas,copy);
      card.onclick=()=>{ this.plantSeed(seed.id); this.setInteractionMode('orbit'); this.scene.frameContent(this.grid); (document.getElementById('catalog-dialog') as HTMLDialogElement).close(); };
      host.append(card); drawSeedPreview(canvas,seed.id);
    }
    this.filterCatalog();
  }
  public filterCatalog(): void {
    const query=(document.getElementById('catalog-search') as HTMLInputElement)?.value.trim().toLowerCase() ?? '';
    const active=document.querySelector<HTMLElement>('#catalog-filters [data-category].active')?.dataset.category ?? 'all';
    let visible = 0;
    document.querySelectorAll<HTMLElement>('#catalog-grid .catalog-card').forEach(card=>{
      card.hidden = (!!query && !(card.dataset.search ?? '').includes(query)) || (active !== 'all' && card.dataset.category !== active);
      if (!card.hidden) visible++;
    });
    document.getElementById('catalog-empty')?.classList.toggle('hidden', visible !== 0);
  }
  public openCatalog(): void { this.renderCatalog(); (document.getElementById('catalog-dialog') as HTMLDialogElement).showModal(); }
  public cancelBreeding(close = false): void {
    this.breedingController?.abort(); this.breedingController=null; this.mutationCandidates.clear();
    const button=document.getElementById('btn-breed') as HTMLButtonElement|null; if(button) button.disabled=false;
    if(close) (document.getElementById('breeding-dialog') as HTMLDialogElement)?.close();
  }
  public async startBreeding(): Promise<void> {
    this.cancelBreeding(); this.togglePlay(false); const controller=new AbortController(); this.breedingController=controller;
    const button=document.getElementById('btn-breed') as HTMLButtonElement; button.disabled=true;
    const dialog=document.getElementById('breeding-dialog') as HTMLDialogElement; dialog.showModal();
    const host=document.getElementById('breeding-grid')!; host.innerHTML=''; const candidates=createMutations(this.grid.clone(),`${this.seedId}:${this.generation}`);
    const cards=new Map<string,{button:HTMLButtonElement;status:HTMLElement}>();
    for(const candidate of candidates){ const card=document.createElement('button'); card.type='button'; card.className='catalog-card'; card.disabled=true; const canvas=document.createElement('canvas');canvas.width=220;canvas.height=116;drawGridPreview(canvas,candidate.grid);const copy=document.createElement('span'),title=document.createElement('strong'),status=document.createElement('small');title.textContent=t(candidate.labelId);status.textContent='…';copy.append(title,status);card.append(canvas,copy);host.append(card);cards.set(candidate.id,{button:card,status}); }
    try {
      for(let i=0;i<candidates.length;i++){ const progress=document.getElementById('breeding-progress');if(progress)progress.textContent=t('breeding.progress',{done:i,total:candidates.length}); const evaluated=await evaluateMutationAsync(candidates[i]!,this.rule,this.boundary,{signal:controller.signal}); if(controller.signal.aborted)return;this.mutationCandidates.set(evaluated.id,evaluated);const view=cards.get(evaluated.id)!;view.status.textContent=t('breeding.result',{population:evaluated.populationAfterPreview ?? 0});view.button.disabled=false;view.button.onclick=()=>this.applyMutation(evaluated.id); }
      const progress=document.getElementById('breeding-progress');if(progress)progress.textContent=t('breeding.ready',{count:candidates.length});
    } catch(error){ if(!(error instanceof DOMException&&error.name==='AbortError')) throw error; }
    finally { if(this.breedingController===controller)this.breedingController=null; button.disabled=false; }
  }
  public applyMutation(id:string):void {
    const candidate=this.mutationCandidates.get(id);if(!candidate)return;this.history.push(this.makeSnapshot());candidate.grid.copyTo(this.grid);
    this.interventions.clear();this.interventionRenderer.sync(this.interventions);this.seedId='';this.seedName='Painted';this.generation=0;this.playing=false;this.initialSnapshot=this.makeSnapshot(false);this.voxels.sync(this.grid);this.trails.clear();this.syncUI();this.resetTrend();this.scene.frameContent(this.grid);this.cancelBreeding(true);this.schedulePersist();
  }
  public resetTrend(): void {
    this.lastStep = null;
    this.trend.reset(this.generation, this.grid.population);
    this.renderTrend();
  }
  public renderTrend(): void {
    document.getElementById('trend-path')?.setAttribute('d', this.trend.path());
    const delta = document.getElementById('step-delta');
    if (delta) delta.textContent = this.lastStep ? t('trend.delta', { births: this.lastStep.births, deaths: this.lastStep.deaths }) : t('trend.waiting');
    document.getElementById('trend-empty')?.classList.toggle('hidden', this.grid.population > 0);
  }
  public setPalette(id: ColorPaletteId, persist = true): void {
    this.palette = id; setColorPalette(id); this.voxels.sync(this.grid); this.trails.clear();
    if (typeof document !== 'undefined') {
      document.querySelectorAll<HTMLElement>('[data-palette]').forEach((el) => el.classList.toggle('active', el.dataset.palette === id));
      document.body.dataset.palette = id;
      const colors = COLOR_PALETTES[id];
      const cssHex = (value: number) => `#${value.toString(16).padStart(6, '0')}`;
      document.body.style.setProperty('--palette-young', cssHex(colors.young));
      document.body.style.setProperty('--palette-mature', cssHex(colors.mature));
      document.body.style.setProperty('--palette-ancient', cssHex(colors.ancient));
    }
    if (persist) this.schedulePersist();
  }
  public applyFeatured(feature: FeaturedScene): void {
    const preset = getPresetById(feature.ruleId); if (!preset) return;
    this.history.push(this.makeSnapshot());
    if (this.grid.size !== 24) this.rebuildGrid(24);
    this.boundary = 'clamp';
    applySeed(this.grid, feature.seedId); this.rule = ruleFromPreset(preset);
    this.interventions.clear(); this.interventionRenderer.sync(this.interventions);
    this.seedId = feature.seedId; this.seedName = getSeedById(feature.seedId)?.name ?? feature.seedId;
    this.speed = feature.speed; this.generation = 0; this.playing = false; this.setInteractionMode('orbit');
    this.initialSnapshot = this.makeSnapshot(false); this.trails.clear(); this.voxels.sync(this.grid);
    this.goCamera(feature.camera); this.syncUI(); this.resetTrend(); this.schedulePersist();
  }
  public renderFeaturedScenes(): void {
    const host = document.getElementById('featured-scenes'); if (!host) return; host.innerHTML = '';
    for (const feature of FEATURED_SCENES) {
      const button = document.createElement('button'); button.className = 'scene-card'; button.type = 'button';
      const canvas = document.createElement('canvas'); canvas.width = 150; canvas.height = 82; canvas.setAttribute('aria-hidden', 'true');
      const copy = document.createElement('span'); const title = document.createElement('strong'); title.textContent = t(feature.nameKey);
      const hint = document.createElement('small'); hint.textContent = t(feature.hintKey); copy.append(title, hint);
      button.append(canvas, copy); button.onclick = () => this.applyFeatured(feature); host.append(button); drawSeedPreview(canvas, feature.seedId);
    }
  }
  public toggleImmersive(force?: boolean): void {
    const entering = force ?? !document.body.classList.contains('immersive');
    if (entering && !this.immersiveState) {
      this.immersiveState = { panelCollapsed: document.getElementById('panel')!.classList.contains('collapsed'), mode: this.interactionMode, sliceVisible: this.paintSliceVisible };
      document.body.classList.add('immersive'); this.setInteractionMode('orbit'); this.slice.setVisible(false); this.scene.setHelpersVisible(false);
      this.interventionRenderer.group.visible = false;
    } else if (!entering && this.immersiveState) {
      const state = this.immersiveState; this.immersiveState = null; document.body.classList.remove('immersive');
      document.getElementById('panel')!.classList.toggle('collapsed', state.panelCollapsed); this.scene.setHelpersVisible(true); this.paintSliceVisible = state.sliceVisible; this.setInteractionMode(state.mode);
      this.interventionRenderer.group.visible = true;
    }
  }
  public saveImage(): void {
    const sliceVisible = this.slice.visible; const helpersVisible = this.scene.helpersVisible;
    const interventionsVisible = this.interventionRenderer.group.visible;
    this.slice.setVisible(false); this.scene.setHelpersVisible(false); this.interventionRenderer.group.visible = false; this.scene.render();
    try { const a = document.createElement('a'); a.download = `voxel-genesis-${this.generation}.png`; a.href = this.scene.renderer.domElement.toDataURL('image/png'); a.click(); this.toast(t('toast.imageSaved')); }
    catch { this.toast(t('toast.imageFailed')); }
    finally { this.slice.setVisible(sliceVisible); this.scene.setHelpersVisible(helpersVisible); this.interventionRenderer.group.visible = interventionsVisible; }
  }
  public clearInterventions(): void {
    this.cancelBreeding(true);
    this.history.push(this.makeSnapshot()); this.interventions.clear(); this.interventionRenderer.sync(this.interventions);
    this.initialSnapshot = this.makeSnapshot(false); this.schedulePersist(); this.toast(t('toast.interventionsCleared'));
  }
  public addCenterSource(): void {
    this.cancelBreeding(true);
    this.history.push(this.makeSnapshot()); const c = Math.floor(this.grid.size / 2);
    this.interventions.set(this.grid.index(c,c,c), 'source'); this.interventions.apply(this.grid); this.interventionRenderer.sync(this.interventions); this.voxels.sync(this.grid);
    this.initialSnapshot = this.makeSnapshot(false); this.syncStats(); this.resetTrend(); this.schedulePersist();
  }
  private loop = (): void => { runAppLoop(this as unknown as AppHost); };
}
