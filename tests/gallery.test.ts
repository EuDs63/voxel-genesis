// @vitest-environment jsdom
import { Grid3D } from '../src/sim/grid';
import { getDefaultRule } from '../src/sim/rules';
import { setLocale, t } from '../src/i18n';
import { Gallery } from '../src/ui/gallery';
import { FEATURED_SCENES } from '../src/ui/featured-scenes';

function setup() {
  document.body.innerHTML = `
    <h1 id="artwork-title"></h1><p id="artwork-description"></p>
    <span id="artwork-index"></span><span id="artwork-category"></span><span class="figure-number">001</span>
    <span id="gallery-generation"></span><span id="gallery-population"></span>
    <span id="gallery-density"></span><span id="gallery-rule"></span>
    <span id="gallery-status"></span><div id="gallery-progress"></div>
    <button id="btn-play"></button><button id="btn-gallery-next"></button>
    <button id="btn-stage-play"><span data-stage-play-label></span></button>
    <button id="btn-explode"><span data-explode-label></span></button><button id="btn-open-studio"></button>
    <button id="btn-gallery-prev"></button><button id="btn-gallery-catalog"></button>
    <button id="btn-gallery-image"></button><button id="btn-gallery-immersive"></button>
    <button data-gallery-seed="torus-knot"></button>
    <button data-gallery-seed="ember-ring"></button>
    <nav><button class="workspace-link" data-workspace="watch"></button>
    <button class="workspace-link" data-workspace="create"></button></nav>
    <aside id="panel" class="collapsed"><button class="tab active" data-tab="watch"></button>
    <button class="tab" data-tab="create"></button></aside>`;
  const app = {
    grid: new Grid3D(12), rule: getDefaultRule(), seedId: 'torus-knot', generation: 7, playing: false, exploded: false,
    displaySeedName: () => 'My study', applyFeatured: vi.fn(), openCatalog: vi.fn(),
    toggleImmersive: vi.fn(), saveImage: vi.fn(), toggleExploded: vi.fn(), setInteractionMode: vi.fn(),
  };
  document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
    tab.onclick = () => document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
  });
  return { app, gallery: new Gallery(app) };
}

afterEach(() => setLocale('en', { persist: false }));

describe('gallery simulation view', () => {
  it('shows real simulation values and keeps status and selection in sync', () => {
    const { app, gallery } = setup();
    app.grid.set(1, 1, 1, 1);
    gallery.sync();
    expect(document.getElementById('artwork-title')?.textContent).toBe('Continuum');
    expect(document.getElementById('gallery-generation')?.textContent).toBe('0007');
    expect(document.getElementById('gallery-population')?.textContent).toBe('1');
    expect(document.getElementById('gallery-progress')?.getAttribute('aria-valuenow')).toBe('0.1');
    expect(document.querySelector('[data-gallery-seed="torus-knot"]')?.getAttribute('aria-pressed')).toBe('true');
    app.playing = true; app.grid.clear(); gallery.sync();
    expect(document.getElementById('gallery-density')?.textContent).toBe('0.0%');
    expect(document.getElementById('gallery-status')?.textContent).toBe('Running');
    expect(document.getElementById('btn-play')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.getElementById('btn-play')?.dataset.playing).toBe('true');
    app.seedId = 'menger-frame'; gallery.sync();
    expect(document.querySelector('.figure-number')?.textContent).toBe('003');
  });

  it('localizes the specimen and falls back to the actual title for user artwork', () => {
    const { app, gallery } = setup();
    setLocale('zh', { persist: false }); gallery.sync();
    expect(document.getElementById('artwork-title')?.textContent).toBe('无尽之结');
    expect(document.getElementById('gallery-status')?.textContent).toBe('已暂停');
    app.seedId = ''; gallery.sync();
    expect(document.getElementById('artwork-title')?.textContent).toBe('My study');
    expect(document.getElementById('artwork-index')?.textContent).toBe('— / 04');
    expect(document.getElementById('artwork-category')?.textContent).toBe('你的创作');
  });

  it('routes collection and capture controls to existing application actions', () => {
    const { app } = setup();
    document.getElementById('btn-gallery-next')!.click();
    expect(app.applyFeatured).toHaveBeenLastCalledWith(FEATURED_SCENES[1]);
    document.getElementById('btn-gallery-prev')!.click();
    expect(app.applyFeatured).toHaveBeenLastCalledWith(FEATURED_SCENES[3]);
    app.seedId = '';
    document.getElementById('btn-gallery-next')!.click();
    expect(app.applyFeatured).toHaveBeenLastCalledWith(FEATURED_SCENES[0]);
    document.getElementById('btn-gallery-catalog')!.click();
    document.getElementById('btn-gallery-image')!.click();
    document.getElementById('btn-gallery-immersive')!.click();
    expect(app.openCatalog).toHaveBeenCalledOnce();
    expect(app.saveImage).toHaveBeenCalledOnce();
    expect(app.toggleImmersive).toHaveBeenCalledWith(true);
  });

  it('opens the requested workspace and reflects changes from the inspector tabs', () => {
    const { app } = setup();
    const create = document.querySelector<HTMLButtonElement>('.workspace-link[data-workspace="create"]')!;
    create.click();
    expect(document.querySelector('.tab.active')?.getAttribute('data-tab')).toBe('create');
    expect(document.getElementById('panel')?.classList.contains('collapsed')).toBe(false);
    expect(create.getAttribute('aria-current')).toBe('page');
    document.querySelector<HTMLButtonElement>('.tab[data-tab="watch"]')!.click();
    expect(create.hasAttribute('aria-current')).toBe(false);
    expect(document.body.dataset.workspace).toBe('watch');
    document.querySelector<HTMLButtonElement>('.workspace-link[data-workspace="watch"]')!.click();
    expect(app.setInteractionMode).toHaveBeenCalledWith('orbit');
    expect(document.getElementById('panel')?.classList.contains('collapsed')).toBe(true);
    expect(document.getElementById('btn-open-studio')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps stage playback, assembly and studio controls connected to real state', () => {
    const { app, gallery } = setup();
    const play = vi.fn();
    document.getElementById('btn-play')!.onclick = play;
    document.getElementById('btn-stage-play')!.click();
    document.getElementById('btn-explode')!.click();
    expect(play).toHaveBeenCalledOnce();
    expect(app.toggleExploded).toHaveBeenCalledOnce();
    app.playing = true; app.exploded = true; gallery.sync();
    expect(document.getElementById('btn-stage-play')?.dataset.playing).toBe('true');
    expect(document.querySelector('[data-stage-play-label]')?.textContent).toBe(t('gallery.pause'));
    expect(document.getElementById('btn-explode')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-explode-label]')?.textContent).toBe(t('gallery.assemble'));
    document.getElementById('btn-open-studio')!.click();
    expect(document.getElementById('panel')?.classList.contains('collapsed')).toBe(false);
    expect(document.getElementById('btn-open-studio')?.getAttribute('aria-expanded')).toBe('true');
    document.getElementById('btn-open-studio')!.click();
    expect(document.getElementById('panel')?.classList.contains('collapsed')).toBe(true);
  });
});
