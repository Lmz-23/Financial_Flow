import { useState, useEffect, useCallback } from 'react';
import { useUserId } from '../store/useUserStore';
import {
  verifyAllAccountsIntegrity,
  isSystemHealthy,
  verifyAccountIntegrity,
} from '../domain/services/IntegrityService';
import type { IntegrityCheckResult } from '../domain/services/IntegrityService';

// =============================================================================
// USE INTEGRITY CHECK HOOK
// =============================================================================
//
// IMPORTANT: This hook is for DEBUG/DIAGNOSTIC purposes only!
// It should NEVER be shown in the normal user flow.
//
// This verifies that the fundamental invariant is never broken:
//   account_balance = unassigned_balance + Σ(explicit_pocket_balances)
//
// If this returns valid=false, there is a BUG in the system.
// =============================================================================

interface UseIntegrityCheckState {
  results: IntegrityCheckResult[];
  allValid: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useIntegrityCheck(): UseIntegrityCheckState {
  const userId = useUserId();
  const [results, setResults] = useState<IntegrityCheckResult[]>([]);
  const [allValid, setAllValid] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const runCheck = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const checkResults = await verifyAllAccountsIntegrity(userId);
      const healthy = checkResults.every((r) => r.valid);

      setResults(checkResults);
      setAllValid(healthy);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return {
    results,
    allValid,
    loading,
    error,
    refetch: runCheck,
  };
}

// Quick health check - returns true if all accounts are valid
export function useSystemHealth() {
  const userId = useUserId();
  const [isHealthy, setIsHealthy] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        setLoading(true);
        const healthy = await isSystemHealthy(userId);
        setIsHealthy(healthy);
      } catch {
        setIsHealthy(false);
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [userId]);

  return { isHealthy, loading };
}

// Hook to verify a specific account
export function useAccountIntegrity(accountId: string | null) {
  const [result, setResult] = useState<IntegrityCheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!accountId) {
      setResult(null);
      setLoading(false);
      return;
    }

    // accountId is string here due to guard above
    const accountIdStr: string = accountId;

    async function check() {
      try {
        setLoading(true);
        setError(null);
        const checkResult = await verifyAccountIntegrity(accountIdStr);
        setResult(checkResult);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }
    check();
  }, [accountId]);

  return { result, loading, error };
}
