// GUARDA ESTRUCTURAL (por AST) de la propiedad del usuario en repositorios y servicios.
//
// El analizador vive en test/helpers/repositoryAst.ts (lee ahi sus reglas R1-R7/S1-S2 y sus LIMITES). Aqui:
//  1. se aplica sobre el codigo REAL: cada `src/database/repositories/*Repository.ts` descubierto en disco
//     y cada `src/domain/services/*.ts` (un repositorio o servicio nuevo no se escapa por no estar en una lista);
//  2. se prueba el PROPIO analizador con fuentes sinteticas (aceptadas y rechazadas) que incluyen los casos
//     evasivos que la guarda anterior (regex sobre `fn.toString()` y sobre lineas) NO detectaba;
//  3. se aplican mutaciones en memoria sobre el codigo real y se comprueba que el analizador las rechaza.
//
// QUE NO VERIFICA (limites honestos; los cubren los tests de comportamiento y el fuzz):
//  - que el `where` referencie `userId` NO prueba que la semantica sea correcta: no valida que la columna
//    pertenezca a la tabla consultada, ni el operador logico (`or(eq(t.userId, userId), <otra cosa>)` pasa),
//    ni las tablas unidas con JOIN, ni el resto del predicado;
//  - `eq/and/or/sql` se reconocen por nombre, no por origen (drizzle-orm);
//  - la clausula `.set(...)` de los `update` SI se inspecciona (R7: sin `userId`, spread ni claves calculadas
//    arbitrarias; caso i1s), pero solo en los repositorios: un UPDATE por SQL crudo fuera de ellos lo para la BD
//    (trigger OWNER_IMMUTABLE de 0001_owner_triggers.sql); el `sql` solo exige un `${userId}` y una columna de
//    propietario, sin relacionarlos, y cualquier `<x>.userId` cuenta como columna (incluso `row.userId`);
//  - un segundo `.where` fuera de la cadena, las asignaciones posteriores al `export const` (monkeypatch,
//    `Object.assign`, sobrescribir un metodo), las consultas dentro de helpers de modulo, los alias de `userId`
//    y los servicios que creen filas con un metodo distinto de `insert` quedan fuera del analisis;
//  - fuera de `insert(db, v)` ninguna funcion puede insertar con `userId` (R5/R6) y un array `const` de
//    condiciones que recibe el filtro solo por `.push` se rechaza (ambos conservadores);
//  - el analizador usa `parseDiagnostics`, API interna de TypeScript (comprobada con `~6.0.3`): puede romperse
//    al actualizar `typescript`. Detalle de cada limite en la cabecera de test/helpers/repositoryAst.ts;
//  - que `ctx.userId` sea el del contexto correcto (lo decide createDomain);
//  - la integridad entre usuarios en la BD: la imponen los triggers (test/integration/schema/owner_triggers.test.ts).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  analyzeRepositorySource,
  analyzeServiceSource,
  formatViolations,
} from '../helpers/repositoryAst';

const REPO_DIR = path.resolve(__dirname, '../../src/database/repositories');
const SERVICES_DIR = path.resolve(__dirname, '../../src/domain/services');

const repoFiles = fs
  .readdirSync(REPO_DIR)
  .filter((f) => /Repository\.ts$/.test(f))
  .sort();
const serviceFiles = fs
  .readdirSync(SERVICES_DIR)
  .filter((f) => f.endsWith('.ts'))
  .sort();

// ============================================================================ codigo REAL

describe('guarda estructural (AST): repositorios reales', () => {
  it('hay repositorios que inspeccionar', () => {
    expect(repoFiles.length).toBeGreaterThanOrEqual(10);
  });

  it.each(repoFiles)('%s: cada funcion recibe (db, userId, ...) y TODA consulta filtra por userId', async (file) => {
    const src = fs.readFileSync(path.join(REPO_DIR, file), 'utf8');
    const { violations, functions } = analyzeRepositorySource(file, src);
    expect(formatViolations(violations), `Repositorio sin userId estructural:\n  ${formatViolations(violations).join('\n  ')}`).toEqual([]);
    // El analizador ve exactamente las funciones que expone el objeto cargado (no hay miembros invisibles).
    const mod = (await import(path.join(REPO_DIR, file))) as Record<string, Record<string, unknown>>;
    const repoName = file.replace(/\.ts$/, '');
    expect(Object.keys(mod), `${file} debe exportar solo el objeto ${repoName}`).toEqual([repoName]);
    expect([...functions].sort()).toEqual(Object.keys(mod[repoName]).sort());
    expect(functions.length).toBeGreaterThan(0);
  });
});

