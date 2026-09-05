// @vitest-environment jsdom
import { App } from '../src/app';
import { parseRuleNotation } from '../src/sim/rules';
import { setLocale } from '../src/i18n';

describe('App rule selector', () => {
  it('keeps a localized Custom option selected for custom rules', () => {
    document.body.innerHTML = '<select id="rule-preset"></select><select id="seed-select"></select><select id="symmetry"></select><div id="camera-presets"></div><p id="rule-empty"></p><p id="rule-live"></p><span id="stat-rule"></span>';
    const app = Object.create(App.prototype) as App;
    Object.assign(app, { rule: parseRuleNotation('B1/S2', 'Custom'), goCamera: vi.fn() });
    app.fillPresetSelects();
    const select = document.getElementById('rule-preset') as HTMLSelectElement;
    expect([...select.options].some((option) => option.value === 'custom')).toBe(true);
    expect(select.value).toBe('custom');
    app.updateRuleDesc();
    expect(document.getElementById('rule-empty')?.textContent).toContain('Empty cell');
    setLocale('zh', { persist: false });
    app.fillPresetSelects();
    app.updateRuleDesc();
    expect(select.value).toBe('custom');
    expect(document.getElementById('rule-empty')?.textContent).toContain('空格子');
    expect(select.options[0]?.textContent).toBe('新生 4 · 保留 4–5');
    setLocale('en', { persist: false });
  });
});

describe('immersive view', () => {
  it('restores the previous panel, drawing mode, and explicit hidden plane', () => {
    document.body.innerHTML = '<aside id="panel"></aside>';
    const app = Object.create(App.prototype) as App;
    const slice = { visible: false, setVisible: vi.fn((visible: boolean) => { slice.visible = visible; }) };
    const scene = { helpersVisible: true, setHelpersVisible: vi.fn((visible: boolean) => { scene.helpersVisible = visible; }) };
    Object.assign(app, { interactionMode: 'paint', paintSliceVisible: false, slice, scene, interventionRenderer: { group: { visible: true } }, setInteractionMode: vi.fn((mode: string) => { app.interactionMode = mode as 'paint' | 'orbit'; }) });
    app.toggleImmersive(true);
    expect(document.body.classList.contains('immersive')).toBe(true); expect(slice.visible).toBe(false);
    app.toggleImmersive(false);
    expect(document.body.classList.contains('immersive')).toBe(false); expect(app.interactionMode).toBe('paint'); expect(slice.visible).toBe(false); expect(scene.helpersVisible).toBe(true);
  });
});

describe('trend empty state', () => {
  it('shows the empty prompt only when population is zero', () => {
    document.body.innerHTML = '<svg><path id="trend-path"></path></svg><p id="step-delta"></p><p id="trend-empty"></p>';
    const app = Object.create(App.prototype) as App;
    Object.assign(app, { grid: { population: 27 }, trend: { path: () => 'M0,0' }, lastStep: null });
    app.renderTrend(); expect(document.getElementById('trend-empty')?.classList.contains('hidden')).toBe(true);
    (app.grid as { population: number }).population = 0; app.renderTrend();
    expect(document.getElementById('trend-empty')?.classList.contains('hidden')).toBe(false);
  });
});

describe('palette legend', () => {
  it('uses the exact renderer palette stops in age order', () => {
    const app = Object.create(App.prototype) as App;
    Object.assign(app, { grid: {}, voxels: { sync: vi.fn() }, trails: { clear: vi.fn() }, schedulePersist: vi.fn() });
    app.setPalette('glacier', false);
    expect(document.body.style.getPropertyValue('--palette-young')).toBe('#5b9dff');
    expect(document.body.style.getPropertyValue('--palette-mature')).toBe('#61f4ef');
    expect(document.body.style.getPropertyValue('--palette-ancient')).toBe('#e3fbff');
    app.setPalette('orchid', false);
    expect(document.body.style.getPropertyValue('--palette-ancient')).toBe('#66e8ff');
  });
});
