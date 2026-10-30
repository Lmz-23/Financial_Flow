import { describe, expect, it } from 'vitest';

import { layoutSizeFor } from '../../../src/lib/layoutSize';

describe('layoutSizeFor', () => {
  it.each([
    [360, 'compact'],
    [599, 'compact'],
    [600, 'medium'],
    [1024, 'medium'],
    [1025, 'wide'],
    [1440, 'wide'],
    [2560, 'wide'],
  ] as const)('%i px -> %s', (width, size) => {
    expect(layoutSizeFor(width)).toBe(size);
  });
});
