import { describe, expect, it } from 'vitest';
import { formatExactDuration } from './formatDuration.js';

describe('formatExactDuration', () => {
  it('preserves seconds for album-length durations under an hour', () => {
    expect(formatExactDuration(2527)).toBe('42:07');
  });

  it('shows hours when the duration crosses one hour', () => {
    expect(formatExactDuration(3723)).toBe('1:02:03');
  });

  it('rounds the summed total once before formatting', () => {
    expect(formatExactDuration(59.6)).toBe('1:00');
  });
});
