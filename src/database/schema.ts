import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// =============================================================================
// HELPERS
// =============================================================================

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
};

const nullableTimestamp = {
  nullable: (field: ReturnType<typeof integer>) => field,
};

// =============================================================================
// USERS
// =============================================================================

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  ...timestamps,
  theme: text('theme', { enum: ['dark', 'light'] }).default('dark').notNull(),
  currency: text('currency').default('COP').notNull(),
  notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).default(true).notNull(),
  reminderDaysBefore: integer('reminder_days_before').default(1).notNull(),
  onboardingCompleted: integer('onboarding_completed', { mode: 'boolean' }).default(false).notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// =============================================================================
// ACCOUNTS
// =============================================================================

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['CHECKING', 'SAVINGS', 'POCKET', 'INVESTMENT', 'CASH', 'OTHER'],
  }).notNull(),
  institution: text('institution'),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  cashflowClass: text('cashflow_class', { enum: ['ASSET', 'NEUTRAL'] }).default('NEUTRAL').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  order: integer('order').default(0).notNull(),
  ...timestamps,
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

// =============================================================================
// POCKETS
// =============================================================================

export const pockets = sqliteTable('pockets', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  goalAmount: real('goal_amount'),
  targetDate: integer('target_date', { mode: 'timestamp' }),
  color: text('color').notNull(),
  icon: text('icon').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  order: integer('order').default(0).notNull(),
  ...timestamps,
});

export type Pocket = typeof pockets.$inferSelect;
export type NewPocket = typeof pockets.$inferInsert;

// =============================================================================
// CATEGORIES
// =============================================================================

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }), // null = system default
  name: text('name').notNull(),
  type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
  icon: text('icon').notNull(),
  color: text('color').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

// =============================================================================
// TRANSACTIONS
// =============================================================================

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  pocketId: text('pocket_id').references(() => pockets.id, { onDelete: 'set null' }), // null = implicit "Unassigned" pocket
  type: text('type', { enum: ['INCOME', 'EXPENSE', 'TRANSFER'] }).notNull(),
  amount: real('amount').notNull(), // positive for income, negative for expense
  description: text('description').notNull(),
  date: integer('date', { mode: 'timestamp' }).notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  recurringItemId: text('recurring_item_id').references(() => recurringItems.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['CONFIRMED', 'PENDING', 'CANCELLED'] }).default('CONFIRMED').notNull(),
  isConfirmed: integer('is_confirmed', { mode: 'boolean' }).default(true).notNull(),
  transferToAccountId: text('transfer_to_account_id').references(() => accounts.id, { onDelete: 'set null' }),
  transferToPocketId: text('transfer_to_pocket_id').references(() => pockets.id, { onDelete: 'set null' }),
  ...timestamps,
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// =============================================================================
// RECURRING_ITEMS
// =============================================================================

export const recurringItems = sqliteTable('recurring_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  incomeSource: text('income_source', { enum: ['EARNED', 'PASSIVE'] }), // only for INCOME type
  frequency: text('frequency', { enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY', 'ANNUAL'] }).notNull(),
  dayOfWeek: integer('day_of_week'), // 0-6 for WEEKLY
  dayOfMonth: integer('day_of_month'), // 1-31 for MONTHLY
  month: integer('month'), // 1-12 for ANNUAL
  isAutoConfirm: integer('is_auto_confirm', { mode: 'boolean' }).default(false).notNull(),
  isAutoDebit: integer('is_auto_debit', { mode: 'boolean' }).default(false).notNull(),
  status: text('status', {
    enum: ['ACTIVE', 'PAUSED', 'PENDING_CONFIRM', 'PENDING_PAYMENT'],
  }).default('ACTIVE').notNull(),
  nextDueDate: integer('next_due_date', { mode: 'timestamp' }).notNull(),
  lastExecutedAt: integer('last_executed_at', { mode: 'timestamp' }),
  ...timestamps,
});

export type RecurringItem = typeof recurringItems.$inferSelect;
export type NewRecurringItem = typeof recurringItems.$inferInsert;

// =============================================================================
// DEBT_CARDS
// =============================================================================

export const debtCards = sqliteTable('debt_cards', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  creditLimit: real('credit_limit').notNull(),
  usedAmount: real('used_amount').notNull(),
  cutoffDay: integer('cutoff_day').notNull(),
  paymentDay: integer('payment_day').notNull(),
  interestRateMonthly: real('interest_rate_monthly'),
  minPaymentPercent: real('min_payment_percent'),
  isAutoDebit: integer('is_auto_debit', { mode: 'boolean' }).default(false).notNull(),
  cashflowClass: text('cashflow_class').default('LIABILITY').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...timestamps,
});

