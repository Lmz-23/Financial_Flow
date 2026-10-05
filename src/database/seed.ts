import { categories, users } from './schema';
import type { AppDatabase } from './types';

// =============================================================================
// SEED: usuario por defecto y categorias base (sistema: userId NULL)
// =============================================================================
// Idempotente: ids deterministas + onConflictDoNothing (y los UNIQUE de categories lo respaldan).
// No importa expo-sqlite: recibe la BD por parametro (app: client.ts; tests: better-sqlite3).

// TODO: reemplazar 'default-user' por el id real cuando exista autenticacion.
export const DEFAULT_USER_ID = 'default-user';

export const DEFAULT_EXPENSE_CATEGORIES = ['Comida', 'Transporte', 'Servicios', 'Salud', 'Otro'] as const;
export const DEFAULT_INCOME_CATEGORIES = ['Sueldo', 'Freelance', 'Ventas', 'Regalo', 'Otro'] as const;

export function seedDatabase(db: AppDatabase, userId: string = DEFAULT_USER_ID): void {
  const now = new Date();

  db.transaction((tx) => {
    // Valores por defecto del esquema: COP, theme 'system', widgets en NULL, onboarding NULL.
    tx.insert(users)
      .values({ id: userId, createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .run();

    const rows = [
      ...DEFAULT_EXPENSE_CATEGORIES.map((name, order) => ({
        id: `sys_expense_${order + 1}`,
        userId: null,
        name,
        type: 'EXPENSE' as const,
        order,
        isActive: true,
        createdAt: now,
      })),
      ...DEFAULT_INCOME_CATEGORIES.map((name, order) => ({
        id: `sys_income_${order + 1}`,
        userId: null,
        name,
        type: 'INCOME' as const,
        order,
        isActive: true,
        createdAt: now,
      })),
    ];

    tx.insert(categories).values(rows).onConflictDoNothing().run();
  });
}
