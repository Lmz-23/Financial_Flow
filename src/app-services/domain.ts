// Dominio de la app: UNA instancia de `createDomain` sobre el cliente expo-sqlite. Es la unica
// frontera entre la interfaz y la BD (los hooks consultan por aqui; los comandos escriben por aqui).
import { db } from '../database/client';
import { createDomain, type Domain } from '../domain/createDomain';

let domain: Domain | undefined;

/** Perezoso: abre el cliente la primera vez que se pide (despues de `initializeDatabase`). */
export function getDomain(): Domain {
  domain ??= createDomain(db);
  return domain;
}
