// =============================================================================
// ADAPTADOR DE NOTIFICACIONES (expo-notifications)
// =============================================================================
//
// Capa de plataforma: traduce el plan puro (`planNotifications`) a notificaciones
// locales y las respuestas del usuario a acciones. No conoce la base de datos ni
// los servicios: quien lo llama (capa de aplicación, F5) le entrega las
// ocurrencias, los ajustes y los manejadores de respuesta.
//
// Diseño: docs/ARCHITECTURE.md §7. Decisiones 34-37 en §10.2.
// =============================================================================

import * as Notifications from 'expo-notifications';
import { formatCOP } from '../domain/money';
import {
  planNotifications,
  WEEKLY_SUMMARY_ID,
  type NotificationSettings,
  type NotificationTarget,
  type PendingOccurrence,
  type PlannedNotification,
  type PlanOptions,
} from '../domain/rules/notificationPlan';

export const ANDROID_CHANNEL_ID = 'reminders';
/** Sin ":" ni "-" (limitación de la API de categorías). */
export const ACTIONS_CATEGORY_ID = 'recurringActions';
export const ACTION_PAID = 'paid';
export const ACTION_SNOOZE = 'snooze';
/** Identificadores propios: todo lo demás que haya programado la app no se toca. */
const OWNED_PREFIX = 'rec:';
/** Clave en `content.data` con la huella del contenido programado. */
const SIGNATURE_KEY = 'ffSignature';
const TARGET_KEY = 'ffTarget';

export interface ReconcileInput {
  occurrences: PendingOccurrence[];
  settings: NotificationSettings;
  now: number;
  options?: PlanOptions;
}

export interface ReconcileResult {
  scheduled: number;
  cancelled: number;
  kept: number;
  /** false si no hay permiso: no se programó nada. */
  permitted: boolean;
}

export type ResponseAction =
  | { kind: 'OPEN'; target: NotificationTarget }
  | { kind: 'SNOOZE'; recurringId: string }
  | { kind: 'IGNORE' };

export interface ResponseHandlers {
  /** Abrir la pantalla de confirmación / pago (ruta de expo-router). */
  onNavigate: (href: string) => void;
  /** "Todavía no": debe llamar a `RecurringService.snooze` y luego a `reconcile`. */
  onSnooze: (recurringId: string) => void | Promise<void>;
}

// ----------------------------------------------------------------------------
// Configuración inicial
// ----------------------------------------------------------------------------

/**
 * Handler de primer plano, canal de Android y categoría de acciones. Idempotente.
 * Llamar una vez al iniciar (no pide permisos).
 */
export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  // En iOS resuelve null (no hay canales).
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Recordatorios',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationCategoryAsync(ACTIONS_CATEGORY_ID, [
    { identifier: ACTION_PAID, buttonTitle: 'Ya pagué', options: { opensAppToForeground: true } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Todavía no', options: { opensAppToForeground: true } },
  ]);
}

/**
 * Permisos. Se piden al crear el primer recurrente con fecha o al activar el
 * interruptor en Ajustes, no al arrancar (§7). Devuelve true si están concedidos.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// ----------------------------------------------------------------------------
// Conciliación
// ----------------------------------------------------------------------------

function bodyOf(n: PlannedNotification): string | undefined {
  return n.amount !== null ? formatCOP(n.amount) : undefined;
}

/** Huella del contenido: si no cambia, la notificación ya programada se conserva. */
function signatureOf(n: PlannedNotification): string {
  // El resumen semanal es repetitivo: su disparo no depende de la fecha concreta.
  const when = n.kind === 'WEEKLY_SUMMARY' ? 'weekly' : String(n.fireAt);
  return JSON.stringify([when, n.title, bodyOf(n) ?? null, n.hasActions, n.target]);
}

function triggerOf(n: PlannedNotification): Notifications.NotificationTriggerInput {
  if (n.kind === 'WEEKLY_SUMMARY') {
    const at = new Date(n.fireAt);
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: at.getDay() + 1, // 1 = domingo
      hour: at.getHours(),
      minute: at.getMinutes(),
      channelId: ANDROID_CHANNEL_ID,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DATE,
    date: n.fireAt,
    channelId: ANDROID_CHANNEL_ID,
  };
}

function isOwned(id: string): boolean {
  return id === WEEKLY_SUMMARY_ID || id.startsWith(OWNED_PREFIX);
}

async function schedule(n: PlannedNotification): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    identifier: n.id,
    content: {
      title: n.title,
      body: bodyOf(n),
      categoryIdentifier: n.hasActions ? ACTIONS_CATEGORY_ID : undefined,
      data: { [SIGNATURE_KEY]: signatureOf(n), [TARGET_KEY]: n.target },
    },
    trigger: triggerOf(n),
  });
}

