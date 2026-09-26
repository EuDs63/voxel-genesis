// @vitest-environment jsdom
import { bindAppInput } from '../src/ui/bind-input';

function pointer(type: string, pointerType = 'mouse') {
  const event = new MouseEvent(type, { button: 0, clientX: 5, clientY: 5, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  return event;
}

function host(mode: 'orbit' | 'paint', tool: 'paint' | 'erase' = 'paint') {
  const paintAt = vi.fn();
  const beginEdit = vi.fn();
  const finishEdit = vi.fn();
  const diveAtPointer = vi.fn(() => true);
  const app = {
    interactionMode: mode, paintTool: tool, painting: false, paintErase: false, lastPaintKey: '', playing: true,
    slice: { visible: true, hitToCell: () => ({ x: 1, y: 2, z: 3 }), setHoverCell: vi.fn(), flashPaint: vi.fn(), clearHover: vi.fn() },
    scene: { camera: {}, controls: { enabled: true } }, pointer: {}, raycaster: { setFromCamera: vi.fn() },
    updatePointer: vi.fn(), paintAt, beginEdit, finishEdit, togglePlay: vi.fn(), applyInteractionMode: vi.fn(), syncUI: vi.fn(),
    setInteractionMode: vi.fn(), undo: vi.fn(), redo: vi.fn(), doStep: vi.fn(), reset: vi.fn(), randomize: vi.fn(), toggleSlice: vi.fn(), nudgeSlice: vi.fn(), clickAxis: vi.fn(), goCamera: vi.fn(), ascendUniverse: vi.fn(), diveAtPointer,
    seedName: '', seedId: '',
  };
  return { app, paintAt, beginEdit, finishEdit, diveAtPointer };
}

describe('canvas input modes', () => {
  const keyboardListeners: EventListenerOrEventListenerObject[] = [];
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) });
    const addListener = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation((type, listener, options) => {
      if (type === 'keydown') keyboardListeners.push(listener);
      addListener(type, listener, options);
    });
  });
  afterEach(() => {
    keyboardListeners.splice(0).forEach((listener) => window.removeEventListener('keydown', listener));
    vi.restoreAllMocks();
  });

  it('orbit clicks never paint', () => {
    const canvas = document.createElement('canvas');
    const test = host('orbit');
    bindAppInput(test.app as never, canvas);
    canvas.dispatchEvent(pointer('pointerdown'));
    expect(test.paintAt).not.toHaveBeenCalled();
    expect(test.beginEdit).not.toHaveBeenCalled();
  });

  it('paint and touch erase commit one history entry per stroke', () => {
    const canvas = document.createElement('canvas');
    const test = host('paint', 'erase');
    bindAppInput(test.app as never, canvas);
    canvas.dispatchEvent(pointer('pointerdown'));
    expect(test.app.paintErase).toBe(true);
    expect(test.beginEdit).toHaveBeenCalledTimes(1);
    expect(test.paintAt).toHaveBeenCalledTimes(1);
    canvas.dispatchEvent(pointer('pointerup'));
    expect(test.finishEdit).toHaveBeenCalledTimes(1);
  });

  it('a stationary double tap dives once in orbit mode', () => {
    const canvas = document.createElement('canvas');
    const test = host('orbit');
    bindAppInput(test.app as never, canvas);
    canvas.dispatchEvent(pointer('pointerdown', 'touch'));
    canvas.dispatchEvent(pointer('pointerup', 'touch'));
    canvas.dispatchEvent(pointer('pointerdown', 'touch'));
    canvas.dispatchEvent(pointer('pointerup', 'touch'));
    // Browsers may synthesize a mouse dblclick after the second touch tap.
    canvas.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 5, clientY: 5 }));
    expect(test.diveAtPointer).toHaveBeenCalledTimes(1);
  });

  it('does not enter a child universe after touch rotation gestures', () => {
    const canvas = document.createElement('canvas');
    const test = host('orbit');
    bindAppInput(test.app as never, canvas);
    for (let i = 0; i < 2; i++) {
      canvas.dispatchEvent(pointer('pointerdown', 'touch'));
      const up = pointer('pointerup', 'touch');
      Object.defineProperty(up, 'clientX', { value: 80 });
      canvas.dispatchEvent(up);
    }
    expect(test.diveAtPointer).not.toHaveBeenCalled();
  });

  it('preserves Space activation on focused controls and editable content', () => {
    const test = host('orbit');
    bindAppInput(test.app as never, document.createElement('canvas'));
    document.body.innerHTML = '<button><span>Open collection</span></button><details><summary>Advanced</summary></details><div contenteditable="true"><span>Draft</span></div>';
    for (const target of document.querySelectorAll('button span, summary, [contenteditable] span')) {
      const event = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(test.app.togglePlay).not.toHaveBeenCalled();
    document.body.innerHTML = '';
  });

  it('leaves already-handled key events alone and retains canvas Space playback', () => {
    const test = host('orbit');
    const canvas = document.createElement('canvas');
    document.body.append(canvas);
    bindAppInput(test.app as never, canvas);
    const handled = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    handled.preventDefault();
    canvas.dispatchEvent(handled);
    expect(test.app.togglePlay).not.toHaveBeenCalled();
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(test.app.togglePlay).toHaveBeenCalledTimes(1);
    canvas.remove();
  });
});
