// Regresion (prueba en telefono, 2026-10-27): con React Compiler activo (app.json), el compilador
// memoizaba `query(getDomain())` solo por `query` y el Dashboard no se refrescaba al invalidar.
// `useDomainQuery` debe quedar fuera del compilador ('use no memo').
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// @babel/core llega como dependencia transitiva de Expo y no trae tipos: se tipa solo lo que se usa.
const { transformSync } = createRequire(import.meta.url)('@babel/core') as {
  transformSync: (code: string, options: object) => { code?: string | null } | null;
};

const FILE = resolve(__dirname, '../../../src/hooks/useDomainQuery.ts');

function compile(source: string): string {
  const out = transformSync(source, {
    babelrc: false,
    configFile: false,
    filename: FILE,
    presets: ['@babel/preset-typescript'],
    plugins: ['babel-plugin-react-compiler'],
  });
  return out?.code ?? '';
}

describe('useDomainQuery con React Compiler', () => {
  it('el compilador no lo memoiza', () => {
    expect(compile(readFileSync(FILE, 'utf8'))).not.toContain('react/compiler-runtime');
  });

  it('sin la directiva, el compilador si lo memoizaria (la prueba detecta el fallo)', () => {
    const withoutDirective = readFileSync(FILE, 'utf8').replace("'use no memo';", '');
    expect(compile(withoutDirective)).toContain('react/compiler-runtime');
  });
});
