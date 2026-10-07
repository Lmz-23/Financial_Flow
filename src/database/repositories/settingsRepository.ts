// PROPIEDAD DEL USUARIO (decision de diseno): toda funcion de este repositorio recibe `(db, userId, ...)`.
// Aqui `userId` es la propia identidad del usuario (la tabla es `users`): cada consulta filtra por
// `users.id = userId` EN LA CONSULTA (WHERE); no se delega en que el servicio lo haya comprobado antes.
// No tiene `insert`: el usuario se crea en src/database/seed.ts. `getWidget` delega en `get(db, userId)`.
// Los mutadores (`setTheme`, `setNotifications`, `setWidget`, `autoActivateWidget`, `markOnboardingCompleted`)
// son `void` y NO devuelven el numero de filas afectadas (un `userId` inexistente es un UPDATE de 0 filas).
// Guarda: test/unit/repositoryOwnership.test.ts (analisis AST: firma `(db, userId, ...)` y un `.where(...)`
// que referencia `userId` en CADA consulta; en `autoActivateWidget` el `sql` con `${users.id}` y `${userId}`)
// y test/integration/repositories/ownership.test.ts (comportamiento con dos usuarios). LIMITES: la guarda
// comprueba que el `where` REFERENCIA `userId`, no que la columna o el operador sean correctos, y no inspecciona
// la clausula `.set({...})` de los `update`; eso lo cubren los tests de comportamiento y el fuzz (test/property).
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
