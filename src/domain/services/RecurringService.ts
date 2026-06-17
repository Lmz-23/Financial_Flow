import { database } from '../../database';
import { recurringItems, transactions, categories } from '../../database/schema';
import { eq, and, lte, gte } from 'drizzle-orm';
import { TransactionRepository } from '../../database/repositories/transactionRepository';
import { rescheduleAll } from '../../lib/expo/notifications';
import type { RecurringItem } from '../../database/schema';
import type { Transaction } from '../../database/schema';

// =============================================================================
// RECURRING SERVICE
// =============================================================================
//
// Handles recurring income and expense items.
// Manages due date calculations, confirmations, and notifications.
//
// When a recurring item is confirmed:
// 1. Create the corresponding transaction
// 2. Update lastExecutedAt
// 3. Calculate and set nextDueDate based on frequency
//
// Status flow:
// - ACTIVE: Normal state, notifications scheduled
// - PENDING_CONFIRM: Income not yet confirmed (waiting for receipt)
// - PENDING_PAYMENT: Expense not yet paid
// - PAUSED: Temporarily disabled
// =============================================================================

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Calculates the next due date based on frequency.
 */
function calculateNextDueDate(
  currentDueDate: Date,
  frequency: RecurringItem['frequency']
): Date {
  const next = new Date(currentDueDate);

  switch (frequency) {
    case 'WEEKLY':
      next.setDate(next.getDate() + 7);
      break;
    case 'BIWEEKLY':
      next.setDate(next.getDate() + 14);
      break;
    case 'MONTHLY':
      next.setMonth(next.getMonth() + 1);
      break;
    case 'ANNUAL':
      next.setFullYear(next.getFullYear() + 1);
      break;
  }

  return next;
}

/**
 * Gets the DEBT_PAYMENT category ID, creating it if necessary.
 */
async function getOrCreateDebtPaymentCategory(): Promise<string | null> {
  // Look for existing DEBT_PAYMENT category
  let category = await database.query.categories.findFirst({
    where: eq(categories.name, 'Pago de deuda'),
  });

  if (!category) {
    // Create the system category
    const id = crypto.randomUUID();
    await database.insert(categories).values({
      id,
      userId: null, // System category
      name: 'Pago de deuda',
      type: 'EXPENSE',
      icon: 'credit-card-check',
      color: '#F59E0B', // Yellow/orange
      isDefault: true,
      isActive: true,
      order: 0,
      createdAt: new Date(),
    });
    category = await database.query.categories.findFirst({
      where: eq(categories.name, 'Pago de deuda'),
    });
  }

  return category?.id || null;
}

// =============================================================================
// CHECK DUE ITEMS
// =============================================================================

export interface DueItem extends RecurringItem {
  daysOverdue: number;
}

/**
 * Checks all active recurring items and returns those that are due.
 * Items are due if nextDueDate <= today and they haven't been executed today.
 */
export async function checkDueItems(userId: string): Promise<DueItem[]> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const allItems = await database.query.recurringItems.findMany({
    where: eq(recurringItems.userId, userId),
  });

  const dueItems: DueItem[] = [];

  for (const item of allItems) {
    if (item.status !== 'ACTIVE') continue;

    const dueDate = new Date(item.nextDueDate);
    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

    // Item is due if due date is today or earlier
    if (dueDateStart <= today) {
      const daysOverdue = Math.floor((today.getTime() - dueDateStart.getTime()) / (1000 * 60 * 60 * 24));

      dueItems.push({
        ...item,
        daysOverdue,
      });
    }
  }

  // Sort by most overdue first
  dueItems.sort((a, b) => b.daysOverdue - a.daysOverdue);

  return dueItems;
}

// =============================================================================
// CONFIRM INCOME
// =============================================================================

export interface ConfirmIncomeResult {
  transaction: Transaction;
  recurringItem: RecurringItem;
}

/**
 * Confirms an income recurring item was received.
 *
 * Creates the INCOME transaction, updates lastExecutedAt, and calculates
 * the next due date based on frequency.
 */
export async function confirmIncome(
  recurringItemId: string,
  actualAmount?: number
): Promise<ConfirmIncomeResult | null> {
  // Get the recurring item
  const item = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (!item) {
    console.error('[RecurringService] Item not found:', recurringItemId);
    return null;
  }

  if (item.type !== 'INCOME') {
    console.error('[RecurringService] Item is not an INCOME type');
    return null;
  }

  const amount = actualAmount ?? item.amount;
  const now = new Date();

  // Create the INCOME transaction
  const transaction = await TransactionRepository.create({
    userId: item.userId,
    accountId: item.accountId,
    toAccountId: null,
    type: 'INCOME',
    amount,
    description: item.name,
    categoryId: null, // Could link to income category
    pocketId: null,
    date: now,
    status: 'CONFIRMED',
    recurringItemId: item.id,
  });

  // Calculate next due date
  const nextDueDate = calculateNextDueDate(now, item.frequency);

  // Update the recurring item
  await database
    .update(recurringItems)
    .set({
      lastExecutedAt: now,
      nextDueDate,
      status: 'ACTIVE', // Back to active
      updatedAt: now,
    })
    .where(eq(recurringItems.id, recurringItemId));

  // Reschedule notification for next due date
  const updatedItem = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (updatedItem) {
    await rescheduleAll(item.userId);
  }

  return {
    transaction,
    recurringItem: updatedItem!,
  };
}

