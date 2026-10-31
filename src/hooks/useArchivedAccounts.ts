import type { AccountView } from '../domain/services/AccountService';
import { useDomainQuery } from './useDomainQuery';

/**
 * Cuentas archivadas. El dominio no tiene una consulta para listarlas, pero una cuenta solo se
 * archiva si tiene movimientos: se descubren por los ids de la actividad que no están entre las activas.
 */
export function useArchivedAccounts(): AccountView[] {
  return useDomainQuery(['accounts', 'transactions'], (domain) => {
    const active = new Set(domain.accounts.summary().accounts.map((a) => a.id));
    const seen = new Set<string>();
    for (const item of domain.activity.list()) {
      if (item.kind === 'TRANSACTION') seen.add(item.transaction.accountId);
      else {
        seen.add(item.transfer.fromAccountId);
        seen.add(item.transfer.toAccountId);
      }
    }
    const archived: AccountView[] = [];
    for (const id of seen) {
      if (active.has(id)) continue;
      const account = domain.accounts.get(id);
      if (account && account.archivedAt !== null) archived.push(account);
    }
    return archived.sort((a, b) => a.order - b.order);
  });
}
