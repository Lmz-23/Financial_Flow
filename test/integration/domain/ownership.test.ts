// Propiedad del usuario: un id de OTRO usuario se trata exactamente como un id inexistente
// (NotFoundError indistinguible, sin efectos en la BD) en TODOS los puntos de entrada con id.
import { describe, expect, it } from 'vitest';
import type { Domain } from '../../../src/domain/createDomain';
import { NotFoundError, RefundAccountRequiredError } from '../../../src/domain/services';
import {
  expectIntegrity, localMs, mkAccount, secondUserDomain, setup, snapshot, thrown, type TestEnv,
} from './_helpers';

const MISSING = 'no-existe-xyz';

interface World {
  env: TestEnv;
  a: Domain;
  b: Domain;
  // Datos de A (el "ajeno" para B)
  accA: string;
  accArchA: string;
  txA: string;
  catA: string;
  debtA: string;
  recDebtA: string;
  debtOccurrence: string;
  goalA: string;
  goalReadyA: string;
  recA: string;
  recAOccurrence: string;
  // Datos propios de B
  accB: string;
  debtB: string;
  goalB: string;
  recB: string;
  recBOccurrence: string;
}

/** A con datos de todas las clases (incluida una cuenta archivada con aportes) y B con lo suyo. */
function world(): World {
  const env = setup();
  const a = env.d;
  const b = secondUserDomain(env);

  const accA = mkAccount(a, 'Cuenta A', 1_000_000);
  const accArchA = mkAccount(a, 'Archivada A', 50_000);
  const txA = a.transactions.create({
    type: 'EXPENSE', accountId: accA, amountMinor: 100, newCategoryName: 'CatA',
  }).result.id;
  const catA = a.transactions.categories('EXPENSE').find((c) => c.userId !== null)!.id;

  const debt = a.debts.create({
    name: 'Deuda A', balanceMinor: 500_000, installmentMinor: 50_000, rate: { known: 0.02 }, nextDueDate: '2026-04-01',
  }).result;
  a.debts.registerPayment({ debtId: debt.id, accountId: accA, amountMinor: 50_000, type: 'INSTALLMENT' });

  const goalA = a.goals.create({ name: 'Meta A', targetMinor: 100_000 }).result.id;
  a.goals.contribute({ goalId: goalA, accountId: accA, amountMinor: 30_000 });
  a.goals.contribute({ goalId: goalA, accountId: accArchA, amountMinor: 10_000 });
  a.accounts.remove(accArchA); // tiene un aporte: se archiva
  const goalReadyA = a.goals.create({ name: 'Lista A', targetMinor: 5_000 }).result.id;
  a.goals.contribute({ goalId: goalReadyA, accountId: accA, amountMinor: 5_000 });

  const recA = a.recurring.create({
    type: 'EXPENSE', name: 'Renta A', amountMinor: 1_000, frequency: 'MONTHLY', anchorDate: '2026-03-15',
    categoryId: catA, defaultAccountId: accA,
  }).result.id;
  a.recurring.confirmOccurrence({ recurringId: recA, occurrenceDate: '2026-03-15', accountId: accA });

  const accB = mkAccount(b, 'Cuenta B', 500_000);
  const debtB = b.debts.create({
    name: 'Deuda B', balanceMinor: 80_000, installmentMinor: 8_000, rate: { known: 0.01 }, nextDueDate: '2026-04-05',
  }).result.id;
  const goalB = b.goals.create({ name: 'Meta B', targetMinor: 50_000 }).result.id;
  const recB = b.recurring.create({
    type: 'EXPENSE', name: 'Renta B', amountMinor: 2_000, frequency: 'MONTHLY', anchorDate: '2026-03-20',
  }).result.id;

  return {
    env, a, b, accA, accArchA, txA, catA,
    debtA: debt.id, recDebtA: debt.recurringId!, debtOccurrence: '2026-04-01',
    goalA, goalReadyA, recA, recAOccurrence: '2026-03-15',
    accB, debtB, goalB, recB, recBOccurrence: '2026-03-20',
  };
}