export type DebtCard = typeof debtCards.$inferSelect;
export type NewDebtCard = typeof debtCards.$inferInsert;

// =============================================================================
// DEBT_LOANS
// =============================================================================

export const debtLoans = sqliteTable('debt_loans', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  institution: text('institution').notNull(),
  originalAmount: real('original_amount').notNull(),
  currentBalance: real('current_balance').notNull(),
  monthlyPayment: real('monthly_payment').notNull(),
  paymentDayOfMonth: integer('payment_day_of_month').notNull(),
  totalInstallments: integer('total_installments').notNull(),
  remainingInstallments: integer('remaining_installments').notNull(),
  interestRateMonthly: real('interest_rate_monthly'),
  interestRateAnnual: real('interest_rate_annual'),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  isAutoDebit: integer('is_auto_debit', { mode: 'boolean' }).default(false).notNull(),
  cashflowClass: text('cashflow_class').default('LIABILITY').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  ...timestamps,
});

export type DebtLoan = typeof debtLoans.$inferSelect;
export type NewDebtLoan = typeof debtLoans.$inferInsert;

// =============================================================================
// BUDGETS_MONTHLY
// =============================================================================

export const budgetsMonthly = sqliteTable('budgets_monthly', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(), // 1-12
  year: integer('year').notNull(),
  totalIncomeExpected: real('total_income_expected').notNull(),
  totalFixedExpenses: real('total_fixed_expenses').notNull(),
  totalDebtPayments: real('total_debt_payments').notNull(),
  totalFreeAmount: real('total_free_amount').notNull(),
  budgetConfig: text('budget_config').notNull(), // JSON serialized
  ...timestamps,
});

export type BudgetMonthly = typeof budgetsMonthly.$inferSelect;
export type NewBudgetMonthly = typeof budgetsMonthly.$inferInsert;

// =============================================================================
// DISTRIBUTION_RULES
// =============================================================================

export const distributionRules = sqliteTable('distribution_rules', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  percentage: real('percentage').notNull(),
  targetType: text('target_type', {
    enum: ['POCKET', 'ACCOUNT', 'SAVINGS', 'INVESTMENT'],
  }).notNull(),
  targetId: text('target_id').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  order: integer('order').default(0).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export type DistributionRule = typeof distributionRules.$inferSelect;
export type NewDistributionRule = typeof distributionRules.$inferInsert;

// =============================================================================
// RELATIONS
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  pockets: many(pockets),
  categories: many(categories),
  transactions: many(transactions),
  recurringItems: many(recurringItems),
  debtCards: many(debtCards),
  debtLoans: many(debtLoans),
  budgetsMonthly: many(budgetsMonthly),
  distributionRules: many(distributionRules),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
  pockets: many(pockets),
  transactions: many(transactions),
}));

export const pocketsRelations = relations(pockets, ({ one, many }) => ({
  user: one(users, {
    fields: [pockets.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [pockets.accountId],
    references: [accounts.id],
  }),
  transactions: many(transactions),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, {
    fields: [categories.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  pocket: one(pockets, {
    fields: [transactions.pocketId],
    references: [pockets.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  recurringItem: one(recurringItems, {
    fields: [transactions.recurringItemId],
    references: [recurringItems.id],
  }),
  transferToAccount: one(accounts, {
    fields: [transactions.transferToAccountId],
    references: [accounts.id],
  }),
  transferToPocket: one(pockets, {
    fields: [transactions.transferToPocketId],
    references: [pockets.id],
  }),
}));

export const recurringItemsRelations = relations(recurringItems, ({ one, many }) => ({
  user: one(users, {
    fields: [recurringItems.userId],
    references: [users.id],
  }),
  account: one(accounts, {
    fields: [recurringItems.accountId],
    references: [accounts.id],
  }),
  transactions: many(transactions),
}));

export const debtCardsRelations = relations(debtCards, ({ one }) => ({
  user: one(users, {
    fields: [debtCards.userId],
    references: [users.id],
  }),
}));

export const debtLoansRelations = relations(debtLoans, ({ one }) => ({
  user: one(users, {
    fields: [debtLoans.userId],
    references: [users.id],
  }),
}));

export const budgetsMonthlyRelations = relations(budgetsMonthly, ({ one }) => ({
  user: one(users, {
    fields: [budgetsMonthly.userId],
    references: [users.id],
  }),
}));

export const distributionRulesRelations = relations(distributionRules, ({ one }) => ({
  user: one(users, {
    fields: [distributionRules.userId],
    references: [users.id],
  }),
}));
