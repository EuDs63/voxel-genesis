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
  getLocale,
  symmetryKey,
  type Locale,
} from '../i18n';
import type { AppHost } from './app-host';
import { ruleConditionLabel } from '../sim/rule-explanation';

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
    $('btn-defaults').onclick = () => app.restoreDefaults();
    $('btn-undo').onclick = () => app.undo();
    $('btn-redo').onclick = () => app.redo();
    $('btn-rand').onclick = () => app.randomize();
    $('btn-seed').onclick = () => {
      app.plantSeed(seedSel.value);
    };
    seedSel.onchange = () => app.updateSeedDesc();
    app.updateSeedDesc();
    presetSel.onchange = () => {
      const p = getPresetById(presetSel.value);
      if (!p) return;
      app.beginEdit(); app.rule = ruleFromPreset(p);
      ($('rule-custom') as HTMLInputElement).value = p.notation;
      app.syncUI();
      app.toast(ruleConditionLabel(app.rule, getLocale()));
      app.finishEdit();
    };
    $('btn-apply-rule').onclick = () => {
      const raw = ($('rule-custom') as HTMLInputElement).value;
      try {
        const parsed = parseRuleNotation(raw, t('rule.custom'));
        $('rule-error').textContent = '';
        app.beginEdit();
        app.rule = parsed;
        presetSel.value = 'custom';
        app.syncUI();
        app.toast(t('toast.rule', { notation: app.rule.notation }));
        app.finishEdit();
      } catch (e) {
        $('rule-error').textContent = t('rules.invalidHelp');
        app.toast(t('toast.invalidRule'));
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
      app.beginEdit();
      app.boundary = (e.target as HTMLSelectElement).value as BoundaryMode;
      app.finishEdit();
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
    $('btn-panel-close').onclick = () => $('panel').classList.add('collapsed');
    $('btn-dismiss-hint').onclick = () => app.dismissHint();
    $('btn-mode-orbit').onclick = () => app.setInteractionMode('orbit');
    $('btn-mode-paint').onclick = () => app.setInteractionMode('paint');
    $('btn-tool-paint').onclick = () => app.setPaintTool('paint');
    $('btn-tool-erase').onclick = () => app.setPaintTool('erase');
    $('btn-tool-source').onclick = () => { app.setInteractionMode('paint'); app.setPaintTool('source'); };
    $('btn-tool-barrier').onclick = () => { app.setInteractionMode('paint'); app.setPaintTool('barrier'); };
    $('btn-tool-intervention-erase').onclick = () => { app.setInteractionMode('paint'); app.setPaintTool('intervention-erase'); };
    $('btn-clear-interventions').onclick = () => app.clearInterventions();
    $('btn-center-source').onclick = () => app.addCenterSource();
    $('btn-mode-fab').onclick = () => {
      app.setInteractionMode(app.interactionMode === 'paint' ? 'orbit' : 'paint');
    };
    document.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach((button) => {
      button.onclick = () => app.setPalette(button.dataset.palette as 'ember' | 'glacier' | 'orchid');
    });
    $('btn-immersive').onclick = () => app.toggleImmersive(true);
    $('btn-exit-immersive').onclick = () => app.toggleImmersive(false);
    $('btn-image').onclick = () => app.saveImage();
    $('btn-open-catalog').onclick = () => app.openCatalog();
    $('btn-open-catalog-create').onclick = () => app.openCatalog();
    $('btn-focus').onclick = () => app.focusArtwork();
    $('btn-breed').onclick = () => { void app.startBreeding(); };
    $('btn-cancel-breeding').onclick = () => app.cancelBreeding(true);
    ($('breeding-dialog') as HTMLDialogElement).oncancel=(event)=>{ event.preventDefault(); app.cancelBreeding(true); };
    document.querySelectorAll<HTMLButtonElement>('[data-environment]').forEach(button=>button.onclick=()=>app.setEnvironment(button.dataset.environment as 'aurora'|'dawn'|'blueprint'));
    document.querySelectorAll<HTMLButtonElement>('[data-dialog-close]').forEach(button=>button.onclick=()=>{ const dialog=button.closest('dialog') as HTMLDialogElement; if(dialog.id==='breeding-dialog')app.cancelBreeding(true);else dialog.close(); });
    ($('catalog-search') as HTMLInputElement).oninput=()=>app.filterCatalog();
    document.querySelectorAll<HTMLButtonElement>('#catalog-filters [data-category]').forEach(button=>button.onclick=()=>{document.querySelectorAll('#catalog-filters [data-category]').forEach(el=>el.classList.toggle('active',el===button));app.filterCatalog();});
    presetSel.addEventListener('change', () => app.updateRuleDesc());
    $('btn-save-work').onclick = () => app.saveWork();
    document.querySelectorAll<HTMLButtonElement>('.tab').forEach((tab) => {
      tab.onclick = () => {
        document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el === tab));
        document.querySelectorAll<HTMLElement>('.tab').forEach((el) => { el.setAttribute('aria-selected', el === tab ? 'true' : 'false'); el.tabIndex = el === tab ? 0 : -1; });
        document.querySelectorAll<HTMLElement>('.tab-content').forEach((el) => {
          el.hidden = el.dataset.tab !== tab.dataset.tab;
        });
      };
      tab.onkeydown = (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault(); const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tab')];
        const delta = event.key === 'ArrowRight' ? 1 : -1; const next = tabs[(tabs.indexOf(tab) + delta + tabs.length) % tabs.length]!;
        next.click(); next.focus();
      };
    });
    app.refreshLibrary();
    app.updateRuleDesc();
  }
