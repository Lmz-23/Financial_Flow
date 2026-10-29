import { describe, expect, it, vi } from 'vitest';

import { invalidateAfterCommit, needsReconcile, runEffects } from '../../../src/app-services/effects';
import type { DomainEffects } from '../../../src/domain/services/shared';

function deps(reconcile: () => Promise<void> = () => Promise.resolve()) {
  return { invalidate: vi.fn(), reconcile: vi.fn(reconcile) };
}

describe('runEffects', () => {
  it('invalida exactamente las claves del efecto', () => {
    const d = deps();
    runEffects({ refresh: ['accounts', 'statement'], reschedule: [] }, d);
    expect(d.invalidate).toHaveBeenCalledTimes(1);
    expect(d.invalidate).toHaveBeenCalledWith(['accounts', 'statement']);
  });

  it('no invalida ni reconcilia si no hay efectos', () => {
    const d = deps();
    runEffects({ refresh: [], reschedule: [] }, d);
    expect(d.invalidate).not.toHaveBeenCalled();
    expect(d.reconcile).not.toHaveBeenCalled();
  });

  it.each<[string, DomainEffects, boolean]>([
    ['solo cuentas', { refresh: ['accounts', 'transactions', 'statement'], reschedule: [] }, false],
    ['metas', { refresh: ['goals'], reschedule: [] }, false],
    ['recurrentes', { refresh: ['recurring'], reschedule: [] }, true],
    ['deudas', { refresh: ['debts'], reschedule: [] }, true],
    ['ajustes', { refresh: ['settings'], reschedule: [] }, true],
    ['ids a reprogramar', { refresh: [], reschedule: ['r1'] }, true],
  ])('reconciliar notificaciones: %s -> %s', (_name, effects, expected) => {
    expect(needsReconcile(effects)).toBe(expected);
    const d = deps();
    runEffects(effects, d);
    expect(d.reconcile).toHaveBeenCalledTimes(expected ? 1 : 0);
  });

  it('un fallo de reconcile no se propaga ni rompe el comando', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const d = deps(() => Promise.reject(new Error('sin permisos')));
    expect(() => runEffects({ refresh: ['recurring'], reschedule: [] }, d)).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('un fallo de invalidate no rompe el comando y aun reconcilia', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const d = deps();
    d.invalidate.mockImplementation(() => {
      throw new Error('sin usuario');
    });
    expect(() => runEffects({ refresh: ['settings'], reschedule: [] }, d)).not.toThrow();
    expect(d.invalidate).toHaveBeenCalledTimes(1);
    expect(d.reconcile).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('invalidateAfterCommit: si refreshSettings lanza, igual invalida las claves y no propaga', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const invalidate = vi.fn();
    const refreshSettings = vi.fn(() => {
      throw new Error('NotFoundError');
    });
    expect(() => invalidateAfterCommit(['settings', 'accounts'], refreshSettings, invalidate)).not.toThrow();
    expect(invalidate).toHaveBeenCalledWith(['settings', 'accounts']);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('invalidateAfterCommit: recarga ajustes antes de invalidar y solo con la clave settings', () => {
    const order: string[] = [];
    invalidateAfterCommit(['settings'], () => order.push('refresh'), () => order.push('invalidate'));
    expect(order).toEqual(['refresh', 'invalidate']);
    const refreshSettings = vi.fn();
    invalidateAfterCommit(['accounts'], refreshSettings, vi.fn());
    expect(refreshSettings).not.toHaveBeenCalled();
  });
});
