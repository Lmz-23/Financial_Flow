#!/usr/bin/env node
// Falla si src/database/schema.ts y src/database/migrations divergen.
// Copia las migraciones a un directorio temporal (ruta RELATIVA, bajo node_modules/.cache, ignorado por git)
// y ejecuta `drizzle-kit generate` sobre la copia: si produce algo nuevo, el esquema tiene cambios sin migrar.
// Falla de forma cerrada: solo declara sincronía tras verificar positivamente que drizzle-kit corrió bien.
// No modifica el repo.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const migrations = path.join(root, 'src/database/migrations');
const cacheDir = path.join(root, 'node_modules', '.cache');

const fail = (msg, code = 1) => {
  console.error('db:check: ' + msg);
  process.exitCode = code;
};

const list = (dir) =>
  fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort();

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);

function main(tmp) {
  const rel = path.relative(root, tmp).split(path.sep).join('/'); // --out relativo al cwd (root)
  fs.cpSync(migrations, tmp, { recursive: true });
  const before = list(tmp);
  const journalBefore = read(path.join(tmp, 'meta/_journal.json'));

  const res = spawnSync(
    'npx',
    ['--no-install', 'drizzle-kit', 'generate', '--dialect', 'sqlite', '--schema', './src/database/schema.ts', '--out', './' + rel],
    { cwd: root, encoding: 'utf8' },
  );
  const output = `${res.stdout || ''}\n${res.stderr || ''}`;

  if (res.error) return fail(`no se pudo ejecutar drizzle-kit: ${res.error.message}`);
  if (res.signal) return fail(`drizzle-kit terminó por señal ${res.signal}.\n${output}`);
  if (res.status !== 0) return fail(`drizzle-kit generate falló (exit ${res.status}).\n${output}`, res.status || 1);
  if (/\b(Error|ENOENT|EACCES|ERR_[A-Z_]+|Cannot find|SyntaxError|TypeError|failed)\b/i.test(output)) {
    return fail(`la salida de drizzle-kit indica un error (aunque terminó con exit 0).\n${output}`);
  }

  // Verificación positiva: el directorio de salida debe seguir teniendo journal y snapshot.
  const journalAfter = read(path.join(tmp, 'meta/_journal.json'));
  const after = list(tmp);
  if (journalAfter === null) return fail('resultado inesperado: falta meta/_journal.json en la salida de drizzle-kit.');
  if (!after.some((f) => /^meta\/\d+_snapshot\.json$/.test(f))) {
    return fail('resultado inesperado: falta el snapshot en la salida de drizzle-kit.');
  }
  for (const f of before) {
    if (!after.includes(f)) return fail(`resultado inesperado: drizzle-kit eliminó ${f} de la copia.`);
  }

  const added = after.filter((f) => !before.includes(f) && path.basename(f) !== 'migrations.js');
  const journalChanged = journalBefore !== journalAfter;
  if (added.length > 0 || journalChanged) {
    fail('el esquema diverge de las migraciones. Ejecuta `npm run db:generate` y versiona el resultado.');
    console.error('Archivos que se generarían: ' + (added.length ? added.join(', ') : '(solo cambia meta/_journal.json)'));
    return;
  }

  // Sin cambios: drizzle-kit debe haberlo confirmado explícitamente.
  if (!/nothing to migrate|no schema changes/i.test(output)) {
    return fail(`no se pudo confirmar la sincronía: drizzle-kit no reportó "nothing to migrate".\n${output}`);
  }
  console.log('db:check: esquema y migraciones en sincronía.');
}

if (!fs.existsSync(migrations) || !fs.statSync(migrations).isDirectory()) {
  fail(`no existe el directorio de migraciones: ${path.relative(root, migrations)}. Ejecuta \`npm run db:generate\`.`);
} else {
  fs.mkdirSync(cacheDir, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(cacheDir, 'ff-migrations-'));
  try {
    main(tmp);
  } catch (e) {
    fail(`error inesperado: ${e && e.message ? e.message : e}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
