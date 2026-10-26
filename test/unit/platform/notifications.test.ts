import { beforeEach, describe, expect, it, vi } from 'vitest';
import { localDateToEpochMs } from '../../../src/domain/dates';
import * as Notifications from 'expo-notifications';
import {
  ACTION_PAID,
  ACTION_SNOOZE,
  ACTIONS_CATEGORY_ID,
  ANDROID_CHANNEL_ID,
  __resetForTests,
  ensureNotificationPermission,
  hrefOf,
  interpretResponse,
  reconcile,
  setupNotifications,
  subscribeToNotificationResponses,
} from '../../../src/platform/notifications';
import type { PendingOccurrence } from '../../../src/domain/rules/notificationPlan';

interface FakeRequest {
  identifier: string;
  content: { title?: string; body?: string; categoryIdentifier?: string; data?: Record<string, unknown> };
  trigger: Record<string, unknown>;
}

const state = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  granted: true,
  canAskAgain: true,
  requestGrants: true,
  lastResponse: null as unknown,
  listener: null as null | ((r: unknown) => void),
}));

vi.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly' },
  AndroidImportance: { DEFAULT: 5 },
  setNotificationHandler: vi.fn(),
  setNotificationChannelAsync: vi.fn(async () => null),
  setNotificationCategoryAsync: vi.fn(async () => ({})),
  getPermissionsAsync: vi.fn(async () => ({ granted: state.granted, canAskAgain: state.canAskAgain })),
  requestPermissionsAsync: vi.fn(async () => ({ granted: state.requestGrants })),
  getAllScheduledNotificationsAsync: vi.fn(async () => [...state.store.values()]),
  scheduleNotificationAsync: vi.fn(async (req: FakeRequest) => {
    state.store.set(req.identifier, req);
    return req.identifier;
  }),
  cancelScheduledNotificationAsync: vi.fn(async (id: string) => {
    state.store.delete(id);
  }),
  addNotificationResponseReceivedListener: vi.fn((l: (r: unknown) => void) => {
    state.listener = l;
    return { remove: vi.fn() };
  }),
  getLastNotificationResponseAsync: vi.fn(async () => state.lastResponse),
  clearLastNotificationResponseAsync: vi.fn(async () => {
    state.lastResponse = null;
  }),
}));

const at = (d: string, h = 0) => localDateToEpochMs(d, h);
const NOW = at('2026-10-08', 8); // jueves
const settings = { reminderHour: 9, notifyPaymentReminders: true, notifyWeeklySummary: true };

function occ(over: Partial<PendingOccurrence> = {}): PendingOccurrence {
  return {
    recurringId: 'r1',
    occurrence: '2026-10-20',
    name: 'Arriendo',
    amount: 1_500_000,
    direction: 'EXPENSE',
    debtId: null,
    debtSettled: false,
    snoozedUntil: null,
    ...over,
  };
}
const ids = () => [...state.store.keys()].sort();
const input = (occurrences: PendingOccurrence[], s = settings) => ({ occurrences, settings: s, now: NOW });

beforeEach(() => {
  vi.clearAllMocks();
  state.store.clear();
  state.granted = true;
  state.canAskAgain = true;
  state.requestGrants = true;
  state.lastResponse = null;
  state.listener = null;
  __resetForTests();
});

describe('setupNotifications', () => {
  it('registra canal de Android y categoría con las dos acciones', async () => {
    await setupNotifications();
    expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
      ANDROID_CHANNEL_ID,
      expect.objectContaining({ name: 'Recordatorios' }),
    );
    const [id, actions] = vi.mocked(Notifications.setNotificationCategoryAsync).mock.calls[0]!;
    expect(id).toBe(ACTIONS_CATEGORY_ID);
    expect(id).not.toMatch(/[:-]/);
    expect(actions.map((a) => [a.identifier, a.buttonTitle])).toEqual([
      [ACTION_PAID, 'Ya pagué'],
      [ACTION_SNOOZE, 'Todavía no'],
    ]);
  });
});