// =============================================================================
// CONFIRM EXPENSE PAID
// =============================================================================

export interface ConfirmExpenseResult {
  transaction: Transaction;
  recurringItem: RecurringItem;
}

/**
 * Confirms an expense recurring item was paid.
 *
 * Creates the EXPENSE transaction, updates lastExecutedAt, and calculates
 * the next due date. If wasLate is true, marks it appropriately.
 */
export async function confirmExpensePaid(
  recurringItemId: string,
  actualAmount?: number,
  wasLate: boolean = false
): Promise<ConfirmExpenseResult | null> {
  // Get the recurring item
  const item = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (!item) {
    console.error('[RecurringService] Item not found:', recurringItemId);
    return null;
  }

  if (item.type !== 'EXPENSE') {
    console.error('[RecurringService] Item is not an EXPENSE type');
    return null;
  }

  const amount = actualAmount ?? item.amount;
  const now = new Date();

  // Create the EXPENSE transaction
  const transaction = await TransactionRepository.create({
    userId: item.userId,
    accountId: item.accountId,
    toAccountId: null,
    type: 'EXPENSE',
    amount: -Math.abs(amount), // Always negative for expenses
    description: `${item.name}${wasLate ? ' (tarde)' : ''}`,
    categoryId: null,
    pocketId: null,
    date: now,
    status: 'CONFIRMED',
    recurringItemId: item.id,
  });

  // Calculate next due date
  const nextDueDate = calculateNextDueDate(now, item.frequency);

  // Update the recurring item
  await database
    .update(recurringItems)
    .set({
      lastExecutedAt: now,
      nextDueDate,
      status: 'ACTIVE',
      updatedAt: now,
    })
    .where(eq(recurringItems.id, recurringItemId));

  // Reschedule notification
  const updatedItem = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (updatedItem) {
    await rescheduleAll(item.userId);
  }

  return {
    transaction,
    recurringItem: updatedItem!,
  };
}

// =============================================================================
// MARK PENDING
// =============================================================================

/**
 * Marks a recurring item as pending confirmation/payment.
 *
 * For INCOME items: sets status to PENDING_CONFIRM
 * For EXPENSE items: sets status to PENDING_PAYMENT
 *
 * Called when the due date passes without confirmation.
 */
export async function markPending(
  recurringItemId: string
): Promise<RecurringItem | null> {
  const item = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (!item) {
    console.error('[RecurringService] Item not found:', recurringItemId);
    return null;
  }

  const now = new Date();
  const newStatus = item.type === 'INCOME' ? 'PENDING_CONFIRM' : 'PENDING_PAYMENT';

  await database
    .update(recurringItems)
    .set({
      status: newStatus,
      updatedAt: now,
    })
    .where(eq(recurringItems.id, recurringItemId));

  // Cancel the notification since it's now pending
  // (user will confirm manually)
  await rescheduleAll(item.userId);

  const updatedItem = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  return updatedItem;
}

// =============================================================================
// POSTPONE
// =============================================================================

/**
 * Postpones a recurring item to a new date without marking it as executed.
 *
 * This is used when the user wants to defer payment/receipt to a later date
 * without creating a transaction.
 */
export async function postpone(
  recurringItemId: string,
  newDate: Date
): Promise<RecurringItem | null> {
  const item = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (!item) {
    console.error('[RecurringService] Item not found:', recurringItemId);
    return null;
  }

  const now = new Date();

  await database
    .update(recurringItems)
    .set({
      nextDueDate: newDate,
      status: 'ACTIVE', // Back to active if it was pending
      updatedAt: now,
    })
    .where(eq(recurringItems.id, recurringItemId));

  // Reschedule notification for the new date
  await rescheduleAll(item.userId);

  const updatedItem = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  return updatedItem;
}

// =============================================================================
// PAUSE / RESUME
// =============================================================================

/**
 * Pauses a recurring item (stops notifications).
 */
export async function pause(recurringItemId: string): Promise<RecurringItem | null> {
  const item = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (!item) return null;

  const now = new Date();

  await database
    .update(recurringItems)
    .set({
      status: 'PAUSED',
      updatedAt: now,
    })
    .where(eq(recurringItems.id, recurringItemId));

  // Cancel notification
  await rescheduleAll(item.userId);

  const updatedItem = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  return updatedItem;
}

/**
 * Resumes a paused recurring item.
 */
export async function resume(recurringItemId: string): Promise<RecurringItem | null> {
  const item = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  if (!item) return null;

  const now = new Date();

  // If nextDueDate is in the past, calculate a new one from today
  let nextDueDate = item.nextDueDate;
  if (new Date(nextDueDate) < now) {
    nextDueDate = calculateNextDueDate(now, item.frequency);
  }

  await database
    .update(recurringItems)
    .set({
      status: 'ACTIVE',
      nextDueDate,
      updatedAt: now,
    })
    .where(eq(recurringItems.id, recurringItemId));

  // Reschedule notification
  await rescheduleAll(item.userId);

  const updatedItem = await database.query.recurringItems.findFirst({
    where: eq(recurringItems.id, recurringItemId),
  });

  return updatedItem;
}