describe('guarda estructural (AST): los INSERT de los servicios llevan el userId del contexto', () => {
  it('hay servicios con inserts que inspeccionar', () => {
    const total = serviceFiles
      .map((f) => analyzeServiceSource(f, fs.readFileSync(path.join(SERVICES_DIR, f), 'utf8')).insertCalls)
      .reduce((a, b) => a + b, 0);
    expect(total).toBeGreaterThanOrEqual(18);
  });

  it.each(serviceFiles)('%s: cada <x>.insert(...) pasa UNA unica propiedad `userId: ctx.userId`', (file) => {
    const { violations } = analyzeServiceSource(file, fs.readFileSync(path.join(SERVICES_DIR, file), 'utf8'));
    expect(formatViolations(violations), `INSERT sin userId: ctx.userId:\n  ${formatViolations(violations).join('\n  ')}`).toEqual([]);
  });
});

// ============================================================================ el PROPIO analizador

const HEAD = `import { and, eq, isNull, or, sql } from 'drizzle-orm';
const owned = (userId: string, id: string) => and(eq(accounts.id, id), eq(accounts.userId, userId));
`;

function repoSource(members: string, head = HEAD): string {
  return `${head}\nexport const fooRepository = {\n${members}\n};\n`;
}

function analyze(members: string, head = HEAD): string[] {
  return formatViolations(analyzeRepositorySource('fooRepository.ts', repoSource(members, head)).violations);
}

const ACCEPT: [string, string][] = [
  [
    'getById con helper verificado',
    `getById(db: DbOrTx, userId: string, id: string) { return db.select().from(accounts).where(owned(userId, id)).get(); }`,
  ],
  [
    'formato de varias lineas y orden de argumentos distinto',
    `getById(
       db: DbOrTx,
       userId: string,
       id: string,
     ) {
       return db
         .select()
         .from(accounts)
         .where(
           and(
             eq(accounts.id, id),
             eq(accounts.userId, userId),
           ),
         )
         .get();
     }`,
  ],
  [
    'eq con los operandos invertidos',
    `a(db: DbOrTx, userId: string) { return db.select().from(accounts).where(eq(userId, accounts.userId)).all(); }`,
  ],
  [
    'parametros por defecto con parentesis y desestructuracion en el 3.er parametro, con filtro correcto',
    `list(
       db: DbOrTx,
       userId: string,
       { limit = clamp(Math.max(1, 2)) }: { limit?: number } = {},
       since = new Date(Date.UTC(2020, 0, 1)),
     ) {
       return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
     }`,
  ],
  [
    'where en una variable con ternario: las dos ramas filtran',
    `list(db: DbOrTx, userId: string, status?: string) {
       const where = status ? and(eq(goals.userId, userId), eq(goals.status, status)) : eq(goals.userId, userId);
       return db.select().from(goals).where(where).all();
     }`,
  ],
  [
    'where con un ambito intermedio (or con filas del sistema) y and anidado',
    `a(db: DbOrTx, userId: string, type?: string) {
       const scope = or(eq(categories.userId, userId), isNull(categories.userId));
       const where = type ? and(eq(categories.type, type), scope) : and(eq(categories.isActive, true), scope);
       return db.select().from(categories).where(where).all();
     }`,
  ],
  [
    'lista de condiciones con spread y push',
    `a(db: DbOrTx, userId: string, f: { x?: string }) {
       const conditions = [eq(transactions.userId, userId)];
       if (f.x) conditions.push(eq(transactions.accountId, f.x));
       return db.select().from(transactions).where(and(...conditions)).all();
     }`,
  ],
  [
    'agregado de varias sumas, todas filtradas, con una subconsulta filtrada',
    `agg(db: DbOrTx, userId: string) {
       const a = db.select({ v: x }).from(accounts).where(eq(accounts.userId, userId)).get();
       const b = db.select({ v: y }).from(goals).where(and(eq(goals.userId, userId), eq(goals.status, 'SPENT'))).get();
       const c = db.select().from(debts).where(and(eq(debts.userId, userId), inArray(debts.id, db.select({ id: transactions.debtId }).from(transactions).where(eq(transactions.userId, userId))))).all();
       return [a, b, c];
     }`,
  ],
  [
    'sql con ${userId} y columna de propietario',
    'a(db: DbOrTx, userId: string, column: unknown) { db.update(users).set({ x: 1 }).where(sql`${users.id} = ${userId} AND ${column} IS NULL`).run(); }',
  ],
  [
    'update/delete con returning',
    `del(db: DbOrTx, userId: string, id: string): number {
       return db.delete(accounts).where(owned(userId, id)).returning({ id: accounts.id }).all().length;
     }`,
  ],
  [
    'delegacion en otro repositorio con (db, userId, ...)',
    `balance(db: DbOrTx, userId: string, id: string) { return otherRepository.sum(db, userId, { id }); }`,
  ],
  [
    'comentarios y cadenas que mencionan userId no molestan si el filtro es real',
    `a(db: DbOrTx, userId: string) {
       // userId
       const note = 'userId: ' + 1;
       return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
     }`,
  ],
  [
    'insert(db, v) con v.userId',
    `insert(db: DbOrTx, v: { userId: string; name: string }): string {
       db.insert(accounts).values({ id: 'x', userId: v.userId, name: v.name }).run();
       return 'x';
     }`,
  ],
  [
    'propiedad flecha en vez de metodo',
    `a: (db: DbOrTx, userId: string) => db.select().from(accounts).where(eq(accounts.userId, userId)).all(),`,
  ],
];

