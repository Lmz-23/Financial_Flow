import { AccountRepository } from '../../database/repositories/accountRepository';
import { PocketRepository } from '../../database/repositories/pocketRepository';

// =============================================================================
// INTEGRITY SERVICE
// =============================================================================
//
// This service verifies the fundamental invariant of the financial model:
//
//   account_balance = unassigned_balance + Σ(explicit_pocket_balances)
//
// Every operation that modifies transactions or pockets should preserve this.
// If verifyAccountIntegrity returns valid=false, there is a bug in the system.
//
// CRITICAL: All amounts are stored as integers (cents), so there should be
// NO floating point precision issues. We use strict equality comparison.
// =============================================================================

export interface IntegrityCheckResult {
  accountId: string;
  valid: boolean;
  details: {
    accountBalance: number;
    unassignedBalance: number;
    pocketsSum: number;
    totalDistributed: number;
    difference: number;
    pockets: {
      id: string;
      name: string;
      balance: number;
    }[];
  };
}

/**
 * Verifies the integrity of a single account.
 *
 * The invariant being checked:
 *   account_balance = unassigned_balance + Σ(explicit_pocket_balances)
 *
 * @returns { valid: true } if the invariant holds, { valid: false } if not
 */
export async function verifyAccountIntegrity(
  accountId: string
): Promise<IntegrityCheckResult> {
  // 1. Get the total balance of the account
  const accountBalance = await AccountRepository.getBalance(accountId);

  // 2. Get the balance of the implicit "Unassigned" pocket
  const unassignedBalance = await PocketRepository.getUnassignedBalance(accountId);

  // 3. Get all explicit pockets with their balances
  const pocketsWithBalances = await PocketRepository.getAllByAccountWithBalances(accountId);

  // 4. Sum the explicit pocket balances
  const pocketsSum = pocketsWithBalances.explicit.reduce(
    (sum, pocket) => sum + pocket.balance,
    0
  );

  // 5. Calculate total distributed (unassigned + explicit pockets)
  const totalDistributed = unassignedBalance + pocketsSum;

  // 6. Calculate the difference
  const difference = accountBalance - totalDistributed;

  // 7. Check if the invariant holds (strict equality - no tolerance)
  const valid = difference === 0;

  const result: IntegrityCheckResult = {
    accountId,
    valid,
    details: {
      accountBalance,
      unassignedBalance,
      pocketsSum,
      totalDistributed,
      difference,
      pockets: pocketsWithBalances.explicit.map((p) => ({
        id: p.id,
        name: p.name,
        balance: p.balance,
      })),
    },
  };

  if (!valid) {
    console.error('[IntegrityService] Account integrity check FAILED:', result);
  }

  return result;
}

/**
 * Verifies the integrity of ALL accounts for a user.
 *
 * @returns Array of results, one per account
 */
export async function verifyAllAccountsIntegrity(
  userId: string
): Promise<IntegrityCheckResult[]> {
  const accounts = await AccountRepository.getAll(userId);
  const results: IntegrityCheckResult[] = [];

  for (const account of accounts) {
    const result = await verifyAccountIntegrity(account.id);
    results.push(result);
  }

  return results;
}

/**
 * Quick check: returns true only if ALL accounts pass integrity check.
 * Useful for running as a health check on app startup.
 */
export async function isSystemHealthy(userId: string): Promise<boolean> {
  const results = await verifyAllAccountsIntegrity(userId);
  return results.every((r) => r.valid);
}
