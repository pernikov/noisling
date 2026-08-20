import { describe, expect, it } from 'vitest';
import { getWeightedRandomValue } from './weightedRandom.js';

describe('getWeightedRandomValue', () => {
  const visualizerModes = [
    { value: 'pills', weight: 1 },
    { value: 'nucleus', weight: 2 },
    { value: 'butterchurn', weight: 19 },
  ];

  it('selects values in proportion to their weights', () => {
    expect(getWeightedRandomValue(visualizerModes, 0)).toBe('pills');
    expect(getWeightedRandomValue(visualizerModes, (1 / 22) - 0.0001)).toBe('pills');
    expect(getWeightedRandomValue(visualizerModes, 1 / 22)).toBe('nucleus');
    expect(getWeightedRandomValue(visualizerModes, (3 / 22) - 0.0001)).toBe('nucleus');
    expect(getWeightedRandomValue(visualizerModes, 3 / 22)).toBe('butterchurn');
    expect(getWeightedRandomValue(visualizerModes, 0.9999)).toBe('butterchurn');
  });

  it('ignores zero, negative, and invalid weights', () => {
    expect(getWeightedRandomValue([
      { value: 'pills', weight: 0 },
      { value: 'nucleus', weight: -2 },
      { value: 'butterchurn', weight: Number.NaN },
      { value: 'future-mode', weight: 1 },
    ], 0.5)).toBe('future-mode');
  });

  it('returns null when there are no selectable values', () => {
    expect(getWeightedRandomValue([], 0.5)).toBeNull();
    expect(getWeightedRandomValue([{ value: 'pills', weight: 0 }], 0.5)).toBeNull();
  });
});