describe('ensureNotificationPermission', () => {
  it('no vuelve a pedir si ya está concedido', async () => {
    expect(await ensureNotificationPermission()).toBe(true);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
  it('pide si falta y se puede', async () => {
    state.granted = false;
    expect(await ensureNotificationPermission()).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  });
  it('no pide si el sistema ya no lo permite', async () => {
    state.granted = false;
    state.canAskAgain = false;
    expect(await ensureNotificationPermission()).toBe(false);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});

describe('reconcile', () => {
  it('programa pre, due y resumen semanal con disparadores DATE y WEEKLY', async () => {
    const r = await reconcile(input([occ()]));
    expect(r).toEqual({ scheduled: 3, cancelled: 0, kept: 0, permitted: true });
    expect(ids()).toEqual(['rec:r1:2026-10-20:due', 'rec:r1:2026-10-20:pre', 'weekly-summary']);

    const due = state.store.get('rec:r1:2026-10-20:due') as FakeRequest;
    expect(due.trigger).toMatchObject({ type: 'date', date: at('2026-10-20', 9), channelId: ANDROID_CHANNEL_ID });
    expect(due.content).toMatchObject({ title: '¿Ya pagaste Arriendo?', body: '$15.000', categoryIdentifier: ACTIONS_CATEGORY_ID });

    const pre = state.store.get('rec:r1:2026-10-20:pre') as FakeRequest;
    expect(pre.content.categoryIdentifier).toBeUndefined();

    const weekly = state.store.get('weekly-summary') as FakeRequest;
    expect(weekly.trigger).toMatchObject({ type: 'weekly', weekday: 1, hour: 19, minute: 0 });
    expect(weekly.content.title).toBe('Tu resumen semanal está listo');
  });

  it('un ingreso solo programa due (decisión 34)', async () => {
    await reconcile(input([occ({ direction: 'INCOME', name: 'Salario' })], { ...settings, notifyWeeklySummary: false }));
    expect(ids()).toEqual(['rec:r1:2026-10-20:due']);
  });

  it('es idempotente: la segunda pasada no programa ni cancela', async () => {
    await reconcile(input([occ()]));
    vi.mocked(Notifications.scheduleNotificationAsync).mockClear();
    const r = await reconcile(input([occ()]));
    expect(r).toEqual({ scheduled: 0, cancelled: 0, kept: 3, permitted: true });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancela lo que sobra y reprograma lo que cambió', async () => {
    await reconcile(input([occ(), occ({ recurringId: 'r2', name: 'Luz' })]));
    expect(ids()).toHaveLength(5);
    const r = await reconcile(input([occ({ amount: 1_600_000 })]));
    expect(ids()).toEqual(['rec:r1:2026-10-20:due', 'rec:r1:2026-10-20:pre', 'weekly-summary']);
    expect(r.cancelled).toBe(2);
    expect(r.scheduled).toBe(2); // pre y due con monto nuevo
    expect(r.kept).toBe(1); // el resumen semanal
  });

  it('apagar el interruptor cancela rec:* y apagar el resumen cancela weekly-summary', async () => {
    await reconcile(input([occ()]));
    await reconcile(input([occ()], { ...settings, notifyPaymentReminders: false }));
    expect(ids()).toEqual(['weekly-summary']);
    await reconcile(input([occ()], { ...settings, notifyPaymentReminders: false, notifyWeeklySummary: false }));
    expect(ids()).toEqual([]);
  });

  it('no toca notificaciones ajenas al plan', async () => {
    state.store.set('otra', { identifier: 'otra', content: {}, trigger: {} });
    await reconcile(input([], { ...settings, notifyWeeklySummary: false }));
    expect(ids()).toEqual(['otra']);
  });

  it('sin permiso no programa y cancela lo propio', async () => {
    await reconcile(input([occ()]));
    state.granted = false;
    const r = await reconcile(input([occ()]));
    expect(r.permitted).toBe(false);
    expect(ids()).toEqual([]);
    state.store.clear();
    vi.mocked(Notifications.scheduleNotificationAsync).mockClear();
    await reconcile(input([occ()]));
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('llamadas simultáneas se serializan sin duplicar', async () => {
    const [a, b] = await Promise.all([reconcile(input([occ()])), reconcile(input([occ()]))]);
    expect(a.scheduled).toBe(3);
    expect(b).toMatchObject({ scheduled: 0, kept: 3 });
  });

  it('respeta el tope reservando el resumen semanal (decisión 37)', async () => {
    await reconcile({ ...input([occ(), occ({ recurringId: 'r2' })]), options: { maxNotifications: 2 } });
    expect(ids()).toContain('weekly-summary');
    expect(ids()).toHaveLength(2);
  });
});

describe('hora local (America/Bogota, UTC-5)', () => {
  // Instantes absolutos escritos a mano: no reutilizan `localDateToEpochMs`, así que un
  // 'YYYY-MM-DD' leído como medianoche UTC (19:00 del día anterior en Bogotá) haría fallar el test.
  it('el huso de la suite es America/Bogota', () => {
    expect(process.env.TZ).toBe('America/Bogota');
  });

  it('el aviso del día y el previo disparan a la hora del recordatorio, en su fecha local', async () => {
    await reconcile(input([occ({ occurrence: '2026-10-20' })]));
    const due = (state.store.get('rec:r1:2026-10-20:due') as FakeRequest).trigger.date as number;
    const pre = (state.store.get('rec:r1:2026-10-20:pre') as FakeRequest).trigger.date as number;

    expect(due).toBe(Date.parse('2026-10-20T14:00:00Z')); // 09:00 en Bogotá
    expect(pre).toBe(Date.parse('2026-10-18T14:00:00Z')); // 2 días antes, 09:00 en Bogotá
    for (const [instant, day] of [[due, 20], [pre, 18]] as const) {
      const d = new Date(instant);
      expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([day, 9, 0]);
    }
  });

  it('respeta una hora de recordatorio tardía sin pasarse al día siguiente', async () => {
    await reconcile(input([occ({ occurrence: '2026-10-20' })], { ...settings, reminderHour: 23 }));
    const due = (state.store.get('rec:r1:2026-10-20:due') as FakeRequest).trigger.date as number;
    expect(due).toBe(Date.parse('2026-10-21T04:00:00Z')); // 23:00 del 20 en Bogotá
    expect(new Date(due).getDate()).toBe(20);
  });

  it('el resumen semanal queda el domingo a las 19:00 locales', async () => {
    await reconcile(input([]));
    const weekly = (state.store.get('weekly-summary') as FakeRequest).trigger;
    expect(weekly).toMatchObject({ type: 'weekly', weekday: 1, hour: 19, minute: 0 });
  });
});

describe('respuestas', () => {
  const response = (actionIdentifier: string, data: Record<string, unknown>, id = 'n1') =>
    ({
      actionIdentifier,
      notification: { date: 1, request: { identifier: id, content: { data } } },
    }) as unknown as Notifications.NotificationResponse;
  const confirm = { route: 'CONFIRM_RECURRING', recurringId: 'r1', occurrence: '2026-10-20' } as const;
  const pay = { route: 'PAY_DEBT', debtId: 'd1', recurringId: 'r1', occurrence: '2026-10-20' } as const;

  it('hrefOf construye las rutas del diseño', () => {
    expect(hrefOf(confirm)).toBe('/recurring/r1/confirm?occurrence=2026-10-20');
    expect(hrefOf(pay)).toBe('/debts/d1/pay?type=INSTALLMENT&occurrence=2026-10-20');
  });

  it('interpreta toque, Ya pagué, Todavía no y notificaciones sin destino', () => {
    expect(interpretResponse(response('expo.modules.notifications.actions.DEFAULT', { ffTarget: confirm }))).toEqual({ kind: 'OPEN', target: confirm });
    expect(interpretResponse(response(ACTION_PAID, { ffTarget: pay }))).toEqual({ kind: 'OPEN', target: pay });
    expect(interpretResponse(response(ACTION_SNOOZE, { ffTarget: pay }))).toEqual({ kind: 'SNOOZE', recurringId: 'r1' });
    expect(interpretResponse(response('x', { ffTarget: null }))).toEqual({ kind: 'IGNORE' });
    expect(interpretResponse(response('x', {}))).toEqual({ kind: 'IGNORE' });
    expect(interpretResponse(response('x', { ffTarget: { route: 'PAY_DEBT', recurringId: 'r', occurrence: 'o' } }))).toEqual({ kind: 'IGNORE' });
  });

  it('el listener navega o aplaza', async () => {
    const h = { onNavigate: vi.fn(), onSnooze: vi.fn() };
    const unsubscribe = subscribeToNotificationResponses(h);
    state.listener!(response(ACTION_PAID, { ffTarget: confirm }, 'a'));
    state.listener!(response(ACTION_SNOOZE, { ffTarget: confirm }, 'b'));
    await vi.waitFor(() => expect(h.onSnooze).toHaveBeenCalledWith('r1'));
    expect(h.onNavigate).toHaveBeenCalledWith('/recurring/r1/confirm?occurrence=2026-10-20');
    unsubscribe();
  });

  it('arranque en frío: procesa la última respuesta una vez y la limpia', async () => {
    state.lastResponse = response(ACTION_PAID, { ffTarget: pay }, 'c');
    const h = { onNavigate: vi.fn(), onSnooze: vi.fn() };
    subscribeToNotificationResponses(h);
    state.listener!(response(ACTION_PAID, { ffTarget: pay }, 'c')); // misma respuesta por el listener
    await vi.waitFor(() => expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled());
    expect(h.onNavigate).toHaveBeenCalledTimes(1);
    expect(h.onNavigate).toHaveBeenCalledWith('/debts/d1/pay?type=INSTALLMENT&occurrence=2026-10-20');
  });

  describe('manejadores que fallan', () => {
    let warn: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    it('listener: captura el error de onSnooze y lo registra', async () => {
      const h = { onNavigate: vi.fn(), onSnooze: vi.fn(async () => { throw new Error('boom'); }) };
      subscribeToNotificationResponses(h);
      state.listener!(response(ACTION_SNOOZE, { ffTarget: confirm }, 'f1'));
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
      expect(h.onSnooze).toHaveBeenCalledTimes(1);
    });

    it('listener: captura el error síncrono de onNavigate', async () => {
      const h = { onNavigate: vi.fn(() => { throw new Error('boom'); }), onSnooze: vi.fn() };
      subscribeToNotificationResponses(h);
      state.listener!(response(ACTION_PAID, { ffTarget: confirm }, 'f2'));
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
    });

    it('arranque en frío: si el manejador lanza, igualmente limpia la respuesta', async () => {
      state.lastResponse = response(ACTION_SNOOZE, { ffTarget: confirm }, 'f3');
      const h = { onNavigate: vi.fn(), onSnooze: vi.fn(async () => { throw new Error('boom'); }) };
      subscribeToNotificationResponses(h);
      await vi.waitFor(() => expect(Notifications.clearLastNotificationResponseAsync).toHaveBeenCalled());
      expect(warn).toHaveBeenCalled();
    });

    it('permite reintentar la misma notificación tras un fallo, y deduplica tras el éxito', async () => {
      const onSnooze = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
      const h = { onNavigate: vi.fn(), onSnooze };
      subscribeToNotificationResponses(h);
      state.listener!(response(ACTION_SNOOZE, { ffTarget: confirm }, 'f4'));
      await vi.waitFor(() => expect(warn).toHaveBeenCalled());
      state.listener!(response(ACTION_SNOOZE, { ffTarget: confirm }, 'f4'));
      await vi.waitFor(() => expect(onSnooze).toHaveBeenCalledTimes(2));
      state.listener!(response(ACTION_SNOOZE, { ffTarget: confirm }, 'f4'));
      await Promise.resolve();
      expect(onSnooze).toHaveBeenCalledTimes(2);
    });
  });
});
