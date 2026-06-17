import { useState, useEffect, useCallback } from 'react';
import { AccountRepository } from '../database/repositories/accountRepository';
import { useUserId } from '../store/useUserStore';
import type { Account } from '../database/schema';

// =============================================================================
// USE ACCOUNTS HOOK
// =============================================================================
//
// IMPORTANT: This is NOT a Zustand store. It's a React hook that:
// - Loads data from SQLite via repositories (single source of truth)
// - Provides a refetch() function to reload data
// - Does NOT cache data in memory (that would create dual source of truth)
//
// Financial data ALWAYS comes from SQLite. The hook is just a convenient
// way to manage the async loading state in React.
// =============================================================================

export interface AccountWithBalance extends Account {
  balance: number;
}

interface UseAccountsState {
  accounts: AccountWithBalance[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAccounts(): UseAccountsState {
  const userId = useUserId();
  const [accounts, setAccounts] = useState<AccountWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await AccountRepository.getAllWithBalances(userId);
      setAccounts(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  return {
    accounts,
    loading,
    error,
    refetch: fetchAccounts,
  };
}

// Hook for a single account
export function useAccount(accountId: string | null) {
  const [account, setAccount] = useState<Account | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!accountId) {
      setAccount(null);
      setBalance(0);
      setLoading(false);
      return;
    }

    async function fetch() {
      if (!accountId) {
        setAccount(null);
        setBalance(0);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const [acc, bal] = await Promise.all([
          AccountRepository.getById(accountId),
          AccountRepository.getBalance(accountId),
        ]);
        setAccount(acc);
        setBalance(bal);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [accountId]);

  return { account, balance, loading, error };
}

// Hook for total patrimony (sum of all accounts)
export function useTotalPatrimony() {
  const userId = useUserId();
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const patrimony = await AccountRepository.getTotalPatrimony(userId);
        setTotal(patrimony);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [userId]);

  return { total, loading, error };
}
