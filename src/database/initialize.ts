import { database } from './index';
import { seedDatabase } from './seed';

/**
 * Initializes the database.
 * 
 * For Expo SDK 56 with expo-sqlite, we use drizzle-kit for migrations
 * during development and manual schema creation for simplicity.
 * 
 * The seed function checks if categories exist before inserting,
 * so it's safe to call multiple times.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // For v1, we rely on drizzle-kit generate + push for migrations.
    // The seed function checks if data exists before inserting.
    
    // Seed default categories (only if table is empty)
    // TODO: Replace 'default-user' with authenticated user ID when auth is implemented
    await seedDatabase('default-user');

    console.log('[Database] Initialized successfully');
  } catch (error) {
    console.error('[Database] Initialization failed:', error);
    throw error;
  }
}

// =============================================================================
// MIGRATIONS (for when you have generated migration files)
// =============================================================================
// 
// To generate migrations:
// 1. npx drizzle-kit generate
// 2. This creates SQL files in src/database/migrations
//
// To apply migrations manually, you would need to import them:
// import { migrationJournal } from './migrations/journal';
// import { migration1 } from './migrations/0000_init';
// etc.
//
// For production, consider using:
// - expo-sqlite with a migration service
// - Or a backend API that handles migrations
