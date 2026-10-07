// ANALIZADOR AST de la guarda estructural de propiedad del usuario (ver
// test/unit/repositoryOwnership.test.ts, que lo ejecuta sobre el codigo real y sobre fuentes sinteticas).
//
// Usa la API del compilador de TypeScript (`ts.createSourceFile` + recorrido de nodos): comentarios y
// cadenas NO existen en el arbol, asi que no hay heuristicas de texto. Nada se ejecuta ni se importa:
// solo se parsea (no resuelve tipos ni simbolos; es un analisis SINTACTICO y por nombres).
//
// ---------------------------------------------------------------------------------------------
// REGLAS PARA UN ARCHIVO `*Repository.ts` (`analyzeRepositorySource`)
// ---------------------------------------------------------------------------------------------
//  R1  El archivo exporta UN solo valor: `export const <archivo> = { ... }` (literal de objeto; se admiten
//      `as`/`satisfies`/parentesis). Ninguna otra exportacion de valor (funciones, `export *`, `export {x}`);
//      los `export type`/`interface` si. Cada miembro es un metodo `f(...) {}` o `f: (...) => ...`;
//      spread, getters/setters, claves calculadas o referencias (`f,`) fallan (no se podrian inspeccionar).
//  R2  Firma. 1.er parametro: identificador `db` (sin valor por defecto, `?` ni `...`).
//      2.º parametro:
//        - `insert`  (UNICA excepcion, por nombre): identificador simple (`v`) sin defecto; ver R6.
//        - resto: identificador `userId`, SIN valor por defecto, SIN `?`/`...`, tipo `string`.
//          Un `userId` desestructurado, con defecto u opcional falla (no se acepta ningun valor que
//          pueda venir "inventado" por la propia funcion).
//      3.er parametro en adelante: libres (defectos con parentesis, desestructuracion, tipos), siempre
//      que no REDECLAREN `userId`. Un `userId` solo presente en un valor por defecto no cuenta como uso.
//      La funcion no puede ser `async` ni generadora.
//  R3  CONSULTAS. Cada llamada `X.select/selectDistinct/update/delete(...)` (incluye subconsultas dentro
//      de argumentos y CADA consulta de un agregado) es la raiz de una cadena `.a().b()...`. Debe:
//        - colgar de `db` (otro receptor falla: tambien marca `Map.delete`; renombrar la variable);
//        - tener EXACTAMENTE un `.where(...)` (con dos, el ultimo sustituye al primero en drizzle);
//        - que ese `where` "filtre por usuario" (R4).
//      Cualquier otro uso de `db` (`db.run`, `db.transaction`, `db.query`, pasarlo a una funcion cualquiera)
//      falla; solo se admite `db` como receptor de las 5 operaciones y como 1.er argumento de
//      `<x>Repository.f(db, userId, ...)` (delegacion).
//  R4  "Filtra por usuario" (`satisfies`): el argumento del `where` se evalua estructuralmente:
//        - `eq(col, userId)` / `eq(userId, col)` con `col` = `<tabla>.userId` (o `users.id`);
//        - `and(...)`/`or(...)`: basta UN argumento que filtre (incluido `...lista` si la lista es un `const`
//          literal de array con algun elemento que filtre y solo se modifica con `.push`);
//        - ternario: filtran LAS DOS ramas (la condicion no cuenta);
//        - llamada a un helper del propio archivo (`owned(userId, id)`, `targetWhere(...)`) que la propia
//          guarda verifica con el mismo metodo: tiene un parametro `userId`, y TODOS sus `return` filtran;
//          el argumento en esa posicion debe ser `userId`;
//        - plantilla etiquetada `sql\`...\`` con un tramo `${userId}` y un tramo columna (`${t.userId}`/`${users.id}`);
//        - un identificador local `const` cuyo inicializador filtra (se resuelve; `let`/reasignado no vale).
//      `userId` cuenta SOLO como referencia de codigo (no nombre de propiedad `t.userId`, no clave `{userId: ..}`,
//      no texto de cadena/comentario, no tipo). No se desciende a subconsultas: una subconsulta que filtra
//      no hace que filtre la consulta exterior.
//  R5  Todo uso de `userId` (referencia de valor) debe ser un argumento directo de `eq(...)`, de un helper
//      verificado, de una delegacion `<x>Repository.f(db, userId, ...)` o un tramo de `sql\`...\``. `void userId`,
//      `[userId]`, `userId.length`, un ternario con `userId`, `console.log(userId)`, `const userId = ...`
//      (redeclaracion) fallan. Una funcion sin consultas debe delegar con `userId` en 2.ª posicion.
//      Las delegaciones `<x>Repository.f(...)` deben pasar `db` y `userId` literalmente.
//  R6  `insert(db, v)` (y cualquier `db.insert(t).values(...)`): `.values(...)` recibe UN literal de objeto con
//      UNA unica propiedad llamada `userId` (las demas columnas son libres), sin spread ni claves calculadas,
//      cuyo valor es `v.userId`. Solo `insert(db, v)` puede construir filas: en cualquier otra funcion el valor
//      exigido seria `userId: userId`, pero R5 rechaza esa referencia (no es un argumento de `eq`, de un helper,
//      de una delegacion ni un tramo de `sql`), asi que ninguna otra funcion puede insertar con `userId`
//      (falso positivo conocido y deliberado: `db.insert(t).values({ id, userId })` fuera de `insert` falla).
//
// ---------------------------------------------------------------------------------------------
// REGLAS PARA `src/domain/services/*.ts` (`analyzeServiceSource`)
// ---------------------------------------------------------------------------------------------
//  S1  TODA llamada `<cualquier receptor>.insert(...)` (incluye alias de repositorio y `tx` como 1.er arg):
//      el 2.º argumento debe ser un literal de objeto con UNA unica propiedad `userId` cuyo valor es
//      exactamente la expresion `ctx.userId`; sin spread (en ninguna posicion), sin claves calculadas, sin
//      ternarios, sin otra propiedad `userId`; el formato de lineas no importa. Si el argumento es una
//      variable, falla con un mensaje que explica que no es verificable.
//  S2  `x.insert` sin llamar (`const f = repo.insert`), `repo['insert'](...)` o `{ insert } = repo` fallan.
//
// ---------------------------------------------------------------------------------------------
// LIMITES (lo que este analizador NO verifica)
// ---------------------------------------------------------------------------------------------
//  - Comprueba que el `where` REFERENCIA `userId` en un `eq(<tabla>.userId, userId)` (o equivalente), no que
//    la semantica sea correcta: no valida que la tabla de la columna sea la consultada, ni el operador
//    logico (un `or(eq(t.userId, userId), sql\`1=1\`)` pasa: basta un disyunto), ni el resto del predicado.
//    Eso lo siguen cubriendo los tests de comportamiento (test/integration/repositories) y el fuzz.
//  - Los JOIN no se verifican: solo el `where` de la consulta (las tablas unidas no se filtran por usuario).
//  - `eq`, `and`, `or`, `sql` se reconocen por NOMBRE (no se comprueba que vengan de drizzle-orm).
//  - Alias de `db`/`userId` (`const u = userId`) no se siguen: usar el alias como filtro falla (R5); es
//    conservador. Las mutaciones de un array de condiciones distintas de `.push` hacen fallar (conservador).
//  - Un array `const` de condiciones que recibe el filtro SOLO por `.push` (`const c = []; c.push(eq(..));
//    and(...c)`) se rechaza: el literal debe contener ya algun elemento que filtre (conservador).
//  - La clausula `.set({...})` de los `update` NO se inspecciona: un `update` que reasignara `userId` a otro
//    usuario existente no lo veria ningun mecanismo (pendiente de cubrir).
//  - El `sql\`...\`` solo exige que existan un tramo `${userId}` y un tramo columna de propietario, sin
//    relacionarlos entre si. Cualquier `<x>.userId` cuenta como columna de propietario (incluso `row.userId`
//    de un parametro).
//  - Un segundo `.where` aplicado FUERA de la cadena (`const q = ...where(filtro); q.where(otro)`) sustituye
//    al filtro y el analizador no lo ve (lo cubre el comportamiento).
//  - Las asignaciones posteriores al `export const` (monkeypatch, `Object.assign`, sobrescribir un metodo) no
//    las ve R1: una clave nueva la atrapa la comparacion `functions == Object.keys` del test; una
//    sobrescritura de un metodo existente solo la atrapan los tests de comportamiento.
//  - Las consultas dentro de helpers de modulo no se analizan (R3 solo recorre las funciones del objeto
//    exportado); pero un helper con consultas debe recibir `db`, y pasar `db` a una funcion que no sea un
//    repositorio se rechaza (R3), asi que no puede usarse sin quedar a la vista.
//  - Un servicio que cree filas con un metodo de repositorio de otro nombre que `insert` queda fuera de S1.
//  - Un `userId` con alias (`const u = userId`) no se sigue (ver arriba).
//  - Usa `parseDiagnostics`, una API INTERNA (no publica) de TypeScript, para detectar errores de sintaxis
//    (comprobada con `typescript ~6.0.3`): puede romperse al actualizar `typescript`.
//  - Los servicios solo se vigilan en la forma `<x>.insert(...)`; que `ctx.userId` sea el del contexto
//    correcto depende de `createDomain`.
//  - No ejecuta nada: un repositorio con la forma correcta pero logica ajena al filtro no se detecta aqui.
import ts from 'typescript';