ACCEPT.push(
  [
    '(f3) desestructuracion cuyo userId es solo nombre de propiedad (control de falso positivo)',
    `nuevo(db: DbOrTx, userId: string, { userId: u }: { userId: string }) {
       return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
     }`,
  ]
);

const REJECT: [string, string, RegExp][] = [
  [
    '(a) comentario con userId y WHERE sin filtro',
    `getById(db: DbOrTx, userId: string, id: string) {
       // filtra por userId (mentira)
       return db.select().from(accounts).where(eq(accounts.id, id)).get();
     }`,
    /no filtra por userId/,
  ],
  [
    '(a2) cadena con userId y WHERE sin filtro',
    `getById(db: DbOrTx, userId: string, id: string) {
       const msg = 'userId';
       return db.select().from(accounts).where(sql\`\${accounts.id} = \${id} -- userId\`).get();
     }`,
    /no filtra por userId/,
  ],
  [
    '(b) void userId y WHERE sin filtro',
    `getById(db: DbOrTx, userId: string, id: string) {
       void userId;
       return db.select().from(accounts).where(eq(accounts.id, id)).get();
     }`,
    /uso de `userId` que no es un filtro|no filtra por userId/,
  ],
  [
    '(b2) void userId aunque el WHERE si filtre: uso no valido de userId',
    `a(db: DbOrTx, userId: string) {
       void userId;
       return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
     }`,
    /uso de `userId` que no es un filtro/,
  ],
  [
    '(e5) userId solo en un parametro por defecto posterior a otro con parentesis, sin filtro',
    `nuevo(db: DbOrTx, id = String(1), userId = 'default-user') {
       return db.select().from(accounts).where(eq(accounts.id, id)).get();
     }`,
    /2\.º parametro debe ser el identificador `userId`/,
  ],
  [
    '(e5b) userId en 2.º lugar pero con valor por defecto',
    `nuevo(db: DbOrTx, userId: string = 'default-user') {
       return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
     }`,
    /2\.º parametro debe ser el identificador `userId`/,
  ],
  [
    '(f2) desestructuracion en el 3.er parametro, userId solo en un comentario y sin filtro',
    `nuevo(db: DbOrTx, id: string, { limit }: { limit: number }) {
       // userId
       return db.select().from(accounts).where(eq(accounts.id, id)).limit(limit).all();
     }`,
    /2\.º parametro debe ser el identificador `userId`/,
  ],
  [
    'agregado con una suma SIN filtro',
    `agg(db: DbOrTx, userId: string) {
       const a = db.select({ v: x }).from(accounts).where(eq(accounts.userId, userId)).get();
       const b = db.select({ v: y }).from(goals).where(eq(goals.status, 'SPENT')).get();
       return [a, b];
     }`,
    /no filtra por userId/,
  ],
  [
    'agregado con una consulta sin where',
    `agg(db: DbOrTx, userId: string) {
       const a = db.select({ v: x }).from(accounts).where(eq(accounts.userId, userId)).get();
       const b = db.select({ v: y }).from(goals).get();
       return [a, b];
     }`,
    /sin `\.where\(\.\.\.\)`/,
  ],
  [
    '(v) precheck con getById y WHERE de borrado sin userId',
    `delete(db: DbOrTx, userId: string, id: string): number {
       if (!fooRepository.getById(db, userId, id)) return 0;
       return db.delete(goals).where(eq(goals.id, id)).returning({ id: goals.id }).all().length;
     }`,
    /no filtra por userId/,
  ],
  [
    'where con eq sobre la columna equivocada (id en vez de userId)',
    `a(db: DbOrTx, userId: string) { return db.select().from(accounts).where(eq(accounts.id, userId)).all(); }`,
    /no filtra por userId/,
  ],
  [
    'where con userId solo como nombre de propiedad y valor ajeno',
    `a(db: DbOrTx, userId: string, other: string) { return db.select().from(accounts).where(eq(accounts.userId, other)).all(); }`,
    /no filtra por userId/,
  ],
  [
    'ternario donde solo una rama filtra',
    `a(db: DbOrTx, userId: string, all: boolean) {
       const where = all ? sql\`1 = 1\` : eq(accounts.userId, userId);
       return db.select().from(accounts).where(where).all();
     }`,
    /no filtra por userId/,
  ],
  [
    'userId dentro de una comparacion/ternario en el where',
    `a(db: DbOrTx, userId: string) { return db.select().from(accounts).where(eq(accounts.userId, userId.length > 0 ? 'x' : userId)).all(); }`,
    /no filtra por userId|uso de `userId`/,
  ],
  [
    'dos where: el ultimo sustituye al primero',
    `a(db: DbOrTx, userId: string) { return db.select().from(accounts).where(eq(accounts.userId, userId)).where(sql\`1 = 1\`).all(); }`,
    /varios `\.where/,
  ],
  [
    'where en variable let reasignada',
    `a(db: DbOrTx, userId: string) {
       let where = eq(accounts.userId, userId);
       where = sql\`1 = 1\`;
       return db.select().from(accounts).where(where).all();
     }`,
    /no filtra por userId/,
  ],
  [
    'subconsulta filtrada dentro de una consulta exterior sin filtro',
    `a(db: DbOrTx, userId: string) {
       return db.select().from(accounts).where(inArray(accounts.id, db.select({ id: goals.id }).from(goals).where(eq(goals.userId, userId)))).all();
     }`,
    /no filtra por userId/,
  ],
  [
    'update sin where',
    `a(db: DbOrTx, userId: string) { return db.update(accounts).set({ name: 'x' }).returning({ id: accounts.id }).all().length; }`,
    /sin `\.where/,
  ],
  [
    'delete con where que usa un operador distinto (ne)',
    `a(db: DbOrTx, userId: string) { return db.delete(accounts).where(ne(accounts.userId, userId)).run(); }`,
    /no filtra por userId/,
  ],
  [
    'helper que no filtra por usuario',
    `a(db: DbOrTx, userId: string, id: string) { return db.select().from(accounts).where(bad(userId, id)).get(); }`,
    /no filtra por userId|helper bad/,
  ],
  [
    'userId redeclarado dentro del cuerpo',
    `a(db: DbOrTx, userId: string) {
       const userId2 = 1;
       const userId = 'default-user';
       return db.select().from(accounts).where(eq(accounts.userId, userId)).all();
     }`,
    /redeclara `userId`/,
  ],
  [
    'userId sin tipo string',
    `a(db: DbOrTx, userId) { return db.select().from(accounts).where(eq(accounts.userId, userId)).all(); }`,
    /tipo `string`/,
  ],
  [
    'segundo parametro renombrado (_userId)',
    `a(db: DbOrTx, _userId: string) { return db.select().from(accounts).where(eq(accounts.userId, _userId)).all(); }`,
    /2\.º parametro debe ser el identificador `userId`/,
  ],
  [
    'funcion async',
    `async a(db: DbOrTx, userId: string) { return db.select().from(accounts).where(eq(accounts.userId, userId)).all(); }`,
    /no debe ser async/,
  ],
  [
    'primer parametro distinto de db',
    `a(tx: DbOrTx, userId: string) { return tx.select().from(accounts).where(eq(accounts.userId, userId)).all(); }`,
    /1\.er parametro debe ser el identificador `db`/,
  ],
  [
    'SQL crudo con db.run',
    'a(db: DbOrTx, userId: string) { db.run(sql`delete from accounts`); return db.select().from(accounts).where(eq(accounts.userId, userId)).all(); }',
    /uso de `db` no permitido/,
  ],
  [
    'delegacion con un usuario fijo',
    `a(db: DbOrTx, userId: string, id: string) { return otherRepository.sum(db, 'default-user', { id }); }`,
    /la delegacion/,
  ],
  [
    'funcion que no consulta ni delega',
    `a(db: DbOrTx, userId: string, id: string) { return id; }`,
    /no consulta ni delega/,
  ],
  [
    'insert con otro userId',
    `insert(db: DbOrTx, v: { userId: string }): string {
       db.insert(accounts).values({ id: 'x', userId: 'default-user' }).run();
       return 'x';
     }`,
    /insert .*userId/,
  ],
  [
    'insert con spread que puede sobrescribir userId',
    `insert(db: DbOrTx, v: { userId: string }): string {
       db.insert(accounts).values({ userId: v.userId, ...v }).run();
       return 'x';
     }`,
    /spread/,
  ],
  [
    'insert con .values(variable)',
    `insert(db: DbOrTx, v: { userId: string }): string {
       const row = { userId: v.userId };
       db.insert(accounts).values(row).run();
       return 'x';
     }`,
    /literal de objeto/,
  ],
  [
    'insert sin userId en la fila',
    `insert(db: DbOrTx, v: { userId: string }): string {
       db.insert(accounts).values({ id: 'x' }).run();
       return 'x';
     }`,
    /no tiene la propiedad `userId`/,
  ],
  [
    'insert con userId en un comentario',
    `insert(db: DbOrTx, v: { userId: string }): string {
       db.insert(accounts).values({ id: 'x' /* userId: v.userId */ }).run();
       return 'x';
     }`,
    /no tiene la propiedad `userId`/,
  ],
];

// ---- R7: la clausula `.set(...)` de los update no puede reasignar `userId`.
const UPD = (setArg: string, pre = '') =>
  `rename(db: DbOrTx, userId: string, id: string, name: string) {
     ${pre}
     return db.update(accounts).set(${setArg}).where(owned(userId, id)).returning({ id: accounts.id }).all().length;
   }`;

ACCEPT.push(
  ['(R7) update con .set literal sin userId', UPD('{ name, updatedAt: new Date(0) }')],
  [
    '(R7) update con .set(set) construido con asignaciones x.campo = ... (patron de debt/goal/recurring)',
    UPD('set', 'const set: Record<string, unknown> = { updatedAt: new Date(0) };\n     if (name !== undefined) set.name = name;'),
  ],
);

REJECT.push(
  ['(R7) .set literal con userId', UPD("{ name, userId: 'otro-usuario' }"), /reasigna `userId`/],
  ['(R7) .set literal con la columna SQL user_id', UPD("{ name, user_id: 'otro-usuario' }"), /reasigna `userId`/],
  ['(R7) .set literal con userId shorthand', UPD('{ userId }'), /reasigna `userId`/],
  ['(R7) .set literal con spread', UPD('{ name, ...extra }', 'const extra = {};'), /spread/],
  ['(R7) .set con clave calculada arbitraria', UPD("{ [col]: 'x' }", "const col = 'userId';"), /clave calculada/],
  [
    '(R7) .set(set) con set.userId = ...',
    UPD('set', "const set: Record<string, unknown> = { name };\n     set.userId = 'otro-usuario';"),
    /`set\.userId = \.\.\.` reasigna `userId`/,
  ],
  [
    '(R7) .set(set) con set[k] = ...',
    UPD('set', "const set: Record<string, unknown> = { name };\n     set['user' + 'Id'] = 'x';"),
    /no verificable/,
  ],
  [
    '(R7) .set(set) alterado con Object.assign',
    UPD('set', "const set: Record<string, unknown> = { name };\n     Object.assign(set, { userId: 'x' });"),
    /no verificable/,
  ],
  [
    '(R7) .set(set) con spread en su literal',
    UPD('set', 'const set: Record<string, unknown> = { ...name };'),
    /spread/,
  ],
  ['(R7) .set(set) con let', UPD('set', 'let set: Record<string, unknown> = { name };'), /`const` con un literal/],
  ['(R7) .set(<llamada>) no verificable', UPD('build(name)'), /no es verificable/],
  [
    '(R6/R7) insert con onConflictDoUpdate (UPDATE encubierto)',
    `insert(db: DbOrTx, v: { userId: string }): string {
       db.insert(accounts).values({ id: 'x', userId: v.userId }).onConflictDoUpdate({ target: accounts.id, set: { userId: v.userId } }).run();
       return 'x';
     }`,
    /onConflictDoUpdate/,
  ],
);

describe('guarda estructural (AST): el propio analizador sobre fuentes sinteticas', () => {
  it.each(ACCEPT)('ACEPTA: %s', (_name, members) => {
    expect(analyze(members)).toEqual([]);
  });

  it.each(REJECT)('RECHAZA: %s', (_name, members, reason) => {
    const v = analyze(members);
    expect(v.length, 'debe haber al menos una violacion').toBeGreaterThan(0);
    expect(v.join('\n')).toMatch(reason);
    // El mensaje nombra repositorio y funcion.
    expect(v[0]).toMatch(/^fooRepository\.ts :: /);
  });

  it('(f4) un userId REDECLARADO por la desestructuracion del 3.er parametro si falla', () => {
    const v = analyze(
      `a(db: DbOrTx, userId: string, { userId }: { userId: string }) { return db.select().from(accounts).where(eq(accounts.userId, userId)).all(); }`,
    );
    expect(v.join('\n')).toMatch(/redeclara `userId`/);
  });

  it('(R7) clave calculada [MAPA[k]] con un const literal del archivo sin userId se acepta (patron de settings)', () => {
    const head = `${HEAD}const COL = { a: 'widgetCashflow', b: 'widgetDebts' } as const;\n`;
    expect(analyze(UPD("{ [COL[name as 'a']]: 1 }"), head)).toEqual([]);
  });

  it('(R7) clave calculada [MAPA[k]] se rechaza si el mapa contiene userId o se modifica', () => {
    const withOwner = `${HEAD}const COL = { a: 'widgetCashflow', b: 'userId' } as const;\n`;
    expect(analyze(UPD("{ [COL[name as 'a']]: 1 }"), withOwner).join('\n')).toMatch(/clave calculada/);
    const mutated = `${HEAD}const COL: Record<string, string> = { a: 'widgetCashflow' };\nCOL['a'] = 'userId';\n`;
    expect(analyze(UPD("{ [COL[name]]: 1 }"), mutated).join('\n')).toMatch(/clave calculada/);
    const passed = `${HEAD}const COL = { a: 'widgetCashflow' };\nObject.freeze(COL);\n`;
    expect(analyze(UPD("{ [COL[name as 'a']]: 1 }"), passed).join('\n')).toMatch(/clave calculada/);
    const destructured = `${HEAD}const COL: Record<string, string> = { a: 'widgetCashflow' };\n[COL['a']] = ['userId'];\n`;
    expect(analyze(UPD("{ [COL[name]]: 1 }"), destructured).join('\n')).toMatch(/clave calculada/);
    const forOf = `${HEAD}const COL: Record<string, string> = { a: 'widgetCashflow' };\nfor (COL['a'] of ['userId']) {}\n`;
    expect(analyze(UPD("{ [COL[name]]: 1 }"), forOf).join('\n')).toMatch(/clave calculada/);
  });

  it('exportaciones: funcion suelta, spread y miembro no funcion fallan', () => {
    const extra = analyzeRepositorySource(
      'fooRepository.ts',
      `${HEAD}
       export function suelta() { return 1; }
       export const fooRepository = { ...other, x: 3, y,
         a(db: DbOrTx, userId: string) { return db.select().from(accounts).where(eq(accounts.userId, userId)).all(); } };`,
    );
    const text = formatViolations(extra.violations).join('\n');
    expect(text).toMatch(/export de FunctionDeclaration no permitido/);
    expect(text).toMatch(/spread en el objeto/);
    expect(text).toMatch(/x: el repositorio solo debe exponer funciones/);
    expect(text).toMatch(/y: el repositorio solo debe exponer funciones/);
    expect(extra.functions).toEqual(['a']);
  });

  it('un archivo sin el objeto exportado falla; un error de sintaxis falla', () => {
    expect(formatViolations(analyzeRepositorySource('fooRepository.ts', 'const x = 1;').violations).join()).toMatch(
      /no exporta/,
    );
    expect(formatViolations(analyzeRepositorySource('fooRepository.ts', 'export const fooRepository = {').violations).join()).toMatch(
      /no se parsea/,
    );
  });
});

function svc(call: string): string[] {
  return formatViolations(analyzeServiceSource('FooService.ts', `function f(ctx, tx) {\n${call}\n}`).violations);
}

describe('guarda estructural (AST): el analizador de INSERT en servicios', () => {
  const ok: [string, string][] = [
    ['literal en una linea', `accountRepository.insert(tx, { userId: ctx.userId, name });`],
    [
      'literal de varias lineas (formato libre)',
      `const id = accountRepository.insert(
         tx,
         {
           name,
           // userId: 'default-user' en un comentario no cuenta
           userId: ctx.userId,
           order: 1,
         },
       );`,
    ],
    ['userId no es el primer campo', `accountRepository.insert(tx, { name, order: 1, userId: ctx.userId });`],
    ['alias de repositorio y db como primer argumento', `const repo = accountRepository; repo.insert(db, { userId: ctx.userId });`],
    ['clave entre comillas', `accountRepository.insert(tx, { 'userId': ctx.userId });`],
  ];
  it.each(ok)('ACEPTA: %s', (_n, call) => {
    expect(svc(call)).toEqual([]);
  });

  const bad: [string, string, RegExp][] = [
    ['(g3) ternario que sustituye el userId', `a.insert(tx, { userId: ctx.userId.length > 0 ? 'default-user' : ctx.userId });`, /no es la expresion exigida/],
    ['(h2) spread posterior que sobrescribe', `a.insert(tx, { userId: ctx.userId, ...{ userId: 'default-user' } });`, /spread/],
    ['(h2b) spread anterior', `a.insert(tx, { ...base, userId: ctx.userId });`, /spread/],
    ['(h3) comentario con ctx.userId y valor ajeno', `a.insert(tx, { /* userId: ctx.userId, */ userId: 'default-user' });`, /no es la expresion exigida/],
    ['segunda propiedad userId', `a.insert(tx, { userId: ctx.userId, userId: 'x' });`, /mas de una propiedad `userId`/],
    ['sin userId', `a.insert(tx, { name });`, /no tiene la propiedad `userId`/],
    ['shorthand userId', `const userId = ctx.userId; a.insert(tx, { userId });`, /shorthand/],
    ['valor con aserción no nula', `a.insert(tx, { userId: ctx.userId! });`, /no es la expresion exigida/],
    ['valor ctx?.userId', `a.insert(tx, { userId: ctx?.userId });`, /no es la expresion exigida/],
    ['valor de otro objeto', `a.insert(tx, { userId: other.userId });`, /no es la expresion exigida/],
    ['clave calculada', `a.insert(tx, { userId: ctx.userId, [key]: 'x' });`, /clave calculada/],
    ['argumento variable (no literal)', `const row = { userId: ctx.userId }; a.insert(tx, row);`, /literal de objeto/],
    ['sin segundo argumento', `a.insert(tx);`, /literal de objeto/],
    ['alias sin llamar', `const ins = accountRepository.insert; ins(tx, { userId: ctx.userId });`, /sin llamar/],
    ['acceso con corchetes', `accountRepository['insert'](tx, { userId: 'x' });`, /no se admite/],
    ['desestructuracion de insert', `const { insert } = accountRepository; insert(tx, { userId: 'x' });`, /desestructurar `insert`/],
  ];
  it.each(bad)('RECHAZA: %s', (_n, call, reason) => {
    const v = svc(call);
    expect(v.length).toBeGreaterThan(0);
    expect(v.join('\n')).toMatch(reason);
    expect(v[0]).toMatch(/^FooService\.ts :: linea \d+/);
  });
});

// ============================================================================ mutaciones en memoria

describe('guarda estructural (AST): mutaciones sobre el codigo REAL se rechazan', () => {
  const read = (file: string) => fs.readFileSync(path.join(REPO_DIR, file), 'utf8');
  const mutate = (file: string, from: string, to: string): string => {
    const src = read(file);
    expect(src, `la mutacion no encuentra el texto: ${from}`).toContain(from);
    return src.replace(from, to);
  };
  const fails = (file: string, mutated: string) => {
    const v = formatViolations(analyzeRepositorySource(file, mutated).violations);
    expect(v.length, `${file} mutado debia fallar`).toBeGreaterThan(0);
  };

  const cases: [string, string, string, string][] = [
    ['goal.delete sin userId en el WHERE (v)', 'goalRepository.ts', 'db.delete(goals).where(owned(userId, id))', 'db.delete(goals).where(eq(goals.id, id))'],
    ['account.getById: comentario en vez de filtro (a)', 'accountRepository.ts', '.from(accounts)\n      .where(owned(userId, id))', '.from(accounts)\n      // userId\n      .where(eq(accounts.id, id))'],
    ['report.monthAggregates: suma de metas SPENT sin userId (c4)', 'reportRepository.ts', "eq(goals.userId, userId),\n          eq(goals.status, 'SPENT'),\n          sql`${goals.spentAt}", "eq(goals.status, 'SPENT'),\n          sql`${goals.spentAt}"],
    ['debt.balancesByDebt: una de tres consultas sin filtro', 'debtRepository.ts', '.where(eq(debts.userId, userId))', '.where(eq(debts.status, 1))'],
    ['transaction.insert con otro userId (g3 analogo)', 'transactionRepository.ts', 'userId: v.userId,', "userId: 'default-user',"],
    ['account.availableOf: userId solo en void', 'accountRepository.ts', 'availableOf(db: DbOrTx, userId: string, id: string): number {', 'availableOf(db: DbOrTx, userId: string, id: string): number {\n    void userId;'],
    ['settings.get sin filtro por usuario', 'settingsRepository.ts', 'where(eq(users.id, userId)).get();\n    return row ? mapRow(row) : undefined;', 'where(eq(users.id, DEFAULT)).get();\n    return row ? mapRow(row) : undefined;'],
    ['adjustment.targetWhere sin userId', 'adjustmentRepository.ts', 'return and(eq(balanceAdjustments.userId, userId), ofTarget);', 'return and(ofTarget);'],
    // i1s (ARCHITECTURE.md, 2026-10-07): un update que reasigna userId a otro usuario. Antes no lo veia ningun mecanismo.
    ["account.rename reasigna userId (i1s)", 'accountRepository.ts', '.set({ name, updatedAt: toDate(now) })', ".set({ name, userId: 'otro-usuario', updatedAt: toDate(now) })"],
    ['goal.update con set.userId = (i1s, variante .set(set))', 'goalRepository.ts', 'if (v.name !== undefined) set.name = v.name;', "if (v.name !== undefined) set.name = v.name;\n    set.userId = 'otro-usuario';"],
    ['recurring.update con spread en el set (i1s, variante spread)', 'recurringRepository.ts', 'const set: Partial<typeof recurringItems.$inferInsert> = { updatedAt: toDate(v.now) };', 'const set: Partial<typeof recurringItems.$inferInsert> = { ...v, updatedAt: toDate(v.now) };'],
  ];
  it.each(cases)('%s', (_n, file, from, to) => {
    fails(file, mutate(file, from, to));
  });
});
