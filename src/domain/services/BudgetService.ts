import { database } from '../../database';
import { transactions, recurringItems, debtCards, debtLoans, budgetsMonthly, categories } from '../../database/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { TransactionRepository } from '../../database/repositories/transactionRepository';
import { AccountRepository } from '../../database/repositories/accountRepository';

// =============================================================================
// BUDGET SERVICE
// =============================================================================

export interface MonthlyBudget {
  month: number;
  year: number;
  totalIncomeExpected: number;
  totalFixedExpenses: number;
  totalDebtPayments: number;
  totalFreeAmount: number;
  budgetConfig: BudgetConfig | null;
}

export interface BudgetConfig {
  variableBudget: number;
  savingsAmount: number;
  savingsPercent: number;
  investmentAmount: number;
  investmentPercent: number;
  pockets: { pocketId: string; amount: number }[];
}

export interface CategoryProgress {
  categoryId: string;
  categoryName: string;
  budgeted: number;
  spent: number;
  percentage: number;
  remaining: number;
}

export interface MonthDateRange {
  start: Date;
  end: Date;
}

/**
 * Gets the start and end dates for a given month/year.
 */
function getMonthDateRange(month: number, year: number): MonthDateRange {
  const start = new Date(year, month - 1, 1); // month is 1-indexed
  const end = new Date(year, month - 1 + 1, 0, 23, 59, 59, 999); // Last day of month
  return { start, end };
}

// =============================================================================
// BUDGET CALCULATION
// =============================================================================

/**
 * Calculates the monthly budget for a user based on recurring items and debts.
 *
 * This is a PROJECTION (expected amounts), not actual spending.
 * For actual spending, use getCategoryProgress().
 */
export async function calculateMonthlyBudget(
  userId: string,
  month: number,
  year: number
): Promise<MonthlyBudget> {
  const { start, end } = getMonthDateRange(month, year);

  // 1. Calculate expected income from recurring items
  const incomeResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${recurringItems.amount}), 0)`,
    })
    .from(recurringItems)
    .where(
      and(
        eq(recurringItems.userId, userId),
        eq(recurringItems.type, 'INCOME'),
        eq(recurringItems.status, 'ACTIVE'),
        lte(recurringItems.nextDueDate, end)
      )
    );

  // 2. Calculate fixed expenses from recurring items
  const expensesResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${recurringItems.amount}), 0)`,
    })
    .from(recurringItems)
    .where(
      and(
        eq(recurringItems.userId, userId),
        eq(recurringItems.type, 'EXPENSE'),
        eq(recurringItems.status, 'ACTIVE'),
        lte(recurringItems.nextDueDate, end)
      )
    );

  // 3. Calculate debt payments
  // For loans: sum of monthlyPayment for active loans
  const loansResult = await database
    .select({
      total: sql<number>`COALESCE(SUM(${debtLoans.monthlyPayment}), 0)`,
    })
    .from(debtLoans)
    .where(
      and(
        eq(debtLoans.userId, userId),
        eq(debtLoans.isActive, true)
      )
    );

  // For credit cards: estimate minimum payment (15% of used amount as default)
  // Note: Drizzle doesn't support arithmetic in template literals, so we fetch and compute
  const cardsData = await database
    .select({
      usedAmount: debtCards.usedAmount,
    })
    .from(debtCards)
    .where(
      and(
        eq(debtCards.userId, userId),
        eq(debtCards.isActive, true)
      )
    );

  const cardsMinPayment = cardsData.reduce(
    (sum, card) => sum + card.usedAmount * 0.15,
    0
  );

  const totalIncomeExpected = Number(incomeResult[0]?.total ?? 0);
  const totalFixedExpenses = Number(expensesResult[0]?.total ?? 0);
  const totalDebtPayments =
    Number(loansResult[0]?.total ?? 0) +
    cardsMinPayment;

  const totalFreeAmount = totalIncomeExpected - totalFixedExpenses - totalDebtPayments;

  // 4. Get saved budget config if exists
  const savedBudget = await database.query.budgetsMonthly.findFirst({
    where: and(
      eq(budgetsMonthly.userId, userId),
      eq(budgetsMonthly.month, month),
      eq(budgetsMonthly.year, year)
    ),
  });

  const budgetConfig: BudgetConfig | null = savedBudget
    ? JSON.parse(savedBudget.budgetConfig)
    : null;

  return {
    month,
    year,
    totalIncomeExpected,
    totalFixedExpenses,
    totalDebtPayments,
    totalFreeAmount,
    budgetConfig,
  };
}

// =============================================================================
// CATEGORY SPENDING
// =============================================================================

/**
 * Gets the total spending for a specific category in a given month.
 */
export async function getCategorySpending(
  userId: string,
  categoryId: string,
  month: number,
  year: number
): Promise<number> {
  const { start, end } = getMonthDateRange(month, year);

  const result = await database
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.categoryId, categoryId),
        eq(transactions.type, 'EXPENSE'),
        eq(transactions.status, 'CONFIRMED'),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    );

  return Math.abs(Number(result[0]?.total ?? 0));
}

/**
 * Gets spending by category for a given month.
 */
