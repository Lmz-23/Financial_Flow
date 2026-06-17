import { useState, useEffect, useCallback } from 'react';
import { PocketRepository } from '../database/repositories/pocketRepository';
import { AccountRepository } from '../database/repositories/accountRepository';
import { useUserId } from '../store/useUserStore';
import type { Pocket, Account } from '../database/schema';

// =============================================================================
// USE POCKETS HOOK
// =============================================================================

interface PocketWithBalance extends Pocket {
  balance: number;
}

interface PocketsWithImplicit {
  explicit: PocketWithBalance[];
  implicit: { name: string; balance: number };
}

interface AccountWithPockets extends Account {
  pockets: PocketsWithImplicit;
}

interface UsePocketsState {
  pockets: PocketWithBalance[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Hook for all pockets of a user (across all accounts)
export function usePockets(): UsePocketsState {
  const userId = useUserId();
  const [pockets, setPockets] = useState<PocketWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPockets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await PocketRepository.getAllByUser(userId);

      // Fetch balance for each pocket
      const pocketsWithBalances = await Promise.all(
        data.map(async (pocket) => ({
          ...pocket,
          balance: await PocketRepository.getBalance(pocket.id),
        }))
      );

      setPockets(pocketsWithBalances);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPockets();
  }, [fetchPockets]);

  return { pockets, loading, error, refetch: fetchPockets };
}

// Hook for pockets of a specific account (includes implicit "Sin asignar")
export function usePocketsByAccount(accountId: string | null): {
  data: PocketsWithImplicit | null;
  loading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<PocketsWithImplicit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!accountId) {
      setData(null);
      setLoading(false);
      return;
    }

    // accountId is string here due to guard above
    const accountIdStr: string = accountId;

    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const result = await PocketRepository.getAllByAccountWithBalances(accountIdStr);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [accountId]);

  return { data, loading, error };
}

// Hook for all pockets grouped by account (for the pockets overview screen)
export function usePocketsGroupedByAccount(): {
  accounts: AccountWithPockets[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const userId = useUserId();
  const [accounts, setAccounts] = useState<AccountWithPockets[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAccountsWithPockets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all accounts for the user
      const allAccounts = await AccountRepository.getAll(userId);

      // Get pockets with balances for each account
      const accountsWithPockets = await Promise.all(
        allAccounts.map(async (account) => {
          const pocketsData = await PocketRepository.getAllByAccountWithBalances(account.id);
          const balance = await AccountRepository.getBalance(account.id);
          return {
            ...account,
            balance,
            pockets: pocketsData,
          };
        })
      );

      setAccounts(accountsWithPockets);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAccountsWithPockets();
  }, [fetchAccountsWithPockets]);

  return { accounts, loading, error, refetch: fetchAccountsWithPockets };
}
