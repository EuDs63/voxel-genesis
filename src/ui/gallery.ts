import type { Grid3D } from '../sim/grid';
import type { Rule } from '../sim/rules';
import { getSeedById } from '../sim/seeds';
import { getLocale, seedDescKey, t } from '../i18n';
import { FEATURED_SCENES, type FeaturedScene } from './featured-scenes';

interface GalleryHost {
  grid: Grid3D;
  rule: Rule;
  seedId: string;
  generation: number;
  playing: boolean;
  exploded?: boolean;
  displaySeedName(): string;
  applyFeatured(feature: FeaturedScene): void;
  openCatalog(): void;
  toggleImmersive(force?: boolean): void;
  saveImage(): void;
  toggleExploded?(): void;
  setInteractionMode?(mode: 'orbit' | 'paint'): void;
}

/** Exhibition UI is a view of the real simulation, with the same editing history. */
export class Gallery {
  private elements = new Map<string, HTMLElement | null>();
  private numberFormat = new Intl.NumberFormat(getLocale());
  private locale = getLocale();

  constructor(private readonly app: GalleryHost) {
    this.bind('btn-gallery-catalog', () => app.openCatalog());
    this.bind('btn-gallery-immersive', () => app.toggleImmersive(true));
    this.bind('btn-gallery-image', () => app.saveImage());
    this.bind('btn-gallery-prev', () => this.advance(-1));
    this.bind('btn-gallery-next', () => this.advance(1));
    this.bind('btn-stage-play', () => this.element('btn-play')?.click());
    this.bind('btn-explode', () => app.toggleExploded?.());
    this.bind('btn-open-studio', () => {
      document.getElementById('panel')?.classList.toggle('collapsed');
      this.syncInspector();
    });
    this.bind('btn-panel', () => this.syncInspector());
    this.bind('btn-panel-close', () => this.syncInspector());
    const panel = document.getElementById('panel');
    if (panel) {
      new MutationObserver(() => this.syncInspector()).observe(panel, { attributes: true, attributeFilter: ['class'] });
    }
    document.querySelectorAll<HTMLButtonElement>('[data-gallery-seed]').forEach((button) => {
      button.addEventListener('click', () => {
        const feature = FEATURED_SCENES.find((item) => item.seedId === button.dataset.gallerySeed);
        if (feature) app.applyFeatured(feature);
      });
    });
    document.querySelectorAll<HTMLButtonElement>('.workspace-link[data-workspace]').forEach((button) => {
      button.addEventListener('click', () => {
        const workspace = button.dataset.workspace;
        document.querySelector<HTMLButtonElement>(`.tab[data-tab="${workspace}"]`)?.click();
        if (workspace === 'watch') app.setInteractionMode?.('orbit');
        document.getElementById('panel')?.classList.toggle('collapsed', workspace === 'watch');
        this.syncWorkspace();
      });
    });
    document.querySelectorAll<HTMLButtonElement>('.tab').forEach((button) => {
      button.addEventListener('click', () => this.syncWorkspace());
    });
    this.syncWorkspace();
  }

  private syncInspector(): void {
    const expanded = !document.getElementById('panel')?.classList.contains('collapsed');
    this.element('btn-open-studio')?.setAttribute('aria-expanded', String(expanded));
    this.element('btn-panel')?.setAttribute('aria-expanded', String(expanded));
    document.body.classList.toggle('inspector-open', expanded);
  }

  private element(id: string): HTMLElement | null {
    if (!this.elements.has(id)) this.elements.set(id, document.getElementById(id));
    return this.elements.get(id) ?? null;
  }

  private bind(id: string, callback: () => void): void {
    this.element(id)?.addEventListener('click', callback);
  }

  private setText(id: string, value: string): void {
    const element = this.element(id);
    if (element && element.textContent !== value) element.textContent = value;
  }

  private advance(direction: 1 | -1): void {
    const current = FEATURED_SCENES.findIndex((feature) => feature.seedId === this.app.seedId);
    const index = current < 0 ? (direction === 1 ? 0 : FEATURED_SCENES.length - 1)
      : (current + direction + FEATURED_SCENES.length) % FEATURED_SCENES.length;
    this.app.applyFeatured(FEATURED_SCENES[index]!);
  }

