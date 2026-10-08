import { Amount, ListRow, Widget } from '../ui/ds';
import type { AccountsSummary } from '../../domain/services/AccountService';
import { routes } from '../../navigation/routes';
import { useRouter } from 'expo-router';
import { WidgetHeader } from './parts';

/** "Resumen de cuentas": total de las cuentas activas y una fila por cuenta. */
export function AccountsSummaryWidget({ summary }: { summary: AccountsSummary }) {
  const router = useRouter();
  return (
    <Widget gap={14}>
      <WidgetHeader
        title="Resumen de cuentas"
        addLabel="Agregar cuenta"
        onAdd={() => router.push(routes.accountNew())}
      />
      <Amount value={summary.totalMinor} variant="amountLg" />
      <>
        {summary.accounts.map((account) => (
          <ListRow
            key={account.id}
            title={account.name}
            trailing={<Amount value={account.availableMinor} variant="amountSm" />}
            onPress={() => router.push(routes.account(account.id))}
            accessibilityLabel={`${account.name}, disponible`}
          />
        ))}
      </>
    </Widget>
  );
}
