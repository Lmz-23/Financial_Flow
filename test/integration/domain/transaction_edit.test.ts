// Edicion de transacciones (decision 2026-10-27): STANDARD editable, DEBT_PAYMENT no, ligada a recurrente sin fecha.
import { describe, expect, it } from 'vitest';
import {
  AccountArchivedError,
  NotFoundError,
  TransactionNotEditableError,
  ValidationError,
} from '../../../src/domain/services';
import { available, expectIntegrity, localMs, mkAccount, setup, snapshot, thrown } from './_helpers';

function world() {
  const env = setup();
  const a = mkAccount(env.d, 'A', 100_000);
  const b = mkAccount(env.d, 'B', 10_000);
  return { env, d: env.d, a, b };
}

describe('TransactionService.update: STANDARD', () => {
  it('edita monto, cuenta, fecha, descripcion y categoria; saldos y reporte se rederivan', () => {
    const { d, a, b } = world();
    const id = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 30_000, description: 'x', date: localMs(2026, 3, 2) }).result.id;
    expect(available(d, a)).toBe(70_000);
    const date = localMs(2026, 2, 10);
    const res = d.transactions.update(id, { amountMinor: 45_000, accountId: b, date, description: '  almuerzo ', newCategoryName: 'Comida' });
    expect(res.effects.refresh).toEqual(['accounts', 'transactions', 'statement']);
    expect(available(d, a)).toBe(100_000);
    expect(available(d, b)).toBe(-35_000);
    const view = d.transactions.get(id)!;
    expect(view).toMatchObject({ amountMinor: 45_000, accountId: b, date, description: 'almuerzo', categoryName: 'Comida', type: 'EXPENSE', kind: 'STANDARD' });
    expect(d.reports.monthStatement(2026, 2).gastoVida).toBe(45_000);
    expect(d.reports.monthStatement(2026, 3).gastoVida).toBe(0);
    expectIntegrity(d);
  });

  it('lo omitido se conserva; categoryId null la quita; una existente se reutiliza', () => {
    const { d, a } = world();
    const id = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 100, newCategoryName: 'Cat' }).result.id;
    const catId = d.transactions.get(id)!.categoryId;
    d.transactions.update(id, { description: 'solo texto' });
    expect(d.transactions.get(id)).toMatchObject({ amountMinor: 100, categoryId: catId, description: 'solo texto' });
    d.transactions.update(id, { categoryId: null });
    expect(d.transactions.get(id)!.categoryId).toBeNull();
    d.transactions.update(id, { categoryId: catId! });
    expect(d.transactions.get(id)!.categoryId).toBe(catId);
    d.transactions.update(id, { newCategoryName: 'Cat' }); // reutiliza la existente
    expect(d.transactions.get(id)!.categoryId).toBe(catId);
  });

  it('validaciones: monto, categoria de otro tipo, categoryId + newCategoryName, id inexistente', () => {
    const { env, d, a } = world();
    const id = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 100 }).result.id;
    d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 1, newCategoryName: 'Sueldo' });
    const income = d.transactions.categories('INCOME').find((c) => c.name === 'Sueldo')!;
    const before = snapshot(env);
    expect(thrown(() => d.transactions.update(id, { amountMinor: 0 }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.update(id, { amountMinor: 1.5 }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.update(id, { categoryId: income.id }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.update(id, { categoryId: income.id, newCategoryName: 'X' }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.update(id, { date: Number.NaN }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transactions.update('no-existe', { amountMinor: 1 }))).toBeInstanceOf(NotFoundError);
    expect(snapshot(env)).toBe(before);
  });

  it('el tipo no se edita y un gasto nunca queda pasivo; un ingreso si puede marcarse y desmarcarse', () => {
    const { env, d, a } = world();
    const exp = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 100 }).result.id;
    // Igual que create: marcar pasivo un gasto es ValidationError.
    expect(thrown(() => d.transactions.update(exp, { isPassive: true }))).toBeInstanceOf(ValidationError);
    expect(d.transactions.get(exp)).toMatchObject({ type: 'EXPENSE', isPassive: false });
    const inc = d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 1_000 }).result.id;
    d.transactions.update(inc, { isPassive: true });
    expect(d.transactions.get(inc)!.isPassive).toBe(true);
    expect(d.reports.monthStatementOf().ingresoPasivo).toBe(1_000);
    d.transactions.update(inc, { amountMinor: 2_000 }); // conserva lo pasivo
    expect(d.transactions.get(inc)!.isPassive).toBe(true);
    d.transactions.update(inc, { isPassive: false });
    expect(d.reports.monthStatementOf().ingresoPasivo).toBe(0);
    expect(env.sqlite.prepare('select type from transactions where id = ?').pluck().get(inc)).toBe('INCOME');
    expectIntegrity(d);
  });

  it('marcar pasivo auto-activa el widget de cashflow (efecto settings) solo si nunca se decidio', () => {
    const { d, a } = world();
    const inc = d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 1_000 }).result.id;
    expect(d.settings.get().widgetCashflow).toBeNull();
    const res = d.transactions.update(inc, { isPassive: true });
    expect(res.effects.refresh).toContain('settings');
    expect(d.settings.get().widgetCashflow).toBe(1);
    d.settings.setWidget('cashflow', false);
    expect(d.transactions.update(inc, { isPassive: true }).effects.refresh).not.toContain('settings');
    expect(d.settings.get().widgetCashflow).toBe(0);
  });

  it('cuenta actual o nueva archivada: AccountArchivedError sin efectos', () => {
    const { env, d, a, b } = world();
    const id = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 100 }).result.id;
    const onB = d.transactions.create({ type: 'EXPENSE', accountId: b, amountMinor: 100 }).result.id;
    d.accounts.remove(b); // archivada
    const before = snapshot(env);
    expect(thrown(() => d.transactions.update(id, { accountId: b }))).toMatchObject({ code: 'ACCOUNT_ARCHIVED', accountId: b });
    expect(thrown(() => d.transactions.update(onB, { description: 'x' }))).toBeInstanceOf(AccountArchivedError);
    expect(thrown(() => d.transactions.update(onB, { accountId: a }))).toBeInstanceOf(AccountArchivedError);
    expect(snapshot(env)).toBe(before);
  });
});

