import { database } from '../index';
import { debtCards } from '../schema';
import { eq } from 'drizzle-orm';
import type { DebtCard, NewDebtCard } from '../schema';

// =============================================================================
// DEBT CARD REPOSITORY
// =============================================================================

export const DebtCardRepository = {
  async create(data: Omit<DebtCard, 'id' | 'createdAt' | 'updatedAt'>): Promise<DebtCard> {
    const now = new Date();
    const id = crypto.randomUUID();

    const newCard = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await database.insert(debtCards).values(newCard);

    const [created] = await database
      .select()
      .from(debtCards)
      .where(eq(debtCards.id, id));

    return created;
  },

  async getById(id: string): Promise<DebtCard | null> {
    const result = await database.query.debtCards.findFirst({
      where: eq(debtCards.id, id),
    });
    return result ?? null;
  },

  async getAllByUser(userId: string): Promise<DebtCard[]> {
    return database.query.debtCards.findMany({
      where: eq(debtCards.userId, userId),
    });
  },

  async update(id: string, data: Partial<DebtCard>): Promise<DebtCard | null> {
    const now = new Date();

    await database
      .update(debtCards)
      .set({ ...data, updatedAt: now })
      .where(eq(debtCards.id, id));

    return this.getById(id);
  },

  async updateUsedAmount(id: string, newUsedAmount: number): Promise<void> {
    await this.update(id, { usedAmount: newUsedAmount });
  },

  async delete(id: string): Promise<void> {
    await database.delete(debtCards).where(eq(debtCards.id, id));
  },
};
