import { App } from '../src/app';
import { Grid3D } from '../src/sim/grid';
import { encodeCells, type AppSnapshot } from '../src/sim/share';
import { getDefaultRule } from '../src/sim/rules';
import { History } from '../src/state/history';
import { PopulationTrend } from '../src/ui/trend';
import { FEATURED_SCENES } from '../src/ui/featured-scenes';
import { Interventions } from '../src/sim/interventions';

function appHarness(size = 12): App {
  const app = Object.create(App.prototype) as App;
  Object.assign(app, {
    grid: new Grid3D(size), scratch: new Grid3D(size), rule: getDefaultRule(), boundary: 'clamp',
    generation: 0, playing: true, speed: 8, density: 0.2, seedName: 'Painted', seedId: '',
    symmetry: 'none', brushRadius: 0, interactionMode: 'orbit', paintSliceVisible: true, history: new History<AppSnapshot>(8), palette: 'ember', environment: 'aurora', trend: new PopulationTrend(), lastStep: null, interventions: new Interventions(size),
    slice: { axis: 'y', index: Math.floor(size / 2), visible: true, setAxis(axis: string) { this.axis = axis; }, setIndex(index: number) { this.index = index; }, setVisible(visible: boolean) { this.visible = visible; }, setGridSize: vi.fn() },
    trails: { clear: vi.fn(), push: vi.fn() }, trailsEnabled: true, voxels: { sync: vi.fn() }, interventionRenderer: { sync: vi.fn(), dispose: vi.fn(), group: {} }, scene: { setEnvironment: vi.fn(), frameContent: vi.fn() }, syncUI: vi.fn(), syncStats: vi.fn(), schedulePersist: vi.fn(), toast: vi.fn(), renderTrend: vi.fn(), goCamera: vi.fn(), cancelBreeding: vi.fn(), setInteractionMode: vi.fn((mode: 'orbit' | 'paint') => { app.interactionMode = mode; }),
  });
  Object.defineProperty(app, 'rebuildGrid', { value(nextSize: number) { this.grid = new Grid3D(nextSize); this.scratch = new Grid3D(nextSize); this.interventions = new Interventions(nextSize); } });
  app.initialSnapshot = app.makeSnapshot(false);
  return app;
}

describe('App experiment restoration', () => {
  it('restores a different-size snapshot and pauses consistently', () => {
    const app = appHarness();
    const restored = new Grid3D(18); restored.set(5, 6, 7, 3);
    app.loadSnapshot({ v: 2, size: 18, generation: 9, rule: 'B5/S5-6', ruleName: 'Crystal', boundary: 'wrap', seedName: 'Painted', seedId: '', cells: encodeCells(restored), density: .12, speed: 11, playing: true, sliceAxis: 'z', sliceIndex: 4, sliceVisible: false });
    expect(app.grid.size).toBe(18);
    expect(app.grid.get(5, 6, 7)).toBe(3);
    expect(app.playing).toBe(false);
    expect(app.slice.axis).toBe('z');
    expect(app.slice.index).toBe(4);
    expect(app.boundary).toBe('wrap');
  });

  it('restarts the exact random initial world instead of a preset', () => {
    const app = appHarness();
    app.randomize();
    const initialCells = encodeCells(app.grid);
    expect(app.seedName).toBe('Random');
    app.grid.clear(); app.generation = 6;
    app.reset();
    expect(encodeCells(app.grid)).toBe(initialCells);
    expect(app.generation).toBe(0);
    expect(app.seedName).toBe('Random');
  });

  it('preserves the random restart point across a session reload', () => {
    const beforeRefresh = appHarness();
    beforeRefresh.randomize();
    const initialCells = encodeCells(beforeRefresh.grid);
    beforeRefresh.doStep();
    const session = beforeRefresh.makeSnapshot();
    expect(session.generation).toBe(1);
    expect(session.restart).toBeTruthy();

    const afterRefresh = appHarness();
    afterRefresh.loadSnapshot(session, false);
    expect(afterRefresh.generation).toBe(1);
    afterRefresh.reset();
    expect(afterRefresh.generation).toBe(0);
    expect(encodeCells(afterRefresh.grid)).toBe(initialCells);
    expect(afterRefresh.seedName).toBe('Random');
  });

  it('applies a featured setup as one undoable edit', () => {
    const app = appHarness(); const before = encodeCells(app.grid);
    app.applyFeatured(FEATURED_SCENES[1]!);
    expect(app.seedId).toBe('spiral-helix'); expect(app.playing).toBe(false); expect(app.grid.size).toBe(24); expect(app.boundary).toBe('clamp'); expect(app.interactionMode).toBe('orbit');
    app.undo();
    expect(encodeCells(app.grid)).toBe(before);
  });
});
