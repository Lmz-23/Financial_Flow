// =============================================================================
// ERRORES DE DOMINIO TIPADOS
// =============================================================================
// La UI distingue por `code` (o con `instanceof`). Todos extienden DomainError.

export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'ACCOUNT_ARCHIVED'
  | 'ACCOUNT_REQUIRED'
  | 'INSUFFICIENT_FUNDS'
  | 'DEBT_SETTLED'
  | 'DEBT_ARCHIVED'
  | 'GOAL_NOT_ACTIVE'
  | 'GOAL_NOT_REACHED'
  | 'OCCURRENCE_ALREADY_CONFIRMED'
  | 'OCCURRENCE_NOT_IN_SERIES'
  | 'RECURRING_WITHOUT_DATE'
  | 'RECURRING_PAUSED'
  | 'REFUND_ACCOUNT_REQUIRED'
  | 'USE_DEBT_PAYMENT_FLOW'
  | 'ONBOARDING_ALREADY_COMPLETED'
  | 'NOT_SUPPORTED';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** Entrada invalida (monto no positivo, nombre vacio, fecha invalida, combinacion no permitida). */
export class ValidationError extends DomainError {
  constructor(message: string) {
    super('VALIDATION', message);
  }
}

export class NotFoundError extends DomainError {
  readonly entity: string;
  readonly entityId: string;
  constructor(entity: string, entityId: string) {
    super('NOT_FOUND', `${entity} no encontrado: ${entityId}`);
    this.entity = entity;
    this.entityId = entityId;
  }
}

/**
 * Operacion que cambiaria el disponible de una cuenta archivada. La UI puede ofrecer "Desarchivar"
 * con `AccountService.unarchive(error.accountId)` y reintentar.
 */
export class AccountArchivedError extends DomainError {
  readonly accountId: string;
  constructor(accountId: string) {
    super('ACCOUNT_ARCHIVED', 'La cuenta está archivada. Desarchívala para modificar su saldo.');
    this.accountId = accountId;
  }
}

/** `confirmOccurrence` sin cuenta: la hoja "Ya pago" siempre pide cuenta (D8). */
export class AccountRequiredError extends DomainError {
  constructor() {
    super('ACCOUNT_REQUIRED', 'Hay que elegir una cuenta para confirmar la ocurrencia');
  }
}

/** Aporte a meta mayor al disponible de la cuenta (D12). */
export class InsufficientFundsError extends DomainError {
  readonly accountId: string;
  readonly availableMinor: number;
  readonly requestedMinor: number;
  constructor(accountId: string, availableMinor: number, requestedMinor: number) {
    super('INSUFFICIENT_FUNDS', 'Saldo insuficiente en la cuenta');
    this.accountId = accountId;
    this.availableMinor = availableMinor;
    this.requestedMinor = requestedMinor;
  }
}

/** Pago a una deuda con saldo 0 (D13). */
export class DebtSettledError extends DomainError {
  readonly debtId: string;
  constructor(debtId: string) {
    super('DEBT_SETTLED', 'Deuda liquidada');
    this.debtId = debtId;
  }
}

export class DebtArchivedError extends DomainError {
  readonly debtId: string;
  constructor(debtId: string) {
    super('DEBT_ARCHIVED', 'La deuda esta archivada');
    this.debtId = debtId;
  }
}

/** Operacion sobre una meta ya cerrada (SPENT): aportes, ajustes, segundo cierre, borrado. */
export class GoalNotActiveError extends DomainError {
  readonly goalId: string;
  constructor(goalId: string, message = 'La meta ya esta cerrada') {
    super('GOAL_NOT_ACTIVE', message);
    this.goalId = goalId;
  }
}

/** Cerrar una meta exige saved >= objetivo (D11). */
export class GoalNotReachedError extends DomainError {
  readonly savedMinor: number;
  readonly targetMinor: number;
  constructor(savedMinor: number, targetMinor: number) {
    super('GOAL_NOT_REACHED', 'La meta aun no alcanza su objetivo');
    this.savedMinor = savedMinor;
    this.targetMinor = targetMinor;
  }
}

