// =============================================================================
// PRUEBA ALEATORIA CON MODELO DE REFERENCIA INDEPENDIENTE
// =============================================================================
// Que es: por cada semilla se crea una BD en memoria con DOS usuarios (el principal y "otro", con datos
// de todas las clases) y se ejecutan N operaciones aleatorias sobre los servicios de dominio. Un modelo
// propio (libro mayor, calendario, series y ETA con BigInt; ver model.ts y calendar.ts, sin importar
// reglas de src/domain) predice el resultado de cada operacion:
//   - ACEPTADA: se compara el estado completo (accounts.summary/get, debts.list, goals.list/get con `eta`,
//     reports.monthStatement/netWorth, recurring.list/upcoming, IntegrityService.check) y que el otro
//     usuario no cambie ni se mezcle con el principal.
//   - RECHAZADA: debe lanzar el error tipado que predice el modelo y dejar las 9 tablas identicas.
// Los ids del otro usuario se usan en todas las clases de operacion (y el otro usuario opera con ids del
// principal): el modelo los trata como inexistentes (NOT_FOUND).
//
// Determinismo: semillas fijas, reloj inyectado, TZ America/Bogota (vitest.config.ts; el calendario del
// modelo asume UTC-5). Nada depende de Date.now() ni de Math.random().
//
// Como se ejecuta:
//   MODO CORTO (por defecto; corre dentro de `npm run test:run`):
//       npx vitest run test/property
//   MODO COMPLETO (300 secuencias x 60 operaciones + 5 x 1000; varios minutos):
//       npm run test:property            (equivale a: FUZZ_FULL=1 vitest run test/property; Linux/macOS)
//     En Windows (sin cross-env) fija la variable antes: `set FUZZ_FULL=1 && npx vitest run test/property`.
//
// (FUZZ_STATS=1 imprime ademas el desglose por tipo de operacion, por codigo de error y la cobertura.)
//
// Como reproducir un fallo: el mensaje de error imprime la semilla, la longitud y las ultimas operaciones.
//       FUZZ_REPRO=<semilla>:<longitud> npx vitest run test/property
//   ejecuta SOLO esa secuencia e imprime su traza completa (misma semilla => mismas operaciones).
// =============================================================================
import { describe, expect, it } from 'vitest';
import { newStats, runSequence, type Stats } from './ops';

const FULL = process.env.FUZZ_FULL === '1';
const REPRO = process.env.FUZZ_REPRO;

/** Semillas: las secuencias cortas parten de 1000; las largas de 900000. */
const SHORT_SEED0 = 1000;
const LONG_SEED0 = 900_000;

// Presupuesto del modo corto: cubre todas las clases de operacion en pocos segundos.
const SHORT = { sequences: 24, length: 40 };
const COMPLETE = { sequences: 300, length: 60, longSequences: 5, longLength: 1000 };

/** Se detiene tras este numero de secuencias divergentes (la primera ya basta para reproducir). */
const MAX_FAILURES = 3;

interface Failure { seed: number; length: number; executed: number; message: string; tail: string[] }

function runMany(seeds: number[], length: number, stats: Stats): Failure[] {
  const failures: Failure[] = [];
  for (const seed of seeds) {
    const r = runSequence(seed, length, stats);
    if (r.divergence) {
      failures.push({ seed, length, executed: r.executed, message: r.divergence, tail: r.log.slice(-10) });
      if (failures.length >= MAX_FAILURES) break; // con un par de semillas basta para depurar
    }
  }
  return failures;
}

function report(label: string, stats: Stats, failures: Failure[], startedAt: number): void {
  const accepted = Object.values(stats.accepted).reduce((a, b) => a + b, 0);
  const rejected = Object.values(stats.rejected).reduce((a, b) => a + b, 0);
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.info(
    `[property] ${label}: operaciones=${stats.ops} aceptadas=${accepted} rechazadas=${rejected} ` +
      `divergencias=${failures.length} duracion=${seconds}s`,
  );
  if (FULL || REPRO || process.env.FUZZ_STATS === '1') {
    console.info('[property] aceptadas por tipo', JSON.stringify(stats.accepted));
    console.info('[property] rechazadas por tipo', JSON.stringify(stats.rejected));
    console.info('[property] rechazadas por codigo', JSON.stringify(stats.byCode));
    console.info('[property] cobertura', JSON.stringify(stats.coverage));
  }
}

function failureMessage(failures: Failure[]): string {
  return failures
    .slice(0, 3)
    .map(
      (f) =>
        `DIVERGENCIA semilla=${f.seed} longitud=${f.length} operacion=${f.executed}: ${f.message}\n` +
        `  reproducir: FUZZ_REPRO=${f.seed}:${f.length} npx vitest run test/property\n` +
        `  ultimas operaciones:\n    ${f.tail.join('\n    ')}`,
    )
    .join('\n');
}

describe('prueba aleatoria con modelo independiente', () => {
  it('la zona horaria de la prueba es America/Bogota (UTC-5), la que asume el calendario del modelo', () => {
    expect(new Date(2026, 5, 15, 12).getTimezoneOffset()).toBe(300);
  });

  if (REPRO) {
    it(`reproduce la secuencia ${REPRO}`, () => {
      const [seed, length] = REPRO.split(':').map(Number);
      const stats = newStats();
      const startedAt = Date.now();
      const result = runSequence(seed as number, length as number, stats);
      console.info(`[property] traza completa (${result.log.length} operaciones):\n${result.log.join('\n')}`);
      const failures: Failure[] = result.divergence
        ? [{ seed: seed as number, length: length as number, executed: result.executed, message: result.divergence, tail: [] }]
        : [];
      report(`repro ${REPRO}`, stats, failures, startedAt);
      expect(result.divergence, `semilla=${seed} longitud=${length}`).toBeNull();
    }, 600_000);
    return;
  }

  const seeds = (from: number, n: number): number[] => Array.from({ length: n }, (_, i) => from + i);

  it(
    FULL ? 'secuencias cortas (300 x 60)' : `secuencias del modo corto (${SHORT.sequences} x ${SHORT.length})`,
    () => {
      const cfg = FULL ? COMPLETE : SHORT;
      const stats = newStats();
      const startedAt = Date.now();
      const failures = runMany(seeds(SHORT_SEED0, cfg.sequences), cfg.length, stats);
      report(`${cfg.sequences}x${cfg.length}`, stats, failures, startedAt);
      expect(failures, failureMessage(failures)).toEqual([]);
    },
    // El modo corto debe terminar en segundos; el completo tarda minutos.
    FULL ? 3_600_000 : 120_000,
  );

  if (FULL) {
    it(`secuencias largas (${COMPLETE.longSequences} x ${COMPLETE.longLength})`, () => {
      const stats = newStats();
      const startedAt = Date.now();
      const failures = runMany(seeds(LONG_SEED0, COMPLETE.longSequences), COMPLETE.longLength, stats);
      report(`${COMPLETE.longSequences}x${COMPLETE.longLength}`, stats, failures, startedAt);
      expect(failures, failureMessage(failures)).toEqual([]);
    }, 3_600_000);
  }
});
