import { useState, useEffect, useCallback } from 'react';
import { database } from '../database';
import { debtCards, debtLoans } from '../database/schema';
import { eq, and } from 'drizzle-orm';
import { useUserId } from '../store/useUserStore';
import type { DebtCard, DebtLoan } from '../database/schema';

// =============================================================================
// USE DEBTS HOOK
// =============================================================================

interface UseDebtsState {
  cards: DebtCard[];
  loans: DebtLoan[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useDebts(): UseDebtsState {
  const userId = useUserId();
  const [cards, setCards] = useState<DebtCard[]>([]);
  const [loans, setLoans] = useState<DebtLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchDebts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [cardsData, loansData] = await Promise.all([
        database.query.debtCards.findMany({
          where: and(
            eq(debtCards.userId, userId),
            eq(debtCards.isActive, true)
          ),
        }),
        database.query.debtLoans.findMany({
          where: and(
            eq(debtLoans.userId, userId),
            eq(debtLoans.isActive, true)
          ),
        }),
      ]);

      setCards(cardsData);
      setLoans(loansData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  return { cards, loans, loading, error, refetch: fetchDebts };
}

// Computed values
export function useTotalDebt() {
  const { cards, loans, loading } = useDebts();

  const totalCardDebt = cards.reduce((sum, card) => sum + card.usedAmount, 0);
  const totalLoanDebt = loans.reduce((sum, loan) => sum + loan.currentBalance, 0);
  const totalDebt = totalCardDebt + totalLoanDebt;

  return { totalCardDebt, totalLoanDebt, totalDebt, loading };
}
