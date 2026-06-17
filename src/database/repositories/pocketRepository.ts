import { database } from '../index';
import { pockets, transactions, accounts } from '../schema';
import { eq, and, sql, asc, isNull } from 'drizzle-orm';
import { AccountRepository } from './accountRepository';
import type { Pocket, NewPocket } from '../schema';

// =============================================================================
// POCKET REPOSITORY
// =============================================================================
//
// CRITICAL: Pocket balance is NEVER stored. It is ALWAYS calculated from
// transactions. The implicit "Unassigned" pocket (Sin asignar) doesn't even
// exist as a record - it's calculated as SUM of transactions where pocketId IS NULL.
//
// INVARIANT: account_balance = unassigned_balance + Σ(explicit_pocket_balances)
// =============================================================================

export const PocketRepository = {
  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  /**
   * Creates a new pocket. accountId is REQUIRED.
   * There is no currentAmount field - balance is always calculated.
   */
  async create(data: Omit<Pocket, 'id' | 'createdAt' | 'updatedAt'>): Promise<Pocket> {
    if (!data.accountId) {
      throw new Error('accountId is required when creating a pocket');
    }

    const now = new Date();
    const id = crypto.randomUUID();

    const newPocket = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await database.insert(pockets).values(newPocket);

    const [created] = await database
      .select()
      .from(pockets)
      .where(eq(pockets.id, id));

    return created;
  },

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  /**
   * Updates editable fields. Never allows writing balance directly.
   */
  async update(
    id: string,
    data: Partial<Pick<Pocket, 'name' | 'icon' | 'color' | 'goalAmount' | 'targetDate' | 'isActive' | 'order'>>
  ): Promise<Pocket | null> {
    const now = new Date();

    await database
      .update(pockets)
      .set({ ...data, updatedAt: now })
      .where(eq(pockets.id, id));

    return this.getById(id);
  },

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  /**
   * Deletes a pocket. Transactions that belonged to this pocket become
   * unassigned (pocketId = null) so money and history are preserved.
   */
  async delete(id: string): Promise<void> {
    // First, set all transactions of this pocket to null (unassigned)
    await database
      .update(transactions)
      .set({ pocketId: null })
      .where(eq(transactions.pocketId, id));

    // Now delete the pocket
    await database.delete(pockets).where(eq(pockets.id, id));
  },

  // ---------------------------------------------------------------------------
  // QUERIES
  // ---------------------------------------------------------------------------

  async getById(id: string): Promise<Pocket | null> {
    const result = await database.query.pockets.findFirst({
      where: eq(pockets.id, id),
    });
    return result ?? null;
  },

  /**
   * Returns all EXPLICIT pockets for an account (does NOT include implicit "Sin asignar").
   */
  async getAllByAccount(accountId: string): Promise<Pocket[]> {
    return database.query.pockets.findMany({
      where: and(
        eq(pockets.accountId, accountId),
        eq(pockets.isActive, true)
      ),
      orderBy: [asc(pockets.order), asc(pockets.name)],
    });
  },

  /**
   * Returns all pockets for a user (across all accounts).
   */
  async getAllByUser(userId: string): Promise<Pocket[]> {
    return database.query.pockets.findMany({
      where: and(
        eq(pockets.userId, userId),
        eq(pockets.isActive, true)
      ),
      orderBy: [asc(pockets.order), asc(pockets.name)],
    });
  },

  // ---------------------------------------------------------------------------
  // BALANCE CALCULATION (CRITICAL - ALWAYS CALCULATED, NEVER STORED)
  // ---------------------------------------------------------------------------

  /**
   * Calculates the balance of a pocket by summing all its transactions.
   * Uses SUM() of Drizzle, not a JavaScript loop.
   */
  async getBalance(pocketId: string): Promise<number> {
    const result = await database
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.pocketId, pocketId),
          eq(transactions.status, 'CONFIRMED')
        )
      );

    return result[0]?.total ?? 0;
  },

  /**
   * Calculates the balance of the IMPLICIT "Unassigned" pocket for an account.
   * This pocket doesn't exist as a record - it's derived from:
   *   account_balance - Σ(explicit_pocket_balances)
   *
   * Efficiently calculated as: SUM of transactions where pocketId IS NULL
   */
  async getUnassignedBalance(accountId: string): Promise<number> {
    // OPTIMIZED: Instead of calculating account balance and subtracting all
    // explicit pockets, we directly sum transactions where pocketId IS NULL.
    // This is mathematically equivalent and avoids N+1 queries.
    const result = await database
      .select({ total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)` })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.status, 'CONFIRMED'),
          isNull(transactions.pocketId) // pocketId IS NULL = unassigned
        )
      );

    return result[0]?.total ?? 0;
  },

  // ---------------------------------------------------------------------------
  // GET ALL WITH BALANCES (OPTIMIZED - NO N+1)
  // ---------------------------------------------------------------------------

  /**
   * Returns all pockets for an account WITH their calculated balances,
   * PLUS the implicit "Sin asignar" pocket as an additional object.
   *
   * Uses a single grouped query to avoid N+1.
   */
  async getAllByAccountWithBalances(accountId: string): Promise<{
    explicit: (Pocket & { balance: number })[];
    implicit: { name: string; balance: number }; // "Sin asignar"
  }> {
    // Single query: sum transactions grouped by pocketId (including NULL)
    const balancesByPocket = await database
      .select({
        pocketId: transactions.pocketId,
        total: sql<number>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.accountId, accountId),
          eq(transactions.status, 'CONFIRMED')
        )
      )
      .groupBy(transactions.pocketId);

    // Create a map for quick lookup
    const balanceMap = new Map<string, number>();
    for (const row of balancesByPocket) {
      if (row.pocketId !== null) {
        balanceMap.set(row.pocketId, row.total);
      }
      // If pocketId is null, it belongs to "unassigned" - handled below
    }

    // Get explicit pockets
    const explicitPockets = await database.query.pockets.findMany({
      where: and(
        eq(pockets.accountId, accountId),
        eq(pockets.isActive, true)
      ),
      orderBy: [asc(pockets.order), asc(pockets.name)],
    });

    // Attach calculated balances to explicit pockets
    const explicitWithBalances = explicitPockets.map((pocket) => ({
      ...pocket,
      balance: balanceMap.get(pocket.id) ?? 0,
    }));

    // Calculate implicit "Sin asignar" balance
    // It's the sum of all transactions where pocketId IS NULL
    const implicitBalance = balanceMap.get('__null__') ?? 0;

    return {
      explicit: explicitWithBalances,
      implicit: {
        name: 'Sin asignar',
        balance: implicitBalance,
      },
    };
  },

  // ---------------------------------------------------------------------------
  // ACCOUNT INTEGRITY VERIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Verifies the invariant: account_balance = unassigned + Σ(explicit)
   * Returns true if consistent, false if data is corrupted.
   *
   * This should be called after any transaction operation to ensure integrity.
   */
  async verifyIntegrity(accountId: string): Promise<boolean> {
    const accountBalance = await AccountRepository.getBalance(accountId);

    const { explicit, implicit } = await this.getAllByAccountWithBalances(accountId);
    const explicitSum = explicit.reduce((sum, p) => sum + p.balance, 0);
    const totalDistributed = explicitSum + implicit.balance;

    // Allow small floating point differences (due to decimal precision)
    const diff = Math.abs(accountBalance - totalDistributed);
    const isValid = diff < 0.01;

    if (!isValid) {
      console.error('[IntegrityService] Pocket invariant violated:', {
        accountId,
        accountBalance,
        explicitSum,
        implicitBalance: implicit.balance,
        totalDistributed,
        difference: accountBalance - totalDistributed,
      });
    }

    return isValid;
  },
};

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type { Pocket, NewPocket };
