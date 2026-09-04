/**
 * Poster PNG capture: clean frame (optional HUD hide) via canvas.toDataURL.
 */

export interface PosterOptions {
  hideHud?: boolean;
  filename?: string;
  beforeCapture?: () => void;
  afterCapture?: () => void;
}

export function setHudHidden(hidden: boolean): void {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('poster-export', hidden);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function captureCanvasPng(
  canvas: HTMLCanvasElement,
  opts: PosterOptions = {},
): string | null {
  const hideHud = opts.hideHud !== false;
  if (hideHud) setHudHidden(true);
  opts.beforeCapture?.();
  let dataUrl: string | null = null;
  try {
    if (typeof document !== 'undefined') void document.body.offsetHeight;
    dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || dataUrl === 'data:,') dataUrl = null;
  } catch {
    dataUrl = null;
  } finally {
    opts.afterCapture?.();
    if (hideHud) setHudHidden(false);
  }
  return dataUrl;
}

export function exportPosterPng(
  canvas: HTMLCanvasElement,
  opts: PosterOptions = {},
): boolean {
  const dataUrl = captureCanvasPng(canvas, opts);
  if (!dataUrl) return false;
  const name = opts.filename ?? `voxel-genesis-poster-${Date.now()}`;
  downloadDataUrl(dataUrl, `${name}.png`);
  return true;
}