/**
 * La operacion con un id ajeno lanza el MISMO NotFoundError que con un id inexistente (misma entidad,
 * mismo mensaje salvo el id) y la foto completa de las 9 tablas queda identica.
 */
function expectNotFound(env: TestEnv, call: (id: string) => unknown, foreignId: string, entity: string): void {
  const before = snapshot(env);
  const foreign = thrown(() => call(foreignId));
  const missing = thrown(() => call(MISSING));
  expect(foreign).toBeInstanceOf(NotFoundError);
  expect(missing).toBeInstanceOf(NotFoundError);
  expect(foreign).toMatchObject({ code: 'NOT_FOUND', entity });
  expect((foreign as NotFoundError).message.replace(foreignId, 'ID')).toBe(
    (missing as NotFoundError).message.replace(MISSING, 'ID'),
  );
  expect(snapshot(env)).toBe(before);
}

describe('propiedad: cuentas', () => {
  it('get de una cuenta ajena es undefined, igual que una inexistente', () => {
    const w = world();
    expect(w.b.accounts.get(w.accA)).toBeUndefined();
    expect(w.b.accounts.get(w.accArchA)).toBeUndefined();
    expect(w.b.accounts.get(MISSING)).toBeUndefined();
    expect(w.a.accounts.get(w.accA)).toBeDefined();
  });

  it.each([
    ['update (nombre)', (w: World, id: string) => w.b.accounts.update(id, { name: 'Hackeada' })],
    ['update (saldo)', (w: World, id: string) => w.b.accounts.update(id, { balanceMinor: 1 })],
    ['remove', (w: World, id: string) => w.b.accounts.remove(id)],
    ['unarchive', (w: World, id: string) => w.b.accounts.unarchive(id)],
  ])('%s con una cuenta ajena activa: NotFoundError sin efectos', (_n, op) => {
    const w = world();
    expectNotFound(w.env, (id) => op(w, id), w.accA, 'Cuenta');
  });

  it.each([
    ['update', (w: World, id: string) => w.b.accounts.update(id, { name: 'X' })],
    ['remove', (w: World, id: string) => w.b.accounts.remove(id)],
    ['unarchive', (w: World, id: string) => w.b.accounts.unarchive(id)],
  ])('%s con una cuenta ajena ARCHIVADA no revela que existe ni que esta archivada', (_n, op) => {
    const w = world();
    expectNotFound(w.env, (id) => op(w, id), w.accArchA, 'Cuenta');
  });

  it('remove ajeno no borra la cuenta de A ni sus ajustes (A sigue viendo todo igual)', () => {
    const w = world();
    const before = JSON.stringify(w.a.accounts.summary());
    thrown(() => w.b.accounts.remove(w.accA));
    expect(JSON.stringify(w.a.accounts.summary())).toBe(before);
    expectIntegrity(w.a);
    expectIntegrity(w.b);
  });
});

