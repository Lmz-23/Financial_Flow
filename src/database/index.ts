// Reexport TEMPORAL para no romper los imports existentes (`import { database } from '.../database'`).
// El codigo nuevo debe importar `db` de './client' (o recibir la BD por inyeccion). Se elimina en F6.
export { db, db as database } from './client';
export * from './schema';
