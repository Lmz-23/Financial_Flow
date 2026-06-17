import { database } from './index';
import { categories } from './schema';
import { eq, sql } from 'drizzle-orm';

// =============================================================================
// SEED DATA - Default Categories
// =============================================================================

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Vivienda', icon: 'home', color: '#6366F1' },
  { name: 'Alimentación', icon: 'food', color: '#22C55E' },
  { name: 'Transporte', icon: 'car', color: '#F59E0B' },
  { name: 'Salud', icon: 'hospital', color: '#EF4444' },
  { name: 'Educación', icon: 'school', color: '#8B5CF6' },
  { name: 'Entretenimiento', icon: 'movie', color: '#EC4899' },
  { name: 'Ropa', icon: 'tshirt', color: '#14B8A6' },
  { name: 'Servicios públicos', icon: 'flash', color: '#64748B' },
  { name: 'Telecomunicaciones', icon: 'phone', color: '#06B6D4' },
  { name: 'Deudas', icon: 'credit-card', color: '#DC2626' },
  { name: 'Ahorro', icon: 'piggy-bank', color: '#10B981' },
  { name: 'Inversión', icon: 'trending-up', color: '#84CC16' },
  { name: 'Otros', icon: 'dots-horizontal', color: '#9CA3AF' },
] as const;

const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salario', icon: 'briefcase', color: '#22C55E' },
  { name: 'Freelance', icon: 'laptop', color: '#8B5CF6' },
  { name: 'Negocio', icon: 'store', color: '#F59E0B' },
  { name: 'Inversión', icon: 'chart-line', color: '#14B8A6' },
  { name: 'Regalo', icon: 'gift', color: '#EC4899' },
  { name: 'Otros', icon: 'dots-horizontal', color: '#9CA3AF' },
] as const;

// =============================================================================
// SEED FUNCTION
// =============================================================================

export async function seedDatabase(userId: string): Promise<void> {
  // Check if categories table is empty
  const existingCategories = await database
    .select({ count: sql<number>`count(*)` })
    .from(categories);

  if (existingCategories[0].count > 0) {
    // Categories already exist, skip seeding
    return;
  }

  const now = new Date();

  // Insert default expense categories
  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((cat, index) => ({
    id: `sys_expense_${index + 1}`,
    userId: null, // null = system default
    name: cat.name,
    type: 'EXPENSE' as const,
    icon: cat.icon,
    color: cat.color,
    isDefault: true,
    isActive: true,
    order: index,
    createdAt: now,
  }));

  // Insert default income categories
  const incomeCategories = DEFAULT_INCOME_CATEGORIES.map((cat, index) => ({
    id: `sys_income_${index + 1}`,
    userId: null, // null = system default
    name: cat.name,
    type: 'INCOME' as const,
    icon: cat.icon,
    color: cat.color,
    isDefault: true,
    isActive: true,
    order: index,
    createdAt: now,
  }));

  // Insert all categories
  await database.insert(categories).values([...expenseCategories, ...incomeCategories]);

  console.log(`[Seed] Inserted ${expenseCategories.length} expense categories and ${incomeCategories.length} income categories`);
}

// =============================================================================
// CATEGORY LOOKUP HELPERS
// =============================================================================

/**
 * Get all active categories (system defaults + user's custom ones)
 */
export async function getActiveCategories(userId: string) {
  return database.query.categories.findMany({
    where: eq(categories.isActive, true),
    orderBy: categories.order,
  });
}

/**
 * Get expense categories only
 */
export async function getExpenseCategories(userId: string) {
  return database.query.categories.findMany({
    where: eq(categories.type, 'EXPENSE'),
    orderBy: categories.order,
  });
}

/**
 * Get income categories only
 */
export async function getIncomeCategories(userId: string) {
  return database.query.categories.findMany({
    where: eq(categories.type, 'INCOME'),
    orderBy: categories.order,
  });
}
