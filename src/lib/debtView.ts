// Textos y calculos de presentacion de las pantallas de Deudas, puros (sin react-native) para
// poder probarlos en vitest. Fuente de los textos: Design/Dashboard.dc.html (~L984-1010) y la
// decision 38 de docs/ARCHITECTURE.md §10.2.
import { formatCOP, formatRate } from '../domain/money';
import type { DebtView } from '../domain/services/DebtService';
import { shortDateLabel } from './dateLabels';

export const MSG_DEBT_SETTLED = 'Esta deuda ya está liquidada.';
export const MSG_ADD_INSTALLMENT = 'Agrega la cuota para ver la proyección.';
/** Decision 38 (CONFIRMADA por el usuario): cuota definida pero monthsRemaining = null. Literal. */
export const MSG_INSTALLMENT_BELOW_INTEREST =
  'Tu cuota actual no alcanza a cubrir el interés mensual — la deuda no va a bajar con este pago.';

type ProjectionInput = Pick<DebtView, 'balanceMinor' | 'installmentMinor' | 'monthsRemaining'>;

/**
 * Proyeccion de una deuda. `monthsRemaining = null` tiene dos significados (arquitectura 3.4):
 * sin cuota -> «Agrega la cuota…»; con cuota -> texto de la decision 38.
 */
export function debtProjection(debt: ProjectionInput): string {
  if (debt.balanceMinor <= 0) return MSG_DEBT_SETTLED;
  const installment = debt.installmentMinor;
  if (installment === null || !(installment > 0)) return MSG_ADD_INSTALLMENT;
  if (debt.monthsRemaining === null) return MSG_INSTALLMENT_BELOW_INTEREST;
  const months = debt.monthsRemaining;
  return `Pagando ${formatCOP(installment)} al mes, la liquidas en ${months} ${months === 1 ? 'mes' : 'meses'} más.`;
}

/** Avance de la barra (0-100) y su texto («Llevas 3 de 10 pagos»). */
export function debtProgress(debt: Pick<DebtView, 'paidCount' | 'totalCount'>): { percent: number; label: string } {
  const { paidCount, totalCount } = debt;
  if (totalCount !== null && totalCount > 0) {
    return {
      percent: Math.min(100, Math.round((paidCount / totalCount) * 100)),
      label: `Llevas ${paidCount} de ${totalCount} pagos`,
    };
  }
  if (paidCount > 0) {
    return { percent: 0, label: `${paidCount} pago${paidCount === 1 ? '' : 's'} realizado${paidCount === 1 ? '' : 's'}` };
  }
  return { percent: 0, label: 'Sin pagos registrados aún' };
}

/** Tasa de la deuda: «2,3% mensual», «1,8% mensual (estimada)» o «Por calcular». */
export function debtRateLabel(debt: Pick<DebtView, 'monthlyRate' | 'rateSource'>): string {
  if (debt.monthlyRate === null || debt.rateSource === 'UNKNOWN') return 'Por calcular';
  if (debt.rateSource === 'ESTIMATED') return `${formatRate(debt.monthlyRate, 1)} mensual (estimada)`;
  return `${formatRate(debt.monthlyRate)} mensual`;
}

/** Fecha del proximo pago como en el diseno («15 oct») o «Sin definir». */
export function debtDueLabel(debt: Pick<DebtView, 'nextDueDate'>): string {
  return debt.nextDueDate ? shortDateLabel(debt.nextDueDate) : 'Sin definir';
}

/** «en 2 deudas activas» / «en 1 deuda activa» (debtsCountLabel del diseno). */
export function debtsCountLabel(count: number): string {
  return `en ${count} ${count === 1 ? 'deuda activa' : 'deudas activas'}`;
}
