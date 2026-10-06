// =============================================================================
// MONEY (unidades menores, solo COP)
// =============================================================================
//
// Todos los montos del dominio son enteros en unidades menores (pesos x 100).
// El formato es-CO se implementa a mano: Intl/toLocaleString puede no estar
// completo en Hermes. Funciones puras, sin dependencias.
//
// `formatCOP` es el UNICO formateador de moneda del proyecto: recibe unidades
// menores (como se guardan en BD). La UI no debe formatear pesos por su cuenta.
// =============================================================================

/** Monto entero en unidades menores (centavos). 1 peso = 100. */
export type Minor = number;

export const MINOR_PER_PESO = 100;

/** Lanza si el valor no es un entero seguro. */
export function assertMinor(value: number, label = 'monto'): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} debe ser un entero en unidades menores: ${value}`);
  }
}

/** Redondeo half-away-from-zero (Math.round redondea -2.5 hacia -2). */
export function roundMinor(value: number): Minor {
  if (!Number.isFinite(value)) {
    throw new RangeError(`No se puede redondear un valor no finito: ${value}`);
  }
  const rounded = Math.round(Math.abs(value));
  // Evita devolver -0.
  return value < 0 && rounded !== 0 ? -rounded : rounded;
}

/** Pesos (posiblemente con decimales) a unidades menores. */
export function toMinor(pesos: number): Minor {
  if (!Number.isFinite(pesos)) {
    throw new RangeError(`Pesos no finitos: ${pesos}`);
  }
  // toPrecision estabiliza errores de coma flotante (1.005 * 100 = 100.4999...).
  return roundMinor(Number((pesos * MINOR_PER_PESO).toPrecision(15)));
}

/** Unidades menores a pesos (puede tener decimales). */
export function fromMinor(minor: Minor): number {
  return minor / MINOR_PER_PESO;
}

/** Suma segura: valida que cada término y el total sean enteros seguros. */
export function addMinor(...values: Minor[]): Minor {
  let total = 0;
  for (const v of values) {
    assertMinor(v);
    total += v;
    assertMinor(total, 'suma');
  }
  return total;
}

/** Inserta '.' como separador de miles en una cadena de dígitos. */
function groupThousands(digits: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += '.';
    out += digits[i];
  }
  return out;
}

/**
 * UNICO formateador de moneda del proyecto. Recibe unidades menores (Minor) y
 * devuelve pesos es-CO enteros SIN espacio tras el "$": "$1.234.567".
 * Negativos con el signo antes del "$": "-$50.000". Cero: "$0".
 * Los centavos se redondean al peso (half-up sobre el valor absoluto; el diseno
 * no muestra decimales) y un negativo que redondea a 0 no muestra signo.
 * La UI no debe formatear pesos por su cuenta: debe llamar a esta funcion.
 */
export function formatCOP(minor: Minor): string {
  assertMinor(minor);
  const pesos = Math.round(Math.abs(minor) / MINOR_PER_PESO);
  const body = `$${groupThousands(String(pesos))}`;
  return minor < 0 && pesos !== 0 ? `-${body}` : body;
}

/**
 * Parseo tolerante de un monto escrito por el usuario, en pesos.
 * es-CO: '.' separa miles y ',' separa decimales. Acepta "$" y espacios, con o sin
 * espacio tras el "$" ("$1.200.000" y "$ 1.200.000").
 * Devuelve null si el texto es vacío, negativo o ambiguo (ej. "1.20").
 *
 * @example parsePesos("1.200.000") // 1200000
 * @example parsePesos("1.200.000,50") // 1200000.5
 */
export function parsePesos(text: string): number | null {
  const clean = text.replace(/[$\s]/g, '');
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/.test(clean)) return null;
  const value = Number(clean.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Igual que parsePesos pero devuelve unidades menores. */
export function parseMinor(text: string): Minor | null {
  const pesos = parsePesos(text);
  return pesos === null ? null : toMinor(pesos);
}

/**
 * Parseo de una tasa escrita en porcentaje ("2,3" o "2.3" -> 2.3).
 * En tasas, tanto ',' como '.' se tratan como decimal (no hay miles).
 */
export function parseRatePercent(text: string): number | null {
  const clean = text.replace(/[%\s]/g, '');
  if (!/^\d+([.,]\d+)?$/.test(clean)) return null;
  const value = Number(clean.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** Tasa decimal (0.023) a texto es-CO ("2,3%"), con hasta `maxDecimals` decimales. */
export function formatRate(rate: number, maxDecimals = 2): string {
  const fixed = (rate * 100).toFixed(maxDecimals);
  const trimmed = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return `${trimmed.replace('.', ',')}%`;
}
