import { useState, useEffect, useCallback } from 'react';
import { useUserId } from '../store/useUserStore';
import { useUIStore } from '../store/useUIStore';
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashflowIndex,
  getCashflowSummary,
} from '../domain/services/CashflowService';
import type {
  IncomeStatement,
  BalanceSheet,
  CashflowIndex,
  CashflowSummary,
} from '../domain/services/CashflowService';

// =============================================================================
// USE CASHFLOW HOOK
// =============================================================================

interface UseCashflowState {
  incomeStatement: IncomeStatement | null;
  balanceSheet: BalanceSheet | null;
  cashflowIndex: CashflowIndex | null;
  summary: CashflowSummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useCashflow(): UseCashflowState {
  const userId = useUserId();
  const { selectedMonth, selectedYear } = useUIStore();

  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [cashflowIndex, setCashflowIndex] = useState<CashflowIndex | null>(null);
  const [summary, setSummary] = useState<CashflowSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCashflow = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [income, balance, index] = await Promise.all([
        getIncomeStatement(userId, selectedMonth, selectedYear),
        getBalanceSheet(userId),
        getCashflowIndex(userId, selectedMonth, selectedYear),
      ]);

      setIncomeStatement(income);
      setBalanceSheet(balance);
      setCashflowIndex(index);
      setSummary({ incomeStatement: income, balanceSheet: balance, cashflowIndex: index });
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchCashflow();
  }, [fetchCashflow]);

  return {
    incomeStatement,
    balanceSheet,
    cashflowIndex,
    summary,
    loading,
    error,
    refetch: fetchCashflow,
  };
}

// Hook for current month (convenience)
export function useCurrentMonthCashflow() {
  const now = new Date();
  const { setSelectedMonth } = useUIStore();

  useEffect(() => {
    setSelectedMonth(now.getMonth() + 1, now.getFullYear());
  }, [setSelectedMonth, now.getMonth(), now.getFullYear()]);

  return useCashflow();
}

// Individual hooks for specific data
export function useIncomeStatement() {
  const userId = useUserId();
  const { selectedMonth, selectedYear } = useUIStore();
  const [data, setData] = useState<IncomeStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const result = await getIncomeStatement(userId, selectedMonth, selectedYear);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [userId, selectedMonth, selectedYear]);

  return { data, loading, error };
}

export function useBalanceSheet() {
  const userId = useUserId();
  const [data, setData] = useState<BalanceSheet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const result = await getBalanceSheet(userId);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [userId]);

  return { data, loading, error };
}

export function useCashflowIndex() {
  const userId = useUserId();
  const { selectedMonth, selectedYear } = useUIStore();
  const [data, setData] = useState<CashflowIndex | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const result = await getCashflowIndex(userId, selectedMonth, selectedYear);
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [userId, selectedMonth, selectedYear]);

  return { data, loading, error };
}