describe('propiedad: transacciones', () => {
  it('get de una transaccion ajena es undefined, igual que una inexistente', () => {
    const w = world();
    expect(w.b.transactions.get(w.txA)).toBeUndefined();
    expect(w.b.transactions.get(MISSING)).toBeUndefined();
    expect(w.a.transactions.get(w.txA)).toBeDefined();
  });

  it('remove de una transaccion ajena: NotFoundError sin efectos', () => {
    const w = world();
    expectNotFound(w.env, (id) => w.b.transactions.remove(id), w.txA, 'Transaccion');
  });

  it('create con accountId ajeno (activa o archivada): NotFoundError sin efectos', () => {
    const w = world();
    for (const acc of [w.accA, w.accArchA]) {
      expectNotFound(
        w.env,
        (id) => w.b.transactions.create({ type: 'INCOME', accountId: id, amountMinor: 10 }),
        acc,
        'Cuenta',
      );
    }
  });

  it('create con categoryId ajeno: NotFoundError; con una categoria del sistema funciona', () => {
    const w = world();
    expectNotFound(
      w.env,
      (id) => w.b.transactions.create({ type: 'EXPENSE', accountId: w.accB, amountMinor: 10, categoryId: id }),
      w.catA,
      'Categoria',
    );
    const system = w.b.transactions.categories('EXPENSE').find((c) => c.userId === null)!;
    expect(() =>
      w.b.transactions.create({ type: 'EXPENSE', accountId: w.accB, amountMinor: 10, categoryId: system.id }),
    ).not.toThrow();
  });

  it('el filtro por accountId ajeno no devuelve nada y B no ve las categorias de A', () => {
    const w = world();
    expect(w.b.transactions.list({ accountId: w.accA })).toEqual([]);
    expect(w.b.transactions.categories().some((c) => c.id === w.catA)).toBe(false);
    expect(w.a.transactions.categories().some((c) => c.id === w.catA)).toBe(true);
  });
});

describe('propiedad: deudas', () => {
  it('get de una deuda ajena es undefined; payments ajeno es [] como el de una deuda inexistente', () => {
    const w = world();
    expect(w.b.debts.get(w.debtA)).toBeUndefined();
    expect(w.b.debts.get(MISSING)).toBeUndefined();
    expect(w.b.debts.payments(MISSING)).toEqual([]);
    expect(w.b.debts.payments(w.debtA)).toEqual([]);
    expect(w.a.debts.payments(w.debtA)).toHaveLength(1);
  });

  it.each([
    ['update (nombre)', (w: World, id: string) => w.b.debts.update(id, { name: 'X' })],
    ['update (saldo)', (w: World, id: string) => w.b.debts.update(id, { balanceMinor: 1 })],
    ['update (fecha)', (w: World, id: string) => w.b.debts.update(id, { nextDueDate: '2026-06-01' })],
    ['remove', (w: World, id: string) => w.b.debts.remove(id)],
    [
      'registerPayment (debtId)',
      (w: World, id: string) =>
        w.b.debts.registerPayment({ debtId: id, accountId: w.accB, amountMinor: 1_000, type: 'EXTRA' }),
    ],
  ])('%s con una deuda ajena: NotFoundError sin efectos', (_n, op) => {
    const w = world();
    expectNotFound(w.env, (id) => op(w, id), w.debtA, 'Deuda');
  });

  it('registerPayment con accountId ajeno (activa o archivada): NotFoundError sin efectos', () => {
    const w = world();
    for (const acc of [w.accA, w.accArchA]) {
      expectNotFound(
        w.env,
        (id) => w.b.debts.registerPayment({ debtId: w.debtB, accountId: id, amountMinor: 1_000, type: 'EXTRA' }),
        acc,
        'Cuenta',
      );
    }
  });
});

