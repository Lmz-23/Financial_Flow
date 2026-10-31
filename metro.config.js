// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Permite importar las migraciones .sql generadas por drizzle-kit (driver 'expo').
config.resolver.sourceExts.push('sql');

// expo-sqlite en web carga SQLite como WebAssembly (wa-sqlite) desde un worker.
config.resolver.assetExts.push('wasm');

// En web, expo-sqlite usa nuestra copia parcheada de su WorkerChannel (ver el encabezado de
// vendor/expo-sqlite/WorkerChannel.ts). Los imports relativos de la copia se resuelven contra la
// carpeta original del paquete.
const sqliteWebDir = path.join(path.dirname(require.resolve('expo-sqlite/package.json')), 'web');
const patchedWorkerChannel = path.join(__dirname, 'vendor', 'expo-sqlite', 'WorkerChannel.ts');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    const fromDir = path.dirname(context.originModulePath);
    if (fromDir === sqliteWebDir && moduleName === './WorkerChannel') {
      return { type: 'sourceFile', filePath: patchedWorkerChannel };
    }
    if (context.originModulePath === patchedWorkerChannel && moduleName.startsWith('./')) {
      return context.resolveRequest(
        { ...context, originModulePath: path.join(sqliteWebDir, 'WorkerChannel.ts') },
        moduleName,
        platform,
      );
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// expo-sqlite en web usa SharedArrayBuffer para su API sincrona, que el navegador solo habilita
// con aislamiento de origen (COOP + COEP). En escritorio, Electron envia las mismas cabeceras.
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  return middleware(req, res, next);
};

module.exports = config;
