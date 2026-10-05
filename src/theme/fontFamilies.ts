/**
 * Mapa (familia, peso) -> nombre de familia de React Native para IBM Plex.
 *
 * En React Native con fuentes propias cada peso es una familia distinta, así que los estilos de
 * texto NO usan `fontWeight`: el peso elige el nombre de familia. Los nombres son los de los
 * paquetes `@expo-google-fonts/ibm-plex-*` (nombre de archivo sin extensión) y son los mismos en
 * iOS y Android porque `app/_layout.tsx` carga las fuentes con `useFonts` (ver fontAssets.ts).
 *
 * Archivo PURO (sin require de .ttf) para poder probarlo en vitest.
 */
import type { FontFamilyKind, FontWeightValue } from './tokens';

export const fontFamilies = {
  sans: {
    400: 'IBMPlexSans_400Regular',
    500: 'IBMPlexSans_500Medium',
    600: 'IBMPlexSans_600SemiBold',
  },
  mono: {
    400: 'IBMPlexMono_400Regular',
    500: 'IBMPlexMono_500Medium',
  },
} as const;

export function fontFamilyFor(kind: FontFamilyKind, weight: FontWeightValue): string {
  const table: Readonly<Record<number, string>> = fontFamilies[kind];
  const name = table[weight];
  if (!name) throw new Error(`IBM Plex ${kind} no está cargada en el peso ${weight}`);
  return name;
}

/** Todos los nombres de familia que la app debe tener cargados antes de renderizar. */
export const allFontFamilyNames: readonly string[] = [
  ...Object.values(fontFamilies.sans),
  ...Object.values(fontFamilies.mono),
];
