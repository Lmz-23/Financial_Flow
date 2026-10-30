import { View } from 'react-native';

import { useTheme } from '../../theme';
import { Text } from '../ui/ds/Text';

/** Fila etiqueta / valor del detalle de transacción y de transferencia en el celular. */
export function DetailRow({ label, value, divider }: { label: string; value: string; divider: boolean }) {
  const { colors, space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space[3],
        paddingBottom: divider ? space[3] : 0,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <Text variant="bodySm" tone="secondary">
        {label}
      </Text>
      <Text variant="body" style={{ flexShrink: 1, textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}
