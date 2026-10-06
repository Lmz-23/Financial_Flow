// =============================================================================
// INFRAESTRUCTURA COMPARTIDA DE LOS SERVICIOS
// =============================================================================
// - DomainContext: BD inyectada, usuario y reloj inyectable (los tests lo fijan).
// - runOperation: UNA transaccion SINCRONA de BD por operacion; devuelve { result, effects }.
//   Los efectos (refrescos, reprogramar notificaciones) los ejecuta la capa de aplicacion
//   DESPUES del COMMIT; los servicios nunca los ejecutan.

import { accountRepository, type AccountRow } from '../../database/repositories/accountRepository';
import { settingsRepository, type WidgetKey } from '../../database/repositories/settingsRepository';
import type { AppDatabase, DbOrTx } from '../../database/types';
import { isValidLocalDate, type LocalDate } from '../dates';
import { AccountArchivedError, NotFoundError, ValidationError } from './errors';

export interface DomainContext {
  db: AppDatabase;
  userId: string;
  /** Reloj inyectable: epoch ms. */
  now: () => number;
}

/** Claves de refresco de la interfaz (§4.1). */
export type RefreshKey =
  | 'accounts'
  | 'transactions'
  | 'debts'
  | 'goals'
  | 'recurring'
  | 'settings'
  | 'statement';

export interface DomainEffects {
  /** Claves de invalidacion a refrescar tras el COMMIT (sin duplicados). */
  refresh: RefreshKey[];
  /** Ids de recurrentes cuyas notificaciones hay que reprogramar (sin duplicados). */
  reschedule: string[];
}

export interface OperationResult<T> {
  result: T;
  effects: DomainEffects;
}

export class EffectsCollector {
  private readonly keys = new Set<RefreshKey>();
  private readonly recurring = new Set<string>();

  refresh(...keys: RefreshKey[]): void {
    for (const k of keys) this.keys.add(k);
  }

  reschedule(recurringId: string): void {
    this.recurring.add(recurringId);
    this.keys.add('recurring');
  }

  build(): DomainEffects {
    return { refresh: [...this.keys], reschedule: [...this.recurring] };
  }
}

/** Corre `fn` en una transaccion de BD sincrona. El callback NO puede ser async. */
export function runOperation<T>(
  ctx: DomainContext,
  fn: (tx: DbOrTx, fx: EffectsCollector) => T,
): OperationResult<T> {
  const fx = new EffectsCollector();
  const result = ctx.db.transaction((tx) => {
    const value = fn(tx, fx);
    if (value !== null && typeof value === 'object' && typeof (value as { then?: unknown }).then === 'function') {
      throw new TypeError('Una operacion de dominio debe ser sincrona (no devolver una promesa)');
    }
    return value;
  });
  return { result, effects: fx.build() };
}

// ----------------------------------------------------------------------------
// Validaciones
// ----------------------------------------------------------------------------

export function assertPositiveMinor(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new ValidationError(`${label} debe ser un entero positivo en unidades menores`);
  }
}

export function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new ValidationError(`${label} debe ser un entero en unidades menores`);
  }
}

export function assertNonNegativeMinor(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ValidationError(`${label} no puede ser negativo`);
  }
}

export function cleanName(value: string, label: string): string {
  const name = value.trim();
  if (name === '') throw new ValidationError(`${label} no puede estar vacio`);
  return name;
}

/** Primer anio aceptado: `new Date(y, ...)` interpreta 0-99 como 1900-1999 y guardaria otra fecha. */
export const MIN_LOCAL_DATE_YEAR = 100;

/**
 * Valida 'YYYY-MM-DD' (formato y dia existente). Rechaza anios < 100 (0000-0099): al convertir a epoch
 * ms con el constructor local de Date se guardarian silenciosamente como 1900-1999.
 */
export function assertLocalDate(value: string, label: string): LocalDate {
  if (!isValidLocalDate(value)) throw new ValidationError(`${label} no es una fecha 'YYYY-MM-DD' valida`);
  if (Number(value.slice(0, 4)) < MIN_LOCAL_DATE_YEAR) {
    throw new ValidationError(`${label} no es una fecha valida: el anio debe ser 0100 o posterior`);
  }
  return value;
}

/** Rango maximo de un `Date` de JavaScript (ECMAScript): +-8.64e15 ms. */
export const MAX_EPOCH_MS = 8.64e15;

/** Un instante epoch ms valido: entero seguro dentro del rango de `Date`. */
export function assertEpochMs(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_EPOCH_MS) {
    throw new ValidationError(`${label} no es un instante valido`);
  }
}

// ----------------------------------------------------------------------------
// Helpers internos entre servicios (dentro de una transaccion ya abierta)
// ----------------------------------------------------------------------------

/** La cuenta debe existir y no estar archivada. */
export function requireActiveAccount(db: DbOrTx, id: string): AccountRow {
  const account = accountRepository.getById(db, id);
  if (!account) throw new NotFoundError('Cuenta', id);
  if (account.archivedAt !== null) throw new AccountArchivedError(id);
  return account;
}

/**
 * `autoActivate(tx, w)` = `UPDATE ... SET w = 1 WHERE w IS NULL` (I6, D10).
 * Devuelve true si cambio el flag (el llamador marca el efecto `settings`).
 */
export function autoActivateWidget(db: DbOrTx, ctx: DomainContext, widget: WidgetKey): boolean {
  if (settingsRepository.getWidget(db, ctx.userId, widget) !== null) return false;
  settingsRepository.autoActivateWidget(db, ctx.userId, widget, ctx.now());
  return true;
}
