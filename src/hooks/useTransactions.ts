import { useState, useEffect, useCallback } from 'react';
import { TransactionRepository, TransactionFilters } from '../database/repositories/transactionRepository';
import { useUserId } from '../store/useUserStore';
import type { Transaction } from '../database/schema';

// =============================================================================
// USE TRANSACTIONS HOOK
// =============================================================================

interface UseTransactionsState {
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTransactions(filters?: TransactionFilters): UseTransactionsState {
  const userId = useUserId();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await TransactionRepository.getAll(userId, filters);
      setTransactions(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId, filters]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}

// Hook for recent transactions (dashboard)
export function useRecentTransactions(limit: number = 10) {
  const userId = useUserId();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = await TransactionRepository.getRecent(userId, limit);
        setTransactions(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [userId, limit]);

  return { transactions, loading, error };
}

// Hook for pending transactions (alerts)
export function usePendingTransactions() {
  const userId = useUserId();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = await TransactionRepository.getPending(userId);
        setTransactions(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [userId]);

  return { transactions, loading, error };
}
