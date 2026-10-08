// =============================================================================
// CACHE DE AJUSTES (arquitectura 4.3)
// =============================================================================
// SQLite (tabla `users`) es la fuente de verdad. Este store solo guarda una copia que se carga al
// iniciar y se vuelve a cargar cuando un comando devuelve el efecto `settings`
// (src/app-services/startup.ts). Nunca se escribe directamente: se escribe a traves de
// `commands.settings.*`. No se persiste (adios AsyncStorage).
import { create } from 'zustand';

import type { SettingsRow, WidgetKey } from '../database/repositories/settingsRepository';
import type { ThemePreference } from '../theme/tokens';

export interface SettingsSnapshot {
  themePreference: ThemePreference;
  onboardingDone: boolean;
  /** Un widget esta activo solo con el flag en 1; NULL (nunca decidido) y 0 (apagado) no lo muestran. */
  widgets: Record<WidgetKey, boolean>;
  notifyPaymentReminders: boolean;
  notifyWeeklySummary: boolean;
  reminderHour: number;
}

export function toSettingsSnapshot(row: SettingsRow): SettingsSnapshot {
  return {
    themePreference: row.themePreference,
    onboardingDone: row.onboardingCompletedAt !== null,
    widgets: {
      cashflow: row.widgetCashflow === 1,
      debts: row.widgetDebts === 1,
      goals: row.widgetGoals === 1,
    },
    notifyPaymentReminders: row.notifyPaymentReminders,
    notifyWeeklySummary: row.notifyWeeklySummary,
    reminderHour: row.reminderHour,
  };
}

interface SettingsState {
  /** null hasta que se cargan de SQLite (la app no renderiza rutas antes). */
  settings: SettingsSnapshot | null;
  setFromRow: (row: SettingsRow) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  setFromRow: (row) => set({ settings: toSettingsSnapshot(row) }),
}));

/** Preferencia de tema; 'system' mientras los ajustes no estan cargados. */
export function useThemePreference(): ThemePreference {
  return useSettingsStore((s) => s.settings?.themePreference ?? 'system');
}

/** Ajustes cargados; lanza si se usa antes de la carga (los hooks viven bajo la compuerta del layout raiz). */
export function useSettings(): SettingsSnapshot {
  const settings = useSettingsStore((s) => s.settings);
  if (!settings) throw new Error('Los ajustes aun no se han cargado (app/_layout.tsx los espera).');
  return settings;
}
