// Transferencias entre cuentas (decision 2026-10-27): saldo derivado, bloqueo por fondos, archivadas,
// reporte del mes sin cambios, actividad unificada y archivado/borrado de cuentas con transferencias.
import { describe, expect, it } from 'vitest';
import {
  AccountArchivedError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../../src/domain/services';
import { available, count, expectIntegrity, localMs, mkAccount, setup, snapshot, thrown } from './_helpers';

function world() {
  const env = setup();
  const a = mkAccount(env.d, 'Origen', 100_000);
  const b = mkAccount(env.d, 'Destino', 20_000);
  return { env, d: env.d, a, b };
}

describe('Transferencias: saldo derivado', () => {
  it('resta del origen, suma al destino y deja intacto el total y el patrimonio', () => {
    const { d, a, b } = world();
    const netWorth = d.reports.netWorth();
    const total = d.accounts.summary().totalMinor;
    const res = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 30_000, note: '  ahorro  ' });
    expect(available(d, a)).toBe(70_000);
    expect(available(d, b)).toBe(50_000);
    expect(d.accounts.summary().totalMinor).toBe(total);
    expect(d.reports.netWorth()).toBe(netWorth);
    expect(d.accounts.summary().accounts.map((x) => x.availableMinor)).toEqual([70_000, 50_000]);
    expect(d.transfers.get(res.result.id)).toMatchObject({
      fromAccountId: a, toAccountId: b, amountMinor: 30_000, note: 'ahorro', fromAccountName: 'Origen', toAccountName: 'Destino',
    });
    expect(res.effects.refresh).toEqual(['accounts', 'transactions']);
    expectIntegrity(d);
  });

  it('no es ingreso ni gasto: el reporte del mes y el Indice no cambian', () => {
    const { d, a, b } = world();
    d.transactions.create({ type: 'INCOME', accountId: a, amountMinor: 10_000, isPassive: true });
    d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 4_000 });
    const before = d.reports.monthStatementOf();
    d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 50_000 });
    expect(d.reports.monthStatementOf()).toEqual(before);
    expect(d.reports.monthStatementOf().index).toEqual(before.index);
  });

  it('nota opcional (vacia -> null) y fecha por defecto = reloj del dominio', () => {
    const { env, d, a, b } = world();
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 1, note: '   ' }).result.id;
    expect(d.transfers.get(id)).toMatchObject({ note: null, date: env.clock.now });
  });
});

describe('Transferencias: validaciones', () => {
  it('origen = destino, monto no positivo/no entero y fecha invalida: ValidationError sin efectos', () => {
    const { env, d, a, b } = world();
    const before = snapshot(env);
    const cases = [
      { fromAccountId: a, toAccountId: a, amountMinor: 10 },
      { fromAccountId: a, toAccountId: b, amountMinor: 0 },
      { fromAccountId: a, toAccountId: b, amountMinor: -5 },
      { fromAccountId: a, toAccountId: b, amountMinor: 1.5 },
      { fromAccountId: a, toAccountId: b, amountMinor: 10, date: Number.NaN },
    ];
    for (const input of cases) expect(thrown(() => d.transfers.create(input))).toBeInstanceOf(ValidationError);
    expect(snapshot(env)).toBe(before);
  });

  it('cuenta inexistente: NotFoundError', () => {
    const { d, a } = world();
    expect(thrown(() => d.transfers.create({ fromAccountId: 'x', toAccountId: a, amountMinor: 1 }))).toBeInstanceOf(NotFoundError);
    expect(thrown(() => d.transfers.create({ fromAccountId: a, toAccountId: 'x', amountMinor: 1 }))).toBeInstanceOf(NotFoundError);
  });

  it('origen o destino archivado: AccountArchivedError con el id de la cuenta', () => {
    const { env, d, a, b } = world();
    const arch = mkAccount(d, 'Vieja', 0);
    d.transactions.create({ type: 'INCOME', accountId: arch, amountMinor: 5 });
    d.accounts.remove(arch); // con movimientos: se archiva
    const before = snapshot(env);
    expect(thrown(() => d.transfers.create({ fromAccountId: arch, toAccountId: b, amountMinor: 1 }))).toMatchObject({
      code: 'ACCOUNT_ARCHIVED', accountId: arch,
    });
    expect(thrown(() => d.transfers.create({ fromAccountId: a, toAccountId: arch, amountMinor: 1 }))).toBeInstanceOf(
      AccountArchivedError,
    );
    expect(snapshot(env)).toBe(before);
  });
});

