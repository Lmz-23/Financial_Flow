import { sql, relations } from 'drizzle-orm';
import {
  sqliteTable,
  text,
  integer,
  real,
  check,
  index,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';
import { newId } from './ids';

// =============================================================================
// CONVENCIONES
// =============================================================================
// - Dinero: INTEGER en unidades menores (centavos), siempre positivo donde se indica.
//   El sentido (ingreso/gasto) lo da `type`, no el signo. No existe ninguna columna de saldo:
//   los saldos de cuenta, deuda y meta se DERIVAN de transacciones, aportes y ajustes.
// - Instantes (createdAt, date, spentAt, ...): INTEGER epoch en MILISEGUNDOS (mode 'timestamp_ms').
// - Fechas de calendario sin hora (anchorDate, nextDueDate, occurrenceDate): TEXT 'YYYY-MM-DD'
//   en hora local del dispositivo (CHECK con GLOB).
// - Ids: TEXT PK generado en JS con newId() (UUID v4 sin depender de crypto.randomUUID).
// - Booleanos: INTEGER 0/1 (mode 'boolean').
// - Las columnas enum de texto tienen ademas un CHECK ... IN (...) para que la BD lo haga cumplir.
// - REQUISITO: PRAGMA foreign_keys = ON en cada conexion (client.ts y test/helpers/db.ts);
//   sin el, SQLite ignora FK y los ON DELETE RESTRICT/CASCADE/SET NULL no se aplican.

const id = () => text('id').primaryKey().$defaultFn(newId);

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date());

const updatedAt = () =>
  integer('updated_at', { mode: 'timestamp_ms' })
    .notNull()
    .$defaultFn(() => new Date());

/** Patron de fecha de calendario 'YYYY-MM-DD' (NULL pasa el CHECK por semantica SQL). */
const isoDate = (col: AnySQLiteColumn) =>
  sql`${col} GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'`;

// =============================================================================
// USERS (una fila: 'default-user'; tambien guarda los ajustes)
// =============================================================================