async function applyPlan(planned: PlannedNotification[]): Promise<ReconcileResult> {
  const existing = (await Notifications.getAllScheduledNotificationsAsync()).filter((r) =>
    isOwned(r.identifier),
  );
  const existingById = new Map(existing.map((r) => [r.identifier, r]));
  const desiredIds = new Set(planned.map((n) => n.id));

  let cancelled = 0;
  for (const r of existing) {
    if (!desiredIds.has(r.identifier)) {
      await Notifications.cancelScheduledNotificationAsync(r.identifier);
      cancelled += 1;
    }
  }

  let scheduled = 0;
  let kept = 0;
  for (const n of planned) {
    const current = existingById.get(n.id);
    if (current && current.content.data?.[SIGNATURE_KEY] === signatureOf(n)) {
      kept += 1;
      continue;
    }
    // Un mismo identificador reemplaza la notificación anterior.
    await schedule(n);
    scheduled += 1;
  }
  return { scheduled, cancelled, kept, permitted: true };
}

/** Serializa las conciliaciones: dos llamadas simultáneas no se pisan. */
let queue: Promise<unknown> = Promise.resolve();

/**
 * Deja programado exactamente lo que dicta el plan (idempotente). Sin permiso no
 * programa nada y devuelve `permitted: false`; no lo solicita (ver
 * `ensureNotificationPermission`). Con permiso revocado se cancela lo propio.
 */
export function reconcile(input: ReconcileInput): Promise<ReconcileResult> {
  const run = async (): Promise<ReconcileResult> => {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) {
      const result = await applyPlan([]);
      return { ...result, permitted: false };
    }
    const planned = planNotifications(input.occurrences, input.settings, input.now, input.options);
    return applyPlan(planned);
  };
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

// ----------------------------------------------------------------------------
// Respuestas
// ----------------------------------------------------------------------------

/** Ruta de expo-router para un destino (§7). */
export function hrefOf(target: NotificationTarget): string {
  const occurrence = encodeURIComponent(target.occurrence);
  return target.route === 'PAY_DEBT'
    ? `/debts/${encodeURIComponent(target.debtId)}/pay?type=INSTALLMENT&occurrence=${occurrence}`
    : `/recurring/${encodeURIComponent(target.recurringId)}/confirm?occurrence=${occurrence}`;
}

function readTarget(data: Record<string, unknown> | undefined): NotificationTarget | null {
  const t = data?.[TARGET_KEY] as Partial<NotificationTarget> | null | undefined;
  if (!t || typeof t !== 'object' || typeof t.recurringId !== 'string' || typeof t.occurrence !== 'string') {
    return null;
  }
  if (t.route === 'PAY_DEBT' && typeof t.debtId === 'string') return t as NotificationTarget;
  if (t.route === 'CONFIRM_RECURRING') return t as NotificationTarget;
  return null;
}

/** Interpreta una respuesta: tocar o "Ya pagué" abre la pantalla; "Todavía no" aplaza. */
export function interpretResponse(response: Notifications.NotificationResponse): ResponseAction {
  const target = readTarget(response.notification.request.content.data);
  if (!target) return { kind: 'IGNORE' }; // p. ej. el resumen semanal: solo abre la app
  if (response.actionIdentifier === ACTION_SNOOZE) {
    return { kind: 'SNOOZE', recurringId: target.recurringId };
  }
  return { kind: 'OPEN', target };
}

let lastHandledKey: string | null = null;

async function handle(response: Notifications.NotificationResponse, h: ResponseHandlers): Promise<void> {
  // El arranque en frío puede entregar la misma respuesta por el listener y por
  // getLastNotificationResponseAsync: se procesa una sola vez.
  const key = `${response.notification.request.identifier}|${response.actionIdentifier}|${response.notification.date}`;
  if (key === lastHandledKey) return;
  lastHandledKey = key;

  const action = interpretResponse(response);
  if (action.kind === 'OPEN') h.onNavigate(hrefOf(action.target));
  else if (action.kind === 'SNOOZE') await h.onSnooze(action.recurringId);
}

/**
 * Registra el listener de respuestas y procesa la que pudo abrir la app (arranque
 * en frío). Devuelve la función para quitar el listener.
 */
export function subscribeToNotificationResponses(h: ResponseHandlers): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    void handle(response, h);
  });
  void Notifications.getLastNotificationResponseAsync().then(async (response) => {
    if (!response) return;
    await handle(response, h);
    await Notifications.clearLastNotificationResponseAsync();
  });
  return () => subscription.remove();
}

/** Solo para pruebas. */
export function __resetForTests(): void {
  lastHandledKey = null;
  queue = Promise.resolve();
}
