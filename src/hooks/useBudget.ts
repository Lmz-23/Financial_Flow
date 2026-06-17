import { useState, useEffect, useCallback } from 'react';
import { useUserId } from '../store/useUserStore';
import { useUIStore } from '../store/useUIStore';
import { getBudgetSummary, getCategoryProgress } from '../domain/services/BudgetService';
import type { BudgetSummary, CategoryProgress } from '../domain/services/BudgetService';

// =============================================================================
// USE BUDGET HOOK
// =============================================================================

interface UseBudgetState {
  budget: BudgetSummary | null;
  categoryProgress: CategoryProgress[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useBudget(): UseBudgetState {
  const userId = useUserId();
  const { selectedMonth, selectedYear } = useUIStore();
  const [budget, setBudget] = useState<BudgetSummary | null>(null);
  const [categoryProgress, setCategoryProgress] = useState<CategoryProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchBudget = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [budgetData, progressData] = await Promise.all([
        getBudgetSummary(userId, selectedMonth, selectedYear),
        getCategoryProgress(userId, selectedMonth, selectedYear),
      ]);

      setBudget(budgetData);
      setCategoryProgress(progressData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  return { budget, categoryProgress, loading, error, refetch: fetchBudget };
}

// Hook for current month budget (convenience)
export function useCurrentMonthBudget() {
  const now = new Date();
  const { setSelectedMonth } = useUIStore();

  useEffect(() => {
    setSelectedMonth(now.getMonth() + 1, now.getFullYear());
  }, [setSelectedMonth, now.getMonth(), now.getFullYear()]);

  return useBudget();
}