describe('Transferencias: bloqueo por fondos', () => {
  it('permite exactamente el disponible y rechaza un centavo mas (InsufficientFundsError con el disponible)', () => {
    const { env, d, a, b } = world();
    const before = snapshot(env);
    const err = thrown(() => d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 100_001 }));
    expect(err).toBeInstanceOf(InsufficientFundsError);
    expect(err).toMatchObject({ code: 'INSUFFICIENT_FUNDS', accountId: a, availableMinor: 100_000, requestedMinor: 100_001 });
    expect(snapshot(env)).toBe(before);
    d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 100_000 });
    expect(available(d, a)).toBe(0);
    expect(thrown(() => d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 1 }))).toBeInstanceOf(InsufficientFundsError);
  });

  it('cuenta en negativo no puede transferir; el dinero recibido si se puede reenviar', () => {
    const { d, a, b } = world();
    d.accounts.update(a, { balanceMinor: -10 });
    expect(thrown(() => d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 1 }))).toBeInstanceOf(InsufficientFundsError);
    d.transfers.create({ fromAccountId: b, toAccountId: a, amountMinor: 20_000 });
    d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 19_990 });
    expect(available(d, a)).toBe(0);
    expectIntegrity(d);
  });
});

describe('Transferencias: editar', () => {
  it('el chequeo considera el monto original devuelto', () => {
    const { d, a, b } = world();
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 80_000 }).result.id;
    expect(available(d, a)).toBe(20_000);
    // Subir a 100.000 cabe porque se devuelven los 80.000 originales (disponible efectivo 100.000).
    d.transfers.update(id, { amountMinor: 100_000 });
    expect(available(d, a)).toBe(0);
    expect(available(d, b)).toBe(120_000);
    // 100.001 ya no cabe.
    const err = thrown(() => d.transfers.update(id, { amountMinor: 100_001 }));
    expect(err).toMatchObject({ code: 'INSUFFICIENT_FUNDS', accountId: a, availableMinor: 100_000, requestedMinor: 100_001 });
    expect(available(d, a)).toBe(0);
  });

  it('cambiar de origen revisa el disponible del nuevo origen (incluido lo que ya recibia de esta transferencia)', () => {
    const { env, d, a, b } = world();
    const c = mkAccount(d, 'Tercera', 5_000);
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 30_000 }).result.id;
    const before = snapshot(env);
    // c solo tiene 5.000
    expect(thrown(() => d.transfers.update(id, { fromAccountId: c }))).toMatchObject({ code: 'INSUFFICIENT_FUNDS', accountId: c, availableMinor: 5_000 });
    // b tiene 50.000 (20.000 + 30.000 recibidos); al devolverlos quedan 20.000: no alcanza para 30.000 hacia a
    expect(thrown(() => d.transfers.update(id, { fromAccountId: b, toAccountId: a }))).toMatchObject({
      code: 'INSUFFICIENT_FUNDS', accountId: b, availableMinor: 20_000,
    });
    expect(snapshot(env)).toBe(before);
    d.transfers.update(id, { fromAccountId: b, toAccountId: a, amountMinor: 20_000 });
    expect(available(d, a)).toBe(120_000);
    expect(available(d, b)).toBe(0);
    expectIntegrity(d);
  });

  it('cambia destino, fecha y nota; bajar el monto o editar la nota no se bloquea si el origen quedo corto', () => {
    const { d, a, b } = world();
    const c = mkAccount(d, 'Tercera', 0);
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 60_000 }).result.id;
    d.accounts.update(a, { balanceMinor: -500 }); // el origen quedo en negativo despues
    const date = localMs(2026, 2, 1);
    d.transfers.update(id, { toAccountId: c, date, note: 'nueva' });
    expect(d.transfers.get(id)).toMatchObject({ toAccountId: c, date, note: 'nueva' });
    d.transfers.update(id, { amountMinor: 10_000, note: '' });
    expect(d.transfers.get(id)).toMatchObject({ amountMinor: 10_000, note: null });
    expect(available(d, c)).toBe(10_000);
    expect(thrown(() => d.transfers.update(id, { amountMinor: 60_001 }))).toBeInstanceOf(InsufficientFundsError);
  });

  it('mismas validaciones que create: from = to, monto, destino archivado', () => {
    const { d, a, b } = world();
    const arch = mkAccount(d, 'Vieja', 0);
    d.transactions.create({ type: 'INCOME', accountId: arch, amountMinor: 5 });
    d.accounts.remove(arch);
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 10 }).result.id;
    expect(thrown(() => d.transfers.update(id, { toAccountId: a }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transfers.update(id, { amountMinor: 0 }))).toBeInstanceOf(ValidationError);
    expect(thrown(() => d.transfers.update(id, { toAccountId: arch }))).toBeInstanceOf(AccountArchivedError);
    expect(thrown(() => d.transfers.update('no-existe', { amountMinor: 1 }))).toBeInstanceOf(NotFoundError);
  });

  it('con una cuenta implicada archivada, editar y borrar lanzan AccountArchivedError; al desarchivar se puede', () => {
    const { env, d, a, b } = world();
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 10_000 }).result.id;
    expect(d.accounts.removalOutcome(b)).toBe('ARCHIVED');
    d.accounts.remove(b);
    const before = snapshot(env);
    expect(thrown(() => d.transfers.update(id, { note: 'x' }))).toMatchObject({ code: 'ACCOUNT_ARCHIVED', accountId: b });
    expect(thrown(() => d.transfers.remove(id))).toMatchObject({ code: 'ACCOUNT_ARCHIVED', accountId: b });
    expect(snapshot(env)).toBe(before);
    d.accounts.unarchive(b);
    // Archivar deja el saldo de b en 0: ya no es AccountArchivedError, sino el bloqueo de fondos del destino
    // (borrar le quitaria los 10.000 recibidos y quedaria en negativo).
    expect(available(d, b)).toBe(0);
    expect(thrown(() => d.transfers.remove(id))).toMatchObject({ code: 'INSUFFICIENT_FUNDS', accountId: b });
    d.accounts.update(b, { balanceMinor: 10_000 });
    expect(() => d.transfers.remove(id)).not.toThrow();
  });

  it('borrar o desviar una transferencia no deja el destino en negativo si ya gasto lo recibido', () => {
    const { env, d, a, b } = world();
    const c = mkAccount(d, 'Tercera', 0);
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 30_000 }).result.id;
    d.transactions.create({ type: 'EXPENSE', accountId: b, amountMinor: 45_000 }); // b: 20.000 + 30.000 - 45.000 = 5.000
    const before = snapshot(env);
    expect(thrown(() => d.transfers.remove(id))).toMatchObject({
      code: 'INSUFFICIENT_FUNDS', accountId: b, availableMinor: 5_000, requestedMinor: 30_000,
    });
    expect(thrown(() => d.transfers.update(id, { toAccountId: c }))).toMatchObject({ code: 'INSUFFICIENT_FUNDS', accountId: b });
    expect(thrown(() => d.transfers.update(id, { amountMinor: 20_000 }))).toMatchObject({ code: 'INSUFFICIENT_FUNDS', accountId: b });
    expect(snapshot(env)).toBe(before);
    d.transfers.update(id, { amountMinor: 25_000 }); // b queda en 0: se permite
    expect(available(d, b)).toBe(0);
  });
});

