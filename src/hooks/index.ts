// =============================================================================
// HOOKS BARREL EXPORT
// =============================================================================

// Stores (Zustand)
export { useUserStore, useTheme, useUserId, useOnboardingCompleted } from '../store/useUserStore';
export { useUIStore } from '../store/useUIStore';
export { useNotificationStore } from '../store/useNotificationStore';

// Data Hooks - Accounts
export { useAccounts, useAccount, useTotalPatrimony } from './useAccounts';
export type { AccountWithBalance } from './useAccounts';

// Data Hooks - Transactions
export { useTransactions, useRecentTransactions, usePendingTransactions } from './useTransactions';

// Data Hooks - Categories
export { useCategories, useCategoriesByType } from './useCategories';

// Data Hooks - Pockets
export { usePockets, usePocketsByAccount, usePocketsGroupedByAccount } from './usePockets';

// Data Hooks - Budget
export { useBudget, useCurrentMonthBudget } from './useBudget';

// Data Hooks - Debts
export { useDebts, useTotalDebt } from './useDebts';

// Data Hooks - Cashflow
export {
  useCashflow,
  useCurrentMonthCashflow,
  useIncomeStatement,
  useBalanceSheet,
  useCashflowIndex,
} from './useCashflow';

// Data Hooks - Integrity Check (DEBUG ONLY)
export { useIntegrityCheck, useSystemHealth, useAccountIntegrity } from './useIntegrityCheck';
