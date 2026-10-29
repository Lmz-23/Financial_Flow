// =============================================================================
// RUTAS DE LA APP (arquitectura 6)
// =============================================================================
// Las pantallas de estas rutas las crea F5b; hasta entonces `typedRoutes` no las conoce, por eso
// cada ruta pasa por `href()`. Cuando existan, esta tabla es el unico sitio a actualizar.
import type { Href } from 'expo-router';

import type { LocalDate } from '../domain/dates';
import type { UpcomingItem } from '../domain/services/RecurringService';

function href(path: string): Href {
  return path as Href;
}

export const routes = {
  dashboard: () => href('/'),
  settings: () => href('/settings'),
  accountNew: () => href('/accounts/new'),
  account: (id: string) => href(`/accounts/${id}`),
  transactions: () => href('/transactions'),
  transaction: (id: string) => href(`/transactions/${id}`),
  transactionNew: () => href('/transactions/new'),
  transactionEdit: (id: string) => href(`/transactions/${id}/edit`),
  /** Nueva transferencia: el mismo formulario de Nueva transaccion con la pestana Transferencia. */
  transferNew: () => href('/transactions/new?type=TRANSFER'),
  transfer: (id: string) => href(`/transfers/${id}`),
  transferEdit: (id: string) => href(`/transfers/${id}/edit`),
  /** Nuevo ingreso con la marca de pasivo ya puesta (atajo del detalle de Cashflow). */
  transactionNewPassive: () => href('/transactions/new?type=INCOME&passive=1'),
  /** Lista de recurrentes (pagos e ingresos; edicion del proximo pago, decision 39). */
  recurring: () => href('/recurring'),
  recurringNew: () => href('/recurring/new'),
  recurringEdit: (id: string) => href(`/recurring/${id}`),
  /** Hoja "Ya pague" (siempre pide cuenta; D8). */
  recurringConfirm: (id: string, occurrence: LocalDate) => href(`/recurring/${id}/confirm?occurrence=${occurrence}`),
  /** Cuota de deuda: va al flujo de pago de deuda, no al generico (I4). */
  debtInstallmentPay: (debtId: string, occurrence: LocalDate) =>
    href(`/debts/${debtId}/pay?type=INSTALLMENT&occurrence=${occurrence}`),
  cashflow: () => href('/cashflow'),
  /** Detalle del flujo ("Ver detalles" en Flujo del mes): gráfico por periodo y desglose por categoría. */
  flow: () => href('/flow'),
  debts: () => href('/debts'),
  debtNew: () => href('/debts/new'),
  goals: () => href('/goals'),
  goalNew: () => href('/goals/new'),
  /** Agregar a meta (transferencia interna cuenta -> meta; §6 fila 10). */
  goalContribute: (id: string) => href(`/goals/${id}/contribute`),
  /** Pasos del onboarding (F5b-1; decisión 46, A1). */
  onboardingAccounts: () => href('/onboarding/accounts'),
  onboardingFlow: () => href('/onboarding/flow'),
  onboardingWidgets: () => href('/onboarding/widgets'),
  onboardingDone: () => href('/onboarding/done'),
} as const;

/** Destino al tocar el circulo de un proximo pago pendiente: una cuota de deuda va al flujo de pago de deuda (I4). */
export function upcomingConfirmRoute(item: Pick<UpcomingItem, 'debtId' | 'recurringId' | 'nextDueDate'>): Href {
  return item.debtId !== null
    ? routes.debtInstallmentPay(item.debtId, item.nextDueDate)
    : routes.recurringConfirm(item.recurringId, item.nextDueDate);
}
