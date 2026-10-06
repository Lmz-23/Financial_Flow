// GUARDA ESTRUCTURAL: ningun repositorio puede exponer una funcion que opere por id sin `userId`.
//
// Mecanismo (reflexion sobre el codigo cargado, sin depender de la memoria de nadie):
//  1. Se descubren los archivos `src/database/repositories/*Repository.ts` en disco, asi que un
//     repositorio NUEVO no puede escapar de la guarda por no estar en una lista.
//  2. Cada archivo debe exportar un unico objeto `<nombre>Repository`, y NO otras funciones sueltas
//     (una funcion exportada fuera del objeto no se inspeccionaria).
//  3. Para cada funcion del objeto se parsea la lista de parametros de `fn.toString()`
//     (los nombres se conservan porque vitest/esbuild no minifica):
//        regla: el parametro #1 es `db` y el parametro #2 es `userId`.
//        regla: el cuerpo USA `userId` (si la firma lo declara pero no se usa -p. ej. se renombra a
//               `_userId` o se deja sin usar- falla).
//  4. Excepcion UNICA y justificada: `insert`, que recibe `userId` dentro de la fila `v`
//     (`insert(db, v)`): se exige que el cuerpo use `v.userId` (la fila lleva el userId del contexto).
//     Cualquier otra funcion sin `userId` en la posicion 2 falla, tenga id o no: es mas simple y
//     estricto que adivinar por el nombre si "recibe un id".
// El mensaje de fallo nombra repositorio.funcion y la regla incumplida.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_DIR = path.resolve(__dirname, '../../src/database/repositories');

/** Excepciones: nombre de funcion -> justificacion. Mantener MINIMA. */
export const INSERT_EXCEPTION = 'insert';

/** Lista de nombres de parametros de una funcion (sin valores por defecto ni desestructuracion). */
export function paramNames(fn: (...a: never[]) => unknown): string[] {
  const src = Function.prototype.toString.call(fn);
  const open = src.indexOf('(');
  let depth = 0;
  let end = -1;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const inner = src.slice(open + 1, end);
  const parts: string[] = [];
  let d = 0;
  let cur = '';
  for (const ch of inner) {
    if (ch === '(' || ch === '[' || ch === '{') d++;
    else if (ch === ')' || ch === ']' || ch === '}') d--;
    if (ch === ',' && d === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.split('=')[0].trim());
}

/** Cuerpo de la funcion (todo lo que sigue a la lista de parametros). */
function body(fn: (...a: never[]) => unknown): string {
  const src = Function.prototype.toString.call(fn);
  return src.slice(src.indexOf(')') + 1);
}

/** Violaciones de la regla para un objeto repositorio. Exportada para probar la propia guarda. */
export function ownershipViolations(repoName: string, repo: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const [fnName, fn] of Object.entries(repo)) {
    const where = `${repoName}.${fnName}`;
    if (typeof fn !== 'function') {
      out.push(`${where}: el repositorio solo debe exponer funciones`);
      continue;
    }
    const f = fn as (...a: never[]) => unknown;
    if (/^\s*async\b/.test(Function.prototype.toString.call(f))) out.push(`${where}: no debe ser async`);
    const params = paramNames(f);
    if (params[0] !== 'db') out.push(`${where}: el primer parametro debe ser \`db\` (es \`${params[0]}\`)`);
    if (fnName === INSERT_EXCEPTION) {
      if (params[1] !== 'v' || !/\bv\.userId\b/.test(body(f))) {
        out.push(`${where}: insert(db, v) debe escribir \`v.userId\` en la fila`);
      }
      continue;
    }
    if (params[1] !== 'userId') {
      out.push(`${where}(${params.join(', ')}): el segundo parametro debe ser \`userId\` (convencion (db, userId, ...))`);
      continue;
    }
    if (!/\buserId\b/.test(body(f))) {
      out.push(`${where}: declara \`userId\` pero el cuerpo no lo usa (la consulta no filtra por usuario)`);
    }
  }
  return out;
}

const repoFiles = fs
  .readdirSync(REPO_DIR)
  .filter((f) => /Repository\.ts$/.test(f))
  .sort();

describe('guarda estructural: repositorios y userId', () => {
  it('hay repositorios que inspeccionar', () => {
    expect(repoFiles.length).toBeGreaterThanOrEqual(9);
  });

  it.each(repoFiles)('%s: cada funcion recibe (db, userId, ...) y filtra por userId', async (file) => {
    const mod = (await import(path.join(REPO_DIR, file))) as Record<string, unknown>;
    const repoName = file.replace(/\.ts$/, '');
    const exported = Object.keys(mod);
    // Un solo export de valor: el objeto repositorio (los tipos no existen en runtime).
    expect(exported, `${file} debe exportar solo el objeto ${repoName}`).toEqual([repoName]);
    const violations = ownershipViolations(repoName, mod[repoName] as Record<string, unknown>);
    expect(violations, `Repositorio sin userId estructural:\n  ${violations.join('\n  ')}`).toEqual([]);
  });

  it('el detector funciona: marca una funcion ofensora y acepta las correctas', () => {
    const bad = ownershipViolations('fooRepository', {
      insert: (db: unknown, v: { userId: string }) => v.userId,
      okById: (db: unknown, userId: string, id: string) => [userId, id],
      sinUserId: (db: unknown, id: string) => id,
      userIdAlFinal: (db: unknown, id: string, userId: string) => [id, userId],
      userIdSinUsar: (db: unknown, userId: string, id: string) => id,
      insertSinUserId: undefined,
    });
    expect(bad.map((m) => m.split(':')[0].split('(')[0])).toEqual([
      'fooRepository.sinUserId',
      'fooRepository.userIdAlFinal',
      'fooRepository.userIdSinUsar',
      'fooRepository.insertSinUserId',
    ]);
  });
});

describe('guarda estructural: los INSERT de los servicios llevan el userId del contexto', () => {
  const SERVICES_DIR = path.resolve(__dirname, '../../src/domain/services');
  const files = fs.readdirSync(SERVICES_DIR).filter((f) => f.endsWith('.ts'));

  it.each(files)('%s: cada <x>Repository.insert(...) pasa `userId: ctx.userId` como primer campo', (file) => {
    const lines = fs.readFileSync(path.join(SERVICES_DIR, file), 'utf8').split('\n');
    const offenders: string[] = [];
    lines.forEach((line, i) => {
      if (/\w+Repository\.insert\(/.test(line) && !/userId: ctx\.userId/.test(lines[i + 1] ?? '')) {
        offenders.push(`${file}:${i + 1}: ${line.trim()}`);
      }
    });
    expect(offenders, `INSERT sin userId: ctx.userId:\n  ${offenders.join('\n  ')}`).toEqual([]);
  });
});

