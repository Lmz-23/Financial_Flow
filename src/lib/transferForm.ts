// Validacion y disponible del formulario de transferencia, puros para probarlos en vitest.
import { formatCOP } from '../domain/money';

export const MSG_TRANSFER_AMOUNT = 'Escribe el monto.';
export const MSG_TRANSFER_FROM = 'Elige la cuenta de origen.';
export const MSG_TRANSFER_TO = 'Elige la cuenta de destino.';
export const MSG_TRANSFER_SAME = 'El origen y el destino deben ser distintos.';
export const MSG_TRANSFER_NOT_FOUND = 'No encontramos esta transferencia.';

/** Primer problema del formulario, o null si se puede enviar (los fondos los valida el dominio). */
export function validateTransferForm(v: {
  amountMinor: number | null;
  fromAccountId: string | null;
  toAccountId: string | null;
}): string | null {
  if (v.amountMinor === null || v.amountMinor <= 0) return MSG_TRANSFER_AMOUNT;
  if (!v.fromAccountId) return MSG_TRANSFER_FROM;
  if (!v.toAccountId) return MSG_TRANSFER_TO;
  if (v.fromAccountId === v.toAccountId) return MSG_TRANSFER_SAME;
  return null;
}

/** «Hacia» no ofrece la cuenta elegida en «Desde». */
export function destinationOptions<T extends { id: string }>(accounts: readonly T[], fromAccountId: string | null): T[] {
  return accounts.filter((a) => a.id !== fromAccountId);
}

/**
 * Disponible del origen para mostrar, igual que valida el dominio al editar: sin la transferencia original,
 * el origen original recupera su monto y el destino original lo pierde.
 */
export function fromAvailable(
  availableMinor: number,
  accountId: string,
  original?: { fromAccountId: string; toAccountId: string; amountMinor: number },
): number {
  if (!original) return availableMinor;
  if (original.fromAccountId === accountId) return availableMinor + original.amountMinor;
  if (original.toAccountId === accountId) return availableMinor - original.amountMinor;
  return availableMinor;
}

/** Mensaje de fondos insuficientes que nombra la cuenta cuando no es la de origen elegida (p. ej. el destino original). */
export function insufficientFundsMessage(
  error: { accountId: string; availableMinor: number },
  fromAccountId: string | null,
  accountName: string | undefined,
  formatMinor: (minor: number) => string,
): string | null {
  if (error.accountId === fromAccountId || !accountName) return null;
  return `${accountName} ya usó ese dinero y quedaría en negativo. Disponible: ${formatMinor(error.availableMinor)}.`;
}

export function availableLabel(availableMinor: number): string {
  return `Disponible: ${formatCOP(availableMinor)}`;
}
