import { describe, expect, it, vi } from 'vitest';

import {
  createExclusiveRunner,
  createFailureStreak,
  ERROR_MESSAGE,
  ERROR_PERSISTENT_HINT,
  ERROR_TITLE,
  errorScreenCopy,
  nextFailureCount,
  safeErrorLogArgs,
  safeErrorName,
} from '../../../src/lib/errorScreen';

describe('nextFailureCount', () => {
  it('el fallo inicial es el 1.º y cada fallo tras reintento suma', () => {
    let n = nextFailureCount(0, false);
    expect(n).toBe(1);
    n = nextFailureCount(n, true);
    n = nextFailureCount(n, true);
    expect(n).toBe(3);
    expect(nextFailureCount(n, false)).toBe(1);
  });
  it('la linea de ayuda sale en la 3.ª pantalla de error (inicial + 2 reintentos fallidos)', () => {
    let n = nextFailureCount(0, false);
    expect(errorScreenCopy(n).hint).toBeNull();
    n = nextFailureCount(n, true);
    expect(errorScreenCopy(n).hint).toBeNull();
    n = nextFailureCount(n, true);
    expect(errorScreenCopy(n).hint).toBe(ERROR_PERSISTENT_HINT);
  });
});

describe('createFailureStreak', () => {
  it('fallos -> exito -> fallo nuevo no muestra la linea extra', () => {
    const s = createFailureStreak();
    expect(s.show(new Error('a'))).toBe(1);
    s.retryRequested();
    expect(s.show(new Error('b'))).toBe(2);
    s.retryRequested();
    s.reset(); // el reintento tuvo exito: la pantalla se fue y no volvio
    const fresh = s.show(new Error('c'));
    expect(fresh).toBe(1);
    expect(errorScreenCopy(fresh).hint).toBeNull();
  });
  it('tres pantallas consecutivas llegan al umbral', () => {
    const s = createFailureStreak();
    s.show(new Error('a'));
    s.retryRequested();
    s.show(new Error('b'));
    s.retryRequested();
    expect(errorScreenCopy(s.show(new Error('c'))).hint).toBe(ERROR_PERSISTENT_HINT);
  });
  it('es idempotente para el mismo error (StrictMode)', () => {
    const s = createFailureStreak();
    const e1 = new Error('a');
    expect(s.show(e1)).toBe(1);
    expect(s.show(e1)).toBe(1);
    s.retryRequested();
    const e2 = new Error('b');
    expect(s.show(e2)).toBe(2);
    expect(s.show(e2)).toBe(2);
  });
});

describe('errorScreenCopy', () => {
  it('usa el copy confirmado y sin linea extra por debajo de 3', () => {
    for (const n of [0, 1, 2]) {
      expect(errorScreenCopy(n)).toEqual({ title: ERROR_TITLE, message: ERROR_MESSAGE, hint: null });
    }
    expect(ERROR_TITLE).toBe('Algo salió mal');
    expect(ERROR_MESSAGE).toBe('No pudimos cargar la aplicación. Inténtalo de nuevo.');
  });
  it('añade la linea de ayuda desde el tercer fallo', () => {
    expect(errorScreenCopy(3).hint).toBe(ERROR_PERSISTENT_HINT);
    expect(errorScreenCopy(7).hint).toBe('Si el problema continúa, cierra la app y vuelve a abrirla.');
  });
});

describe('safeErrorName / safeErrorLogArgs', () => {
  it('devuelve solo el nombre, nunca el mensaje', () => {
    const err = new Error('INSERT INTO t VALUES (1500000) params: 1500000');
    err.name = 'DrizzleQueryError';
    const args = safeErrorLogArgs('Falló.', err);
    expect(args[1]).toBe('DrizzleQueryError');
    expect(JSON.stringify(args)).not.toContain('1500000');
  });
  it('tolera valores que no son Error y nombres raros', () => {
    expect(safeErrorName('texto con datos')).toBe('string');
    expect(safeErrorName(null)).toBe('object');
    const weird = new Error('x');
    weird.name = 'SELECT * FROM cuentas WHERE saldo=5';
    expect(safeErrorName(weird)).toBe('Error');
  });
});

describe('createExclusiveRunner', () => {
  it('ignora un segundo disparo mientras el primero sigue en curso', async () => {
    const run = createExclusiveRunner();
    let release!: () => void;
    const action = vi.fn(() => new Promise<void>((r) => (release = r)));
    const first = run(action);
    const second = await run(action);
    expect(second.ran).toBe(false);
    release();
    expect((await first).ran).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
  });
  it('permite otra ejecucion tras terminar, incluso si la accion lanzo', async () => {
    const run = createExclusiveRunner();
    await expect(run(() => Promise.reject(new Error('x')))).rejects.toThrow();
    expect((await run(() => 1)).ran).toBe(true);
  });
});
