import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

const db = openDatabaseSync('financial-flow.db');

export const database = drizzle(db, { schema });

export * from './schema';
