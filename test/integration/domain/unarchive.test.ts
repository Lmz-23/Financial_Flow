// F2b-ter punto 1: AccountService.unarchive.
import { describe, expect, it } from 'vitest';
import { AccountArchivedError, NotFoundError, ValidationError } from '../../../src/domain/services';
import {
  available, count, expectIntegrity, mkAccount, secondUserDomain, setup, snapshot, thrown,
} from './_helpers';

/** Cuenta con movimientos, archivada (ARCHIVE_CLOSE la deja en 0). */
function archived() {
  const env = setup();
  const { d } = env;
  const acc = mkAccount(d, 'Vieja', 500_000);
  const tx = d.transactions.create({ type: 'EXPENSE', accountId: acc, amountMinor: 10_000 }).result.id;
  d.accounts.remove(acc);
  return { env, d, acc, tx };
}

describe('AccountService.unarchive', () => {
  it('quita archivedAt, vuelve a las listas y al total, sin crear ajustes; el disponible sigue en 0', () => {
    const { env, d, acc } = archived();
    const other = mkAccount(d, 'Otra', 1000);
    expect(d.accounts.summary().accounts.map((a) => a.id)).toEqual([other]);
    const adjustments = count(env, 'balance_adjustments');
    const { result, effects } = d.accounts.unarchive(acc);
    expect(result).toEqual({ id: acc });
    expect(effects.refresh).toEqual(expect.arrayContaining(['accounts', 'goals']));
    expect(effects.reschedule).toEqual([]);
    const summary = d.accounts.summary();
    expect(summary.accounts.map((a) => a.id).sort()).toEqual([acc, other].sort());
    expect(summary.accounts.find((a) => a.id === acc)).toMatchObject({ availableMinor: 0, archivedAt: null });
    expect(summary.totalMinor).toBe(1000);
    expect(d.accounts.get(acc)?.archivedAt).toBeNull();
    expect(count(env, 'balance_adjustments')).toBe(adjustments);
    // El ARCHIVE_CLOSE queda como historial.
    expect(count(env, 'balance_adjustments', "reason = 'ARCHIVE_CLOSE'")).toBe(1);
    expectIntegrity(d);
  });

  it('la cuenta desarchivada acepta movimientos de nuevo', () => {
    const { env, d, acc } = archived();
    d.accounts.unarchive(acc);
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 700 });
    expect(available(d, acc)).toBe(700);
    d.accounts.update(acc, { balanceMinor: 900 });
    expect(available(d, acc)).toBe(900);
    const goal = d.goals.create({ name: 'G', targetMinor: 5000 }).result.id;
    d.goals.contribute({ goalId: goal, accountId: acc, amountMinor: 400 });
    expect(available(d, acc)).toBe(500);
    expect(count(env, 'transactions')).toBe(2);
    expectIntegrity(d);
  });

  it('caso que lo motiva: tras desarchivar se puede borrar una transaccion antigua antes bloqueada', () => {
    const { env, d, acc, tx } = archived();
    expect(thrown(() => d.transactions.remove(tx))).toBeInstanceOf(AccountArchivedError);
    d.accounts.unarchive(acc);
    d.transactions.remove(tx);
    expect(count(env, 'transactions')).toBe(0);
    // El gasto de 10_000 se revierte: el disponible (0) sube exactamente esa cantidad.
    expect(available(d, acc)).toBe(10_000);
    expectIntegrity(d);
  });

  it('una cuenta que NO esta archivada se rechaza con ValidationError y sin efectos', () => {
    const env = setup();
    const { d } = env;
    const acc = mkAccount(d, 'A', 100);
    const before = snapshot(env);
    const err = thrown(() => d.accounts.unarchive(acc));
    expect(err).toBeInstanceOf(ValidationError);
    expect(err).toMatchObject({ code: 'VALIDATION' });
    expect(snapshot(env)).toBe(before);
    // Tampoco se puede desarchivar dos veces.
    const { d: d2, acc: acc2 } = archived();
    d2.accounts.unarchive(acc2);
    expect(thrown(() => d2.accounts.unarchive(acc2))).toBeInstanceOf(ValidationError);
  });

  it('cuenta inexistente o de otro usuario: NotFoundError y sin efectos', () => {
    const env = setup();
    const { d } = env;
    const d2 = secondUserDomain(env);
    const foreign = d2.accounts.create({ name: 'Ajena', type: 'CASH', openingMinor: 50 }).result.id;
    d2.transactions.create({ type: 'EXPENSE', accountId: foreign, amountMinor: 5 });
    d2.accounts.remove(foreign);
    const before = snapshot(env);
    expect(thrown(() => d.accounts.unarchive('no-existe'))).toBeInstanceOf(NotFoundError);
    const err = thrown(() => d.accounts.unarchive(foreign));
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err).toMatchObject({ code: 'NOT_FOUND', entityId: foreign });
    expect(snapshot(env)).toBe(before);
    expect(d2.accounts.get(foreign)?.archivedAt).not.toBeNull();
  });

  it('el mensaje de AccountArchivedError sugiere desarchivar y conserva el code', () => {
    const { d, acc } = archived();
    const err = thrown(() => d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 1 }));
    expect(err).toBeInstanceOf(AccountArchivedError);
    expect(err).toMatchObject({
      code: 'ACCOUNT_ARCHIVED',
      accountId: acc,
      message: 'La cuenta está archivada. Desarchívala para modificar su saldo.',
    });
  });

  it('archivar de nuevo tras desarchivar funciona (ciclo completo) y sigue cuadrando', () => {
    const { env, d, acc } = archived();
    d.accounts.unarchive(acc);
    d.transactions.create({ type: 'INCOME', accountId: acc, amountMinor: 300 });
    expect(d.accounts.remove(acc).result.outcome).toBe('ARCHIVED');
    expect(available(d, acc)).toBe(0);
    expect(count(env, 'balance_adjustments', "reason = 'ARCHIVE_CLOSE'")).toBe(2);
    expectIntegrity(d);
  });

  it('con DOS cuentas archivadas, desarchivar una deja la otra archivada (no las desarchiva todas)', () => {
    const env = setup();
    const { d } = env;
    const active = mkAccount(d, 'Activa', 1000);
    const x = mkAccount(d, 'X', 500);
    const y = mkAccount(d, 'Y', 700);
    const goal = d.goals.create({ name: 'G', targetMinor: 90_000 }).result.id;
    d.goals.contribute({ goalId: goal, accountId: x, amountMinor: 50 });
    d.goals.contribute({ goalId: goal, accountId: y, amountMinor: 70 });
    d.transactions.create({ type: 'EXPENSE', accountId: x, amountMinor: 10 });
    d.transactions.create({ type: 'EXPENSE', accountId: y, amountMinor: 20 });
    expect(d.accounts.remove(x).result.outcome).toBe('ARCHIVED');
    expect(d.accounts.remove(y).result.outcome).toBe('ARCHIVED');
    expect(d.accounts.summary().accounts.map((a) => a.id)).toEqual([active]);
    const adjustments = count(env, 'balance_adjustments');

    d.accounts.unarchive(x);

    // X reaparece en lista, selectores y total; Y sigue fuera de todo.
    const summary = d.accounts.summary();
    expect(summary.accounts.map((a) => a.id).sort()).toEqual([active, x].sort());
    expect(summary.accounts.some((a) => a.id === y)).toBe(false);
    expect(summary.totalMinor).toBe(1000);
    expect(d.accounts.get(x)?.archivedAt).toBeNull();
    expect(d.accounts.get(y)?.archivedAt).not.toBeNull();
    const origins = d.goals.contributions(goal);
    expect(origins.find((c) => c.accountId === x)?.accountArchived).toBe(false);
    expect(origins.find((c) => c.accountId === y)?.accountArchived).toBe(true);
    // Y sigue rechazando cualquier operacion que cambie su saldo.
    const before = snapshot(env);
    expect(thrown(() => d.transactions.create({ type: 'INCOME', accountId: y, amountMinor: 1 }))).toBeInstanceOf(
      AccountArchivedError,
    );
    expect(thrown(() => d.accounts.update(y, { balanceMinor: 5 }))).toBeInstanceOf(AccountArchivedError);
    expect(thrown(() => d.goals.contribute({ goalId: goal, accountId: y, amountMinor: 1 }))).toBeInstanceOf(
      AccountArchivedError,
    );
    expect(snapshot(env)).toBe(before);
    // X acepta movimientos y no se crearon ajustes por desarchivar.
    d.transactions.create({ type: 'INCOME', accountId: x, amountMinor: 300 });
    expect(available(d, x)).toBe(300);
    expect(count(env, 'balance_adjustments')).toBe(adjustments);
    expectIntegrity(d);
  });
});
