import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AccountsDesktop } from '../../../src/components/accounts/AccountsDesktop';
import { ScreenHeader } from '../../../src/components/screens/ScreenHeader';
import { SCREEN_MARGIN } from '../../../src/components/ui/ds/constants';
import { Amount } from '../../../src/components/ui/ds/Amount';
import { ListRow } from '../../../src/components/ui/ds/ListRow';
import { Text } from '../../../src/components/ui/ds/Text';
import { useAccounts } from '../../../src/hooks';
import { useIsDesktop } from '../../../src/hooks/useLayoutSize';
import { routes } from '../../../src/navigation/routes';
import { useTheme } from '../../../src/theme';

/** Cuentas: tabla con panel en escritorio; en el celular no tiene entrada y solo hay una lista simple. */
export default function AccountsScreen() {
  const desktop = useIsDesktop();
  return desktop ? <AccountsDesktop /> : <AccountsMobile />;
}

function AccountsMobile() {
  const { space } = useTheme();
  const router = useRouter();
  const { accounts } = useAccounts();
  return (
    <View style={{ flex: 1 }}>
      <ScreenHeader title="Cuentas" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN_MARGIN, paddingBottom: space[6] }}>
        {accounts.length === 0 ? (
          <Text variant="bodySm" tone="secondary">
            Todavía no tienes cuentas.
          </Text>
        ) : (
          accounts.map((a) => (
            <ListRow
              key={a.id}
              title={a.name}
              divider
              onPress={() => router.push(routes.account(a.id))}
              trailing={<Amount value={a.availableMinor} />}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}