export class OccurrenceAlreadyConfirmedError extends DomainError {
  readonly recurringId: string;
  readonly occurrenceDate: string;
  constructor(recurringId: string, occurrenceDate: string) {
    super('OCCURRENCE_ALREADY_CONFIRMED', 'La ocurrencia ya esta confirmada');
    this.recurringId = recurringId;
    this.occurrenceDate = occurrenceDate;
  }
}

/** La fecha indicada no es una ocurrencia de la serie del recurrente (ancla + frecuencia). */
export class OccurrenceNotInSeriesError extends DomainError {
  readonly recurringId: string;
  readonly occurrenceDate: string;
  constructor(recurringId: string, occurrenceDate: string) {
    super('OCCURRENCE_NOT_IN_SERIES', 'La fecha no pertenece a la serie del recurrente');
    this.recurringId = recurringId;
    this.occurrenceDate = occurrenceDate;
  }
}

/** Un recurrente sin fecha (ancla NULL) no se puede confirmar: primero hay que fijar la fecha. */
export class RecurringWithoutDateError extends DomainError {
  readonly recurringId: string;
  constructor(recurringId: string) {
    super('RECURRING_WITHOUT_DATE', 'El recurrente no tiene fecha: fija la fecha antes de confirmar');
    this.recurringId = recurringId;
  }
}

/** Confirmar una ocurrencia de un recurrente pausado. */
export class RecurringPausedError extends DomainError {
  readonly recurringId: string;
  constructor(recurringId: string) {
    super('RECURRING_PAUSED', 'El recurrente esta pausado');
    this.recurringId = recurringId;
  }
}

/** Origen archivado de aportes de una meta, con el total que hay que redirigir. */
export interface ArchivedRefundSource {
  accountId: string;
  accountName: string;
  amountMinor: number;
}

/**
 * Eliminar una meta con aportes de cuentas ARCHIVADAS exige elegir una cuenta ACTIVA de destino.
 * `invalidAccountId` es la cuenta indicada que no sirvio (inexistente, archivada o ajena), o null si
 * simplemente no se indico ninguna.
 */
export class RefundAccountRequiredError extends DomainError {
  readonly goalId: string;
  /** Total que se redirige al destino (suma de las cuentas archivadas de origen). */
  readonly totalMinor: number;
  readonly byAccount: ArchivedRefundSource[];
  readonly invalidAccountId: string | null;
  constructor(goalId: string, totalMinor: number, byAccount: ArchivedRefundSource[], invalidAccountId: string | null) {
    super('REFUND_ACCOUNT_REQUIRED', 'Hay que elegir una cuenta activa para recibir el dinero de las cuentas archivadas');
    this.goalId = goalId;
    this.totalMinor = totalMinor;
    this.byAccount = byAccount;
    this.invalidAccountId = invalidAccountId;
  }
}

/**
 * Confirmar por el camino generico un recurrente que es la cuota de una deuda (I4).
 * La UI redirige a "Registrar pago de deuda" (`DebtService.registerPayment`).
 */
export class UseDebtPaymentFlow extends DomainError {
  readonly debtId: string;
  readonly recurringId: string;
  readonly occurrenceDate: string;
  constructor(debtId: string, recurringId: string, occurrenceDate: string) {
    super('USE_DEBT_PAYMENT_FLOW', 'La cuota de una deuda se paga con el flujo de pago de deuda');
    this.debtId = debtId;
    this.recurringId = recurringId;
    this.occurrenceDate = occurrenceDate;
  }
}

export class OnboardingAlreadyCompletedError extends DomainError {
  constructor() {
    super('ONBOARDING_ALREADY_COMPLETED', 'El onboarding ya se completo');
  }
}

/** Operacion fuera del alcance del servicio (p. ej. editar una cuota de deuda como recurrente generico). */
export class NotSupportedError extends DomainError {
  constructor(message: string) {
    super('NOT_SUPPORTED', message);
  }
}
