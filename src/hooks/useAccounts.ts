import type { AccountsSummary, AccountView } from '../domain/services/AccountService';
import { useDomainQuery } from './useDomainQuery';

/** Cuentas no archivadas con su disponible derivado y el total ("Resumen de cuentas"). */
export function useAccounts(): AccountsSummary {
  return useDomainQuery(['accounts'], (domain) => domain.accounts.summary());
}

/** Una cuenta (activa o archivada) o undefined si no existe. */
export function useAccount(id: string): AccountView | undefined {
  return useDomainQuery(['accounts'], (domain) => domain.accounts.get(id), id);
}
