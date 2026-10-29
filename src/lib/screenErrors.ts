// Mensaje para mostrar en pantalla cuando un comando del dominio falla (sin romper la pantalla).
import { formatCOP } from '../domain/money';
import { AccountArchivedError, DomainError, InsufficientFundsError, TransactionNotEditableError } from '../domain/services/errors';

export const MSG_UNEXPECTED_ERROR = 'No pudimos completar la acción. Inténtalo de nuevo.';

export const MSG_DEBT_PAYMENT_NOT_EDITABLE = 'Este pago de deuda no se puede editar. Bórralo y regístralo de nuevo.';
export const MSG_RECURRING_DATE_LOCKED = 'La fecha de un pago recurrente no se puede cambiar.';
export const MSG_ACCOUNT_ARCHIVED = 'Una de las cuentas está archivada. Desarchívala para continuar.';

/** Errores de dominio (ValidationError, NotFoundError...) traen su texto; el resto, un mensaje generico. */
export function errorMessage(error: unknown): string {
  if (error instanceof InsufficientFundsError) {
    return `Saldo insuficiente. Disponible: ${formatCOP(error.availableMinor)}.`;
  }
  if (error instanceof TransactionNotEditableError) {
    return error.reason === 'DEBT_PAYMENT' ? MSG_DEBT_PAYMENT_NOT_EDITABLE : MSG_RECURRING_DATE_LOCKED;
  }
  if (error instanceof AccountArchivedError) return MSG_ACCOUNT_ARCHIVED;
  return error instanceof DomainError ? error.message : MSG_UNEXPECTED_ERROR;
}
