// =============================================================================
// STATEMENT (reporte del mes, Índice de Flujo de Caja, saldos de deuda)
// =============================================================================
//
// Fórmulas de la arquitectura §3.1-3.2. Montos en unidades menores.
//   gastoTotal = gastoVida + gastoDeuda + gastoMetas   (grupos que no se solapan)
//   netCashflow = ingresoTotal - gastoTotal
// =============================================================================

import { addMinor, assertMinor, type Minor } from '../money';

/** Agregados del mes calendario, ya calculados por la capa de datos. */
export interface MonthAggregates {
  ingresoTotal: Minor;
  ingresoPasivo: Minor;
  gastoVida: Minor;
  gastoDeuda: Minor;
  gastoMetas: Minor;
}

/**
 * Resultado del Índice de Flujo de Caja.
 * - RATIO: ingresoPasivo / gastoTotal (ratio 1 = 100%).
 * - NO_EXPENSES: no hubo gasto pero sí ingreso pasivo ("sin gastos").
 * - NONE: no hay gasto ni ingreso pasivo (null en la arquitectura).
 */
export type CashflowIndex =
  | { kind: 'RATIO'; ratio: number }
  | { kind: 'NO_EXPENSES' }
  | { kind: 'NONE' };

export interface MonthStatement {
  ingresoTotal: Minor;
  ingresoPasivo: Minor;
  ingresoActivo: Minor;
  gastoVida: Minor;
  gastoDeuda: Minor;
  gastoMetas: Minor;
  gastoTotal: Minor;
  netCashflow: Minor;
  index: CashflowIndex;
}

export function computeCashflowIndex(ingresoPasivo: Minor, gastoTotal: Minor): CashflowIndex {
  if (gastoTotal > 0) return { kind: 'RATIO', ratio: ingresoPasivo / gastoTotal };
  return ingresoPasivo > 0 ? { kind: 'NO_EXPENSES' } : { kind: 'NONE' };
}

export function computeMonthStatement(agg: MonthAggregates): MonthStatement {
  const gastoTotal = addMinor(agg.gastoVida, agg.gastoDeuda, agg.gastoMetas);
  assertMinor(agg.ingresoTotal, 'ingresoTotal');
  assertMinor(agg.ingresoPasivo, 'ingresoPasivo');
  return {
    ingresoTotal: agg.ingresoTotal,
    ingresoPasivo: agg.ingresoPasivo,
    ingresoActivo: agg.ingresoTotal - agg.ingresoPasivo,
    gastoVida: agg.gastoVida,
    gastoDeuda: agg.gastoDeuda,
    gastoMetas: agg.gastoMetas,
    gastoTotal,
    netCashflow: agg.ingresoTotal - gastoTotal,
    index: computeCashflowIndex(agg.ingresoPasivo, gastoTotal),
  };
}

/** Porcentaje entero redondeado como el diseño: Math.round(ratio * 100). */
export function cashflowPercent(index: CashflowIndex): number {
  return index.kind === 'RATIO' ? Math.round(index.ratio * 100) : 0;
}

/** Texto del Índice: "42%", "Sin gastos" o "—" cuando no hay datos. */
export function formatCashflowIndex(index: CashflowIndex): string {
  switch (index.kind) {
    case 'RATIO':
      return `${cashflowPercent(index)}%`;
    case 'NO_EXPENSES':
      return 'Sin gastos';
    case 'NONE':
      return '—';
  }
}

/**
 * Libertad financiera: índice >= 100%. Decisión del usuario (2026-10-07): NO_EXPENSES
 * (ingreso pasivo sin gastos) también cuenta, porque el pasivo cubre el 100% de un gasto de 0.
 */
export function isFinancialFreedom(index: CashflowIndex): boolean {
  return index.kind === 'NO_EXPENSES' || (index.kind === 'RATIO' && index.ratio >= 1);
}

/**
 * Mensaje bajo el Índice (textos del diseño, Dashboard.dc.html ~1373).
 * Los textos de libertad financiera y de "sin gastos" son decisión del usuario
 * (2026-10-07); el texto previo al 100% viene del diseño. El texto de libertad
 * financiera lleva "100%" LITERAL (no el porcentaje real), tal como lo confirmó.
 */
export function describeCashflowIndex(index: CashflowIndex): string {
  if (index.kind === 'NO_EXPENSES') {
    return 'No tienes gastos registrados este mes, así que tu ingreso pasivo ya los cubre por completo.';
  }
  if (index.kind === 'NONE' || cashflowPercent(index) === 0) {
    return 'Aún no tienes ingreso pasivo registrado. En cuanto marques uno, este número empieza a moverse.';
  }
  const pct = cashflowPercent(index);
  return isFinancialFreedom(index)
    ? 'Tu ingreso pasivo cubre el 100% de tus gastos — esto es libertad financiera en el método Cashflow.'
    : `Tu ingreso pasivo cubre el ${pct}% de tus gastos del mes. Cuando llegue a 100%, eso es libertad financiera en el método Cashflow.`;
}

// -----------------------------------------------------------------------------
// Deudas (§3.1, §3.4)
// -----------------------------------------------------------------------------

/** Capital aplicado de un pago: min(monto, saldo), con saldo acotado a >= 0. */
export function principalApplied(amount: Minor, balance: Minor): Minor {
  assertMinor(amount, 'monto del pago');
  assertMinor(balance, 'saldo');
  if (amount <= 0) throw new RangeError('El monto del pago debe ser > 0');
  return Math.min(amount, Math.max(balance, 0));
}

export interface DebtPaymentEffect {
  /** Capital aplicado = min(monto, saldo). */
  principalApplied: Minor;
  /** Gasto de deuda del mes: SIEMPRE el monto completo. */
  expense: Minor;
  /** Parte del pago que excede el saldo (no reduce deuda, sí cuenta como gasto). */
  overpayment: Minor;
  /** Saldo derivado tras el pago (>= 0). */
  newBalance: Minor;
}

/** Efecto de registrar un pago de deuda sobre el saldo actual. */
export function debtPaymentEffect(amount: Minor, balance: Minor): DebtPaymentEffect {
  const applied = principalApplied(amount, balance);
  return {
    principalApplied: applied,
    expense: amount,
    overpayment: amount - applied,
    newBalance: Math.max(balance, 0) - applied,
  };
}

/** Saldo derivado de una deuda: Σ ajustes (delta) - Σ capital aplicado. */
export function debtBalance(adjustmentsDelta: Minor, principalAppliedTotal: Minor): Minor {
  assertMinor(adjustmentsDelta, 'ajustes');
  assertMinor(principalAppliedTotal, 'capital aplicado');
  return adjustmentsDelta - principalAppliedTotal;
}

/** Pagos hechos de una deuda: pagos iniciales + cuotas (INSTALLMENT) registradas. */
export function paidCount(initialPaidCount: number, installmentPayments: number): number {
  return initialPaidCount + installmentPayments;
}

export interface NetWorthInput {
  /** Disponible de cada cuenta no archivada. */
  accountAvailable: Minor[];
  /** Ahorro (saved) de cada meta activa. */
  goalsSaved: Minor[];
  /** Saldo de cada deuda no archivada. */
  debtBalances: Minor[];
}

/** Patrimonio neto = Σ disponible + Σ saved de metas activas - Σ saldo de deudas. */
export function netWorth(input: NetWorthInput): Minor {
  return (
    addMinor(...input.accountAvailable) +
    addMinor(...input.goalsSaved) -
    addMinor(...input.debtBalances)
  );
}
