// =============================================================================
// AMORTIZATION (reglas puras de deuda)
// =============================================================================
//
// Todas las funciones son agnósticas de unidad: saldo y cuota deben venir en la
// misma unidad (en la app, unidades menores). La tasa es mensual y decimal
// (0.025 = 2,5%).
// =============================================================================

/** Tope de meses al proyectar (50 años). */
export const MAX_PROJECTION_MONTHS = 600;

const MAX_DOUBLINGS = 50;
const BISECTION_ITERATIONS = 100;

/** Valor presente de una anualidad de `meses` cuotas a tasa mensual r. */
function presentValue(cuota: number, meses: number, r: number): number {
  return r === 0 ? cuota * meses : (cuota * (1 - Math.pow(1 + r, -meses))) / r;
}

/**
 * Estima la tasa mensual que hace que `meses` cuotas iguales amorticen `saldo`.
 * Bisección con cota superior que se duplica (igual que el diseño). El valor
 * presente decrece con la tasa, así que la raíz está en (0, hi].
 * Devuelve null con entradas inválidas o si `cuota * meses <= saldo`
 * (no hay interés implícito).
 */
export function estimateMonthlyRate(saldo: number, cuota: number, meses: number): number | null {
  if (!(saldo > 0) || !(cuota > 0) || !(meses > 0)) return null;
  if (!Number.isFinite(saldo) || !Number.isFinite(cuota) || !Number.isFinite(meses)) return null;
  if (cuota * meses <= saldo) return null;

  let lo = 0;
  let hi = 1;
  let tries = 0;
  while (presentValue(cuota, meses, hi) > saldo && tries < MAX_DOUBLINGS) {
    lo = hi;
    hi *= 2;
    tries += 1;
  }
  if (presentValue(cuota, meses, hi) > saldo) return null;

  for (let i = 0; i < BISECTION_ITERATIONS; i++) {
    const mid = (lo + hi) / 2;
    if (presentValue(cuota, meses, mid) > saldo) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type PayoffProjection =
  /** Se liquida en `months` pagos (el último puede ser menor a la cuota). */
  | { status: 'PAYABLE'; months: number; totalPaid: number; totalInterest: number }
  /** La cuota no cubre el interés del primer mes: el saldo nunca baja. */
  | { status: 'NEVER' }
  /** Supera el tope de meses sin liquidarse. */
  | { status: 'CAPPED' };

/**
 * Proyección de liquidación pagando `cuota` cada mes con tasa mensual `tasa`.
 * Con saldo <= 0 devuelve PAYABLE con 0 meses.
 */
export function projectPayoff(
  saldo: number,
  cuota: number,
  tasa: number,
  maxMonths: number = MAX_PROJECTION_MONTHS,
): PayoffProjection {
  if (!Number.isFinite(saldo) || !Number.isFinite(cuota) || !Number.isFinite(tasa) || tasa < 0) {
    throw new RangeError('projectPayoff requiere números finitos y tasa >= 0');
  }
  if (saldo <= 0) return { status: 'PAYABLE', months: 0, totalPaid: 0, totalInterest: 0 };
  if (cuota <= 0) return { status: 'NEVER' };
  if (cuota <= saldo * tasa) return { status: 'NEVER' };

  // El saldo se arrastra sin redondear (el redondeo mensual acumula residuos que
  // crearían un mes extra espurio). Un residuo menor a media unidad cuenta como
  // liquidado. Los totales se redondean al final.
  const HALF_UNIT = 0.5;
  let balance = saldo;
  let totalPaid = 0;
  let totalInterest = 0;
  for (let month = 1; month <= maxMonths; month++) {
    const interest = balance * tasa;
    const owed = balance + interest;
    totalInterest += interest;
    if (owed <= cuota + HALF_UNIT) {
      totalPaid += owed;
      return {
        status: 'PAYABLE',
        months: month,
        totalPaid: Math.round(totalPaid),
        totalInterest: Math.round(totalInterest),
      };
    }
    totalPaid += cuota;
    balance = owed - cuota;
  }
  return { status: 'CAPPED' };
}

/** Meses restantes sin tasa: ceil(saldo / cuota). null si no hay cuota. */
export function monthsWithoutRate(saldo: number, cuota: number): number | null {
  if (!(cuota > 0)) return null;
  if (saldo <= 0) return 0;
  return Math.ceil(saldo / cuota);
}

export interface RemainingMonthsInput {
  saldo: number;
  cuota: number | null;
  /** Tasa mensual decimal; null/0 = se ignora el interés. */
  tasa: number | null;
  /** Total de pagos pactados (deudas con plazo conocido). */
  totalCount: number | null;
  paidCount: number;
}

/**
 * Meses restantes para la proyección de una deuda. null si no hay cuota o si
 * con la tasa dada nunca se liquida / supera el tope.
 * - Con tasa > 0 usa projectPayoff; sin tasa, ceil(saldo / cuota).
 * - Si hay totalCount, aplica max(totalCount - paidCount, base) como el diseño.
 * SUPUESTO: la regla max(...) del diseño se aplica también sobre la proyección con tasa.
 */
export function remainingMonths(input: RemainingMonthsInput): number | null {
  const { saldo, cuota, tasa, totalCount, paidCount } = input;
  if (cuota === null || !(cuota > 0)) return null;
  if (saldo <= 0) return 0;

  let base: number;
  if (tasa !== null && tasa > 0) {
    const projection = projectPayoff(saldo, cuota, tasa);
    if (projection.status !== 'PAYABLE') return null;
    base = projection.months;
  } else {
    base = Math.ceil(saldo / cuota);
  }
  return totalCount !== null && totalCount > 0 ? Math.max(totalCount - paidCount, base) : base;
}
