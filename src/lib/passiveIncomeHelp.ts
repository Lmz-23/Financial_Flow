// Flag "ya vio la explicacion de ingreso pasivo". Se guarda en AsyncStorage (clave-valor, sin
// migracion de SQLite). El almacenamiento se inyecta para poder probar la logica sin React Native.
export const PASSIVE_HELP_SEEN_KEY = 'passive-income-help-seen';

export interface KeyValueStorage {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
}

/**
 * true solo la primera vez que se pide (y deja marcado el flag). Si el almacenamiento falla, devuelve
 * false: preferimos no mostrar la hoja a mostrarla en cada marca.
 */
export async function consumePassiveHelpFirstTime(storage: KeyValueStorage): Promise<boolean> {
  try {
    if ((await storage.getItem(PASSIVE_HELP_SEEN_KEY)) === '1') return false;
    await storage.setItem(PASSIVE_HELP_SEEN_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