export const users = sqliteTable(
  'users',
  {
    id: id(),
    currency: text('currency').notNull().default('COP'),
    themePreference: text('theme_preference', { enum: ['light', 'dark', 'system'] })
      .notNull()
      .default('system'),
    notifyPaymentReminders: integer('notify_payment_reminders', { mode: 'boolean' }).notNull().default(true),
    notifyWeeklySummary: integer('notify_weekly_summary', { mode: 'boolean' }).notNull().default(true),
    /** Hora local (0-23) de los avisos. */
    reminderHour: integer('reminder_hour').notNull().default(9),
    /** Tres estados: NULL = nunca decidido, 1 = activo, 0 = apagado por el usuario. */
    widgetCashflow: integer('widget_cashflow'),
    widgetDebts: integer('widget_debts'),
    widgetGoals: integer('widget_goals'),
    onboardingCompletedAt: integer('onboarding_completed_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('ck_users_theme', sql`${t.themePreference} IN ('light', 'dark', 'system')`),
    check('ck_users_reminder_hour', sql`${t.reminderHour} BETWEEN 0 AND 23`),
    check('ck_users_widget_cashflow', sql`${t.widgetCashflow} IN (0, 1)`),
    check('ck_users_widget_debts', sql`${t.widgetDebts} IN (0, 1)`),
    check('ck_users_widget_goals', sql`${t.widgetGoals} IN (0, 1)`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

// =============================================================================
// ACCOUNTS (sin columna de saldo)
// =============================================================================

export const accounts = sqliteTable(
  'accounts',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    type: text('type', { enum: ['CASH', 'SAVINGS', 'CHECKING', 'DIGITAL_WALLET'] }).notNull(),
    order: integer('order').notNull().default(0),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('ck_accounts_type', sql`${t.type} IN ('CASH', 'SAVINGS', 'CHECKING', 'DIGITAL_WALLET')`),
    index('idx_accounts_user').on(t.userId),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

// =============================================================================
// CATEGORIES (userId NULL = categoria base del sistema)
// =============================================================================

export const categories = sqliteTable(
  'categories',
  {
    id: id(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
    order: integer('order').notNull().default(0),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    check('ck_categories_type', sql`${t.type} IN ('INCOME', 'EXPENSE')`),
    // UNIQUE(userId, type, name) segun el documento. En SQLite los NULL son distintos entre si,
    // asi que este indice NO protege las categorias del sistema (userId NULL)...
    uniqueIndex('uq_categories_user_type_name').on(t.userId, t.type, t.name),
    // ...por eso se agrega este UNIQUE parcial para las del sistema.
    uniqueIndex('uq_categories_system_type_name')
      .on(t.type, t.name)
      .where(sql`${t.userId} IS NULL`),
  ],
);

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

// =============================================================================
// DEBTS (sin columna de saldo: saldo = ajustes - capital aplicado por pagos)
// =============================================================================

export const debts = sqliteTable(
  'debts',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    /** NULL = cuota "sin definir". */
    installmentMinor: integer('installment_minor'),
    /** Tasa mensual (fraccion, 0.02 = 2%). NULL si se desconoce. */
    monthlyRate: real('monthly_rate'),
    rateSource: text('rate_source', { enum: ['KNOWN', 'ESTIMATED', 'UNKNOWN'] }).notNull(),
    initialPaidCount: integer('initial_paid_count').notNull().default(0),
    totalCount: integer('total_count'),
    archivedAt: integer('archived_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('ck_debts_installment', sql`${t.installmentMinor} IS NULL OR ${t.installmentMinor} > 0`),
    check('ck_debts_rate', sql`${t.monthlyRate} IS NULL OR ${t.monthlyRate} >= 0`),
    check('ck_debts_rate_source', sql`${t.rateSource} IN ('KNOWN', 'ESTIMATED', 'UNKNOWN')`),
    check('ck_debts_initial_paid', sql`${t.initialPaidCount} >= 0`),
    check('ck_debts_total_count', sql`${t.totalCount} IS NULL OR ${t.totalCount} > 0`),
    index('idx_debts_user').on(t.userId),
  ],
);

export type Debt = typeof debts.$inferSelect;
export type NewDebt = typeof debts.$inferInsert;

// =============================================================================
// GOALS
// =============================================================================

export const goals = sqliteTable(
  'goals',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    targetMinor: integer('target_minor').notNull(),
    status: text('status', { enum: ['ACTIVE', 'SPENT'] }).notNull().default('ACTIVE'),
    spentAt: integer('spent_at', { mode: 'timestamp_ms' }),
    /** Foto del ahorro al cerrar la meta. */
    spentAmountMinor: integer('spent_amount_minor'),
    targetDate: integer('target_date', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('ck_goals_target', sql`${t.targetMinor} > 0`),
    check('ck_goals_status', sql`${t.status} IN ('ACTIVE', 'SPENT')`),
    // status='SPENT' <=> spentAt y spentAmountMinor no nulos (ACTIVE => ambos NULL).
    check(
      'ck_goals_spent_fields',
      sql`(${t.status} = 'SPENT' AND ${t.spentAt} IS NOT NULL AND ${t.spentAmountMinor} IS NOT NULL)
        OR (${t.status} = 'ACTIVE' AND ${t.spentAt} IS NULL AND ${t.spentAmountMinor} IS NULL)`,
    ),
    check('ck_goals_spent_amount', sql`${t.spentAmountMinor} IS NULL OR ${t.spentAmountMinor} >= 0`),
    index('idx_goals_user').on(t.userId),
  ],
);

export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;

// =============================================================================
// RECURRING_ITEMS
// =============================================================================
// frequency:
//   WEEKLY   = cada 7 dias.
//   BIWEEKLY = "quincenal" en el sentido colombiano: los dias 15 y ULTIMO dia del mes
//              (NO cada 14 dias).
//   MONTHLY  = mismo dia del mes del ancla (si el mes es mas corto, el ultimo dia).

export const recurringItems = sqliteTable(
  'recurring_items',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
    kind: text('kind', { enum: ['STANDARD', 'DEBT_INSTALLMENT'] }).notNull().default('STANDARD'),
    /** Solo para kind='DEBT_INSTALLMENT'. UNIQUE: una cuota recurrente por deuda. */
    debtId: text('debt_id').references(() => debts.id, { onDelete: 'restrict' }),
    /** NULL para cuotas de deuda (se toma el nombre de la deuda). */
    name: text('name'),
    /** NULL para cuotas de deuda (se toma la cuota de la deuda). */
    amountMinor: integer('amount_minor'),
    isPassive: integer('is_passive', { mode: 'boolean' }).notNull().default(false),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    /** Solo sugerencia; al confirmar siempre se pide cuenta. */
    defaultAccountId: text('default_account_id').references(() => accounts.id, { onDelete: 'set null' }),
    frequency: text('frequency', { enum: ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] }).notNull(),
    anchorDate: text('anchor_date'),
    /** NULL = "sin fecha" (p. ej. lo creado en onboarding). */
    nextDueDate: text('next_due_date'),
    snoozedUntil: integer('snoozed_until', { mode: 'timestamp_ms' }),
    status: text('status', { enum: ['ACTIVE', 'PAUSED'] }).notNull().default('ACTIVE'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('ck_rec_type', sql`${t.type} IN ('INCOME', 'EXPENSE')`),
    check('ck_rec_kind', sql`${t.kind} IN ('STANDARD', 'DEBT_INSTALLMENT')`),
    check('ck_rec_frequency', sql`${t.frequency} IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY')`),
    check('ck_rec_status', sql`${t.status} IN ('ACTIVE', 'PAUSED')`),
    // kind='DEBT_INSTALLMENT' <=> debtId no nulo.
    check('ck_rec_kind_debt', sql`(${t.kind} = 'DEBT_INSTALLMENT') = (${t.debtId} IS NOT NULL)`),
    // DEBT_INSTALLMENT => type='EXPENSE' y amountMinor/name NULL.
    check(
      'ck_rec_debt_installment',
      sql`${t.kind} <> 'DEBT_INSTALLMENT' OR (${t.type} = 'EXPENSE' AND ${t.amountMinor} IS NULL AND ${t.name} IS NULL)`,
    ),
    // STANDARD => amountMinor > 0 y name no nulo.
    check(
      'ck_rec_standard',
      sql`${t.kind} <> 'STANDARD' OR (${t.amountMinor} IS NOT NULL AND ${t.amountMinor} > 0 AND ${t.name} IS NOT NULL)`,
    ),
    check('ck_rec_passive_income', sql`${t.isPassive} = 0 OR ${t.type} = 'INCOME'`),
    check('ck_rec_anchor_date', isoDate(t.anchorDate)),
    check('ck_rec_next_due_date', isoDate(t.nextDueDate)),
    uniqueIndex('uq_rec_debt').on(t.debtId),
    index('idx_rec_user_status').on(t.userId, t.status),
    index('idx_rec_category').on(t.categoryId),
    index('idx_rec_default_account').on(t.defaultAccountId),
  ],
);

export type RecurringItem = typeof recurringItems.$inferSelect;
export type NewRecurringItem = typeof recurringItems.$inferInsert;

// =============================================================================
// TRANSACTIONS (solo ingresos y gastos reales)
// =============================================================================

export const transactions = sqliteTable(
  'transactions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
    type: text('type', { enum: ['INCOME', 'EXPENSE'] }).notNull(),
    kind: text('kind', { enum: ['STANDARD', 'DEBT_PAYMENT'] }).notNull().default('STANDARD'),
    amountMinor: integer('amount_minor').notNull(),
    description: text('description').notNull().default(''),
    /** Instante del movimiento (epoch ms). */
    date: integer('date', { mode: 'timestamp_ms' }).notNull(),
    categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
    isPassive: integer('is_passive', { mode: 'boolean' }).notNull().default(false),
    debtId: text('debt_id').references(() => debts.id, { onDelete: 'restrict' }),
    debtPaymentType: text('debt_payment_type', { enum: ['INSTALLMENT', 'EXTRA'] }),
    /** Capital aplicado a la deuda: 0 <= x <= amountMinor (el sobrante de un abono grande no es capital). */
    debtPrincipalAppliedMinor: integer('debt_principal_applied_minor'),
    recurringItemId: text('recurring_item_id').references(() => recurringItems.id, { onDelete: 'set null' }),
    /** Ocurrencia del recurrente que esta transaccion confirma ('YYYY-MM-DD'). */
    occurrenceDate: text('occurrence_date'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('ck_tx_amount', sql`${t.amountMinor} > 0`),
    check('ck_tx_type', sql`${t.type} IN ('INCOME', 'EXPENSE')`),
    check('ck_tx_kind', sql`${t.kind} IN ('STANDARD', 'DEBT_PAYMENT')`),
    check('ck_tx_payment_type', sql`${t.debtPaymentType} IN ('INSTALLMENT', 'EXTRA')`),
    check('ck_tx_passive_income', sql`${t.isPassive} = 0 OR ${t.type} = 'INCOME'`),
    // kind='DEBT_PAYMENT' => EXPENSE con debtId, debtPaymentType y debtPrincipalAppliedMinor no nulos.
    check(
      'ck_tx_debt_payment',
      sql`${t.kind} <> 'DEBT_PAYMENT' OR (${t.type} = 'EXPENSE' AND ${t.debtId} IS NOT NULL AND ${t.debtPaymentType} IS NOT NULL AND ${t.debtPrincipalAppliedMinor} IS NOT NULL)`,
    ),
    // kind='STANDARD' => los tres campos de deuda NULL (cierra el "si y solo si").
    check(
      'ck_tx_standard_no_debt',
      sql`${t.kind} <> 'STANDARD' OR (${t.debtId} IS NULL AND ${t.debtPaymentType} IS NULL AND ${t.debtPrincipalAppliedMinor} IS NULL)`,
    ),
    check(
      'ck_tx_principal_range',
      sql`${t.debtPrincipalAppliedMinor} IS NULL OR (${t.debtPrincipalAppliedMinor} >= 0 AND ${t.debtPrincipalAppliedMinor} <= ${t.amountMinor})`,
    ),
    // Una transaccion ligada a un recurrente debe indicar la ocurrencia (si no, el UNIQUE parcial no la cubriria).
    check('ck_tx_occurrence_required', sql`${t.recurringItemId} IS NULL OR ${t.occurrenceDate} IS NOT NULL`),
    check('ck_tx_occurrence_date', isoDate(t.occurrenceDate)),
    index('idx_tx_user_date').on(t.userId, t.date),
    index('idx_tx_account').on(t.accountId),
    index('idx_tx_debt').on(t.debtId),
    index('idx_tx_category').on(t.categoryId),
    // Como mucho una transaccion por (recurrente, ocurrencia).
    uniqueIndex('uq_tx_recurring_occurrence')
      .on(t.recurringItemId, t.occurrenceDate)
      .where(sql`${t.recurringItemId} IS NOT NULL`),
  ],
);

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

// =============================================================================
// GOAL_CONTRIBUTIONS (transferencia interna cuenta -> meta; nunca es Transaction)
// =============================================================================

export const goalContributions = sqliteTable(
  'goal_contributions',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    goalId: text('goal_id').notNull().references(() => goals.id, { onDelete: 'restrict' }),
    accountId: text('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
    amountMinor: integer('amount_minor').notNull(),
    date: integer('date', { mode: 'timestamp_ms' }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('ck_contrib_amount', sql`${t.amountMinor} > 0`),
    index('idx_contrib_goal').on(t.goalId),
    index('idx_contrib_account').on(t.accountId),
  ],
);

export type GoalContribution = typeof goalContributions.$inferSelect;
export type NewGoalContribution = typeof goalContributions.$inferInsert;

// =============================================================================
// BALANCE_ADJUSTMENTS (apertura / correccion manual / cierre de cuenta, deuda o meta)
// =============================================================================
// Tres FK reales (no referencia polimorfica) para que SQLite haga cumplir la integridad.
// ON DELETE CASCADE: el ajuste es un hecho SOBRE su objetivo y no tiene sentido sin el
// (los servicios borran cuenta/deuda/meta solo cuando no tienen movimientos).

export const balanceAdjustments = sqliteTable(
  'balance_adjustments',
  {
    id: id(),
    userId: text('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
    targetType: text('target_type', { enum: ['ACCOUNT', 'DEBT', 'GOAL'] }).notNull(),
    accountId: text('account_id').references(() => accounts.id, { onDelete: 'cascade' }),
    debtId: text('debt_id').references(() => debts.id, { onDelete: 'cascade' }),
    goalId: text('goal_id').references(() => goals.id, { onDelete: 'cascade' }),
    previousMinor: integer('previous_minor').notNull(),
    newMinor: integer('new_minor').notNull(),
    deltaMinor: integer('delta_minor').notNull(),
    reason: text('reason', { enum: ['OPENING', 'MANUAL', 'ARCHIVE_CLOSE'] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('ck_adj_target_type', sql`${t.targetType} IN ('ACCOUNT', 'DEBT', 'GOAL')`),
    check('ck_adj_reason', sql`${t.reason} IN ('OPENING', 'MANUAL', 'ARCHIVE_CLOSE')`),
    // Exactamente un FK no nulo y que coincida con targetType.
    check(
      'ck_adj_single_target',
      sql`(${t.targetType} = 'ACCOUNT' AND ${t.accountId} IS NOT NULL AND ${t.debtId} IS NULL AND ${t.goalId} IS NULL)
        OR (${t.targetType} = 'DEBT' AND ${t.debtId} IS NOT NULL AND ${t.accountId} IS NULL AND ${t.goalId} IS NULL)
        OR (${t.targetType} = 'GOAL' AND ${t.goalId} IS NOT NULL AND ${t.accountId} IS NULL AND ${t.debtId} IS NULL)`,
    ),
    check('ck_adj_delta', sql`${t.deltaMinor} = ${t.newMinor} - ${t.previousMinor}`),
    // Deudas y metas nunca quedan negativas; las cuentas si pueden.
    check('ck_adj_non_negative', sql`${t.targetType} = 'ACCOUNT' OR ${t.newMinor} >= 0`),
    index('idx_adj_account').on(t.accountId),
    index('idx_adj_debt').on(t.debtId),
    index('idx_adj_goal').on(t.goalId),
  ],
);

export type BalanceAdjustment = typeof balanceAdjustments.$inferSelect;
export type NewBalanceAdjustment = typeof balanceAdjustments.$inferInsert;

// =============================================================================
// RELATIONS
// =============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  categories: many(categories),
  transactions: many(transactions),
  debts: many(debts),
  goals: many(goals),
  goalContributions: many(goalContributions),
  balanceAdjustments: many(balanceAdjustments),
  recurringItems: many(recurringItems),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  goalContributions: many(goalContributions),
  balanceAdjustments: many(balanceAdjustments),
  recurringItems: many(recurringItems),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  recurringItems: many(recurringItems),
}));

export const debtsRelations = relations(debts, ({ one, many }) => ({
  user: one(users, { fields: [debts.userId], references: [users.id] }),
  transactions: many(transactions),
  balanceAdjustments: many(balanceAdjustments),
  // 0..1: cuota recurrente vinculada (el FK vive en recurring_items.debtId).
  recurringItem: one(recurringItems),
}));

export const goalsRelations = relations(goals, ({ one, many }) => ({
  user: one(users, { fields: [goals.userId], references: [users.id] }),
  contributions: many(goalContributions),
  balanceAdjustments: many(balanceAdjustments),
}));

export const recurringItemsRelations = relations(recurringItems, ({ one, many }) => ({
  user: one(users, { fields: [recurringItems.userId], references: [users.id] }),
  debt: one(debts, { fields: [recurringItems.debtId], references: [debts.id] }),
  category: one(categories, { fields: [recurringItems.categoryId], references: [categories.id] }),
  defaultAccount: one(accounts, { fields: [recurringItems.defaultAccountId], references: [accounts.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  debt: one(debts, { fields: [transactions.debtId], references: [debts.id] }),
  recurringItem: one(recurringItems, { fields: [transactions.recurringItemId], references: [recurringItems.id] }),
}));

export const goalContributionsRelations = relations(goalContributions, ({ one }) => ({
  user: one(users, { fields: [goalContributions.userId], references: [users.id] }),
  goal: one(goals, { fields: [goalContributions.goalId], references: [goals.id] }),
  account: one(accounts, { fields: [goalContributions.accountId], references: [accounts.id] }),
}));

export const balanceAdjustmentsRelations = relations(balanceAdjustments, ({ one }) => ({
  user: one(users, { fields: [balanceAdjustments.userId], references: [users.id] }),
  account: one(accounts, { fields: [balanceAdjustments.accountId], references: [accounts.id] }),
  debt: one(debts, { fields: [balanceAdjustments.debtId], references: [debts.id] }),
  goal: one(goals, { fields: [balanceAdjustments.goalId], references: [goals.id] }),
}));
