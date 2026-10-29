// =============================================================================
// MAPEO EN LA FRONTERA (Date de drizzle <-> epoch ms del dominio)
// =============================================================================
// Las columnas `timestamp_ms` salen de drizzle como `Date`. El dominio y las reglas puras
// trabajan con epoch ms (`number`), asi que TODO lo que sale de un repositorio pasa por
// `mapRow`/`mapRows`, y lo que entra convierte con `toDate`.

/** Reemplaza los campos `Date` por `number` (epoch ms), conservando los nulos. */
export type DatesToMs<T> = {
  [K in keyof T]: T[K] extends Date ? number : T[K] extends Date | null ? number | null : T[K];
};

export function mapRow<T extends object>(row: T): DatesToMs<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value instanceof Date ? value.getTime() : value;
  }
  return out as DatesToMs<T>;
}

export function mapRows<T extends object>(rows: T[]): DatesToMs<T>[] {
  return rows.map(mapRow);
}

export function toDate(ms: number): Date {
  return new Date(ms);
}

export function toDateOrNull(ms: number | null): Date | null {
  return ms === null ? null : new Date(ms);
}
