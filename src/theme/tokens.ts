/**
 * Tokens del Design System de Financial Flow.
 *
 * Copia local y tipada de `Design/design-tokens.json` (fuente de verdad). Se copia en lugar de
 * importar el JSON para que el bundle no dependa de la carpeta `Design/` (supuesto aprobado en
 * la arquitectura, §5). `test/unit/theme/tokens.test.ts` compara esta copia con el JSON y falla
 * si divergen, así que cualquier cambio de diseño debe replicarse aquí.
 *
 * Este archivo es PURO (sin imports de react-native ni de expo) para poder probarlo en vitest.
 */

// ---------------------------------------------------------------------------
// Esquema y preferencia
// ---------------------------------------------------------------------------

export type Scheme = 'light' | 'dark';
export type ThemePreference = Scheme | 'system';

/** Esquema que reporta el sistema (`useColorScheme`). `unspecified` y `null` se tratan como claro. */
export type SystemScheme = Scheme | 'unspecified' | null | undefined;

/**
 * Esquema efectivo a partir de la preferencia del usuario y el esquema del sistema.
 * - 'light' / 'dark': la preferencia manda.
 * - 'system': sigue al sistema; si el sistema no informa nada, claro.
 */
export function resolveScheme(preference: ThemePreference, systemScheme: SystemScheme): Scheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

// ---------------------------------------------------------------------------
// Colores
// ---------------------------------------------------------------------------

export type ColorTokenName =
  | 'surfacePage'
  | 'surfaceCard'
  | 'surfaceRaised'
  | 'borderSubtle'
  | 'inkPrimary'
  | 'inkSecondary'
  | 'inkOnBrand'
  | 'brandPrimary'
  | 'signalGrowth'
  | 'signalDebt'
  | 'signalGoal'
  | 'focusRing';

export type ColorTokens = Readonly<Record<ColorTokenName, string>>;

export interface RawColorToken {
  /** Nombre original en kebab-case, igual que en design-tokens.json. */
  readonly name: string;
  readonly light: string;
  readonly dark: string;
}

/**
 * Valores tal como vienen en design-tokens.json. Un valor `{token-name}` es una referencia a otro
 * token del mismo esquema (focus-ring -> {brand-primary}); `resolveColorTokens` la resuelve.
 */
export const rawColorTokens: readonly RawColorToken[] = [
  { name: 'surface-page', light: '#F3F6F4', dark: '#0B1512' },
  { name: 'surface-card', light: '#FFFFFF', dark: '#121F1A' },
  { name: 'surface-raised', light: '#E9EFEC', dark: '#182A23' },
  { name: 'border-subtle', light: '#D7E0DB', dark: '#27392F' },
  { name: 'ink-primary', light: '#0E211C', dark: '#EAF2EE' },
  { name: 'ink-secondary', light: '#51645D', dark: '#9EB3AB' },
  { name: 'ink-on-brand', light: '#F3FBF8', dark: '#0B1512' },
  { name: 'brand-primary', light: '#0B3B36', dark: '#4FC9A8' },
  { name: 'signal-growth', light: '#1E8F5D', dark: '#4FD399' },
  { name: 'signal-debt', light: '#B5472E', dark: '#E08465' },
  { name: 'signal-goal', light: '#A97723', dark: '#D9A94E' },
  { name: 'focus-ring', light: '{brand-primary}', dark: '{brand-primary}' },
];

/** 'surface-page' -> 'surfacePage'. */
export function kebabToCamel(name: string): string {
  return name.replace(/-([a-z0-9])/g, (_, ch: string) => ch.toUpperCase());
}

const REFERENCE = /^\{([a-z0-9-]+)\}$/;

/**
 * Transforma la lista cruda a un objeto camelCase para un esquema, resolviendo referencias
 * `{token}`. Lanza si una referencia apunta a un token inexistente o si hay un ciclo.
 */
export function resolveColorTokens(raw: readonly RawColorToken[], scheme: Scheme): Record<string, string> {
  const byName = new Map(raw.map((t) => [t.name, t[scheme]]));

  const resolve = (name: string, trail: readonly string[]): string => {
    const value = byName.get(name);
    if (value === undefined) throw new Error(`Token de color inexistente: "${name}"`);
    const ref = REFERENCE.exec(value);
    if (!ref) return value;
    if (trail.includes(ref[1])) throw new Error(`Referencia circular en tokens de color: ${[...trail, ref[1]].join(' -> ')}`);
    return resolve(ref[1], [...trail, name]);
  };

  const out: Record<string, string> = {};
  for (const token of raw) out[kebabToCamel(token.name)] = resolve(token.name, []);
  return out;
}

export const colorTokens: Readonly<Record<Scheme, ColorTokens>> = {
  light: resolveColorTokens(rawColorTokens, 'light') as ColorTokens,
  dark: resolveColorTokens(rawColorTokens, 'dark') as ColorTokens,
};

// ---------------------------------------------------------------------------
// Tipografía
// ---------------------------------------------------------------------------

