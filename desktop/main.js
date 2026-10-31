// =============================================================================
// FINANCIAL FLOW: PROGRAMA DE ESCRITORIO (Electron)
// =============================================================================
//
// Envuelve la exportación web de la app (`npm run desktop:web` -> desktop/app/) en una ventana
// propia. Puntos clave:
// - Sirve la app desde un protocolo propio (`app://financial-flow`) con las cabeceras COOP/COEP:
//   sin ellas no hay SharedArrayBuffer y expo-sqlite no abre la base de datos.
// - Los datos (SQLite en OPFS) quedan en la carpeta de datos del programa (%APPDATA%\Financial Flow
//   en Windows). El ORIGEN no debe cambiar nunca: es la llave de esos datos.
// - Una sola instancia: abrir el programa otra vez enfoca la ventana existente (dos ventanas
//   pelearían por el mismo archivo de la base de datos).
// - Recuerda tamaño, posición y si estaba maximizada.
// =============================================================================

const { app, BrowserWindow, Menu, nativeTheme, net, protocol, screen, session, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_NAME = 'Financial Flow';
const SCHEME = 'app';
const HOST = 'financial-flow';
const ORIGIN = `${SCHEME}://${HOST}`;
const WEB_ROOT = path.join(__dirname, 'app');

// Fondo de la app (surface-page) para que la ventana no destelle en blanco al abrir.
const BACKGROUND = { light: '#F3F6F4', dark: '#0B1512' };
const DEFAULT_SIZE = { width: 1440, height: 900 };
const MIN_SIZE = { width: 720, height: 560 };

app.setName(APP_NAME);
// Solo para pruebas sin empaquetar: datos en otra carpeta para no tocar los del usuario.
if (!app.isPackaged && process.env.FF_USER_DATA) app.setPath('userData', process.env.FF_USER_DATA);

// Debe registrarse antes de `ready`. `standard` + `secure` dan un origen seguro y estable (OPFS,
// workers, fetch); `stream` permite servir el WASM de SQLite.
protocol.registerSchemesAsPrivileged([
  {
    scheme: SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
]);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let mainWindow = null;

  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    // Sin permisos de navegador (cámara, micrófono, ubicación, notificaciones…): la app no usa ninguno.
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    registerAppProtocol();
    Menu.setApplicationMenu(buildMenu());
    mainWindow = createWindow();
    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  });

  app.on('window-all-closed', () => app.quit());
}

// -----------------------------------------------------------------------------
// Protocolo app://financial-flow: archivos de desktop/app con aislamiento de origen
// -----------------------------------------------------------------------------

const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

// Solo código y recursos propios: si algo inyectara un script, no podría cargar ni enviar nada fuera.
// 'wasm-unsafe-eval' lo necesita el WASM de SQLite; 'unsafe-inline' en estilos, react-native-web.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== HOST) return new Response('No encontrado', { status: 404 });

    // Rutas de la app (/transactions, /debts/…) sin archivo propio: es una app de una sola página.
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response('Dirección inválida', { status: 400 });
    }
    let filePath = path.normalize(path.join(WEB_ROOT, pathname));
    if (filePath !== WEB_ROOT && !filePath.startsWith(WEB_ROOT + path.sep)) {
      return new Response('Prohibido', { status: 403 });
    }
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      // Un archivo con extensión que no existe es un error (404); una ruta sin extensión es de la app.
      if (path.extname(pathname)) return new Response('No encontrado', { status: 404 });
      filePath = path.join(WEB_ROOT, 'index.html');
    }

    let response;
    try {
      response = await net.fetch(pathToFileURL(filePath).toString());
    } catch {
      return new Response('Error al leer el archivo', { status: 500 });
    }
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    const mime = MIME_TYPES[path.extname(filePath).toLowerCase()];
    if (mime) headers.set('Content-Type', mime);
    if (filePath.endsWith('.html')) headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
    return new Response(response.body, { status: response.status, headers });
  });
}

// -----------------------------------------------------------------------------
// Ventana: tamaño y posición recordados
// -----------------------------------------------------------------------------

function boundsFile() {
  return path.join(app.getPath('userData'), 'ventana.json');
}

function readBounds() {
  try {
    const saved = JSON.parse(fs.readFileSync(boundsFile(), 'utf8'));
    if (![saved.x, saved.y, saved.width, saved.height].every(Number.isFinite)) throw new Error('ventana.json inválido');
    // Si la pantalla donde estaba ya no existe (otro monitor), se abre centrada.
    const visible = screen.getAllDisplays().some(({ workArea: a }) =>
      saved.x >= a.x && saved.y >= a.y && saved.x < a.x + a.width && saved.y < a.y + a.height,
    );
    return visible ? saved : { width: saved.width, height: saved.height, maximized: saved.maximized };
  } catch {
    // Primera vez: 1440×900 o lo que quepa (90 % del área útil en portátiles pequeños), centrada.
    const area = screen.getPrimaryDisplay().workAreaSize;
    return {
      width: Math.min(DEFAULT_SIZE.width, Math.round(area.width * 0.9)),
      height: Math.min(DEFAULT_SIZE.height, Math.round(area.height * 0.9)),
      maximized: false,
    };
  }
}

function saveBounds(win) {
  try {
    const { x, y, width, height } = win.getNormalBounds();
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
    fs.writeFileSync(boundsFile(), JSON.stringify({ x, y, width, height, maximized: win.isMaximized() }));
  } catch {
    // No poder guardar la posición no debe impedir cerrar el programa.
  }
}

function createWindow() {
  const saved = readBounds();
  const win = new BrowserWindow({
    title: APP_NAME,
    x: saved.x,
    y: saved.y,
    width: Math.max(saved.width ?? DEFAULT_SIZE.width, MIN_SIZE.width),
    height: Math.max(saved.height ?? DEFAULT_SIZE.height, MIN_SIZE.height),
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: nativeTheme.shouldUseDarkColors ? BACKGROUND.dark : BACKGROUND.light,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      navigateOnDragDrop: false,
      spellcheck: false,
    },
  });

  if (saved.maximized) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', () => saveBounds(win));

  // Los enlaces externos se abren en el navegador; la ventana nunca navega fuera de la app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openIfWeb(url);
    return { action: 'deny' };
  });
  const keepInApp = (event, url) => {
    if (isAppUrl(url)) return;
    event.preventDefault();
    openIfWeb(url);
  };
  win.webContents.on('will-navigate', keepInApp);
  win.webContents.on('will-redirect', keepInApp);
  win.webContents.on('will-frame-navigate', (event) => keepInApp(event, event.url));
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  if (app.isPackaged) win.webContents.on('devtools-opened', () => win.webContents.closeDevTools());

  win.loadURL(`${ORIGIN}/`);
  return win;
}

/** true solo para direcciones de la propia app. `URL.origin` no sirve: con esquemas propios es "null". */
function isAppUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === `${SCHEME}:` && u.host === HOST;
  } catch {
    return false;
  }
}

/** Abre en el navegador del sistema solo direcciones http(s). */
function openIfWeb(url) {
  try {
    const { protocol: scheme } = new URL(url);
    if (scheme === 'https:' || scheme === 'http:') shell.openExternal(url);
  } catch {
    // dirección inválida: se ignora
  }
}

// -----------------------------------------------------------------------------
// Menú (oculto; Alt lo muestra). Sus atajos funcionan aunque no se vea: F11, Ctrl+R, zoom.
// -----------------------------------------------------------------------------

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Archivo',
      submenu: [{ role: 'quit', label: 'Salir' }],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Herramientas de desarrollo' }]),
      ],
    },
  ]);
}
