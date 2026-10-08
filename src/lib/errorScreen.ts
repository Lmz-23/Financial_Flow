// Logica PURA de la pantalla de error compartida (fallo de arranque y error boundary de rutas).

export const ERROR_TITLE = 'Algo salió mal';
export const ERROR_MESSAGE = 'No pudimos cargar la aplicación. Inténtalo de nuevo.';
export const ERROR_RETRY_LABEL = 'Reintentar';
export const ERROR_PERSISTENT_HINT = 'Si el problema continúa, cierra la app y vuelve a abrirla.';

/** Número de pantallas de error consecutivas (la inicial cuenta como la 1.ª) para la línea de ayuda. */
export const PERSISTENT_FAILURE_THRESHOLD = 3;

/**
 * Pantallas de error consecutivas: un fallo que sigue a un reintento suma; un fallo que no sigue
 * a un reintento (primero, o nuevo tras un éxito) vuelve a empezar en 1.
 */
export function nextFailureCount(previous: number, followsRetry: boolean): number {
  return followsRetry ? previous + 1 : 1;
}

/**
 * Racha de fallos del error boundary. Pura (sin timers ni React). `show` es idempotente para el
 * mismo error (render doble de StrictMode); `retryRequested` marca que el siguiente fallo es
 * consecutivo; `reset` se llama cuando el reintento tuvo éxito (la pantalla se fue y no volvió).
 */
export function createFailureStreak() {
  let count = 0;
  let retryPending = false;
  let lastError: unknown = undefined;
  let hasLast = false;
  return {
    show(error: unknown): number {
      if (hasLast && error === lastError && !retryPending) return count;
      count = nextFailureCount(count, retryPending);
      retryPending = false;
      lastError = error;
      hasLast = true;
      return count;
    },
    retryRequested(): void {
      retryPending = true;
    },
    reset(): void {
      count = 0;
      retryPending = false;
      lastError = undefined;
      hasLast = false;
    },
  };
}

/** Textos visibles. Nunca incluye el mensaje de la excepcion ni datos del usuario. */
export function errorScreenCopy(failureCount: number): {
  title: string;
  message: string;
  hint: string | null;
} {
  return {
    title: ERROR_TITLE,
    message: ERROR_MESSAGE,
    hint: failureCount >= PERSISTENT_FAILURE_THRESHOLD ? ERROR_PERSISTENT_HINT : null,
  };
}

/**
 * Solo el tipo/nombre del error, para la consola. El mensaje y el objeto completo se omiten: los
 * errores de SQLite/Drizzle pueden traer SQL con parametros (datos financieros).
 */
export function safeErrorName(error: unknown): string {
  const name = error instanceof Error ? error.name : typeof error;
  return /^[A-Za-z0-9_]{1,60}$/.test(name) ? name : 'Error';
}

/** Argumentos fijos para `console.error`: texto constante + nombre del error. */
export function safeErrorLogArgs(context: string, error: unknown): [string, string] {
  return [`${context} Tipo de error:`, safeErrorName(error)];
}

/** Ejecuta `action` solo si no hay otra en curso (proteccion contra doble toque). */
export function createExclusiveRunner() {
  let running = false;
  return async function run<T>(action: () => Promise<T> | T): Promise<{ ran: boolean; value?: T }> {
    if (running) return { ran: false };
    running = true;
    try {
      return { ran: true, value: await action() };
    } finally {
      running = false;
    }
  };
}