export interface Violation {
  file: string;
  /** Funcion/miembro/helper (o `lineaN` en servicios). */
  fn: string;
  reason: string;
}

export function formatViolations(vs: Violation[]): string[] {
  return vs.map((v) => `${v.file} :: ${v.fn}: ${v.reason}`);
}

const QUERY_METHODS = new Set(['select', 'selectDistinct', 'update', 'delete', 'insert']);
const REPOSITORY_CALLEE = /Repository$/;

// ------------------------------------------------------------------ utilidades de AST

function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

function syntaxErrors(sf: ts.SourceFile): number {
  return (sf as unknown as { parseDiagnostics: ts.Diagnostic[] }).parseDiagnostics.length;
}

/** Recorre el arbol; si `fn` devuelve `false` no desciende a los hijos. */
function visit(node: ts.Node, fn: (n: ts.Node) => boolean | void): void {
  if (fn(node) === false) return;
  ts.forEachChild(node, (c) => visit(c, fn));
}

function unwrap(e: ts.Expression): ts.Expression {
  let cur = e;
  while (
    ts.isParenthesizedExpression(cur) ||
    ts.isAsExpression(cur) ||
    ts.isSatisfiesExpression(cur) ||
    ts.isNonNullExpression(cur) ||
    ts.isTypeAssertionExpression(cur)
  ) {
    cur = cur.expression;
  }
  return cur;
}

