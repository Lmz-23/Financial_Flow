import { database } from '../index';
import { recurringItems } from '../schema';
import { eq } from 'drizzle-orm';
import type { RecurringItem, NewRecurringItem } from '../schema';

export const RecurringItemRepository = {
  async create(data: Omit<RecurringItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<RecurringItem> {
    const now = new Date();
    const id = crypto.randomUUID();

    const newItem: NewRecurringItem = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    };

    await database.insert(recurringItems).values(newItem);

    const [created] = await database
      .select()
      .from(recurringItems)
      .where(eq(recurringItems.id, id));

    return created;
  },

  async getAll(userId: string): Promise<RecurringItem[]> {
    return database.query.recurringItems.findMany({
      where: eq(recurringItems.userId, userId),
    });
  },
};