  private syncWorkspace(): void {
    const selected = document.querySelector<HTMLElement>('.tab.active')?.dataset.tab ?? 'watch';
    document.querySelectorAll<HTMLElement>('.workspace-link[data-workspace]').forEach((button) => {
      const active = button.dataset.workspace === selected;
      button.classList.toggle('active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    document.body.dataset.workspace = selected;
    this.syncInspector();
  }

  sync(): void {
    const app = this.app;
    const locale = getLocale();
    if (this.locale !== locale) {
      this.locale = locale;
      this.numberFormat = new Intl.NumberFormat(locale);
    }
    const index = FEATURED_SCENES.findIndex((feature) => feature.seedId === app.seedId);
    const feature = FEATURED_SCENES[index];
    const seed = getSeedById(app.seedId);
    const occupancy = app.grid.population / app.grid.size ** 3 * 100;
    this.setText('artwork-title', feature ? t(feature.nameKey) : app.displaySeedName());
    this.setText('artwork-description', feature ? t(feature.descriptionKey) : seed ? t(seedDescKey(seed.id)) : t('gallery.customDescription'));
    this.setText('artwork-index', `${index >= 0 ? String(index + 1).padStart(2, '0') : '—'} / ${String(FEATURED_SCENES.length).padStart(2, '0')}`);
    const figureNumber = index >= 0 ? String(index + 1).padStart(3, '0') : '—';
    document.querySelectorAll<HTMLElement>('.figure-number').forEach((element) => {
      if (element.textContent !== figureNumber) element.textContent = figureNumber;
    });
    this.setText('artwork-category', seed ? t(`category.${seed.category ?? 'geometry'}`) : t('gallery.custom'));
    this.setText('gallery-generation', String(app.generation).padStart(4, '0'));
    this.setText('gallery-population', this.numberFormat.format(app.grid.population));
    this.setText('gallery-density', `${occupancy.toFixed(1)}%`);
    this.setText('gallery-rule', app.rule.notation);
    this.setText('gallery-status', t(app.playing ? 'state.running' : 'state.paused'));
    const progress = this.element('gallery-progress');
    if (progress) {
      progress.style.width = `${occupancy}%`;
      progress.setAttribute('aria-label', t('gallery.fill'));
      progress.setAttribute('aria-valuenow', occupancy.toFixed(1));
      progress.setAttribute('aria-valuemin', '0');
      progress.setAttribute('aria-valuemax', '100');
      progress.setAttribute('role', 'meter');
    }
    document.querySelectorAll<HTMLElement>('[data-gallery-seed]').forEach((button) => {
      const active = button.dataset.gallerySeed === app.seedId;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    document.body.classList.toggle('simulation-running', app.playing);
    this.element('gallery-status')?.classList.toggle('running', app.playing);
    const playButton = this.element('btn-play');
    if (playButton) {
      playButton.setAttribute('aria-pressed', String(app.playing));
      playButton.dataset.playing = String(app.playing);
    }
    const stagePlay = this.element('btn-stage-play');
    if (stagePlay) {
      const label = stagePlay.querySelector('[data-stage-play-label]') ?? stagePlay;
      const text = t(app.playing ? 'gallery.pause' : app.generation > 0 ? 'gallery.resume' : 'gallery.start');
      if (label.textContent !== text) label.textContent = text;
      stagePlay.setAttribute('aria-pressed', String(app.playing));
      stagePlay.dataset.playing = String(app.playing);
    }
    const explode = this.element('btn-explode');
    if (explode) {
      const label = explode.querySelector('[data-explode-label]') ?? explode;
      const text = t(app.exploded ? 'gallery.assemble' : 'gallery.explode');
      if (label.textContent !== text) label.textContent = text;
      explode.setAttribute('aria-pressed', String(!!app.exploded));
    }
    document.body.classList.toggle('artwork-exploded', !!app.exploded);
  }
}
