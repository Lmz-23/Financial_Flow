import { useEffect, useMemo } from 'react';
import type { ErrorBoundaryProps } from 'expo-router';

import { createFailureStreak, safeErrorLogArgs } from '../../lib/errorScreen';
import { useInvalidation } from '../../store/useInvalidation';
import { ErrorScreen } from './ErrorScreen';

// Expo Router desmonta la pantalla de error mientras reintenta (renderiza el arbol), asi que la
// racha vive fuera del componente. Si el reintento falla, la pantalla se vuelve a montar en el
// mismo commit; si tiene exito, se desmonta y no vuelve: ese desmontaje sin remontaje reinicia la
// racha (ver el temporizador de limpieza).
const streak = createFailureStreak();
let resetTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Error boundary reutilizable de Expo Router: se exporta como `ErrorBoundary` desde un layout
 * (`export { RouteErrorBoundary as ErrorBoundary }`). Cubre solo el subarbol de ese layout.
 */
export function RouteErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  // `show` es idempotente para el mismo error, asi que el render doble de StrictMode no cambia el resultado.
  const count = streak.show(error);

  useEffect(() => {
    if (resetTimer) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }
    return () => {
      resetTimer = setTimeout(() => {
        resetTimer = null;
        streak.reset();
      }, 0);
    };
  }, []);

  useEffect(() => {
    console.error(...safeErrorLogArgs('Error al renderizar una ruta.', error));
  }, [error]);

  const onRetry = useMemo(
    () => async () => {
      streak.retryRequested();
      try {
        useInvalidation.getState().invalidateAll();
      } catch (err) {
        console.error(...safeErrorLogArgs('Falló la invalidación al reintentar.', err));
      }
      try {
        await retry();
      } catch (err) {
        console.error(...safeErrorLogArgs('Falló el reintento de la ruta.', err));
      }
    },
    [retry],
  );

  return <ErrorScreen failureCount={count} onRetry={onRetry} />;
}