describe('Transferencias: borrar', () => {
  it('devuelve el dinero al origen y efectos accounts + transactions', () => {
    const { env, d, a, b } = world();
    const id = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 25_000 }).result.id;
    const res = d.transfers.remove(id);
    expect(res.effects.refresh).toEqual(['accounts', 'transactions']);
    expect(available(d, a)).toBe(100_000);
    expect(available(d, b)).toBe(20_000);
    expect(count(env, 'account_transfers')).toBe(0);
    expect(d.transfers.get(id)).toBeUndefined();
    expectIntegrity(d);
  });
});

describe('Transferencias: cuentas con transferencias', () => {
  it('cuenta con transferencias (origen o destino) cuenta como con movimientos: se archiva, no se borra', () => {
    const { d, a, b } = world();
    const spare = mkAccount(d, 'Libre', 0);
    expect(d.accounts.removalOutcome(spare)).toBe('DELETED');
    const c = mkAccount(d, 'C', 0);
    d.transfers.create({ fromAccountId: a, toAccountId: c, amountMinor: 1_000 });
    expect(d.accounts.removalOutcome(c)).toBe('ARCHIVED'); // solo destino
    const e = mkAccount(d, 'E', 0);
    d.accounts.update(e, { balanceMinor: 500 });
    const f = mkAccount(d, 'F', 0);
    d.transfers.create({ fromAccountId: e, toAccountId: f, amountMinor: 500 });
    expect(d.accounts.removalOutcome(e)).toBe('ARCHIVED'); // solo origen, queda en 0
    expect(d.accounts.remove(c).result.outcome).toBe('ARCHIVED');
    expect(available(d, c)).toBe(0); // ARCHIVE_CLOSE deja el disponible en 0
    expect(d.accounts.get(c)?.archivedAt).not.toBeNull();
    expect(b).toBeTruthy();
    expectIntegrity(d);
  });
});

