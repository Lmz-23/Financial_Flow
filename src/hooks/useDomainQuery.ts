// Consulta reactiva al dominio (arquitectura 4.1): ejecuta una consulta SINCRONA de solo lectura y
// la repite cuando cambia la version de alguna de las claves de invalidacion a las que se suscribe.
import { useState } from 'react';

import { getDomain } from '../app-services/domain';
import type { Domain } from '../domain/createDomain';
import type { RefreshKey } from '../domain/services/shared';
import { useInvalidationVersion } from '../store/useInvalidation';

/**
 * @param keys claves de refresco a las que se suscribe la consulta.
 * @param query consulta de solo lectura sobre el dominio (no abre transacciones).
 * @param inputKey identifica los argumentos de la consulta (id, limite...) para repetirla si cambian.
 */
export function useDomainQuery<T>(
  keys: readonly RefreshKey[],
  query: (domain: Domain) => T,
  inputKey = '',
): T {
  // Fuera de React Compiler: la consulta lee la BD (no es pura) y el compilador memoizaba
  // `query(getDomain())` solo por `query`, que es estable; al invalidar devolvia datos viejos
  // hasta que la pantalla se volvia a montar.
  'use no memo';
  const version = useInvalidationVersion(keys);
  const [snapshot, setSnapshot] = useState(() => ({ version, inputKey, data: query(getDomain()) }));
  if (snapshot.version === version && snapshot.inputKey === inputKey) return snapshot.data;
  // Patron "ajustar estado al cambiar una entrada" (sin efecto): se recalcula en el mismo render.
  const next = { version, inputKey, data: query(getDomain()) };
  setSnapshot(next);
  return next.data;
}
