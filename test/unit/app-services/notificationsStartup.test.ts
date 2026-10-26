import { beforeEach, describe, expect, it, vi } from 'vitest';

// vi.mock se eleva sobre estos imports.
import { registerNotificationReconciler, reconcileNotifications } from '../../../src/app-services/notificationsPort';
import { startNotifications } from '../../../src/app-services/notificationsStartup';

const mocks = vi.hoisted(() => ({
  setupNotifications: vi.fn(async () => undefined),
  reconcile: vi.fn(async () => ({ scheduled: 0, cancelled: 0, kept: 0, permitted: true })),
  occurrences: [] as unknown[],
  settings: { reminderHour: 9, notifyPaymentReminders: true, notifyWeeklySummary: true },
}));

vi.mock('../../../src/platform/notifications', () => ({
  setupNotifications: mocks.setupNotifications,
  reconcile: mocks.reconcile,
}));
vi.mock('../../../src/app-services/domain', () => ({
  getDomain: () => ({
    recurring: { pendingOccurrences: () => mocks.occurrences },
    settings: { notificationSettings: () => mocks.settings },
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  registerNotificationReconciler(null);
});

describe('startNotifications', () => {
  it('configura, registra el reconciliador y concilia con el dominio', async () => {
    await startNotifications();
    expect(mocks.setupNotifications).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    expect(mocks.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ occurrences: mocks.occurrences, settings: mocks.settings, now: expect.any(Number) }),
    );

    // Queda registrado: los comandos posteriores también concilian.
    await reconcileNotifications();
    expect(mocks.reconcile).toHaveBeenCalledTimes(2);
  });

  it('registra el reconciliador antes de esperar a la configuración nativa', async () => {
    mocks.setupNotifications.mockReturnValueOnce(new Promise(() => undefined)); // nunca resuelve
    void startNotifications();
    await reconcileNotifications();
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
  });

  it('un fallo al configurar o al conciliar no bloquea el arranque', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.setupNotifications.mockRejectedValueOnce(new Error('sin canal'));
    mocks.reconcile.mockRejectedValueOnce(new Error('sin permiso'));

    await expect(startNotifications()).resolves.toBeUndefined();
    expect(mocks.reconcile).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
