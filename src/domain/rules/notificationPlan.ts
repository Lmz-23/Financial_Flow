// =============================================================================
// NOTIFICATION PLAN (notificaciones deseadas, función pura)
// =============================================================================
//
// Dado el estado (ocurrencias pendientes, ajustes y "ahora") devuelve las
// notificaciones que deberían estar programadas, con identificadores
// deterministas. El adaptador de plataforma concilia contra lo ya programado.
//
// Identificadores:
//   rec:{id}:{occ}:pre              2 días antes, a reminderHour (solo pagos)
//   rec:{id}:{occ}:due              el día del vencimiento, a reminderHour
//   rec:{id}:{occ}:snooze:{fecha}   recordatorio diario tras "Todavía no"
//   weekly-summary                  domingo 19:00
//
// SUPUESTOS:
// - Los avisos de ingresos solo tienen `due` ("¿Ya recibiste X?") y snooze; no hay `pre`.
// - El toggle de avisos de pago apaga también los avisos de ingresos recurrentes.
// - Un snooze diario no se duplica con el `pre` ni con el `due` del mismo día.
// - El texto del resumen semanal es propio del plan (el diseño no lo trae).
// - Con tope, el resumen semanal se reserva primero y el resto se prioriza por cercanía.
// =============================================================================

import {
  addDays,
  compareLocalDates,
  dayOfWeek,
  localDateToEpochMs,
  toLocalDate,
  type LocalDate,
} from '../dates';
import type { Minor } from '../money';

export const DEFAULT_MAX_NOTIFICATIONS = 60;
/** Días después del vencimiento hasta los que llegan los avisos de snooze. */
export const SNOOZE_GRACE_DAYS = 7;
export const PRE_DUE_DAYS = 2;
export const WEEKLY_SUMMARY_ID = 'weekly-summary';
export const WEEKLY_SUMMARY_HOUR = 19;
const SUNDAY = 0;

export type OccurrenceDirection = 'EXPENSE' | 'INCOME';

/** Ocurrencia pendiente de un recurrente activo con fecha. */
export interface PendingOccurrence {
  recurringId: string;
  /** Fecha de vencimiento (ocurrencia) 'YYYY-MM-DD'. */
  occurrence: LocalDate;
  /** Nombre a mostrar (para cuotas de deuda, el de la deuda). */
  name: string;
  amount: Minor | null;
  direction: OccurrenceDirection;
  /** Presente si es la cuota de una deuda. */
  debtId: string | null;
  /** true si la deuda está liquidada (saldo 0) o archivada: no se notifica. */
  debtSettled: boolean;
  /** Epoch ms del próximo recordatorio tras "Todavía no"; null si no hay snooze. */
  snoozedUntil: number | null;
}

export interface NotificationSettings {
  /** Hora local 0-23. */
  reminderHour: number;
  notifyPaymentReminders: boolean;
  notifyWeeklySummary: boolean;
}

/** Destino al responder la notificación. */
export type NotificationTarget =
  | { route: 'CONFIRM_RECURRING'; recurringId: string; occurrence: LocalDate }
  | { route: 'PAY_DEBT'; debtId: string; recurringId: string; occurrence: LocalDate };

export type NotificationKind = 'PRE' | 'DUE' | 'SNOOZE' | 'WEEKLY_SUMMARY';

export interface PlannedNotification {
  id: string;
  kind: NotificationKind;
  /** Instante de disparo, epoch ms. */
  fireAt: number;
  title: string;
  /** null para el resumen semanal (abre la app sin destino específico). */
  target: NotificationTarget | null;
  /** true si lleva las acciones "Ya pagué/recibí" y "Todavía no". */
  hasActions: boolean;
  direction: OccurrenceDirection | null;
  amount: Minor | null;
}

export interface PlanOptions {
  /** Tope de notificaciones (iOS admite ~64). Por defecto 60. */
  maxNotifications?: number;
}

