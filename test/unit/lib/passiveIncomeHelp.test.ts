import { describe, expect, it } from 'vitest';

import { consumePassiveHelpFirstTime, PASSIVE_HELP_SEEN_KEY, type KeyValueStorage } from '../../../src/lib/passiveIncomeHelp';

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
  };
}

describe('consumePassiveHelpFirstTime', () => {
  it('true la primera vez y deja el flag', async () => {
    const s = memoryStorage();
    expect(await consumePassiveHelpFirstTime(s)).toBe(true);
    expect(s.data.get(PASSIVE_HELP_SEEN_KEY)).toBe('1');
  });
  it('false en las siguientes', async () => {
    const s = memoryStorage();
    await consumePassiveHelpFirstTime(s);
    expect(await consumePassiveHelpFirstTime(s)).toBe(false);
    expect(await consumePassiveHelpFirstTime(s)).toBe(false);
  });
  it('false si el almacenamiento falla', async () => {
    const bad: KeyValueStorage = {
      getItem: async () => {
        throw new Error('x');
      },
      setItem: async () => {},
    };
    expect(await consumePassiveHelpFirstTime(bad)).toBe(false);
  });
});
