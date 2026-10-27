// =============================================================================
// RUTAS DE LA APP (arquitectura 6)
// =============================================================================
// Las pantallas de estas rutas las crea F5b; hasta entonces `typedRoutes` no las conoce, por eso
// cada ruta pasa por `href()`. Cuando existan, esta tabla es el unico sitio a actualizar.
// Sin pantalla todavia (los botones que las usan van con `comingSoon` en components/dashboard):
// recurringNew, recurringConfirm, debtInstallmentPay, cashflow, debts, debtNew.
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
  recurringNew: () => href('/recurring/new'),
  /** Hoja "Ya pague" (siempre pide cuenta; D8). */
  recurringConfirm: (id: string, occurrence: LocalDate) => href(`/recurring/${id}/confirm?occurrence=${occurrence}`),
  /** Cuota de deuda: va al flujo de pago de deuda, no al generico (I4). */
  debtInstallmentPay: (debtId: string, occurrence: LocalDate) =>
    href(`/debts/${debtId}/pay?type=INSTALLMENT&occurrence=${occurrence}`),
  cashflow: () => href('/cashflow'),
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
