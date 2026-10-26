// =============================================================================
// HOOKS BARREL (F5a)
// =============================================================================
// Un hook por dominio. Archivo compartido con UN solo dueno (F5a): las carpetas de F5b importan su
// hook directamente en vez de editar este barril.
export { useDomainQuery } from './useDomainQuery';
export { useAccounts, useAccount } from './useAccounts';
export { useMonthStatement } from './useMonthStatement';
export { useRecentTransactions } from './useTransactions';
export type { RecentTransactions } from './useTransactions';
export { useUpcoming } from './useUpcoming';
export { useDebts } from './useDebts';
export type { DebtsSummary } from './useDebts';
export { useGoals } from './useGoals';
export { useSettings, useSettingsStore, useThemePreference } from '../store/useSettingsStore';
