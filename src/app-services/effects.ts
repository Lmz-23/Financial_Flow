// =============================================================================
// EJECUCION DE EFECTOS (arquitectura 3.4, P4)
// =============================================================================
// Los servicios devuelven `{ result, effects }` y nunca ejecutan los efectos. Esta funcion los
// ejecuta DESPUES del COMMIT: refresca las claves de la interfaz y pide reconciliar las
// notificaciones cuando el comando toco recurrentes, deudas o ajustes. Es pura respecto de sus
// dependencias (inyectadas) para poder probarla sin React Native.
import type { DomainEffects, RefreshKey } from '../domain/services/shared';

export interface EffectsDeps {
  invalidate: (keys: readonly RefreshKey[]) => void;
  reconcile: () => Promise<void>;
}

/** Claves que obligan a reconciliar notificaciones (arquitectura 7). */
const RECONCILE_KEYS: readonly RefreshKey[] = ['recurring', 'debts', 'settings'];

export function needsReconcile(effects: DomainEffects): boolean {
  return effects.reschedule.length > 0 || effects.refresh.some((key) => RECONCILE_KEYS.includes(key));
}

/**
 * Invalidacion posterior al COMMIT. La cache de ajustes se recarga ANTES de avisar a los hooks para
 * que lean valores nuevos; si esa recarga falla (p. ej. NotFoundError sin usuario) se registra un
 * aviso y la invalidacion de claves se ejecuta igualmente: los datos ya estan guardados.
 */
export function invalidateAfterCommit(
  keys: readonly RefreshKey[],
  refreshSettings: () => void,
  invalidate: (keys: readonly RefreshKey[]) => void,
): void {
  if (keys.includes('settings')) {
    try {
      refreshSettings();
    } catch (error) {
      console.warn('Fallo la recarga de la cache de ajustes:', error);
    }
  }
  invalidate(keys);
}

export function runEffects(effects: DomainEffects, deps: EffectsDeps): void {
  if (effects.refresh.length > 0) {
    // Tras el COMMIT ningun fallo de la interfaz puede romper el comando (los datos ya se guardaron).
    try {
      deps.invalidate(effects.refresh);
    } catch (error) {
      console.warn('Fallo la invalidacion de la interfaz:', error);
    }
  }
  if (needsReconcile(effects)) {
    // Sin await: la reconciliacion es asincrona e idempotente y no debe retrasar la interfaz.
    void deps.reconcile().catch((error) => {
      console.warn('Fallo la reconciliacion de notificaciones:', error);
    });
  }
}
