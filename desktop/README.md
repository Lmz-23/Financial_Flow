# Financial Flow para escritorio

Programa de Windows (Electron) que envuelve la versión web de la app.

## Probar en local

```bash
npm run desktop:web            # exporta la app web a desktop/app/
cd desktop && npm install      # solo la primera vez
npm start                      # abre la ventana
```

## Cómo funciona

- `main.js` sirve `desktop/app/` desde `app://financial-flow` con las cabeceras COOP/COEP que
  necesita expo-sqlite en web, una CSP que solo permite recursos propios y sin permisos de navegador.
- Los datos (SQLite en OPFS) quedan en la carpeta de datos del programa (`%APPDATA%\Financial Flow`
  en Windows). El origen `app://financial-flow` no debe cambiar: es la llave de esos datos.
- Una sola instancia: abrirlo otra vez enfoca la ventana existente.
- Recuerda tamaño, posición y si estaba maximizada. F11: pantalla completa. Alt muestra el menú.

## Instalador de Windows

Lo compila GitHub Actions (`.github/workflows/escritorio.yml`) en una máquina Windows:

- En cada PR que toque la app o `desktop/`: el `.exe` queda como artefacto de la ejecución (30 días).
- Al subir una etiqueta `vX.Y.Z` (`git tag v1.0.0 && git push origin v1.0.0`): se publica en Releases.

En local: `npm run dist:dir` (en `desktop/`) arma la versión para este sistema sin instalador.
El instalador no va firmado: la primera vez Windows muestra «Windows protegió su PC» → «Más
información» → «Ejecutar de todas formas».
