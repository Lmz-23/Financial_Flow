import { beforeEach, describe, expect, it } from 'vitest';

import { toSettingsSnapshot, useSettingsStore } from '../../../src/store/useSettingsStore';
import { REFRESH_KEYS, useInvalidation } from '../../../src/store/useInvalidation';
import { setup } from '../../integration/domain/_helpers';

describe('useInvalidation', () => {
  beforeEach(() => {
    useInvalidation.setState({ versions: Object.fromEntries(REFRESH_KEYS.map((k) => [k, 0])) as never });
  });

  it('invalidate incrementa solo las claves dadas (una vez aunque se repitan)', () => {
    useInvalidation.getState().invalidate(['accounts', 'accounts', 'statement']);
    const v = useInvalidation.getState().versions;
    expect(v.accounts).toBe(1);
    expect(v.statement).toBe(1);
    expect(v.transactions).toBe(0);
  });

  it('invalidateAll incrementa todas las claves', () => {
    useInvalidation.getState().invalidateAll();
    expect(Object.values(useInvalidation.getState().versions).every((n) => n === 1)).toBe(true);
    expect(Object.keys(useInvalidation.getState().versions).sort()).toEqual([...REFRESH_KEYS].sort());
  });
});

describe('cache de ajustes', () => {
  it('traduce la fila de users: NULL y 0 no activan un widget; solo 1', () => {
    const env = setup();
    const fresh = toSettingsSnapshot(env.d.settings.get());
    expect(fresh).toMatchObject({
      themePreference: 'system',
      onboardingDone: false,
      widgets: { cashflow: false, debts: false, goals: false },
    });

    env.d.settings.setWidget('cashflow', true);
    env.d.settings.setWidget('debts', false);
    env.d.settings.setTheme('dark');
    const next = toSettingsSnapshot(env.d.settings.get());
    expect(next.widgets).toEqual({ cashflow: true, debts: false, goals: false });
    expect(next.themePreference).toBe('dark');
  });

  it('setFromRow publica el snapshot en el store', () => {
    const env = setup();
    useSettingsStore.getState().setFromRow(env.d.settings.get());
    expect(useSettingsStore.getState().settings?.onboardingDone).toBe(false);
    env.d.onboarding.complete({ accounts: [], recurring: [], widgets: { cashflow: true, debts: false, goals: false } });
    useSettingsStore.getState().setFromRow(env.d.settings.get());
    expect(useSettingsStore.getState().settings).toMatchObject({
      onboardingDone: true,
      widgets: { cashflow: true, debts: false, goals: false },
    });
  });
});