describe('propiedad: metas', () => {
  it('get ajeno es undefined; contributions y refundPreview ajenos son vacios como los de una meta inexistente', () => {
    const w = world();
    expect(w.b.goals.get(w.goalA)).toBeUndefined();
    expect(w.b.goals.get(MISSING)).toBeUndefined();
    expect(w.b.goals.contributions(MISSING)).toEqual([]);
    expect(w.b.goals.contributions(w.goalA)).toEqual([]);
    const empty = { refunds: [], requiresDestinationMinor: 0 };
    expect(w.b.goals.refundPreview(MISSING)).toEqual(empty);
    expect(w.b.goals.refundPreview(w.goalA)).toEqual(empty);
    expect(w.a.goals.contributions(w.goalA)).toHaveLength(2);
    expect(w.a.goals.refundPreview(w.goalA).requiresDestinationMinor).toBe(10_000);
  });

  it.each([
    ['update', (w: World, id: string) => w.b.goals.update(id, { name: 'X', savedMinor: 1 })],
    ['close', (w: World, id: string) => w.b.goals.close(id)],
    ['remove', (w: World, id: string) => w.b.goals.remove(id)],
    [
      'remove con refundAccountId propio',
      (w: World, id: string) => w.b.goals.remove(id, { refundAccountId: w.accB }),
    ],
    [
      'contribute (goalId)',
      (w: World, id: string) => w.b.goals.contribute({ goalId: id, accountId: w.accB, amountMinor: 1_000 }),
    ],
  ])('%s con una meta ajena: NotFoundError sin efectos', (_n, op) => {
    const w = world();
    expectNotFound(w.env, (id) => op(w, id), w.goalReadyA, 'Meta');
    expectNotFound(w.env, (id) => op(w, id), w.goalA, 'Meta');
  });

  it('contribute con accountId ajeno (activa o archivada): NotFoundError sin efectos', () => {
    const w = world();
    for (const acc of [w.accA, w.accArchA]) {
      expectNotFound(
        w.env,
        (id) => w.b.goals.contribute({ goalId: w.goalB, accountId: id, amountMinor: 1_000 }),
        acc,
        'Cuenta',
      );
    }
  });

  it('create con accountId ajeno y ahorro inicial: NotFoundError y no se crea la meta', () => {
    const w = world();
    expectNotFound(
      w.env,
      (id) => w.b.goals.create({ name: 'N', targetMinor: 9_000, initialMinor: 100, accountId: id }),
      w.accA,
      'Cuenta',
    );
  });

  it('EXCEPCION: remove de una meta PROPIA con refundAccountId ajeno lanza RefundAccountRequiredError (invalidAccountId)', () => {
    // El error de dominio ya establecido para "destino inservible" (inexistente, archivado o ajeno): no
    // revela si la cuenta existe. Es indistinguible del caso inexistente.
    const w = world();
    const before = snapshot(w.env);
    const foreign = thrown(() => w.a.goals.remove(w.goalA, { refundAccountId: w.accB }));
    const missing = thrown(() => w.a.goals.remove(w.goalA, { refundAccountId: MISSING }));
    expect(foreign).toBeInstanceOf(RefundAccountRequiredError);
    expect(missing).toBeInstanceOf(RefundAccountRequiredError);
    expect(foreign).toMatchObject({ invalidAccountId: w.accB, totalMinor: 10_000 });
    expect((foreign as RefundAccountRequiredError).byAccount).toEqual((missing as RefundAccountRequiredError).byAccount);
    expect(snapshot(w.env)).toBe(before);
    expectIntegrity(w.a);
    expectIntegrity(w.b);
  });
});

