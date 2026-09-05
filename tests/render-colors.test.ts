import { afterEach, describe, expect, it } from 'vitest';
import { ageToColor, getColorPalette, setColorPalette, trailColor } from '../src/render/colors';

afterEach(() => setColorPalette('ember'));

describe('render color palettes', () => {
  it('switches the live voxel ramp at runtime', () => {
    setColorPalette('ember');
    const ember = ageToColor(1).getHex();
    setColorPalette('glacier');
    const glacier = ageToColor(1).getHex();

    expect(getColorPalette()).toBe('glacier');
    expect(glacier).not.toBe(ember);
  });

  it('uses the selected palette for trails', () => {
    setColorPalette('glacier');
    const glacier = trailColor(0.5).getHex();
    setColorPalette('orchid');
    const orchid = trailColor(0.5).getHex();

    expect(orchid).not.toBe(glacier);
  });
});