export type FontFamilyKind = 'sans' | 'mono';
export type FontWeightValue = 400 | 500 | 600;

export type TypeStyleName =
  | 'displayLg'
  | 'displayMd'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySm'
  | 'label'
  | 'amountLg'
  | 'amountMd'
  | 'amountSm';

export interface TypeStyleSpec {
  readonly family: FontFamilyKind;
  readonly fontSize: number;
  readonly lineHeight: number;
  /** Peso de diseño. En React Native NO se usa `fontWeight`: el peso elige la familia (ver fontFamilies.ts). */
  readonly weight: FontWeightValue;
}

export const typeSpecs: Readonly<Record<TypeStyleName, TypeStyleSpec>> = {
  displayLg: { family: 'sans', fontSize: 40, lineHeight: 44, weight: 600 },
  displayMd: { family: 'sans', fontSize: 28, lineHeight: 34, weight: 600 },
  h1: { family: 'sans', fontSize: 22, lineHeight: 28, weight: 600 },
  h2: { family: 'sans', fontSize: 18, lineHeight: 24, weight: 600 },
  h3: { family: 'sans', fontSize: 16, lineHeight: 22, weight: 600 },
  body: { family: 'sans', fontSize: 15, lineHeight: 22, weight: 400 },
  bodySm: { family: 'sans', fontSize: 13, lineHeight: 18, weight: 400 },
  label: { family: 'sans', fontSize: 12, lineHeight: 16, weight: 500 },
  amountLg: { family: 'mono', fontSize: 28, lineHeight: 32, weight: 500 },
  amountMd: { family: 'mono', fontSize: 18, lineHeight: 24, weight: 500 },
  amountSm: { family: 'mono', fontSize: 14, lineHeight: 20, weight: 400 },
};

/** Tamaño mínimo (px) para usar ink-secondary (regla del Design System por contraste). */
export const INK_SECONDARY_MIN_SIZE = 14;

// ---------------------------------------------------------------------------
// Espaciado y radios
// ---------------------------------------------------------------------------

export type SpaceStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** space-1 … space-7 (px). Uso: `space[4]`. */
export const space: Readonly<Record<SpaceStep, number>> = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
};

export type RadiusName = 'xs' | 'sm' | 'md' | 'lg' | 'full';

export const radius: Readonly<Record<RadiusName, number>> = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 22,
  full: 999,
};

// ---------------------------------------------------------------------------
// Sombra de hoja
// ---------------------------------------------------------------------------

/** Valor crudo de design-tokens.json (`shadow-sheet`). Solo hojas inferiores y modales. */
export const rawShadowSheet: Readonly<Record<Scheme, string>> = {
  light: '0 -8px 24px rgba(14,33,28,0.14)',
  dark: 'none',
};

/** Misma forma que `BoxShadowValue` de react-native (se redeclara para mantener este archivo puro). */
export interface BoxShadowValue {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
}

/** Estilo aplicable a una View: vacío cuando no hay sombra. */
export interface ShadowStyle {
  boxShadow?: BoxShadowValue[];
}

function splitCssTokens(input: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of input.trim()) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (/\s/.test(ch) && depth === 0) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

function parsePx(token: string): number {
  const m = /^(-?\d*\.?\d+)(px)?$/.exec(token);
  if (!m) throw new Error(`Valor de longitud no soportado en sombra: "${token}"`);
  return Number(m[1]);
}

/**
 * Traduce una sombra CSS (`<x> <y> <blur> [<spread>] <color>`, solo px, una capa) al `boxShadow`
 * de React Native. 'none' devuelve un estilo vacío.
 *
 * Justificación: React Native 0.85 (solo Nueva Arquitectura) implementa `boxShadow` con la
 * semántica de CSS en iOS y Android 9+, por lo que la traducción es 1:1 (offset, blur y color se
 * conservan). Las alternativas heredadas no sirven: `shadowOffset/shadowRadius/shadowOpacity` solo
 * funcionan en iOS (el blur de CSS equivale a 2σ, no a shadowRadius) y `elevation` en Android
 * proyecta la sombra hacia abajo, mientras que la hoja necesita una sombra hacia ARRIBA (y = -8).
 */
export function cssShadowToRN(css: string): ShadowStyle {
  const value = css.trim();
  if (value === '' || value.toLowerCase() === 'none') return {};
  const tokens = splitCssTokens(value);
  if (tokens.length < 4 || tokens.length > 5) throw new Error(`Sombra CSS no soportada: "${css}"`);
  const [x, y, blur] = tokens;
  const spread = tokens.length === 5 ? tokens[3] : '0';
  const color = tokens[tokens.length - 1];
  return {
    boxShadow: [
      { offsetX: parsePx(x), offsetY: parsePx(y), blurRadius: parsePx(blur), spreadDistance: parsePx(spread), color },
    ],
  };
}

export const shadowSheetTokens: Readonly<Record<Scheme, ShadowStyle>> = {
  light: cssShadowToRN(rawShadowSheet.light),
  dark: cssShadowToRN(rawShadowSheet.dark),
};