describe('propiedad: recurrentes', () => {
  it.each([
    ['update', (w: World, id: string) => w.b.recurring.update(id, { name: 'X', amountMinor: 5 })],
    ['remove', (w: World, id: string) => w.b.recurring.remove(id)],
    ['snooze', (w: World, id: string) => w.b.recurring.snooze(id)],
    [
      'confirmOccurrence (recurringId)',
      (w: World, id: string) =>
        w.b.recurring.confirmOccurrence({ recurringId: id, occurrenceDate: '2026-04-15', accountId: w.accB }),
    ],
  ])('%s con un recurrente ajeno: NotFoundError sin efectos', (_n, op) => {
    const w = world();
    expectNotFound(w.env, (id) => op(w, id), w.recA, 'Recurrente');
  });

  it('una cuota de deuda ajena se trata como inexistente (no NOT_SUPPORTED ni USE_DEBT_PAYMENT_FLOW)', () => {
    const w = world();
    expectNotFound(w.env, (id) => w.b.recurring.update(id, { name: 'X' }), w.recDebtA, 'Recurrente');
    expectNotFound(w.env, (id) => w.b.recurring.remove(id), w.recDebtA, 'Recurrente');
    expectNotFound(w.env, (id) => w.b.recurring.snooze(id), w.recDebtA, 'Recurrente');
    expectNotFound(
      w.env,
      (id) => w.b.recurring.confirmOccurrence({ recurringId: id, occurrenceDate: '2026-05-01', accountId: w.accB }),
      w.recDebtA,
      'Recurrente',
    );
  });

  it('unconfirm de la ocurrencia confirmada de otro usuario: NotFoundError y la transaccion de A sigue', () => {
    const w = world();
    expectNotFound(w.env, (id) => w.b.recurring.unconfirm(id, w.recAOccurrence), w.recA, 'Ocurrencia confirmada');
    expectNotFound(w.env, (id) => w.b.recurring.unconfirm(id, w.debtOccurrence), w.recDebtA, 'Ocurrencia confirmada');
    expect(w.a.recurring.list().find((r) => r.id === w.recA)?.nextDueDate).toBe('2026-04-15');
    expect(w.a.debts.payments(w.debtA)).toHaveLength(1);
  });

  it('confirmOccurrence propio con accountId ajeno (activa o archivada): NotFoundError sin efectos', () => {
    const w = world();
    for (const acc of [w.accA, w.accArchA]) {
      expectNotFound(
        w.env,
        (id) =>
          w.b.recurring.confirmOccurrence({
            recurringId: w.recB, occurrenceDate: w.recBOccurrence, accountId: id,
          }),
        acc,
        'Cuenta',
      );
    }
  });

  it('create y update con defaultAccountId o categoryId ajenos: NotFoundError sin efectos', () => {
    const w = world();
    const base = { type: 'EXPENSE', name: 'N', amountMinor: 10, frequency: 'MONTHLY' } as const;
    expectNotFound(w.env, (id) => w.b.recurring.create({ ...base, defaultAccountId: id }), w.accA, 'Cuenta');
    expectNotFound(w.env, (id) => w.b.recurring.create({ ...base, defaultAccountId: id }), w.accArchA, 'Cuenta');
    expectNotFound(w.env, (id) => w.b.recurring.create({ ...base, categoryId: id }), w.catA, 'Categoria');
    expectNotFound(w.env, (id) => w.b.recurring.update(w.recB, { defaultAccountId: id }), w.accA, 'Cuenta');
    expectNotFound(w.env, (id) => w.b.recurring.update(w.recB, { categoryId: id }), w.catA, 'Categoria');
  });
});

describe('propiedad: onboarding', () => {
  it('ids ajenos dentro del borrador (categoryId, defaultAccountId): NotFoundError y no se completa nada', () => {
    const w = world();
    const widgets = { cashflow: true, debts: true, goals: true };
    const rec = { type: 'EXPENSE', name: 'N', amountMinor: 10, frequency: 'MONTHLY' } as const;
    expectNotFound(
      w.env,
      (id) => w.b.onboarding.complete({ accounts: [], recurring: [{ ...rec, categoryId: id }], widgets }),
      w.catA,
      'Categoria',
    );
    expectNotFound(
      w.env,
      (id) => w.b.onboarding.complete({ accounts: [], recurring: [{ ...rec, defaultAccountId: id }], widgets }),
      w.accA,
      'Cuenta',
    );
    expect(w.b.settings.get().onboardingCompletedAt).toBeNull();
  });
});

