import { describe, expect, it } from 'vitest';

import { routes, upcomingConfirmRoute } from '../../../src/navigation/routes';

describe('upcomingConfirmRoute', () => {
  it('un recurrente generico abre la hoja "Ya pague" con la ocurrencia', () => {
    expect(upcomingConfirmRoute({ debtId: null, recurringId: 'r1', nextDueDate: '2026-10-15' })).toBe(
      '/recurring/r1/confirm?occurrence=2026-10-15',
    );
  });

  it('la cuota de una deuda va al flujo de pago de deuda, nunca al generico (I4)', () => {
    expect(upcomingConfirmRoute({ debtId: 'd1', recurringId: 'r9', nextDueDate: '2026-10-20' })).toBe(
      '/debts/d1/pay?type=INSTALLMENT&occurrence=2026-10-20',
    );
  });

  it('rutas del Dashboard', () => {
    expect(routes.account('a1')).toBe('/accounts/a1');
    expect(routes.transactionNew()).toBe('/transactions/new');
  });
});
