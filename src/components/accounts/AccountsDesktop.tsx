import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { useAccount, useAccounts } from '../../hooks';
import { useActivity } from '../../hooks/useActivity';
import { useArchivedAccounts } from '../../hooks/useArchivedAccounts';
import type { AccountView } from '../../domain/services/AccountService';
import { accountTypeLabel } from '../../lib/onboardingDraft';
import { routes } from '../../navigation/routes';
import { DataTable, type DataColumn } from '../desktop/DataTable';
import { DesktopPage } from '../desktop/DesktopPage';
import { ListDetailLayout } from '../desktop/ListDetailLayout';
import { Amount } from '../ui/ds/Amount';
import { Button } from '../ui/ds/Button';
import { Text } from '../ui/ds/Text';
import { AccountDetail } from './AccountDetail';

const columns: DataColumn<AccountView>[] = [
  {
    key: 'name',
    title: 'Cuenta',
    flex: 2,
    render: (a) => (
      <Text variant="body" numberOfLines={1}>
        {a.name}
      </Text>
    ),
  },
  {
    key: 'type',
    title: 'Tipo',
    render: (a) => (
      <Text variant="bodySm" tone="secondary" numberOfLines={1}>
        {accountTypeLabel(a.type)}
      </Text>
    ),
  },
  {
    key: 'balance',
    title: 'Saldo',
    width: 160,
    align: 'right',
    render: (a) => <Amount value={a.availableMinor} />,
  },
];

function AccountPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const account = useAccount(id);
  const movements = useActivity({ accountId: id });
  // Cuenta eliminada: el panel se cierra solo.
  if (!account) return null;
  return <AccountDetail key={id} account={account} movements={movements} layout="panel" onClose={onClose} onRemoved={onClose} />;
}

/** Cuentas en escritorio (Design/escritorio 2e): total, tabla de cuentas, archivadas y panel de detalle. */
export function AccountsDesktop() {
  const router = useRouter();
  const { accounts, totalMinor } = useAccounts();
  const archived = useArchivedAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const exists = selectedId !== null && (accounts.some((a) => a.id === selectedId) || archived.some((a) => a.id === selectedId));
  const close = () => setSelectedId(null);

  return (
    <ListDetailLayout
      detail={exists ? <AccountPanel id={selectedId} onClose={close} /> : null}
      list={
        <DesktopPage
          eyebrow="Disponible en total"
          heading={<Amount value={totalMinor} variant="amountLg" />}
          actions={<Button label="+ Agregar cuenta" size="md" fullWidth={false} onPress={() => router.push(routes.accountNew())} />}
        >
          <DataTable
            columns={columns}
            rows={accounts}
            rowKey={(a) => a.id}
            selectedKey={selectedId}
            onRowPress={(a) => setSelectedId(a.id)}
            empty="Todavía no tienes cuentas."
            accessibilityLabelFor={(a) => a.name}
          />
          {archived.length > 0 ? (
            <View style={{ gap: 10 }}>
              <Text variant="label" tone="secondary" accessibilityRole="header">
                Archivadas
              </Text>
              <DataTable
                columns={columns}
                rows={archived}
                rowKey={(a) => a.id}
                selectedKey={selectedId}
                onRowPress={(a) => setSelectedId(a.id)}
                accessibilityLabelFor={(a) => `${a.name}, archivada`}
              />
            </View>
          ) : null}
        </DesktopPage>
      }
    />
  );
}
