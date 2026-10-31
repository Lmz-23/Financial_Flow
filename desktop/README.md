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
