import { eq, sql } from 'drizzle-orm';
import { users, type User } from '../schema';
import type { DbOrTx } from '../types';
import { mapRow, toDate, type DatesToMs } from './mapping';

export type SettingsRow = DatesToMs<User>;
export type WidgetKey = 'cashflow' | 'debts' | 'goals';

const WIDGET_COLUMN = {
  cashflow: 'widgetCashflow',
  debts: 'widgetDebts',
  goals: 'widgetGoals',
} as const;

export const settingsRepository = {
  get(db: DbOrTx, userId: string): SettingsRow | undefined {
    const row = db.select().from(users).where(eq(users.id, userId)).get();
    return row ? mapRow(row) : undefined;
  },

  setTheme(db: DbOrTx, userId: string, theme: User['themePreference'], now: number): void {
    db.update(users).set({ themePreference: theme, updatedAt: toDate(now) }).where(eq(users.id, userId)).run();
  },

  setNotifications(
    db: DbOrTx,
    userId: string,
    v: { notifyPaymentReminders?: boolean; notifyWeeklySummary?: boolean; reminderHour?: number },
    now: number,
  ): void {
    const set: Partial<typeof users.$inferInsert> = { updatedAt: toDate(now) };
    if (v.notifyPaymentReminders !== undefined) set.notifyPaymentReminders = v.notifyPaymentReminders;
    if (v.notifyWeeklySummary !== undefined) set.notifyWeeklySummary = v.notifyWeeklySummary;
    if (v.reminderHour !== undefined) set.reminderHour = v.reminderHour;
    db.update(users).set(set).where(eq(users.id, userId)).run();
  },

  /** Valor del flag de un widget: null (nunca decidido), 1 (activo) o 0 (apagado). */
  getWidget(db: DbOrTx, userId: string, widget: WidgetKey): number | null {
    const row = settingsRepository.get(db, userId);
    return row ? row[WIDGET_COLUMN[widget]] : null;
  },

  /** Fija el flag a 1 o 0 (decision del usuario). */
  setWidget(db: DbOrTx, userId: string, widget: WidgetKey, on: boolean, now: number): void {
    db.update(users)
      .set({ [WIDGET_COLUMN[widget]]: on ? 1 : 0, updatedAt: toDate(now) })
      .where(eq(users.id, userId))
      .run();
  },

  /** Activacion automatica: solo si el flag es NULL (`UPDATE ... SET w = 1 WHERE w IS NULL`). */
  autoActivateWidget(db: DbOrTx, userId: string, widget: WidgetKey, now: number): void {
    const column = users[WIDGET_COLUMN[widget]];
    db.update(users)
      .set({ [WIDGET_COLUMN[widget]]: 1, updatedAt: toDate(now) })
      .where(sql`${users.id} = ${userId} AND ${column} IS NULL`)
      .run();
  },

  markOnboardingCompleted(db: DbOrTx, userId: string, now: number): void {
    db.update(users)
      .set({ onboardingCompletedAt: toDate(now), updatedAt: toDate(now) })
      .where(eq(users.id, userId))
      .run();
  },
};