export async function getSpendingByCategory(
  userId: string,
  month: number,
  year: number
): Promise<{ categoryId: string | null; categoryName: string | null; total: number }[]> {
  const { start, end } = getMonthDateRange(month, year);

  const results = await database
    .select({
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'EXPENSE'),
        eq(transactions.status, 'CONFIRMED'),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    )
    .groupBy(transactions.categoryId, categories.name);

  return results.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    total: Math.abs(Number(r.total)),
  }));
}

// =============================================================================
// CATEGORY PROGRESS
// =============================================================================

/**
 * Gets budget progress for all categories with assigned budgets.
 *
 * Returns an array with category spending vs budget, including percentage.
 */
export async function getCategoryProgress(
  userId: string,
  month: number,
  year: number
): Promise<CategoryProgress[]> {
  // Get saved budget config
  const savedBudget = await database.query.budgetsMonthly.findFirst({
    where: and(
      eq(budgetsMonthly.userId, userId),
      eq(budgetsMonthly.month, month),
      eq(budgetsMonthly.year, year)
    ),
  });

  if (!savedBudget) {
    // No budget configured for this month
    return [];
  }

  const budgetConfig: BudgetConfig = JSON.parse(savedBudget.budgetConfig);

  // Get spending by category for this month
  const spendingByCategory = await getSpendingByCategory(userId, month, year);
  const spendingMap = new Map(
    spendingByCategory.map((s) => [s.categoryId, s.total])
  );

  // Build progress array
  // Note: The budgetConfig.pockets contains per-pocket budgets
  // For category budgets, we need to look at budgetConfig directly
  // Since we don't have category-specific budgets stored, we'll
  // return the overall variable budget progress for now
  //
  // TODO: Extend to support per-category budgets in budgetConfig

  const progress: CategoryProgress[] = [];

  // Add variable budget category
  if (budgetConfig.variableBudget > 0) {
    const spent = await getTotalVariableSpending(userId, month, year);
    progress.push({
      categoryId: 'VARIABLE',
      categoryName: 'Gastos Variables',
      budgeted: budgetConfig.variableBudget,
      spent,
      percentage: Math.round((spent / budgetConfig.variableBudget) * 100),
      remaining: budgetConfig.variableBudget - spent,
    });
  }

  return progress;
}

/**
 * Gets total variable spending for a month (all expenses not assigned to pockets).
 */
async function getTotalVariableSpending(
  userId: string,
  month: number,
  year: number
): Promise<number> {
  const { start, end } = getMonthDateRange(month, year);

  // Get total expenses minus those that went to pockets (savings/investment pockets)
  const result = await database
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'EXPENSE'),
        eq(transactions.status, 'CONFIRMED'),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    );

  return Math.abs(Number(result[0]?.total ?? 0));
}

// =============================================================================
// BUDGET CONFIGURATION
// =============================================================================

/**
 * Saves or updates the budget configuration for a month.
 */
export async function saveBudgetConfig(
  userId: string,
  month: number,
  year: number,
  config: BudgetConfig
): Promise<void> {
  const now = new Date();

  const existing = await database.query.budgetsMonthly.findFirst({
    where: and(
      eq(budgetsMonthly.userId, userId),
      eq(budgetsMonthly.month, month),
      eq(budgetsMonthly.year, year)
    ),
  });

  if (existing) {
    await database
      .update(budgetsMonthly)
      .set({
        budgetConfig: JSON.stringify(config),
        updatedAt: now,
      })
      .where(eq(budgetsMonthly.id, existing.id));
  } else {
    await database.insert(budgetsMonthly).values({
      id: crypto.randomUUID(),
      userId,
      month,
      year,
      totalIncomeExpected: 0, // Will be calculated
      totalFixedExpenses: 0,
      totalDebtPayments: 0,
      totalFreeAmount: 0,
      budgetConfig: JSON.stringify(config),
      createdAt: now,
      updatedAt: now,
    });
  }
}

// =============================================================================
// DASHBOARD SUMMARY
// =============================================================================

export interface BudgetSummary {
  month: number;
  year: number;
  income: number;
  expenses: number;
  debts: number;
  free: number;
  topCategories: { name: string; amount: number; percentage: number }[];
}

/**
 * Gets a summary of the month's budget for dashboard display.
 */
export async function getBudgetSummary(
  userId: string,
  month: number,
  year: number
): Promise<BudgetSummary> {
  const budget = await calculateMonthlyBudget(userId, month, year);
  const { start, end } = getMonthDateRange(month, year);

  // Get actual expenses for the month
  const actualExpenses = await database
    .select({
      total: sql<number>`COALESCE(SUM(ABS(${transactions.amount})), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'EXPENSE'),
        eq(transactions.status, 'CONFIRMED'),
        gte(transactions.date, start),
        lte(transactions.date, end)
      )
    );

  const totalActualExpenses = Math.abs(Number(actualExpenses[0]?.total ?? 0));

  // Get top spending categories
  const categorySpending = await getSpendingByCategory(userId, month, year);
  const topCategories = categorySpending
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((c) => ({
      name: c.categoryName ?? 'Sin categoría',
      amount: c.total,
      percentage:
        totalActualExpenses > 0
          ? Math.round((c.total / totalActualExpenses) * 100)
          : 0,
    }));

  return {
    month,
    year,
    income: budget.totalIncomeExpected,
    expenses: budget.totalFixedExpenses,
    debts: budget.totalDebtPayments,
    free: budget.totalFreeAmount,
    topCategories,
  };
}
