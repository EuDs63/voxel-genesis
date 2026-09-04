import {
  getPresetById,
  parseRuleNotation,
  ruleFromPreset,
} from '../sim/rules';
import { type SymmetryMode } from '../sim/symmetry';
import { type BoundaryMode } from '../sim/grid';
import { parseSnapshotJSON, writeHash } from '../sim/share';
import { type SliceAxis } from '../render/slice';
import {
  setLocale,
  t,
  onLocaleChange,
  syncLangToggle,
  ruleNameKey,
  symmetryKey,
  type Locale,
} from '../i18n';
import type { AppHost } from './app-host';

export function bindAppUI(app: AppHost): void {
    const $ = (id: string) => document.getElementById(id)!;
    app.fillPresetSelects();
    const presetSel = $('rule-preset') as HTMLSelectElement;
    const seedSel = $('seed-select') as HTMLSelectElement;
    const symSel = $('symmetry') as HTMLSelectElement;
    document.querySelectorAll<HTMLButtonElement>('[data-locale]').forEach((btn) => {
      btn.onclick = () => {
        const loc = btn.dataset.locale as Locale;
        if (loc === 'en' || loc === 'zh') setLocale(loc);
      };
    });
    onLocaleChange(() => app.refreshLocalizedUI());
    syncLangToggle();
    symSel.onchange = () => {
      app.symmetry = symSel.value as SymmetryMode;
      app.toast(
        t('toast.symmetry', { label: t(symmetryKey(app.symmetry)) }),
      );
    };
    $('btn-play').onclick = () => app.togglePlay();
    $('btn-step').onclick = () => app.doStep();
    $('btn-reset').onclick = () => app.reset();
    $('btn-rand').onclick = () => app.randomize();
    $('btn-seed').onclick = () => {
      app.plantSeed(seedSel.value);
    };
    seedSel.onchange = () => app.updateSeedDesc();
    app.updateSeedDesc();
    presetSel.onchange = () => {
      const p = getPresetById(presetSel.value);
      if (!p) return;
      app.rule = ruleFromPreset(p);
      ($('rule-custom') as HTMLInputElement).value = p.notation;
      app.syncUI();
      app.toast(t(ruleNameKey(p.id)));
    };
    $('btn-apply-rule').onclick = () => {
      const raw = ($('rule-custom') as HTMLInputElement).value;
      try {
        app.rule = parseRuleNotation(raw, t('rule.custom'));
        presetSel.value = '';
        app.syncUI();
        app.toast(t('toast.rule', { notation: app.rule.notation }));
      } catch (e) {
        app.toast(e instanceof Error ? e.message : t('toast.invalidRule'));
      }
    };
    const speed = $('speed') as HTMLInputElement;
    speed.oninput = () => {
      app.speed = Number(speed.value);
      $('speed-val').textContent = String(app.speed);
    };
    const size = $('size') as HTMLInputElement;
    size.onchange = () => {
      app.resizeWorld(Number(size.value));
    };
    size.oninput = () => {
      $('size-val').textContent = size.value;
    };
    const dens = $('density') as HTMLInputElement;
    dens.oninput = () => {
      app.density = Number(dens.value);
      $('density-val').textContent = app.density.toFixed(2);
    };
    ($('boundary') as HTMLSelectElement).onchange = (e) => {
      app.boundary = (e.target as HTMLSelectElement).value as BoundaryMode;
    };
    const slice = $('slice') as HTMLInputElement;
    slice.oninput = () => {
      app.slice.setIndex(Number(slice.value));
      $('slice-val').textContent = slice.value;
    };
    const brush = $('brush') as HTMLInputElement;
    brush.oninput = () => {
      app.brushRadius = Number(brush.value);
      app.slice.setBrushRadius(app.brushRadius);
      $('brush-val').textContent = String(app.brushRadius * 2 + 1);
    };
    app.slice.setBrushRadius(app.brushRadius);
    const setAxis = (axis: SliceAxis) => {
      app.slice.setAxis(axis);
      document.querySelectorAll('.axis').forEach((b) => b.classList.remove('active'));
      $(`axis-${axis}`).classList.add('active');
    };
    $('axis-x').onclick = () => setAxis('x');
    $('axis-y').onclick = () => setAxis('y');
    $('axis-z').onclick = () => setAxis('z');
    $('btn-slice-toggle').onclick = () => app.toggleSlice();
    $('btn-orbit').onclick = () => {
      const on = !app.scene.autoOrbit;
      app.scene.setAutoOrbit(on);
      $('btn-orbit').classList.toggle('on', on);
    };
    $('btn-trails').onclick = () => {
      app.trailsEnabled = !app.trailsEnabled;
      app.trails.setEnabled(app.trailsEnabled);
      $('btn-trails').classList.toggle('on', app.trailsEnabled);
    };
    $('btn-bloom').onclick = () => {
      const btn = $('btn-bloom');
      const on = !btn.classList.contains('on');
      btn.classList.toggle('on', on);
      app.scene.setBloom(on);
    };
    if (app.reducedMotion) {
      $('btn-orbit').classList.remove('on');
      $('btn-trails').classList.remove('on');
      $('btn-bloom').classList.remove('on');
    }
    $('btn-export').onclick = () => app.exportJSON();
    $('btn-import').onclick = () => $('import-file').click();
    $('import-file').onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        app.loadSnapshot(parseSnapshotJSON(text));
        app.toast(t('toast.imported'));
      } catch {
        app.toast(t('toast.importFailed'));
      }
    };
    $('btn-share').onclick = async () => {
      writeHash(app.makeSnapshot());
      try {
        await navigator.clipboard.writeText(location.href);
        app.toast(t('toast.urlCopied'));
      } catch {
        app.toast(t('toast.hashUpdated'));
      }
    };
    $('btn-panel').onclick = () => {
      $('panel').classList.toggle('collapsed');
    };
    $('btn-dismiss-hint').onclick = () => app.dismissHint();
    $('btn-mode-orbit').onclick = () => app.setInteractionMode('orbit');
    $('btn-mode-paint').onclick = () => app.setInteractionMode('paint');
    $('btn-mode-fab').onclick = () => {
      app.setInteractionMode(app.interactionMode === 'paint' ? 'orbit' : 'paint');
    };
    presetSel.addEventListener('change', () => app.updateRuleDesc());
    app.updateRuleDesc();
  }
