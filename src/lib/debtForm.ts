// Validacion y armado del formulario «Agregar deuda», puros (sin react-native) para vitest.
// Calculadora de tasa en vivo: Design/Dashboard.dc.html (~L1209-1242), con la misma biseccion que
// usa el dominio al guardar (`estimateMonthlyRate`).
import type { LocalDate } from '../domain/dates';
import { parseRatePercent, type Minor } from '../domain/money';
import { estimateMonthlyRate } from '../domain/rules/amortization';
import type { CreateDebtInput } from '../domain/services/DebtService';

export interface NewDebtForm {
  name: string;
  balance: Minor | null;
  /** true = «Conozco la tasa»; false = «No sé la tasa». */
  knowsRate: boolean;
  /** Tasa mensual en porcentaje, como la escribe el usuario («2,3»). */
  rateText: string;
  installment: Minor | null;
  /** «Meses que te faltan», solo digitos. */
  monthsText: string;
  dueDate: LocalDate | null;
}

export type RatePreview =
  | { status: 'incomplete' }
  | { status: 'unsolvable' }
  | { status: 'ok'; rate: number };

export const MSG_RATE_INCOMPLETE = 'Completa los 3 campos para ver la tasa estimada.';
export const MSG_RATE_UNSOLVABLE = 'Revisa los números: esa cuota no alcanza a cubrir ese saldo en esos meses.';
/** Inferidos (no estan en el diseno): espejo de “Escribe el saldo de la cuenta.”. */
export const MSG_BALANCE_REQUIRED = 'Escribe el saldo de la deuda.';
export const MSG_RATE_REQUIRED = 'Escribe la tasa de interés mensual.';

/** Meses enteros > 0 o null. */
export function parseMonths(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null;
  const months = Number(text.trim());
  return Number.isSafeInteger(months) && months > 0 ? months : null;
}

/** Tasa estimada con saldo, cuota y meses (modo «No sé la tasa»). */
export function ratePreview(form: Pick<NewDebtForm, 'balance' | 'installment' | 'monthsText'>): RatePreview {
  const months = parseMonths(form.monthsText);
  if (!form.balance || !form.installment || months === null) return { status: 'incomplete' };
  const rate = estimateMonthlyRate(form.balance, form.installment, months);
  return rate === null ? { status: 'unsolvable' } : { status: 'ok', rate };
}

/** «Tasa estimada: 1,8% mensual» (un decimal, coma decimal) o el aviso que corresponda. */
export function ratePreviewLabel(preview: RatePreview): string {
  if (preview.status === 'incomplete') return MSG_RATE_INCOMPLETE;
  if (preview.status === 'unsolvable') return MSG_RATE_UNSOLVABLE;
  return `Tasa estimada: ${(preview.rate * 100).toFixed(1).replace('.', ',')}% mensual`;
}

export type BuildDebtResult = { ok: true; input: CreateDebtInput } | { ok: false; error: string };

/**
 * Arma el input de `commands.debts.create`. El nombre lo valida el dominio (`cleanName`). Sin tasa
 * se exigen los meses (el dominio los pide); si la tasa no tiene solucion, la deuda se guarda con
 * «Por calcular», como en el diseno. La fecha solo viaja con cuota (sin cuota no hay recurrente).
 */
export function buildCreateDebtInput(form: NewDebtForm): BuildDebtResult {
  if (!form.balance) return { ok: false, error: MSG_BALANCE_REQUIRED };

  let rate: CreateDebtInput['rate'];
  if (form.knowsRate) {
    const percent = parseRatePercent(form.rateText);
    if (percent === null) return { ok: false, error: MSG_RATE_REQUIRED };
    rate = { known: percent / 100 };
  } else {
    const months = parseMonths(form.monthsText);
    if (months === null) return { ok: false, error: MSG_RATE_INCOMPLETE };
    rate = { unknown: { months } };
  }

  const installment = form.installment ? form.installment : null;
  return {
    ok: true,
    input: {
      name: form.name,
      balanceMinor: form.balance,
      installmentMinor: installment,
      rate,
      ...(installment !== null && form.dueDate !== null ? { nextDueDate: form.dueDate } : {}),
    },
  };
}

export type PaymentType = 'INSTALLMENT' | 'EXTRA';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Params de «Registrar pago de deuda» (arquitectura 6, fila 6): `type` (INSTALLMENT | EXTRA; por
 * defecto cuota) y `occurrence` ('YYYY-MM-DD'). Una ocurrencia mal formada se ignora y el dominio
 * usa la proxima fecha de la cuota.
 */
export function parsePayParams(params: { type?: string | string[]; occurrence?: string | string[] }): {
  type: PaymentType;
  occurrence: LocalDate | undefined;
} {
  const type = firstParam(params.type)?.toUpperCase() === 'EXTRA' ? 'EXTRA' : 'INSTALLMENT';
  const raw = firstParam(params.occurrence);
  return { type, occurrence: raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined };
}