describe('Actividad unificada', () => {
  it('mezcla transacciones y transferencias por fecha desc con kind, filtra por cuenta y respeta limit', () => {
    const { d, a, b } = world();
    const t1 = d.transactions.create({ type: 'EXPENSE', accountId: a, amountMinor: 100, date: localMs(2026, 3, 1) }).result.id;
    const x1 = d.transfers.create({ fromAccountId: a, toAccountId: b, amountMinor: 200, date: localMs(2026, 3, 5) }).result.id;
    const t2 = d.transactions.create({ type: 'INCOME', accountId: b, amountMinor: 300, date: localMs(2026, 3, 9) }).result.id;
    const x2 = d.transfers.create({ fromAccountId: b, toAccountId: a, amountMinor: 50, date: localMs(2026, 3, 7) }).result.id;
    const all = d.activity.list();
    expect(all.map((i) => [i.kind, i.id])).toEqual([['TRANSACTION', t2], ['TRANSFER', x2], ['TRANSFER', x1], ['TRANSACTION', t1]]);
    expect(all.every((i) => i.date === (i.kind === 'TRANSACTION' ? i.transaction.date : i.transfer.date))).toBe(true);
    expect(d.activity.list({ limit: 2 }).map((i) => i.id)).toEqual([t2, x2]);
    const ofA = d.activity.list({ accountId: a });
    expect(ofA.map((i) => i.id)).toEqual([x2, x1, t1]);
    expect(ofA.map((i) => (i.kind === 'TRANSFER' ? i.direction : null))).toEqual(['IN', 'OUT', null]);
    expect(d.activity.list().map((i) => (i.kind === 'TRANSFER' ? i.direction : 'n/a')).filter((x) => x !== 'n/a')).toEqual([null, null]);
    expect(d.activity.list({ from: localMs(2026, 3, 6), to: localMs(2026, 3, 8) }).map((i) => i.id)).toEqual([x2]);
    expect(d.transfers.list({ accountId: b }).map((x) => x.id)).toEqual([x2, x1]);
    expect(d.transfers.list().map((x) => x.id)).toEqual([x2, x1]);
    // El payload de la transaccion conserva su propio `kind` (STANDARD/DEBT_PAYMENT).
    const first = all[0];
    expect(first.kind === 'TRANSACTION' && first.transaction.kind).toBe('STANDARD');
  });
});
