import { database } from '../index';
import { accounts, transactions, pockets } from '../schema';
import { eq, and, sql, asc, desc } from 'drizzle-orm';
import type { Account, NewAccount } from '../schema';

// =============================================================================
// ACCOUNT REPOSITORY
// =============================================================================
//
// CRITICAL: Balance is NEVER stored. It is ALWAYS calculated from transactions.
// This is the single source of truth that prevents the synchronization bug
// where pocket balances diverge from account balances.
// =============================================================================

export const AccountRepository = {
  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async create(data: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Promise<Account> {
    const now = new Date();
    const id = crypto.randomUUID();

    const newAccount = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await database.insert(accounts).values(newAccount);

    const [created] = await database
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));

    return created;
  },

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async update(
    id: string,
    data: Partial<Pick<Account, 'name' | 'icon' | 'color' | 'institution' | 'cashflowClass' | 'isActive' | 'order'>>
  ): Promise<Account | null> {
    const now = new Date();

    await database
      .update(accounts)
      .set({ ...data, updatedAt: now })
      .where(eq(accounts.id, id));

    return this.getById(id);
  },

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async delete(id: string): Promise<void> {
    // Check if account has transactions
    const txCount = await database
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(eq(transactions.accountId, id));

    if (txCount[0].count > 0) {
      throw new Error(
        `Cannot delete account: it has ${txCount[0].count} associated transactions. ` +
        `Delete or reassign the transactions first.`
      );
    }

    // Check if account has pockets
    const pocketCount = await database
      .select({ count: sql<number>`count(*)` })
      .from(pockets)
      .where(eq(pockets.accountId, id));

    if (pocketCount[0].count > 0) {
      throw new Error(
        `Cannot delete account: it has ${pocketCount[0].count} associated pockets. ` +
        `Delete the pockets first.`
      );
    }

    await database.delete(accounts).where(eq(accounts.id, id));
  },

  // ---------------------------------------------------------------------------
  // QUERIES (without balance - use getBalance() for that)
  // ---------------------------------------------------------------------------

  async getAll(userId: string): Promise<Account[]> {
    return database.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.isActive, true)
      ),
      orderBy: [asc(accounts.order), asc(accounts.name)],
    });
  },

  async getById(id: string): Promise<Account | null> {
    const result = await database.query.accounts.findFirst({
      where: eq(accounts.id, id),
    });
    return result ?? null;
  },

  async getAllIncludingInactive(userId: string): Promise<Account[]> {
    return database.query.accounts.findMany({
      where: eq(accounts.userId, userId),
      orderBy: [asc(accounts.order), asc(accounts.name)],
    });
  },

  // ---------------------------------------------------------------------------
  // BALANCE CALCULATION (CRITICAL - ALWAYS CALCULATED, NEVER STORED)
  // ---------------------------------------------------------------------------

  /**
   * Calculates the current balance of an account by summing all transactions.
   * This is the ONLY source of truth for account balance.
   *
   * @returns Sum of all transaction amounts for this account (positive + negative)
   */
  async getBalance(accountId: string): Promise<number> {
    const result = await database
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.status, 'CONFIRMED')
        )
      );

    return result[0]?.total ?? 0;
  },

  /**
   * Calculates the balance of an account AS OF a specific date.
   * Useful for historical reports and patrimony evolution.
   */
  async getBalanceAsOf(accountId: string, date: Date): Promise<number> {
    const result = await database
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.status, 'CONFIRMED'),
          sql`${transactions.date} <= ${date.getTime()}`
        )
      );

    return result[0]?.total ?? 0;
  },

  // ---------------------------------------------------------------------------
  // GET ALL WITH BALANCES (OPTIMIZED - NO N+1 QUERIES)
  // ---------------------------------------------------------------------------

  /**
   * Returns all accounts for a user with their calculated balances.
   * Uses a single aggregated query instead of N+1 queries.
   */
  async getAllWithBalances(userId: string): Promise<(Account & { balance: number })[]> {
    // Single query: get all accounts with their transaction sums in one round trip
    const accountsWithSums = await database
      .select({
        accountId: accounts.id,
        balance: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(accounts)
      .leftJoin(
        transactions,
        and(
          eq(accounts.id, transactions.accountId),
          eq(transactions.status, 'CONFIRMED')
        )
      )
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.isActive, true)
        )
      )
      .groupBy(accounts.id)
      .orderBy(asc(accounts.order), asc(accounts.name));

    // Get the full account records
    const allAccounts = await database.query.accounts.findMany({
      where: and(
        eq(accounts.userId, userId),
        eq(accounts.isActive, true)
      ),
      orderBy: [asc(accounts.order), asc(accounts.name)],
    });

    // Merge: attach balance to each account
    const balanceMap = new Map(
      accountsWithSums.map((row) => [row.accountId, row.balance])
    );

    return allAccounts.map((account) => ({
      ...account,
      balance: balanceMap.get(account.id) ?? 0,
    }));
  },

  // ---------------------------------------------------------------------------
  // TOTAL PATRIMONY (SUM OF ALL ACCOUNTS)
  // ---------------------------------------------------------------------------

  /**
   * Calculates total patrimony (sum of all account balances) for a user.
   */
  async getTotalPatrimony(userId: string): Promise<number> {
    const result = await database
      .select({
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(accounts)
      .leftJoin(
        transactions,
        and(
          eq(accounts.id, transactions.accountId),
          eq(transactions.status, 'CONFIRMED')
        )
      )
      .where(eq(accounts.userId, userId));

    return result[0]?.total ?? 0;
  },
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { Account, NewAccount };
