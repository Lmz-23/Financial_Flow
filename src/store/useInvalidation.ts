// =============================================================================
// STORE DE INVALIDACION (arquitectura 4.1)
// =============================================================================
// Un contador por clave de refresco. Cada comando (src/app-services) lo incrementa DESPUES del
// COMMIT y los hooks vuelven a consultar cuando cambia el contador de las claves a las que se
// suscriben. No guarda datos financieros (4.3): solo versiones.
import { create } from 'zustand';

import type { RefreshKey } from '../domain/services/shared';

export const REFRESH_KEYS: readonly RefreshKey[] = [
  'accounts',
  'transactions',
  'debts',
  'goals',
  'recurring',
  'settings',
  'statement',
];

type Versions = Record<RefreshKey, number>;

interface InvalidationState {
  versions: Versions;
  /** Incrementa las claves dadas (los duplicados cuentan una vez por llamada). */
  invalidate: (keys: readonly RefreshKey[]) => void;
  /** Incrementa todas (p. ej. al volver a primer plano: cambio de dia o de mes). */
  invalidateAll: () => void;
}

const initialVersions = (): Versions => ({
  accounts: 0,
  transactions: 0,
  debts: 0,
  goals: 0,
  recurring: 0,
  settings: 0,
  statement: 0,
});

export const useInvalidation = create<InvalidationState>((set) => ({
  versions: initialVersions(),
  invalidate: (keys) =>
    set((state) => {
      const next = { ...state.versions };
      for (const key of new Set(keys)) next[key] += 1;
      return { versions: next };
    }),
  invalidateAll: () =>
    set((state) => {
      const next = { ...state.versions };
      for (const key of REFRESH_KEYS) next[key] += 1;
      return { versions: next };
    }),
}));

/** Suma de las versiones de las claves: cambia cuando cualquiera de ellas se invalida. */
export function useInvalidationVersion(keys: readonly RefreshKey[]): number {
  return useInvalidation((state) => keys.reduce((total, key) => total + state.versions[key], 0));
}