type FunctionNode = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration;

function isFunctionNode(n: ts.Node): n is FunctionNode {
  return (
    ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)
  );
}

function isDeclarationName(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return false;
  return (
    (ts.isVariableDeclaration(p) ||
      ts.isParameter(p) ||
      ts.isBindingElement(p) ||
      ts.isFunctionDeclaration(p) ||
      ts.isFunctionExpression(p) ||
      ts.isClassDeclaration(p) ||
      ts.isClassExpression(p) ||
      ts.isImportSpecifier(p) ||
      ts.isImportClause(p) ||
      ts.isNamespaceImport(p) ||
      ts.isTypeParameterDeclaration(p) ||
      ts.isEnumMember(p)) &&
    p.name === id
  );
}

/** El identificador es una REFERENCIA de valor (no nombre de propiedad, clave, declaracion ni tipo). */
function isValueRef(id: ts.Identifier): boolean {
  const p = id.parent;
  if (!p) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false;
  if (ts.isPropertyAssignment(p) && p.name === id) return false;
  if (ts.isBindingElement(p) && p.propertyName === id) return false;
  if (ts.isQualifiedName(p)) return false;
  if (
    (ts.isMethodDeclaration(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isPropertySignature(p) ||
      ts.isMethodSignature(p) ||
      ts.isGetAccessorDeclaration(p) ||
      ts.isSetAccessorDeclaration(p)) &&
    p.name === id
  ) {
    return false;
  }
  if (isDeclarationName(id)) return false;
  if (ts.isTypeNode(p)) return false;
  return true;
}

function isUserIdRef(e: ts.Expression): boolean {
  const u = unwrap(e);
  return ts.isIdentifier(u) && u.text === 'userId' && isValueRef(u);
}

/** Columna que identifica al usuario: `<tabla>.userId` o `users.id`. */
function isOwnerColumn(e: ts.Expression): boolean {
  const u = unwrap(e);
  if (!ts.isPropertyAccessExpression(u)) return false;
  if (u.name.text === 'userId') return true;
  return u.name.text === 'id' && ts.isIdentifier(u.expression) && u.expression.text === 'users';
}

function memberName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return undefined;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

function line(sf: ts.SourceFile, n: ts.Node): number {
  return sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
}

/** Cadena de llamadas `root.a().b()...` hacia arriba. */
function chainCalls(root: ts.CallExpression): { name: string; call: ts.CallExpression }[] {
  const out: { name: string; call: ts.CallExpression }[] = [];
  let cur: ts.CallExpression = root;
  out.push({ name: (root.expression as ts.PropertyAccessExpression).name.text, call: root });
  for (;;) {
    const access = cur.parent;
    if (!access || !ts.isPropertyAccessExpression(access) || access.expression !== cur) break;
    const call = access.parent;
    if (!call || !ts.isCallExpression(call) || call.expression !== access) break;
    out.push({ name: access.name.text, call });
    cur = call;
  }
  return out;
}

// ------------------------------------------------------------------ analizador de repositorios

interface HelperInfo {
  node: FunctionNode;
  /** Indice del parametro `userId` (null = no es un helper de propiedad). */
  userIdIndex: number | null;
}

class RepositoryAnalyzer {
  readonly violations: Violation[] = [];
  readonly functions: string[] = [];
  private readonly helpers = new Map<string, HelperInfo>();
  private readonly helperState = new Map<string, number | null | 'pending'>();

  constructor(
    private readonly sf: ts.SourceFile,
    private readonly file: string,
    private readonly repoName: string,
  ) {}

  private add(fn: string, reason: string): void {
    this.violations.push({ file: this.file, fn, reason });
  }

  run(): void {
    if (syntaxErrors(this.sf) > 0) {
      this.add('(archivo)', 'el archivo no se parsea: errores de sintaxis');
      return;
    }
    this.collectHelpers();
    const object = this.findExportedObject();
    for (const name of this.helpers.keys()) this.verifyHelper(name);
    if (object) this.analyzeObject(object);
  }

  // ---- exportaciones (R1)
  private findExportedObject(): ts.ObjectLiteralExpression | undefined {
    let found: ts.ObjectLiteralExpression | undefined;
    for (const st of this.sf.statements) {
      const exported = ts.canHaveModifiers(st)
        ? ts.getModifiers(st)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
        : false;
      if (ts.isExportAssignment(st)) {
        this.add('(export)', 'export default no permitido: el repositorio debe ser `export const <archivo> = {...}`');
      } else if (ts.isExportDeclaration(st)) {
        if (!st.isTypeOnly) this.add('(export)', 'reexportaciones de valores no permitidas (no se inspeccionarian)');
      } else if (exported && ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          const n = ts.isIdentifier(d.name) ? d.name.text : '(patron)';
          const init = d.initializer ? unwrap(d.initializer) : undefined;
          if (n === this.repoName && init && ts.isObjectLiteralExpression(init)) found = init;
          else this.add('(export)', `export de valor no permitido: \`${n}\` (solo el objeto ${this.repoName})`);
        }
      } else if (exported && (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st))) {
        this.add('(export)', `export de ${ts.SyntaxKind[st.kind]} no permitido (solo el objeto ${this.repoName})`);
      }
    }
    if (!found) this.add('(export)', `no exporta \`export const ${this.repoName} = { ... }\` como literal de objeto`);
    return found;
  }

  // ---- helpers del archivo (R4)
  private collectHelpers(): void {
    for (const st of this.sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name) {
        this.helpers.set(st.name.text, { node: st, userIdIndex: this.userIdParamIndex(st) });
      } else if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          const init = d.initializer ? unwrap(d.initializer) : undefined;
          if (ts.isIdentifier(d.name) && init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
            this.helpers.set(d.name.text, { node: init, userIdIndex: this.userIdParamIndex(init) });
          }
        }
      }
    }
  }

  private userIdParamIndex(fn: FunctionNode): number | null {
    const i = fn.parameters.findIndex(
      (p) => ts.isIdentifier(p.name) && p.name.text === 'userId' && !p.initializer && !p.questionToken && !p.dotDotDotToken,
    );
    return i === -1 ? null : i;
  }

  /** Devuelve el indice del parametro `userId` si el helper filtra por usuario en TODOS sus `return`. */
  private verifyHelper(name: string): number | null {
    const state = this.helperState.get(name);
    if (state === 'pending') return null;
    if (state !== undefined) return state;
    const info = this.helpers.get(name);
    if (!info || info.userIdIndex === null) {
      this.helperState.set(name, null);
      return null;
    }
    this.helperState.set(name, 'pending');
    const fnName = `helper ${name}`;
    const node = info.node;
    let ok = true;
    if (node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) {
      this.add(fnName, 'no debe ser async');
      ok = false;
    }
    const returns: ts.Expression[] = [];
    if (node.body && !ts.isBlock(node.body)) returns.push(node.body);
    else if (node.body) {
      visit(node.body, (n) => {
        if (n !== node.body && isFunctionNode(n)) return false;
        if (ts.isReturnStatement(n) && n.expression) returns.push(n.expression);
      });
    }
    if (returns.length === 0) {
      this.add(fnName, 'no devuelve ninguna expresion de filtro');
      ok = false;
    }
    for (const r of returns) {
      if (!this.satisfies(r, node, new Set())) {
        this.add(fnName, 'un `return` del helper no filtra por `userId` (se espera eq(<tabla>.userId, userId) y similares)');
        ok = false;
      }
    }
    const before = this.violations.length;
    this.checkUserRefs(fnName, node, info.userIdIndex);
    if (this.violations.length > before) ok = false;
    const result = ok ? info.userIdIndex : null;
    this.helperState.set(name, result);
    return result;
  }

  // ---- satisfies (R4)
  private satisfies(expr: ts.Expression, scope: ts.Node, seen: Set<string>): boolean {
    const e = unwrap(expr);
    if (ts.isConditionalExpression(e)) {
      return this.satisfies(e.whenTrue, scope, seen) && this.satisfies(e.whenFalse, scope, seen);
    }
    if (ts.isCallExpression(e)) return this.callSatisfies(e, scope, seen);
    if (ts.isTaggedTemplateExpression(e)) return this.sqlSatisfies(e);
    if (ts.isIdentifier(e)) return this.variableSatisfies(e.text, scope, seen);
    return false;
  }

  private callSatisfies(call: ts.CallExpression, scope: ts.Node, seen: Set<string>): boolean {
    const callee = unwrap(call.expression);
    if (!ts.isIdentifier(callee)) return false;
    const args = call.arguments;
    if (callee.text === 'eq') {
      if (args.length !== 2) return false;
      return (isUserIdRef(args[0]) && isOwnerColumn(args[1])) || (isUserIdRef(args[1]) && isOwnerColumn(args[0]));
    }
    if (callee.text === 'and' || callee.text === 'or') {
      return args.some((a) =>
        ts.isSpreadElement(a) ? this.spreadSatisfies(a.expression, scope, seen) : this.satisfies(a, scope, seen),
      );
    }
    if (this.helpers.has(callee.text)) {
      const idx = this.verifyHelper(callee.text);
      return idx !== null && idx < args.length && isUserIdRef(args[idx]);
    }
    return false;
  }

  private sqlSatisfies(t: ts.TaggedTemplateExpression): boolean {
    const tag = unwrap(t.tag);
    if (!ts.isIdentifier(tag) || tag.text !== 'sql' || !ts.isTemplateExpression(t.template)) return false;
    const spans = t.template.templateSpans.map((s) => s.expression);
    return spans.some(isUserIdRef) && spans.some(isOwnerColumn);
  }

  private declarationsOf(scope: ts.Node, name: string): ts.VariableDeclaration[] {
    const out: ts.VariableDeclaration[] = [];
    visit(scope, (n) => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) out.push(n);
    });
    return out;
  }

  private variableSatisfies(name: string, scope: ts.Node, seen: Set<string>): boolean {
    if (seen.has(name)) return false;
    const decls = this.declarationsOf(scope, name);
    if (decls.length === 0) return false;
    const next = new Set(seen).add(name);
    let reassigned = false;
    visit(scope, (n) => {
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
        n.operatorToken.kind <= ts.SyntaxKind.LastAssignment
      ) {
        const left = unwrap(n.left);
        if (ts.isIdentifier(left) && left.text === name) reassigned = true;
      }
    });
    if (reassigned) return false;
    return decls.every(
      (d) =>
        !!d.initializer &&
        (d.parent.flags & ts.NodeFlags.Const) !== 0 &&
        this.satisfies(d.initializer, scope, next),
    );
  }

  /** `...lista`: `lista` es un `const` literal de array con algun elemento que filtra y solo se usa con `.push`. */
  private spreadSatisfies(expr: ts.Expression, scope: ts.Node, seen: Set<string>): boolean {
    const e = unwrap(expr);
    if (!ts.isIdentifier(e)) return false;
    const name = e.text;
    if (seen.has(`...${name}`)) return false;
    const decls = this.declarationsOf(scope, name);
    if (decls.length === 0) return false;
    let tampered = false;
    visit(scope, (n) => {
      if (!ts.isIdentifier(n) || n.text !== name || !isValueRef(n)) return;
      const p = n.parent;
      const isPush =
        ts.isPropertyAccessExpression(p) &&
        p.expression === n &&
        p.name.text === 'push' &&
        ts.isCallExpression(p.parent) &&
        p.parent.expression === p;
      const isSpread = ts.isSpreadElement(p);
      if (!isPush && !isSpread) tampered = true;
    });
    if (tampered) return false;
    const next = new Set(seen).add(`...${name}`);
    return decls.every((d) => {
      const init = d.initializer ? unwrap(d.initializer) : undefined;
      return (
        !!init &&
        (d.parent.flags & ts.NodeFlags.Const) !== 0 &&
        ts.isArrayLiteralExpression(init) &&
        init.elements.some((el) =>
          ts.isSpreadElement(el) ? this.spreadSatisfies(el.expression, scope, next) : this.satisfies(el, scope, next),
        )
      );
    });
  }

  // ---- usos de userId (R5)
  private isLegitUserIdUse(ref: ts.Identifier): boolean {
    let node: ts.Node = ref;
    while (
      node.parent &&
      (ts.isParenthesizedExpression(node.parent) ||
        ts.isAsExpression(node.parent) ||
        ts.isSatisfiesExpression(node.parent) ||
        ts.isNonNullExpression(node.parent))
    ) {
      node = node.parent;
    }
    const p = node.parent;
    if (!p) return false;
    if (ts.isCallExpression(p)) {
      const i = p.arguments.findIndex((a) => a === node);
      if (i === -1) return false;
      const callee = unwrap(p.expression);
      if (ts.isIdentifier(callee)) {
        if (callee.text === 'eq') return true;
        return this.helpers.has(callee.text) && this.verifyHelper(callee.text) === i;
      }
      if (
        ts.isPropertyAccessExpression(callee) &&
        ts.isIdentifier(callee.expression) &&
        REPOSITORY_CALLEE.test(callee.expression.text)
      ) {
        return i === 1;
      }
      return false;
    }
    if (ts.isTemplateSpan(p) && ts.isTemplateExpression(p.parent) && ts.isTaggedTemplateExpression(p.parent.parent)) {
      const tag = unwrap(p.parent.parent.tag);
      return ts.isIdentifier(tag) && tag.text === 'sql';
    }
    return false;
  }

  private checkUserRefs(fnName: string, fn: FunctionNode, ownIndex: number | null): void {
    const own = ownIndex !== null ? fn.parameters[ownIndex].name : undefined;
    visit(fn, (n) => {
      if (!ts.isIdentifier(n) || n.text !== 'userId' || n === own) return;
      if (isDeclarationName(n)) {
        this.add(fnName, 'redeclara `userId` (variable, parametro o desestructuracion): sombrea el userId de la firma');
      } else if (isValueRef(n) && !this.isLegitUserIdUse(n)) {
        this.add(
          fnName,
          `uso de \`userId\` que no es un filtro (linea ${line(this.sf, n)}): \`void userId\`, comparaciones o variables ` +
            'sin uso real no cuentan; el uso valido es eq(<columna>, userId) dentro de un where',
        );
      }
    });
  }

  // ---- objeto exportado (R1/R2)
  private analyzeObject(obj: ts.ObjectLiteralExpression): void {
    for (const m of obj.properties) {
      if (ts.isSpreadAssignment(m)) {
        this.add('(spread)', 'spread en el objeto del repositorio: sus funciones no se podrian inspeccionar');
        continue;
      }
      const name = memberName(m.name);
      if (name === undefined) {
        this.add('(miembro)', 'clave calculada o no estatica: no se puede nombrar ni inspeccionar');
        continue;
      }
      let fn: FunctionNode | undefined;
      if (ts.isMethodDeclaration(m)) fn = m;
      else if (ts.isPropertyAssignment(m)) {
        const init = unwrap(m.initializer);
        if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) fn = init;
      }
      if (!fn) {
        this.add(name, 'el repositorio solo debe exponer funciones declaradas en linea (metodo o flecha)');
        continue;
      }
      this.functions.push(name);
      this.analyzeFunction(name, fn);
    }
  }

  private analyzeFunction(name: string, fn: FunctionNode): void {
    const startViolations = this.violations.length;
    if (fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword)) this.add(name, 'no debe ser async');
    if (fn.asteriskToken) this.add(name, 'no debe ser generadora');
    if (!fn.body) {
      this.add(name, 'sin cuerpo');
      return;
    }
    const [p0, p1] = fn.parameters;
    const plain = (p: ts.ParameterDeclaration | undefined, id: string): boolean =>
      !!p && ts.isIdentifier(p.name) && p.name.text === id && !p.initializer && !p.questionToken && !p.dotDotDotToken;
    if (!plain(p0, 'db')) {
      this.add(name, 'el 1.er parametro debe ser el identificador `db` (sin defecto, `?` ni `...`)');
    }
    const isInsert = name === 'insert';
    let secondName: string | undefined;
    let ownIndex: number | null = null;
    if (isInsert) {
      if (p1 && ts.isIdentifier(p1.name) && !p1.initializer && !p1.questionToken && !p1.dotDotDotToken) {
        secondName = p1.name.text;
      } else this.add(name, 'insert(db, v): el 2.º parametro debe ser un identificador simple sin defecto');
    } else if (!plain(p1, 'userId')) {
      this.add(
        name,
        'el 2.º parametro debe ser el identificador `userId` (sin desestructurar, sin defecto, sin `?` ni `...`): ' +
          'convencion (db, userId, ...)',
      );
    } else {
      ownIndex = 1;
      if (!p1.type || p1.type.kind !== ts.SyntaxKind.StringKeyword) {
        this.add(name, 'el parametro `userId` debe tener el tipo `string`');
      }
    }

    this.checkUserRefs(name, fn, ownIndex);
    this.checkDbUsage(name, fn);

    // Consultas (R3) e inserciones (R6)
    let queries = 0;
    visit(fn.body, (n) => {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression)) return;
      const method = n.expression.name.text;
      if (!QUERY_METHODS.has(method)) return;
      queries++;
      this.checkQuery(name, fn, n, secondName);
    });

    // Delegaciones (R5)
    let delegations = 0;
    visit(fn.body, (n) => {
      if (!ts.isCallExpression(n)) return;
      const callee = unwrap(n.expression);
      if (
        !ts.isPropertyAccessExpression(callee) ||
        !ts.isIdentifier(callee.expression) ||
        !REPOSITORY_CALLEE.test(callee.expression.text)
      ) {
        return;
      }
      const target = `${callee.expression.text}.${callee.name.text}`;
      if (callee.name.text === 'insert') {
        this.add(name, `delegar en \`${target}\` no se admite dentro de un repositorio`);
        return;
      }
      const [a0, a1] = n.arguments;
      if (!a0 || !ts.isIdentifier(unwrap(a0)) || (unwrap(a0) as ts.Identifier).text !== 'db' || !a1 || !isUserIdRef(a1)) {
        this.add(name, `la delegacion \`${target}(...)\` debe pasar \`db\` y \`userId\` como 1.er y 2.º argumento`);
        return;
      }
      delegations++;
    });

    if (!isInsert && queries === 0 && delegations === 0 && this.violations.length === startViolations) {
      this.add(name, 'no consulta ni delega: `userId` no se usa en ningun filtro');
    }
  }

  /** `db` solo como receptor de select/update/delete/insert o 1.er argumento de `<x>Repository.f(db, ...)`. */
  private checkDbUsage(fnName: string, fn: FunctionNode): void {
    visit(fn, (n) => {
      if (!ts.isIdentifier(n) || n.text !== 'db' || !isValueRef(n)) return;
      const p = n.parent;
      if (
        ts.isPropertyAccessExpression(p) &&
        p.expression === n &&
        QUERY_METHODS.has(p.name.text) &&
        ts.isCallExpression(p.parent) &&
        p.parent.expression === p
      ) {
        return;
      }
      if (ts.isCallExpression(p) && p.arguments[0] === n) {
        const callee = unwrap(p.expression);
        if (
          ts.isPropertyAccessExpression(callee) &&
          ts.isIdentifier(callee.expression) &&
          REPOSITORY_CALLEE.test(callee.expression.text)
        ) {
          return;
        }
      }
      this.add(
        fnName,
        `uso de \`db\` no permitido (linea ${line(this.sf, n)}): solo db.select/update/delete/insert(...) o ` +
          'pasarlo como 1.er argumento de <x>Repository.f(db, userId, ...)',
      );
    });
  }

  private checkQuery(
    fnName: string,
    fn: FunctionNode,
    root: ts.CallExpression,
    secondName: string | undefined,
  ): void {
    const access = root.expression as ts.PropertyAccessExpression;
    const method = access.name.text;
    const at = `linea ${line(this.sf, root)}`;
    const receiver = unwrap(access.expression);
    if (!ts.isIdentifier(receiver) || receiver.text !== 'db') {
      this.add(fnName, `\`.${method}(...)\` (${at}) no cuelga de \`db\`: las consultas se construyen sobre el parametro db`);
      return;
    }
    const calls = chainCalls(root);
    if (method === 'insert') {
      this.checkInsertChain(fnName, calls, at, secondName);
      return;
    }
    const wheres = calls.filter((c) => c.name === 'where');
    if (wheres.length === 0) {
      this.add(fnName, `consulta \`${method}\` sin \`.where(...)\` (${at}): no filtra por usuario`);
      return;
    }
    if (wheres.length > 1) {
      this.add(fnName, `consulta \`${method}\` con varios \`.where(...)\` (${at}): el ultimo sustituye a los anteriores`);
      return;
    }
    const args = wheres[0].call.arguments;
    if (args.length !== 1 || !this.satisfies(args[0], fn, new Set())) {
      this.add(
        fnName,
        `el \`.where(...)\` de la consulta \`${method}\` (${at}) no filtra por userId: se espera eq(<tabla>.userId, userId), ` +
          'un helper verificado (owned/targetWhere) o un sql con ${userId}; un comentario, una cadena o un `void userId` no cuentan',
      );
    }
  }

  private checkInsertChain(
    fnName: string,
    calls: { name: string; call: ts.CallExpression }[],
    at: string,
    secondName: string | undefined,
  ): void {
    const values = calls.filter((c) => c.name === 'values');
    if (values.length !== 1 || values[0].call.arguments.length !== 1) {
      this.add(fnName, `insert (${at}): se espera exactamente un \`.values(<literal de objeto>)\``);
      return;
    }
    const arg = unwrap(values[0].call.arguments[0]);
    if (!ts.isObjectLiteralExpression(arg)) {
      this.add(fnName, `insert (${at}): \`.values(...)\` debe recibir un literal de objeto para poder verificar \`userId\``);
      return;
    }
    const problem = userIdPropertyProblem(arg, (init) => {
      if (fnName === 'insert') {
        return (
          !!secondName &&
          ts.isPropertyAccessExpression(init) &&
          ts.isIdentifier(init.expression) &&
          init.expression.text === secondName &&
          init.name.text === 'userId'
        );
      }
      return ts.isIdentifier(init) && init.text === 'userId';
    });
    if (problem) {
      const expected = fnName === 'insert' ? `userId: ${secondName ?? 'v'}.userId` : 'userId: userId';
      this.add(fnName, `insert (${at}): ${problem}; se exige una unica propiedad \`${expected}\``);
    }
  }
}