describe('TransactionService.update: DEBT_PAYMENT y recurrentes', () => {
  it('un pago de deuda no se edita (TransactionNotEditableError DEBT_PAYMENT) y sigue igual', () => {
    const { env, d, a } = world();
    const debt = d.debts.create({ name: 'D', balanceMinor: 500_000, installmentMinor: 50_000, rate: { known: 0.02 }, nextDueDate: '2026-04-01' }).result;
    const pay = d.debts.registerPayment({ debtId: debt.id, accountId: a, amountMinor: 50_000, type: 'INSTALLMENT' }).result.transactionId;
    const before = snapshot(env);
    const err = thrown(() => d.transactions.update(pay, { amountMinor: 1 }));
    expect(err).toBeInstanceOf(TransactionNotEditableError);
    expect(err).toMatchObject({ code: 'TRANSACTION_NOT_EDITABLE', reason: 'DEBT_PAYMENT', transactionId: pay });
    expect(snapshot(env)).toBe(before);
  });

  it('la que confirma una ocurrencia recurrente edita todo menos la fecha', () => {
    const { d, a, b } = world();
    const rec = d.recurring.create({ type: 'EXPENSE', name: 'Renta', amountMinor: 1_000, frequency: 'MONTHLY', anchorDate: '2026-03-05' }).result.id;
    const txId = d.recurring.confirmOccurrence({ recurringId: rec, occurrenceDate: '2026-03-05', accountId: a }).result.transactionId;
    const original = d.transactions.get(txId)!;
    const err = thrown(() => d.transactions.update(txId, { date: original.date + 86_400_000 }));
    expect(err).toMatchObject({ code: 'TRANSACTION_NOT_EDITABLE', reason: 'RECURRING_DATE' });
    expect(d.transactions.get(txId)!.date).toBe(original.date);
    // La misma fecha (el formulario la reenvia) se acepta.
    d.transactions.update(txId, { date: original.date, amountMinor: 1_500, accountId: b, description: 'ajustada', newCategoryName: 'Vivienda' });
    expect(d.transactions.get(txId)).toMatchObject({ amountMinor: 1_500, accountId: b, description: 'ajustada', categoryName: 'Vivienda', recurringItemId: rec, occurrenceDate: '2026-03-05' });
    // La ocurrencia sigue confirmada y se puede desmarcar.
    d.recurring.unconfirm(rec, '2026-03-05');
    expect(d.transactions.get(txId)).toBeUndefined();
    expectIntegrity(d);
  });
});