describe('propiedad: listados, reportes e integridad no se mezclan', () => {
  it('B sin datos no ve nada de A en ningun listado, reporte ni patrimonio', () => {
    const w = world();
    const empty = secondUserDomain(w.env, 'vacio');
    expect(empty.accounts.summary()).toEqual({ accounts: [], totalMinor: 0 });
    expect(empty.transactions.list()).toEqual([]);
    expect(empty.debts.list()).toEqual([]);
    expect(empty.goals.list()).toEqual([]);
    expect(empty.goals.list('ACTIVE')).toEqual([]);
    expect(empty.recurring.list()).toEqual([]);
    expect(empty.recurring.upcoming()).toEqual([]);
    expect(empty.recurring.pendingOccurrences()).toEqual([]);
    expect(empty.reports.netWorth()).toBe(0);
    const zero = empty.reports.monthStatement(2026, 3);
    expect(zero).toMatchObject({
      ingresoTotal: 0, ingresoPasivo: 0, ingresoActivo: 0, gastoVida: 0, gastoDeuda: 0, gastoMetas: 0,
      gastoTotal: 0, netCashflow: 0, index: { kind: 'NONE' },
    });
    expect(empty.reports.monthStatementOf(localMs(2026, 3, 10))).toEqual(zero);
    expectIntegrity(empty);
  });

  it('cada usuario ve solo lo suyo y las operaciones de B no cambian las vistas de A', () => {
    const w = world();
    const viewsOfA = () =>
      JSON.stringify([
        w.a.accounts.summary(), w.a.transactions.list(), w.a.debts.list(), w.a.goals.list(), w.a.goals.list('ACTIVE'),
        w.a.recurring.list(), w.a.recurring.upcoming(), w.a.recurring.pendingOccurrences(),
        w.a.reports.monthStatement(2026, 3), w.a.reports.netWorth(),
      ]);
    const before = viewsOfA();
    expect(w.a.accounts.summary().accounts.map((x) => x.id)).toEqual([w.accA]);
    expect(w.b.accounts.summary().accounts.map((x) => x.id)).toEqual([w.accB]);
    expect(w.b.accounts.summary().totalMinor).toBe(500_000);
    expect(w.b.transactions.list()).toEqual([]);
    expect(w.b.debts.list().map((d) => d.id)).toEqual([w.debtB]);
    expect(w.b.goals.list().map((g) => g.id)).toEqual([w.goalB]);
    expect(w.b.recurring.list().map((r) => r.id)).toEqual([w.recB]);
    const upcomingB = w.b.recurring.upcoming().map((r) => r.recurringId);
    expect(upcomingB).toHaveLength(2); // su recurrente y la cuota de su deuda
    expect(upcomingB).toContain(w.recB);
    expect(upcomingB).not.toContain(w.recA);
    expect(upcomingB).not.toContain(w.recDebtA);
    expect(w.b.recurring.pendingOccurrences()).toHaveLength(2);
    expect(w.b.reports.netWorth()).toBe(500_000 - 80_000);

    // B opera de verdad sobre lo suyo: las vistas de A no cambian.
    w.b.transactions.create({ type: 'INCOME', accountId: w.accB, amountMinor: 123_456, isPassive: true });
    w.b.transactions.create({ type: 'EXPENSE', accountId: w.accB, amountMinor: 1_000, newCategoryName: 'CatA' });
    w.b.debts.registerPayment({ debtId: w.debtB, accountId: w.accB, amountMinor: 8_000, type: 'INSTALLMENT' });
    w.b.goals.contribute({ goalId: w.goalB, accountId: w.accB, amountMinor: 10_000 });
    w.b.recurring.confirmOccurrence({ recurringId: w.recB, occurrenceDate: w.recBOccurrence, accountId: w.accB });
    expect(viewsOfA()).toBe(before);
    expect(w.b.reports.monthStatement(2026, 3).ingresoTotal).toBe(123_456);
    expect(w.a.reports.monthStatement(2026, 3).ingresoTotal).toBe(0);
    expectIntegrity(w.a);
    expectIntegrity(w.b);
  });

  it('IntegrityService es independiente: una violacion de A no aparece en B', () => {
    const w = world();
    // Meta de A marcada como gastada con una foto que no coincide con su ahorro (I3), por SQL directo.
    w.env.sqlite
      .prepare("update goals set status = 'SPENT', spent_at = 0, spent_amount_minor = 999 where id = ?")
      .run(w.goalA);
    const reportA = w.a.integrity.check();
    expect(reportA.ok).toBe(false);
    expect(reportA.violations.some((v) => v.invariant === 'I3')).toBe(true);
    expectIntegrity(w.b);
  });
});