function targetOf(o: PendingOccurrence): NotificationTarget {
  return o.debtId !== null
    ? { route: 'PAY_DEBT', debtId: o.debtId, recurringId: o.recurringId, occurrence: o.occurrence }
    : { route: 'CONFIRM_RECURRING', recurringId: o.recurringId, occurrence: o.occurrence };
}

function dueTitle(o: PendingOccurrence): string {
  return o.direction === 'INCOME' ? `¿Ya recibiste ${o.name}?` : `¿Ya pagaste ${o.name}?`;
}

/** Próximo domingo 19:00 local estrictamente posterior a `now`. */
export function nextWeeklySummaryAt(now: number): number {
  let date = toLocalDate(now);
  while (dayOfWeek(date) !== SUNDAY || localDateToEpochMs(date, WEEKLY_SUMMARY_HOUR) <= now) {
    date = addDays(date, 1);
  }
  return localDateToEpochMs(date, WEEKLY_SUMMARY_HOUR);
}

export function planNotifications(
  occurrences: PendingOccurrence[],
  settings: NotificationSettings,
  now: number,
  options: PlanOptions = {},
): PlannedNotification[] {
  const { reminderHour } = settings;
  if (!Number.isInteger(reminderHour) || reminderHour < 0 || reminderHour > 23) {
    throw new RangeError(`reminderHour fuera de rango: ${reminderHour}`);
  }
  const max = options.maxNotifications ?? DEFAULT_MAX_NOTIFICATIONS;
  const planned: PlannedNotification[] = [];

  const push = (n: PlannedNotification): void => {
    if (n.fireAt > now) planned.push(n);
  };

  if (settings.notifyPaymentReminders) {
    for (const o of occurrences) {
      if (o.debtSettled) continue;
      const base = `rec:${o.recurringId}:${o.occurrence}`;
      const target = targetOf(o);
      const preDate = addDays(o.occurrence, -PRE_DUE_DAYS);

      if (o.direction === 'EXPENSE') {
        push({
          id: `${base}:pre`,
          kind: 'PRE',
          fireAt: localDateToEpochMs(preDate, reminderHour),
          title: `Tu pago de ${o.name} vence en ${PRE_DUE_DAYS} días`,
          target,
          hasActions: false,
          direction: o.direction,
          amount: o.amount,
        });
      }
      push({
        id: `${base}:due`,
        kind: 'DUE',
        fireAt: localDateToEpochMs(o.occurrence, reminderHour),
        title: dueTitle(o),
        target,
        hasActions: true,
        direction: o.direction,
        amount: o.amount,
      });

      if (o.snoozedUntil !== null) {
        const last = addDays(o.occurrence, SNOOZE_GRACE_DAYS);
        for (
          let day = toLocalDate(o.snoozedUntil);
          compareLocalDates(day, last) <= 0;
          day = addDays(day, 1)
        ) {
          const covered =
            day === o.occurrence || (o.direction === 'EXPENSE' && day === preDate);
          if (covered) continue;
          push({
            id: `${base}:snooze:${day}`,
            kind: 'SNOOZE',
            fireAt: localDateToEpochMs(day, reminderHour),
            title: dueTitle(o),
            target,
            hasActions: true,
            direction: o.direction,
            amount: o.amount,
          });
        }
      }
    }
  }

  const byProximity = (a: PlannedNotification, b: PlannedNotification): number =>
    a.fireAt - b.fireAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  planned.sort(byProximity);

  let result: PlannedNotification[];
  if (settings.notifyWeeklySummary && max > 0) {
    result = planned.slice(0, max - 1);
    result.push({
      id: WEEKLY_SUMMARY_ID,
      kind: 'WEEKLY_SUMMARY',
      fireAt: nextWeeklySummaryAt(now),
      title: 'Tu resumen semanal está listo',
      target: null,
      hasActions: false,
      direction: null,
      amount: null,
    });
    result.sort(byProximity);
  } else {
    result = planned.slice(0, Math.max(max, 0));
  }
  return result;
}
