// Confirmación para las acciones destructivas de la versión de escritorio (web). `Alert.alert` de
// react-native-web no hace nada, así que el escritorio usa el diálogo del navegador. Sin `window`
// (celular, pruebas) devuelve false: no se confirma nada sin que el usuario lo vea.
export function confirmAction(title: string, message: string): boolean {
  if (typeof window === 'undefined' || typeof window.confirm !== 'function') return false;
  return window.confirm(`${title}\n\n${message}`);
}
