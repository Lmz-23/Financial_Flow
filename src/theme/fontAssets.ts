/**
 * Archivos .ttf de IBM Plex que `app/_layout.tsx` pasa a `useFonts` de expo-font.
 *
 * Estrategia (ver el reporte de F3): el plugin `expo-font` de app.json embebe los .ttf, pero con
 * él el nombre de familia difiere por plataforma (Android: nombre de archivo; iOS: nombre
 * PostScript leído del .ttf, p. ej. `IBMPlexSans-Regular`). Cargar además con `useFonts` registra
 * cada fuente bajo el alias `IBMPlexSans_400Regular`, etc. en TODAS las plataformas
 * (expo-font iOS: FontLoaderModule.loadAsync + FontFamilyAliasManager), así que los nombres de
 * `fontFamilies.ts` son deterministas. Se importan los .ttf por ruta directa (los mismos que usa
 * el plugin) en lugar del índice del paquete, para no empaquetar los 28 pesos que no usamos.
 *
 * Importa archivos binarios: NO importar desde tests de vitest.
 */
import { fontFamilies } from './fontFamilies';

export const fontAssets: Record<string, number> = {
  [fontFamilies.sans[400]]: require('@expo-google-fonts/ibm-plex-sans/400Regular/IBMPlexSans_400Regular.ttf'),
  [fontFamilies.sans[500]]: require('@expo-google-fonts/ibm-plex-sans/500Medium/IBMPlexSans_500Medium.ttf'),
  [fontFamilies.sans[600]]: require('@expo-google-fonts/ibm-plex-sans/600SemiBold/IBMPlexSans_600SemiBold.ttf'),
  [fontFamilies.mono[400]]: require('@expo-google-fonts/ibm-plex-mono/400Regular/IBMPlexMono_400Regular.ttf'),
  [fontFamilies.mono[500]]: require('@expo-google-fonts/ibm-plex-mono/500Medium/IBMPlexMono_500Medium.ttf'),
};
