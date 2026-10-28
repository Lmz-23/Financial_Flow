// =============================================================================
// TRANSFERENCIAS ENTRE CUENTAS (decision 2026-10-27, revierte D9)
// =============================================================================
// Mueve dinero entre dos cuentas activas del usuario. NO es ingreso ni gasto (no es una Transaction):
// no entra al reporte del mes ni al Indice, y la suma global de disponibles no cambia (I1 se conserva).
// Disponible de una cuenta = formula de §3.1 − Σ transferencias salientes + Σ entrantes.
import { accountRepository } from '../../database/repositories/accountRepository';
import {
  accountTransferRepository,
  type AccountTransferFilters,
  type AccountTransferRow,
  type AccountTransferView,
} from '../../database/repositories/accountTransferRepository';
import type { DbOrTx } from '../../database/types';
import { AccountArchivedError, InsufficientFundsError, NotFoundError, ValidationError } from './errors';
import {
  assertEpochMs,
  assertPositiveMinor,
  requireActiveAccount,
  runOperation,
  type DomainContext,
  type OperationResult,
} from './shared';

export interface CreateTransferInput {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  /** Epoch ms; por defecto el reloj del dominio. */
  date?: number;
  note?: string;
}

/** Lo omitido se conserva. `note: ''` (o solo espacios) borra la nota. */
export interface UpdateTransferInput {
  fromAccountId?: string;
  toAccountId?: string;
  amountMinor?: number;
  date?: number;
  note?: string;
}

