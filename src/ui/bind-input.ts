import type { AppHost } from './app-host';

export function bindAppInput(app: AppHost, canvas: HTMLCanvasElement): void {
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.target instanceof HTMLSelectElement) return;
      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        app.togglePlay();
      } else if (k === 'n') app.doStep();
      else if (k === 'r') app.reset();
      else if (k === 'g') app.randomize();
      else if (k === 'p') app.toggleSlice();
      else if (k === '[') app.nudgeSlice(-1);
      else if (k === ']') app.nudgeSlice(1);
      else if (k === 'x') app.clickAxis('x');
      else if (k === 'y') app.clickAxis('y');
      else if (k === 'z') app.clickAxis('z');
      else if (k === 'o') document.getElementById('btn-orbit')?.click();
      else if (k === 't') document.getElementById('btn-trails')?.click();
      else if (k === 'm') {
        app.setInteractionMode(app.interactionMode === 'paint' ? 'orbit' : 'paint');
      } else if (k === '?' || (e.shiftKey && k === '/')) {
        document.getElementById('panel')?.classList.toggle('collapsed');
      } else if (k === '1') app.goCamera('orbit');
      else if (k === '2') app.goCamera('hero');
      else if (k === '3') app.goCamera('top');
      else if (k === '4') app.goCamera('close');
      else if (k === '5') app.goCamera('flyby');
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (!app.slice.visible) return;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      if (coarse && app.interactionMode !== 'paint') return;
      app.updatePointer(e, canvas);
      app.raycaster.setFromCamera(app.pointer, app.scene.camera);
      const cell = app.slice.hitToCell(app.raycaster);
      if (!cell) return;
      if (!coarse && app.interactionMode !== 'paint' && !e.altKey) {
      }
      e.preventDefault();
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
      }
      app.scene.controls.enabled = false;
      app.painting = true;
      app.paintErase = e.shiftKey;
      app.lastPaintKey = '';
      app.paintAt(cell.x, cell.y, cell.z);
      app.slice.setHoverCell(cell);
      app.slice.flashPaint();
    });
    canvas.addEventListener('pointermove', (e) => {
      app.updatePointer(e, canvas);
      app.raycaster.setFromCamera(app.pointer, app.scene.camera);
      const cell = app.slice.hitToCell(app.raycaster);
      if (app.slice.visible) {
        app.slice.setHoverCell(cell);
      }
      if (!app.painting) return;
      if (cell) {
        app.paintAt(cell.x, cell.y, cell.z);
        app.slice.flashPaint();
      }
    });
    const endPaint = (e?: PointerEvent) => {
      if (!app.painting) return;
      app.painting = false;
      app.lastPaintKey = '';
      if (e) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
        }
      }
      app.applyInteractionMode();
      app.seedName = 'Painted';
      app.seedId = '';
      app.syncUI();
    };
    canvas.addEventListener('pointerup', endPaint);
    canvas.addEventListener('pointercancel', endPaint);
    canvas.addEventListener('pointerleave', () => {
      if (!app.painting) app.slice.clearHover();
    });
  }

export function runAppLoop(app: AppHost): void {
  requestAnimationFrame(() => runAppLoop(app));
  const dt = app.scene.delta;
  if (app.playing) {
    app.accum += dt;
    const interval = 1 / Math.max(0.5, app.speed);
    while (app.accum >= interval) {
      app.accum -= interval;
      app.doStep();
      if (app.accum > interval * 3) app.accum = 0;
    }
  }
  app.slice.update(dt);
  app.scene.render();
}