/**
 * Comprueba que el literal tiene UNA unica propiedad `userId` (PropertyAssignment) con un valor aceptado,
 * sin spread, claves calculadas ni metodos/accesores/shorthand que la sustituyan. Devuelve el problema o null.
 */
function userIdPropertyProblem(
  obj: ts.ObjectLiteralExpression,
  valueOk: (init: ts.Expression) => boolean,
): string | null {
  let found: ts.PropertyAssignment | undefined;
  for (const p of obj.properties) {
    if (ts.isSpreadAssignment(p)) return 'tiene un spread (`...x`) que podria sobrescribir `userId`';
    if (p.name && ts.isComputedPropertyName(p.name)) return 'tiene una clave calculada que podria sobrescribir `userId`';
    const n = memberName(p.name);
    if (n !== 'userId') continue;
    if (!ts.isPropertyAssignment(p)) return 'la propiedad `userId` es shorthand/metodo/accesor, no `userId: <expresion>`';
    if (found) return 'tiene mas de una propiedad `userId`';
    found = p;
  }
  if (!found) return 'no tiene la propiedad `userId`';
  if (!valueOk(found.initializer)) return 'el valor de `userId` no es la expresion exigida (sin ternarios, operadores ni otras expresiones)';
  return null;
}

export interface RepositoryAnalysis {
  violations: Violation[];
  /** Funciones inspeccionadas del objeto exportado (para no dar por buena una analisis vacio). */
  functions: string[];
}

