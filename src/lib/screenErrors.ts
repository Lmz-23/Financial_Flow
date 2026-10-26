// Mensaje para mostrar en pantalla cuando un comando del dominio falla (sin romper la pantalla).
import { DomainError } from '../domain/services/errors';

export const MSG_UNEXPECTED_ERROR = 'No pudimos completar la acción. Inténtalo de nuevo.';

/** Errores de dominio (ValidationError, NotFoundError...) traen su texto; el resto, un mensaje generico. */
export function errorMessage(error: unknown): string {
  return error instanceof DomainError ? error.message : MSG_UNEXPECTED_ERROR;
}
