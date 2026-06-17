import { database } from '../index';
import { debtLoans } from '../schema';
import { eq } from 'drizzle-orm';
import type { DebtLoan, NewDebtLoan } from '../schema';

// =============================================================================
// DEBT LOAN REPOSITORY
// =============================================================================

export const DebtLoanRepository = {
  async create(data: Omit<DebtLoan, 'id' | 'createdAt' | 'updatedAt'>): Promise<DebtLoan> {
    const now = new Date();
    const id = crypto.randomUUID();

    const newLoan = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await database.insert(debtLoans).values(newLoan);

    const [created] = await database
      .select()
      .from(debtLoans)
      .where(eq(debtLoans.id, id));

    return created;
  },

  async getById(id: string): Promise<DebtLoan | null> {
    const result = await database.query.debtLoans.findFirst({
      where: eq(debtLoans.id, id),
    });
    return result ?? null;
  },

  async getAllByUser(userId: string): Promise<DebtLoan[]> {
    return database.query.debtLoans.findMany({
      where: eq(debtLoans.userId, userId),
    });
  },

  async update(id: string, data: Partial<DebtLoan>): Promise<DebtLoan | null> {
    const now = new Date();

    await database
      .update(debtLoans)
      .set({ ...data, updatedAt: now })
      .where(eq(debtLoans.id, id));

    return this.getById(id);
  },

  async updateBalance(id: string, newBalance: number, remainingInstallments?: number): Promise<void> {
    const updates: Partial<DebtLoan> = { currentBalance: newBalance };
    if (remainingInstallments !== undefined) {
      updates.remainingInstallments = remainingInstallments;
    }
    await this.update(id, updates);
  },

  async delete(id: string): Promise<void> {
    await database.delete(debtLoans).where(eq(debtLoans.id, id));
  },
};
