/**
 * Generador de ids (text PK) que funciona en React Native (Hermes) y en Node.
 *
 * No se asume `crypto.randomUUID`: no hay evidencia de que exista en Hermes / RN 0.85 ni
 * Expo lo polyfillea en `expo/src/winter`. Se usa, en orden de preferencia:
 *   1. crypto.randomUUID()        (Node, navegadores, y Hermes si algun dia lo expone)
 *   2. crypto.getRandomValues()   (UUID v4 armado a mano)
 *   3. Math.random()              (ultimo recurso; los ids son locales, no son secretos)
 * El formato siempre es UUID v4.
 */
type CryptoLike = {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
};

export function newId(): string {
  const c = (globalThis as { crypto?: CryptoLike }).crypto;

  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') + '-' +
    hex.slice(4, 6).join('') + '-' +
    hex.slice(6, 8).join('') + '-' +
    hex.slice(8, 10).join('') + '-' +
    hex.slice(10, 16).join('')
  );
}
