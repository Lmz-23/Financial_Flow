import { describe, expect, it } from 'vitest';

import { activeRailKey, isDialogRoute, skeletonFor } from '../../../src/navigation/desktop';

describe('activeRailKey', () => {
  it.each([
    ['/', 'home'],
    ['/transactions', 'transactions'],
    ['/transactions/abc', 'transactions'],
    ['/debts/d1/pay', 'debts'],
    ['/settings', 'settings'],
    ['/accounts/a1', 'accounts'],
    ['/reports', null],
    ['/transactionsx', null],
  ] as const)('%s -> %s', (pathname, key) => {
    expect(activeRailKey(pathname)).toBe(key);
  });
});

describe('isDialogRoute', () => {
  it('los formularios se abren como ventana; listas y detalles no', () => {
    expect(isDialogRoute('transactions/new')).toBe(true);
    expect(isDialogRoute('recurring/[id]/confirm')).toBe(true);
    expect(isDialogRoute('transactions/index')).toBe(false);
    expect(isDialogRoute('transactions/[id]')).toBe(false);
    expect(isDialogRoute('index')).toBe(false);
  });
});

describe('skeletonFor', () => {
  it('cada pantalla tiene el esqueleto de su estructura; el resto, tabla', () => {
    expect(skeletonFor('index')).toBe('dashboard');
    expect(skeletonFor('recurring/index')).toBe('weeks');
    expect(skeletonFor('transactions/index')).toBe('table');
    expect(skeletonFor('accounts/[id]')).toBe('table');
  });
});
