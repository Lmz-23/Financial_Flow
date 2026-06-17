import { database } from '../../database';
import { distributionRules, pockets, accounts } from '../../database/schema';
import { eq, and, asc } from 'drizzle-orm';
import { TransactionRepository } from '../../database/repositories/transactionRepository';

// =============================================================================
// DISTRIBUTION SERVICE
// =============================================================================

export interface DistributionPreviewItem {
  ruleId: string;
  ruleName: string;
  targetType: 'POCKET' | 'ACCOUNT' | 'SAVINGS' | 'INVESTMENT';
  targetId: string;
  targetName: string;
  amount: number;
  percentage: number;
}

export interface DistributionPreview {
  items: DistributionPreviewItem[];
  totalDistributed: number;
  remaining: number;
  originalAmount: number;
}

export interface DistributionItem {
  ruleId: string;
  targetType: 'POCKET' | 'ACCOUNT' | 'SAVINGS' | 'INVESTMENT';
  targetId: string;
  amount: number;
}

// =============================================================================
// PREVIEW DISTRIBUTION
// =============================================================================

/**
 * Previews how an amount would be distributed according to active rules.
 *
 * @param amount - Total amount to distribute (positive number)
 * @param userId - User ID to get their distribution rules
 * @returns Preview with items and remaining amount
 */
export async function previewDistribution(
  amount: number,
  userId: string
): Promise<DistributionPreview> {
  if (amount <= 0) {
    return {
      items: [],
      totalDistributed: 0,
      remaining: amount,
      originalAmount: amount,
    };
  }

  // Get active distribution rules for user
  const rules = await database.query.distributionRules.findMany({
    where: and(
      eq(distributionRules.userId, userId),
      eq(distributionRules.isActive, true)
    ),
    orderBy: [asc(distributionRules.order)],
  });

  if (rules.length === 0) {
    return {
      items: [],
      totalDistributed: 0,
      remaining: amount,
      originalAmount: amount,
    };
  }

  const items: DistributionPreviewItem[] = [];
  let remaining = amount;

  for (const rule of rules) {
    // Calculate amount for this rule
    // Use the percentage of the ORIGINAL amount (not remaining)
    const ruleAmount = Math.floor((amount * rule.percentage) / 100);

    if (ruleAmount <= 0) continue;

    // Get target name for display
    let targetName = 'Unknown';
    if (rule.targetType === 'POCKET') {
      const pocket = await database.query.pockets.findFirst({
        where: eq(pockets.id, rule.targetId),
      });
      targetName = pocket?.name ?? 'Unknown Pocket';
    } else if (rule.targetType === 'ACCOUNT' || rule.targetType === 'SAVINGS' || rule.targetType === 'INVESTMENT') {
      const account = await database.query.accounts.findFirst({
        where: eq(accounts.id, rule.targetId),
      });
      targetName = account?.name ?? 'Unknown Account';
    }

    items.push({
      ruleId: rule.id,
      ruleName: rule.name,
      targetType: rule.targetType,
      targetId: rule.targetId,
      targetName,
      amount: ruleAmount,
      percentage: rule.percentage,
    });

    remaining -= ruleAmount;
  }

  return {
    items,
    totalDistributed: amount - remaining,
    remaining: Math.max(0, remaining), // Don't allow negative remaining
    originalAmount: amount,
  };
}

// =============================================================================
// APPLY DISTRIBUTION
// =============================================================================

/**
 * Applies an accepted distribution preview by creating the necessary TRANSFER transactions.
 *
 * For each distribution item:
 * - If target is a POCKET: creates a TRANSFER to move money from the main account
 *   to the specified pocket (within same account)
 * - If target is ACCOUNT/SAVINGS/INVESTMENT: creates a TRANSFER to the target account
 *
 * @param sourceTransaction - The income transaction that was just created
 * @param distribution - Array of distribution items to apply
 * @returns Array of created transfer transactions
 */
export async function applyDistribution(
  sourceTransactionId: string,
  distribution: DistributionItem[]
): Promise<void> {
  // Get the source transaction
  const sourceTx = await TransactionRepository.getById(sourceTransactionId);
  if (!sourceTx) {
    throw new Error('Source transaction not found');
  }

  if (sourceTx.type !== 'INCOME') {
    throw new Error('Source transaction must be of type INCOME');
  }

  const userId = sourceTx.userId;
  const sourceAccountId = sourceTx.accountId;
  // The source pocket is optional - if the income went to a specific pocket, that's the origin

  // Process each distribution item
  for (const item of distribution) {
    if (item.amount <= 0) continue;

    if (item.targetType === 'POCKET') {
      // Transfer to a pocket within the same account
      // This is an internal redistribution - the account balance doesn't change
      // but the money moves from "unassigned" to the specified pocket
      await TransactionRepository.createTransfer(
        sourceAccountId, // from account
        sourceAccountId, // to same account
        item.amount,
        {
          description: `Distribución: ${item.ruleId}`,
          fromPocketId: sourceTx.pocketId ?? null, // Source pocket (or null for unassigned)
          toPocketId: item.targetId, // Destination pocket
          userId,
        }
      );
    } else if (item.targetType === 'ACCOUNT' || item.targetType === 'SAVINGS' || item.targetType === 'INVESTMENT') {
      // Transfer to another account
      // This actually moves money between accounts
      await TransactionRepository.createTransfer(
        sourceAccountId,
        item.targetId,
        item.amount,
        {
          description: `Distribución: ${item.ruleId}`,
          fromPocketId: sourceTx.pocketId ?? null,
          toPocketId: null,
          userId,
        }
      );
    }
    // SAVINGS and INVESTMENT are treated as ACCOUNT transfers for now
    // In the future, we could add specific logic
  }
}

// =============================================================================
// RULE MANAGEMENT
// =============================================================================

/**
 * Gets all distribution rules for a user.
 */
export async function getDistributionRules(userId: string) {
  return database.query.distributionRules.findMany({
    where: eq(distributionRules.userId, userId),
    orderBy: [asc(distributionRules.order)],
  });
}

/**
 * Gets only active distribution rules for a user.
 */
export async function getActiveDistributionRules(userId: string) {
  return database.query.distributionRules.findMany({
    where: and(
      eq(distributionRules.userId, userId),
      eq(distributionRules.isActive, true)
    ),
    orderBy: [asc(distributionRules.order)],
  });
}

/**
 * Gets the total percentage of all active rules for a user.
 * Useful to check if rules sum to 100%.
 */
export async function getTotalDistributionPercentage(userId: string): Promise<number> {
  const rules = await getActiveDistributionRules(userId);
  return rules.reduce((sum, rule) => sum + rule.percentage, 0);
}

/**
 * Validates if a set of rules can be used for distribution.
 * Returns error message if invalid, null if valid.
 */
export function validateDistributionRules(rules: { percentage: number }[]): string | null {
  const total = rules.reduce((sum, r) => sum + r.percentage, 0);

  if (total > 100) {
    return `Los porcentajes suman ${total}%, que excede el 100%. Ajusta las reglas.`;
  }

  return null;
}
