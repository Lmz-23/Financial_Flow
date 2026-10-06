import { settingsRepository, type SettingsRow, type WidgetKey } from '../../database/repositories/settingsRepository';
import type { NotificationSettings } from '../rules/notificationPlan';
import { NotFoundError, ValidationError } from './errors';
import {
  autoActivateWidget,
  runOperation,
  type DomainContext,
  type OperationResult,
} from './shared';

export type ThemePreference = SettingsRow['themePreference'];

export interface NotificationsInput {
  notifyPaymentReminders?: boolean;
  notifyWeeklySummary?: boolean;
  /** Hora local 0-23. */
  reminderHour?: number;
}

export function createSettingsService(ctx: DomainContext) {
  function get(): SettingsRow {
    const row = settingsRepository.get(ctx.db, ctx.userId);
    if (!row) throw new NotFoundError('Usuario', ctx.userId);
    return row;
  }

  return {
    setTheme(theme: ThemePreference): OperationResult<null> {
      return runOperation(ctx, (tx, fx) => {
        if (theme !== 'light' && theme !== 'dark' && theme !== 'system') {
          throw new ValidationError('Tema invalido');
        }
        settingsRepository.setTheme(tx, ctx.userId, theme, ctx.now());
        fx.refresh('settings');
        return null;
      });
    },

    /** Cambia avisos y/o hora; pide reconciliar notificaciones (efecto `settings`). */
    setNotifications(input: NotificationsInput): OperationResult<null> {
      return runOperation(ctx, (tx, fx) => {
        if (
          input.reminderHour !== undefined &&
          (!Number.isInteger(input.reminderHour) || input.reminderHour < 0 || input.reminderHour > 23)
        ) {
          throw new ValidationError('La hora del aviso debe estar entre 0 y 23');
        }
        settingsRepository.setNotifications(tx, ctx.userId, input, ctx.now());
        fx.refresh('settings');
        return null;
      });
    },

    /** Decision del usuario: activar pone 1, desactivar pone 0 (no borra nada). */
    setWidget(widget: WidgetKey, on: boolean): OperationResult<null> {
      return runOperation(ctx, (tx, fx) => {
        settingsRepository.setWidget(tx, ctx.userId, widget, on, ctx.now());
        fx.refresh('settings');
        return null;
      });
    },

    /** Activacion automatica: solo desde NULL (I6). `activated` indica si cambio el flag. */
    autoActivate(widget: WidgetKey): OperationResult<{ activated: boolean }> {
      return runOperation(ctx, (tx, fx) => {
        const activated = autoActivateWidget(tx, ctx, widget);
        if (activated) fx.refresh('settings');
        return { activated };
      });
    },

    // --- Consultas (solo lectura) -------------------------------------------

    get,

    /** Entrada de `planNotifications`. */
    notificationSettings(): NotificationSettings {
      const s = get();
      return {
        reminderHour: s.reminderHour,
        notifyPaymentReminders: s.notifyPaymentReminders,
        notifyWeeklySummary: s.notifyWeeklySummary,
      };
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