/** Analiza el texto de un `*Repository.ts` (el nombre del objeto exportado es el del archivo sin `.ts`). */
export function analyzeRepositorySource(fileName: string, text: string): RepositoryAnalysis {
  const base = fileName.replace(/^.*[\\/]/, '').replace(/\.ts$/, '');
  const sf = parse(fileName, text);
  const a = new RepositoryAnalyzer(sf, fileName.replace(/^.*[\\/]/, ''), base);
  a.run();
  return { violations: a.violations, functions: a.functions };
}

// ------------------------------------------------------------------ analizador de servicios

export interface ServiceAnalysis {
  violations: Violation[];
  /** Numero de llamadas `<x>.insert(...)` inspeccionadas. */
  insertCalls: number;
}

function isCtxUserId(e: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(e) &&
    !e.questionDotToken &&
    ts.isIdentifier(e.expression) &&
    e.expression.text === 'ctx' &&
    e.name.text === 'userId'
  );
}

/** Analiza el texto de un archivo de `src/domain/services`. */
export function analyzeServiceSource(fileName: string, text: string): ServiceAnalysis {
  const file = fileName.replace(/^.*[\\/]/, '');
  const sf = parse(fileName, text);
  const violations: Violation[] = [];
  let insertCalls = 0;
  const add = (n: ts.Node, reason: string): void => {
    violations.push({ file, fn: `linea ${line(sf, n)}`, reason });
  };
  if (syntaxErrors(sf) > 0) {
    violations.push({ file, fn: '(archivo)', reason: 'el archivo no se parsea: errores de sintaxis' });
    return { violations, insertCalls };
  }
  visit(sf, (n) => {
    if (ts.isCallExpression(n)) {
      const callee = unwrap(n.expression);
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'insert') {
        insertCalls++;
        const arg = n.arguments[1] ? unwrap(n.arguments[1]) : undefined;
        if (!arg || !ts.isObjectLiteralExpression(arg)) {
          add(
            n,
            '`insert(...)` debe recibir como 2.º argumento un literal de objeto con `userId: ctx.userId`; con una variable ' +
              'o expresion no se puede verificar que lleve el userId del contexto (inlinea el literal)',
          );
        } else {
          const problem = userIdPropertyProblem(arg, isCtxUserId);
          if (problem) add(n, `\`insert(...)\`: ${problem}; se exige una unica propiedad \`userId: ctx.userId\``);
        }
      } else if (
        ts.isElementAccessExpression(callee) &&
        ts.isStringLiteralLike(callee.argumentExpression) &&
        callee.argumentExpression.text === 'insert'
      ) {
        add(n, "`x['insert'](...)` no se admite: usar `x.insert(...)` para poder verificarlo");
      }
    }
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'insert') {
      const p = n.parent;
      if (!(ts.isCallExpression(p) && unwrap(p.expression) === n)) {
        add(n, '`.insert` referenciado sin llamar (alias de la funcion): no se podria verificar su argumento');
      }
    }
    if (ts.isBindingElement(n)) {
      const prop = n.propertyName ? memberName(n.propertyName as ts.PropertyName) : ts.isIdentifier(n.name) ? n.name.text : undefined;
      if (prop === 'insert') add(n, 'desestructurar `insert` de un repositorio no se admite: no se podria verificar su argumento');
    }
  });
  return { violations, insertCalls };
}
