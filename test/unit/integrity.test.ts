/**
 * INTEGRITY TESTS
 * 
 * These tests verify the mathematical invariant of the account-pocket system:
 *   account_balance = unassigned_balance + Σ(explicit_pocket_balances)
 * 
 * Since expo-sqlite is a native module that cannot run in Node.js test environment,
 * these tests use mocked repositories to verify the integrity calculation logic.
 * 
 * The actual database integration should be tested manually in Expo Go or via
 * E2E tests with Detox/Appium.
 * 
 * To run these tests: npm run test:run
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// =============================================================================
// MOCK REPOSITORIES
// =============================================================================

// Mock data store (simulates database)
interface MockTransaction {
  accountId: string;
  pocketId: string | null;
  amount: number;
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED';
}

const mockTransactions: MockTransaction[] = [];

const MockAccountRepository = {
  getBalance: vi.fn((accountId: string) => {
    return mockTransactions
      .filter((t) => t.accountId === accountId && t.status === 'CONFIRMED')
      .reduce((sum, t) => sum + t.amount, 0);
  }),
};

const MockPocketRepository = {
  getBalance: vi.fn((pocketId: string) => {
    return mockTransactions
      .filter((t) => t.pocketId === pocketId && t.status === 'CONFIRMED')
      .reduce((sum, t) => sum + t.amount, 0);
  }),

  getUnassignedBalance: vi.fn((accountId: string) => {
    return mockTransactions
      .filter(
        (t) =>
          t.accountId === accountId &&
          t.pocketId === null &&
          t.status === 'CONFIRMED'
      )
      .reduce((sum, t) => sum + t.amount, 0);
  }),

  getAllByAccountWithBalances: vi.fn((accountId: string) => {
    // Group by pocketId
    const pocketBalances = new Map<string, number>();
    let unassignedBalance = 0;

    for (const t of mockTransactions) {
      if (t.accountId !== accountId || t.status !== 'CONFIRMED') continue;
      if (t.pocketId === null) {
        unassignedBalance += t.amount;
      } else {
        pocketBalances.set(
          t.pocketId,
          (pocketBalances.get(t.pocketId) || 0) + t.amount
        );
      }
    }

    return {
      explicit: Array.from(pocketBalances.entries()).map(([id, balance]) => ({
        id,
        name: `Pocket ${id}`,
        balance,
      })),
      implicit: {
        name: 'Sin asignar',
        balance: unassignedBalance,
      },
    };
  }),
};

// =============================================================================
// INTEGRITY SERVICE (COPY FOR TESTING)
// =============================================================================

interface IntegrityCheckResult {
  accountId: string;
  valid: boolean;
  details: {
    accountBalance: number;
    unassignedBalance: number;
    pocketsSum: number;
    totalDistributed: number;
    difference: number;
    pockets: { id: string; name: string; balance: number }[];
  };
}

async function verifyAccountIntegrity(accountId: string): Promise<IntegrityCheckResult> {
  const accountBalance = MockAccountRepository.getBalance(accountId);
  const pocketsWithBalances = MockPocketRepository.getAllByAccountWithBalances(accountId);
  const unassignedBalance = pocketsWithBalances.implicit.balance;
  const pocketsSum = pocketsWithBalances.explicit.reduce((sum, p) => sum + p.balance, 0);
  const totalDistributed = unassignedBalance + pocketsSum;
  const difference = accountBalance - totalDistributed;
  const valid = difference === 0;

  return {
    accountId,
    valid,
    details: {
      accountBalance,
      unassignedBalance,
      pocketsSum,
      totalDistributed,
      difference,
      pockets: pocketsWithBalances.explicit,
    },
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function resetMockData() {
  mockTransactions.length = 0;
  vi.clearAllMocks();
}

function addTransaction(
  accountId: string,
  pocketId: string | null,
  amount: number,
  status: 'CONFIRMED' | 'PENDING' | 'CANCELLED' = 'CONFIRMED'
) {
  mockTransactions.push({ accountId, pocketId, amount, status });
}

// =============================================================================
// TESTS
// =============================================================================

describe('Account-Pocket Integrity', () => {
  beforeEach(() => {
    resetMockData();
  });

  // -------------------------------------------------------------------------
  // TEST 1: New account with no transactions
  // -------------------------------------------------------------------------
  it('should have valid integrity for a new account with zero balance', async () => {
    const accountId = 'account-1';

    const result = await verifyAccountIntegrity(accountId);

    expect(result.valid).toBe(true);
    expect(result.details.accountBalance).toBe(0);
    expect(result.details.unassignedBalance).toBe(0);
    expect(result.details.pocketsSum).toBe(0);
    expect(result.details.difference).toBe(0);
    expect(result.details.pockets).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Account with transactions but no pockets (all goes to unassigned)
  // -------------------------------------------------------------------------
  it('should have valid integrity when all transactions go to unassigned pocket', async () => {
    const accountId = 'account-2';

    // Income: +$1,000,000
    addTransaction(accountId, null, 1000000);
    // Expense: -$500,000
    addTransaction(accountId, null, -500000);

    const result = await verifyAccountIntegrity(accountId);

    expect(result.valid).toBe(true);
    expect(result.details.accountBalance).toBe(500000); // 1M - 500K = 500K
    expect(result.details.unassignedBalance).toBe(500000); // All goes here
    expect(result.details.pocketsSum).toBe(0); // No explicit pockets
    expect(result.details.difference).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Account with transactions split across pockets + unassigned
  // -------------------------------------------------------------------------
  it('should have valid integrity when transactions are distributed across pockets', async () => {
    const accountId = 'account-3';
    const pocket1Id = 'pocket-1';
    const pocket2Id = 'pocket-2';

    // Income to pocket 1: +$500,000
    addTransaction(accountId, pocket1Id, 500000);
    // Income to pocket 2: +$300,000
    addTransaction(accountId, pocket2Id, 300000);
    // Income to unassigned: +$700,000
    addTransaction(accountId, null, 700000);
    // Expense from unassigned: -$200,000
    addTransaction(accountId, null, -200000);

    const result = await verifyAccountIntegrity(accountId);

    expect(result.valid).toBe(true);
    // Total: 500K + 300K + 700K - 200K = 1,300K
    expect(result.details.accountBalance).toBe(1300000);
    // Unassigned: 700K - 200K = 500K
    expect(result.details.unassignedBalance).toBe(500000);
    // Pockets: 500K + 300K = 800K
    expect(result.details.pocketsSum).toBe(800000);
    expect(result.details.difference).toBe(0);
    expect(result.details.pockets).toHaveLength(2);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Pocket-to-pocket transfer preserves account balance
  // -------------------------------------------------------------------------
  it('should preserve integrity when transferring between pockets of the same account', async () => {
    const accountId = 'account-4';
    const pocket1Id = 'pocket-a';
    const pocket2Id = 'pocket-b';

    // Initial deposit to Pocket A: +$1,000,000
    addTransaction(accountId, pocket1Id, 1000000);

    // Verify before transfer
    const beforeResult = await verifyAccountIntegrity(accountId);
    expect(beforeResult.valid).toBe(true);
    expect(beforeResult.details.accountBalance).toBe(1000000);

    // Transfer $300,000 from Pocket A to Pocket B
    // This is modeled as two transactions:
    // - Deduct from Pocket A: -$300,000
    // - Add to Pocket B: +$300,000
    addTransaction(accountId, pocket1Id, -300000); // Deduct from A
    addTransaction(accountId, pocket2Id, 300000); // Add to B

    // Verify after transfer
    const afterResult = await verifyAccountIntegrity(accountId);

    expect(afterResult.valid).toBe(true);
    // Account balance should NOT change (just redistributed)
    expect(afterResult.details.accountBalance).toBe(1000000);
    // Pocket A should have $700,000
    const pocketA = afterResult.details.pockets.find((p) => p.id === pocket1Id);
    expect(pocketA?.balance).toBe(700000);
    // Pocket B should have $300,000
    const pocketB = afterResult.details.pockets.find((p) => p.id === pocket2Id);
    expect(pocketB?.balance).toBe(300000);
    // Unassigned should be 0
    expect(afterResult.details.unassignedBalance).toBe(0);
    expect(afterResult.details.difference).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 5: PENDING transactions should NOT affect balance
  // -------------------------------------------------------------------------
  it('should exclude PENDING transactions from balance calculation', async () => {
    const accountId = 'account-5';

    // Confirmed income: +$500,000
    addTransaction(accountId, null, 500000, 'CONFIRMED');
    // Pending income: +$1,000,000 (should NOT count)
    addTransaction(accountId, null, 1000000, 'PENDING');
    // Cancelled expense: -$200,000 (should NOT count)
    addTransaction(accountId, null, -200000, 'CANCELLED');

    const result = await verifyAccountIntegrity(accountId);

    expect(result.valid).toBe(true);
    // Only the confirmed $500,000 counts
    expect(result.details.accountBalance).toBe(500000);
    expect(result.details.unassignedBalance).toBe(500000);
    expect(result.details.difference).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 6: Multiple accounts are independent
  // -------------------------------------------------------------------------
  it('should calculate balances independently for each account', async () => {
    const account1Id = 'account-6a';
    const account2Id = 'account-6b';

    // Account 1: +$1,000,000
    addTransaction(account1Id, null, 1000000);
    // Account 2: +$500,000
    addTransaction(account2Id, null, 500000);

    const result1 = await verifyAccountIntegrity(account1Id);
    const result2 = await verifyAccountIntegrity(account2Id);

    expect(result1.valid).toBe(true);
    expect(result1.details.accountBalance).toBe(1000000);

    expect(result2.valid).toBe(true);
    expect(result2.details.accountBalance).toBe(500000);
  });
});

// =============================================================================
// INTEGRITY VIOLATION DETECTION TESTS
// =============================================================================

describe('Integrity Violation Detection', () => {
  beforeEach(() => {
    resetMockData();
  });

  it('should detect when unassigned + pockets does not equal account balance', async () => {
    // This simulates a data corruption scenario where the mock returns
    // inconsistent data (in real life, this would be a bug in the system)
    const accountId = 'corrupted-account';

    // Manually add transactions that would cause inconsistency
    // We simulate this by having MockAccountRepository return a different value
    // than what the transactions sum to
    MockAccountRepository.getBalance.mockReturnValueOnce(1000000); // Wrong value
    MockPocketRepository.getUnassignedBalance.mockReturnValueOnce(500000);
    MockPocketRepository.getAllByAccountWithBalances.mockReturnValueOnce({
      explicit: [],
      implicit: { name: 'Sin asignar', balance: 500000 },
    });

    const result = await verifyAccountIntegrity(accountId);

    expect(result.valid).toBe(false);
    expect(result.details.difference).toBe(500000); // 1M - 500K = 500K difference
  });
});