function cleanNote(note: string | undefined): string | null {
  const trimmed = note?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

export function createTransferService(ctx: DomainContext) {
  /** Lo que `accountId` tendria disponible si la transferencia `old` no existiera (sin `old`: su disponible actual). */
  function availableWithout(tx: DbOrTx, accountId: string, old: AccountTransferRow | undefined): number {
    let available = accountRepository.availableOf(tx, ctx.userId, accountId);
    if (old) {
      if (old.fromAccountId === accountId) available += old.amountMinor;
      if (old.toAccountId === accountId) available -= old.amountMinor;
    }
    return available;
  }

  /**
   * Bloqueo de fondos (decision del 2026-10-27): ninguna cuenta implicada puede quedar con disponible negativo
   * por el cambio. Se compara contra el disponible actual para no bloquear un cambio que no empeora una cuenta
   * que ya estaba en negativo por otros motivos.
   */
  function assertNoNegative(
    tx: DbOrTx,
    old: AccountTransferRow,
    next: { fromAccountId: string; toAccountId: string; amountMinor: number } | null,
  ): void {
    const affected = new Set([old.fromAccountId, old.toAccountId, ...(next ? [next.fromAccountId, next.toAccountId] : [])]);
    for (const accountId of affected) {
      const current = accountRepository.availableOf(tx, ctx.userId, accountId);
      let after = availableWithout(tx, accountId, old);
      if (next?.fromAccountId === accountId) after -= next.amountMinor;
      if (next?.toAccountId === accountId) after += next.amountMinor;
      if (after >= 0 || after >= current) continue;
      // Origen: disponible sin esta transferencia frente al monto pedido; destino que pierde lo recibido: su
      // disponible actual frente a lo que se le quitaria.
      if (next?.fromAccountId === accountId) {
        throw new InsufficientFundsError(accountId, availableWithout(tx, accountId, old), next.amountMinor);
      }
      throw new InsufficientFundsError(accountId, current, current - after);
    }
  }

  return {
    /**
     * Errores: `ValidationError` (monto/fecha invalidos, origen = destino), `NotFoundError` (cuenta inexistente
     * o ajena), `AccountArchivedError` (origen o destino archivado), `InsufficientFundsError` (el monto supera
     * el disponible del origen). Efectos: `accounts` y `transactions`.
     */
    create(input: CreateTransferInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        assertPositiveMinor(input.amountMinor, 'El monto');
        const date = input.date ?? ctx.now();
        assertEpochMs(date, 'La fecha');
        if (input.fromAccountId === input.toAccountId) {
          throw new ValidationError('La cuenta de origen y la de destino deben ser distintas');
        }
        requireActiveAccount(tx, ctx.userId, input.fromAccountId);
        requireActiveAccount(tx, ctx.userId, input.toAccountId);
        const available = accountRepository.availableOf(tx, ctx.userId, input.fromAccountId);
        if (input.amountMinor > available) {
          throw new InsufficientFundsError(input.fromAccountId, available, input.amountMinor);
        }
        const id = accountTransferRepository.insert(tx, {
          userId: ctx.userId,
          fromAccountId: input.fromAccountId,
          toAccountId: input.toAccountId,
          amountMinor: input.amountMinor,
          date,
          note: cleanNote(input.note),
          now: ctx.now(),
        });
        fx.refresh('accounts', 'transactions');
        return { id };
      });
    },

    /**
     * Mismas validaciones que `create`, y ademas la transferencia original no puede tener una cuenta archivada
     * (`AccountArchivedError`). El chequeo de fondos considera el monto original devuelto y solo corre si
     * cambia el origen o sube el monto (editar nota, fecha o destino no se bloquea por un origen que quedo corto).
     */
    update(id: string, input: UpdateTransferInput): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        const old = accountTransferRepository.getById(tx, ctx.userId, id);
        if (!old) throw new NotFoundError('Transferencia', id);
        const fromAccountId = input.fromAccountId ?? old.fromAccountId;
        const toAccountId = input.toAccountId ?? old.toAccountId;
        const amountMinor = input.amountMinor ?? old.amountMinor;
        const date = input.date ?? old.date;
        assertPositiveMinor(amountMinor, 'El monto');
        assertEpochMs(date, 'La fecha');
        if (fromAccountId === toAccountId) {
          throw new ValidationError('La cuenta de origen y la de destino deben ser distintas');
        }
        for (const accountId of [old.fromAccountId, old.toAccountId]) {
          const current = accountRepository.getById(tx, ctx.userId, accountId);
          if (current && current.archivedAt !== null) throw new AccountArchivedError(accountId);
        }
        requireActiveAccount(tx, ctx.userId, fromAccountId);
        requireActiveAccount(tx, ctx.userId, toAccountId);
        assertNoNegative(tx, old, { fromAccountId, toAccountId, amountMinor });
        accountTransferRepository.update(tx, ctx.userId, id, {
          fromAccountId,
          toAccountId,
          amountMinor,
          date,
          note: input.note === undefined ? old.note : cleanNote(input.note),
          now: ctx.now(),
        });
        fx.refresh('accounts', 'transactions');
        return { id };
      });
    },

    /**
     * Borra la transferencia (el dinero vuelve al origen). Con una cuenta implicada archivada lanza
     * `AccountArchivedError`. Si el destino ya gasto lo recibido y quedaria en negativo, `InsufficientFundsError`.
     */
    remove(id: string): OperationResult<{ id: string }> {
      return runOperation(ctx, (tx, fx) => {
        const row = accountTransferRepository.getById(tx, ctx.userId, id);
        if (!row) throw new NotFoundError('Transferencia', id);
        for (const accountId of [row.fromAccountId, row.toAccountId]) {
          const account = accountRepository.getById(tx, ctx.userId, accountId);
          if (account && account.archivedAt !== null) throw new AccountArchivedError(accountId);
        }
        assertNoNegative(tx, row, null);
        accountTransferRepository.delete(tx, ctx.userId, id);
        fx.refresh('accounts', 'transactions');
        return { id };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    get(id: string): AccountTransferView | undefined {
      return accountTransferRepository.getViewById(ctx.db, ctx.userId, id);
    },

    /** De la mas reciente a la mas antigua. `accountId` = origen O destino. */
    list(filters: AccountTransferFilters = {}): AccountTransferView[] {
      return accountTransferRepository.list(ctx.db, ctx.userId, filters);
    },
  };
}

export type TransferService = ReturnType<typeof createTransferService>;
