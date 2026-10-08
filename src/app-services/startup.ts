// Arranque de la aplicacion: migraciones + semilla y carga de la cache de ajustes.
import { AppState } from 'react-native';

import { initializeDatabase } from '../database/initialize';
import { useInvalidation } from '../store/useInvalidation';
import { useSettingsStore } from '../store/useSettingsStore';
import { getDomain } from './domain';

/** Vuelve a leer los ajustes de SQLite y actualiza la cache (la fuente de verdad es la BD). */
export function refreshSettings(): void {
  useSettingsStore.getState().setFromRow(getDomain().settings.get());
}

/** Idempotente (comparte la promesa de `initializeDatabase`). Deja los ajustes en el store. */
export async function initializeApp(): Promise<void> {
  await initializeDatabase();
  refreshSettings();
}

/**
 * Al volver a primer plano se invalida todo: el mes en curso, "Hoy/Ayer" y el estado de los
 * proximos pagos dependen del reloj, no de un comando. Devuelve la funcion para desuscribirse.
 */
export function subscribeToForeground(): () => void {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') useInvalidation.getState().invalidateAll();
  });
  return () => subscription.remove();
}
