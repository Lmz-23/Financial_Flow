import { describe, expect, it, vi } from 'vitest';

import { createCommands } from '../../../src/app-services/commands';
import { AccountArchivedError } from '../../../src/domain/services/errors';
import type { DomainEffects } from '../../../src/domain/services/shared';
import { setup } from '../domain/_helpers';

function makeCommands() {
  const env = setup();
  const applied: DomainEffects[] = [];
  const commands = createCommands(
    () => env.d,
    (effects) => applied.push(effects),
  );
  return { env, commands, applied };
}

describe('commands (app-services) sobre SQLite real', () => {
  it('ejecuta los efectos UNA vez, despues del COMMIT, y devuelve solo el resultado', () => {
    const { env, commands, applied } = makeCommands();
    let committedWhenApplied: number | null = null;
    const spy = createCommands(
      () => env.d,
      () => {
        // Cuando se ejecutan los efectos la fila ya esta confirmada en la BD.
        committedWhenApplied = (env.sqlite.prepare('select count(*) as n from accounts').get() as { n: number }).n;
      },
    );
    const { id } = spy.accounts.create({ name: 'Efectivo', type: 'CASH', openingMinor: 10_000 });
    expect(id).toBeTruthy();
    expect(committedWhenApplied).toBe(1);

    commands.accounts.create({ name: 'Ahorros', type: 'SAVINGS', openingMinor: 0 });
    expect(applied).toEqual([{ refresh: ['accounts'], reschedule: [] }]);
  });

  it('si la operacion lanza, no se ejecutan efectos y el error tipado llega intacto', () => {
    const { env, commands, applied } = makeCommands();
    const id = env.d.accounts.create({ name: 'Vieja', type: 'CASH', openingMinor: 5_000 }).result.id;
    // Con movimientos se archiva (no se borra).
    env.d.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 1_000 });
    env.d.accounts.remove(id);
    applied.length = 0;

    expect(() =>
      commands.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 500 }),
    ).toThrow(AccountArchivedError);
    expect(applied).toEqual([]);

    // Contrato F5: desarchivar con el id del error y reintentar.
    let archivedId = '';
    try {
      commands.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 500 });
    } catch (error) {
      if (error instanceof AccountArchivedError) archivedId = error.accountId;
    }
    expect(archivedId).toBe(id);
    commands.accounts.unarchive(archivedId);
    commands.transactions.create({ type: 'EXPENSE', accountId: id, amountMinor: 500 });
    expect(applied.map((e) => e.refresh)).toEqual([
      ['accounts', 'goals'],
      ['accounts', 'transactions', 'statement'],
    ]);
  });

  it('un recurrente pide reprogramar notificaciones (reschedule) y refrescar recurring', () => {
    const { commands, applied } = makeCommands();
    const { id } = commands.recurring.create({
      type: 'EXPENSE',
      name: 'Arriendo',
      amountMinor: 45_000_000,
      frequency: 'MONTHLY',
      anchorDate: '2026-03-15',
    });
    expect(applied).toHaveLength(1);
    expect(applied[0].reschedule).toEqual([id]);
    expect(applied[0].refresh).toContain('recurring');
  });

  it('settings.setWidget refresca settings (la cache de ajustes se recarga con ese efecto)', () => {
    const { env, commands, applied } = makeCommands();
    commands.settings.setWidget('goals', true);
    expect(applied[0].refresh).toEqual(['settings']);
    expect(env.d.settings.get().widgetGoals).toBe(1);
  });

  it('autoActivate sin cambio no refresca nada', () => {
    const { commands, applied } = makeCommands();
    commands.settings.setWidget('debts', false);
    applied.length = 0;
    const { activated } = commands.settings.autoActivate('debts');
    expect(activated).toBe(false);
    expect(applied).toEqual([{ refresh: [], reschedule: [] }]);
  });

  it('el aplicador de efectos recibe efectos de una operacion en cadena (metas: eliminar con destino)', () => {
    const { env, commands } = makeCommands();
    const spy = vi.fn();
    const withSpy = createCommands(() => env.d, spy);
    const acc = commands.accounts.create({ name: 'A', type: 'CASH', openingMinor: 100_000 }).id;
    const goal = withSpy.goals.create({ name: 'Viaje', targetMinor: 50_000, initialMinor: 20_000, accountId: acc });
    expect(spy).toHaveBeenCalledTimes(1);
    withSpy.goals.remove(goal.id);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
