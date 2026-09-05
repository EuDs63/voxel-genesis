// @vitest-environment jsdom
import { bindAppInput } from '../src/ui/bind-input';

function pointer(type: string) {
  const event = new MouseEvent(type, { button: 0, clientX: 5, clientY: 5, bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  return event;
}

function host(mode: 'orbit' | 'paint', tool: 'paint' | 'erase' = 'paint') {
  const paintAt = vi.fn();
  const beginEdit = vi.fn();
  const finishEdit = vi.fn();
  const app = {
    interactionMode: mode, paintTool: tool, painting: false, paintErase: false, lastPaintKey: '', playing: true,
    slice: { visible: true, hitToCell: () => ({ x: 1, y: 2, z: 3 }), setHoverCell: vi.fn(), flashPaint: vi.fn(), clearHover: vi.fn() },
    scene: { camera: {}, controls: { enabled: true } }, pointer: {}, raycaster: { setFromCamera: vi.fn() },
    updatePointer: vi.fn(), paintAt, beginEdit, finishEdit, togglePlay: vi.fn(), applyInteractionMode: vi.fn(), syncUI: vi.fn(),
    setInteractionMode: vi.fn(), undo: vi.fn(), redo: vi.fn(), doStep: vi.fn(), reset: vi.fn(), randomize: vi.fn(), toggleSlice: vi.fn(), nudgeSlice: vi.fn(), clickAxis: vi.fn(), goCamera: vi.fn(),
    seedName: '', seedId: '',
  };
  return { app, paintAt, beginEdit, finishEdit };
}

describe('canvas input modes', () => {
  beforeEach(() => Object.defineProperty(window, 'matchMedia', { configurable: true, value: () => ({ matches: true }) }));

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
});
