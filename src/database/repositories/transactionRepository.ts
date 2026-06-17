import { database } from '../index';
import { transactions, accounts, pockets } from '../schema';
import { eq, and, gte, lte, desc, asc, sql, inArray } from 'drizzle-orm';
import type { Transaction, NewTransaction } from '../schema';

// =============================================================================
// TRANSACTION REPOSITORY
// =============================================================================

export interface TransactionFilters {
  dateFrom?: Date;
  dateTo?: Date;
  accountId?: string;
  pocketId?: string;
  categoryId?: string;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status?: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
}

export const TransactionRepository = {
  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(
    data: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Transaction> {
    // Validate TRANSFER requires destination
    if (data.type === 'TRANSFER') {
      if (!data.transferToAccountId && !data.transferToPocketId) {
        throw new Error(
          'Transfer transaction requires either transferToAccountId or transferToPocketId'
        );
      }
    }

    const now = new Date();
    const id = crypto.randomUUID();

    const newTransaction: NewTransaction = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await database.insert(transactions).values(newTransaction);

    const [created] = await database
      .select()
      .from(transactions)
      .where(eq(transactions.id, id));

    return created;
  },

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    data: Partial<
      Pick<
        Transaction,
        | 'description'
        | 'amount'
        | 'date'
        | 'categoryId'
        | 'pocketId'
        | 'status'
        | 'isConfirmed'
      >
    >
  ): Promise<Transaction | null> {
    const now = new Date();

    await database
      .update(transactions)
      .set({ ...data, updatedAt: now })
      .where(eq(transactions.id, id));

    return this.getById(id);
  },

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    await database.delete(transactions).where(eq(transactions.id, id));
  },

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Transaction | null> {
    const result = await database.query.transactions.findFirst({
      where: eq(transactions.id, id),
    });
    return result ?? null;
  },

  /**
   * Get all transactions for a user with optional filters.
   */
  async getAll(
    userId: string,
    filters?: TransactionFilters
  ): Promise<Transaction[]> {
    const conditions = [eq(transactions.userId, userId)];

    if (filters?.dateFrom) {
      conditions.push(gte(transactions.date, filters.dateFrom));
    }
    if (filters?.dateTo) {
      conditions.push(lte(transactions.date, filters.dateTo));
    }
    if (filters?.accountId) {
      conditions.push(eq(transactions.accountId, filters.accountId));
    }
    if (filters?.pocketId) {
      conditions.push(eq(transactions.pocketId, filters.pocketId));
    }
    if (filters?.categoryId) {
      conditions.push(eq(transactions.categoryId, filters.categoryId));
    }
    if (filters?.type) {
      conditions.push(eq(transactions.type, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(transactions.status, filters.status));
    }

    return database.query.transactions.findMany({
      where: and(...conditions),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
    });
  },

  /**
   * Get transactions for a specific account with pagination.
   */
  async getByAccount(
    accountId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Transaction[]> {
    return database.query.transactions.findMany({
      where: eq(transactions.accountId, accountId),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit,
      offset,
    });
  },

  /**
   * Get recent transactions for dashboard display.
   */
  async getRecent(userId: string, limit: number = 10): Promise<Transaction[]> {
    return database.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit,
    });
  },

  /**
   * Get transactions for a specific pocket.
   */
  async getByPocket(
    pocketId: string,
    limit?: number
  ): Promise<Transaction[]> {
    return database.query.transactions.findMany({
      where: eq(transactions.pocketId, pocketId),
      orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      limit,
    });
  },

  /**
   * Get pending transactions (for reminders/alerts).
   */
  async getPending(userId: string): Promise<Transaction[]> {
    return database.query.transactions.findMany({
      where: and(
        eq(transactions.userId, userId),
        eq(transactions.status, 'PENDING')
      ),
      orderBy: [asc(transactions.date)],
    });
  },

  // ---------------------------------------------------------------------------
  // TRANSFER OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Creates a transfer between accounts or pockets.
   *
   * DECISION: For same-account pocket transfers, we create TWO transactions
   * that cancel each other out in terms of account balance but change the
   * pocket distribution:
   *
   * - Pocket 1 loses $X: EXPENSE transaction with amount = -X
   * - Pocket 2 gains $X: INCOME transaction with amount = +X
   *
   * This approach:
   * 1. Preserves the account balance invariant (sum = 0 for the two txns)
   * 2. Correctly updates pocket balances
   * 3. Keeps the history of where the money moved
   * 4. Is simple to understand and audit
   *
   * For cross-account transfers:
   * - Source account loses $X: EXPENSE with amount = -X
   * - Destination account gains $X: INCOME with amount = +X
   */
  async createTransfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    options: {
      description?: string;
      fromPocketId?: string | null;
      toPocketId?: string | null;
      date?: Date;
      userId: string;
    }
  ): Promise<[Transaction, Transaction]> {
    const {
      description = 'Transfer',
      fromPocketId = null,
      toPocketId = null,
      date = new Date(),
      userId,
    } = options;

    const now = new Date();
    const id1 = crypto.randomUUID();
    const id2 = crypto.randomUUID();

    // Determine if this is a same-account transfer (pocket redistribution)
    const isSameAccount = fromAccountId === toAccountId;

    if (isSameAccount) {
      // SAME ACCOUNT: Move between pockets
      // Transaction 1: Deduct from source pocket
      // Transaction 2: Add to destination pocket
      await database.insert(transactions).values([
        {
          id: id1,
          userId,
          accountId: fromAccountId,
          pocketId: fromPocketId,
          type: 'TRANSFER',
          amount: -Math.abs(amount), // Always negative for the source
          description: `${description} (salida)`,
          date,
          status: 'CONFIRMED',
          isConfirmed: true,
          transferToAccountId: toAccountId,
          transferToPocketId: toPocketId,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: id2,
          userId,
          accountId: toAccountId,
          pocketId: toPocketId,
          type: 'TRANSFER',
          amount: Math.abs(amount), // Positive for the destination
          description: `${description} (entrada)`,
          date,
          status: 'CONFIRMED',
          isConfirmed: true,
          transferToAccountId: null,
          transferToPocketId: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    } else {
      // DIFFERENT ACCOUNTS: Actual transfer between accounts
      // Transaction 1: Deduct from source account
      // Transaction 2: Add to destination account
      await database.insert(transactions).values([
        {
          id: id1,
          userId,
          accountId: fromAccountId,
          pocketId: fromPocketId,
          type: 'TRANSFER',
          amount: -Math.abs(amount),
          description: `${description} → ${toAccountId.slice(0, 8)}`,
          date,
          status: 'CONFIRMED',
          isConfirmed: true,
          transferToAccountId: toAccountId,
          transferToPocketId: toPocketId,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: id2,
          userId,
          accountId: toAccountId,
          pocketId: toPocketId,
          type: 'TRANSFER',
          amount: Math.abs(amount),
          description: `${description} ← ${fromAccountId.slice(0, 8)}`,
          date,
          status: 'CONFIRMED',
          isConfirmed: true,
          transferToAccountId: null,
          transferToPocketId: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);
    }

    const [tx1] = await database
      .select()
      .from(transactions)
      .where(eq(transactions.id, id1));
    const [tx2] = await database
      .select()
      .from(transactions)
      .where(eq(transactions.id, id2));

    return [tx1, tx2];
  },

  // ---------------------------------------------------------------------------
  // BULK OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Delete multiple transactions by ID.
   */
  async deleteMany(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await database
      .delete(transactions)
      .where(inArray(transactions.id, ids));
  },

  /**
   * Update status for multiple transactions.
   */
  async updateStatusMany(
    ids: string[],
    status: 'CONFIRMED' | 'PENDING' | 'CANCELLED'
  ): Promise<void> {
    if (ids.length === 0) return;
    const now = new Date();
    await database
      .update(transactions)
      .set({ status, updatedAt: now })
      .where(inArray(transactions.id, ids));
  },

  // ---------------------------------------------------------------------------
  // AGGREGATIONS
  // ---------------------------------------------------------------------------

  /**
   * Get total income for a user in a date range.
   */
  async getTotalIncome(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<number> {
    const result = await database
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'INCOME'),
          eq(transactions.status, 'CONFIRMED'),
          gte(transactions.date, dateFrom),
          lte(transactions.date, dateTo)
        )
      );
    return result[0]?.total ?? 0;
  },

  /**
   * Get total expenses for a user in a date range.
   */
  async getTotalExpenses(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<number> {
    const result = await database
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'EXPENSE'),
          eq(transactions.status, 'CONFIRMED'),
          gte(transactions.date, dateFrom),
          lte(transactions.date, dateTo)
        )
      );
    return result[0]?.total ?? 0;
  },

  /**
   * Get expenses by category for a user in a date range.
   */
  async getExpensesByCategory(
    userId: string,
    dateFrom: Date,
    dateTo: Date
  ): Promise<{ categoryId: string | null; total: number }[]> {
    return database
      .select({
        categoryId: transactions.categoryId,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, 'EXPENSE'),
          eq(transactions.status, 'CONFIRMED'),
          gte(transactions.date, dateFrom),
          lte(transactions.date, dateTo)
        )
      )
      .groupBy(transactions.categoryId);
  },
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { Transaction, NewTransaction };
