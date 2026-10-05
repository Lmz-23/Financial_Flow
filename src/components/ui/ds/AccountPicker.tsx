import { View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { Pill } from './Pill';
import { Text } from './Text';

export interface AccountOption {
  id: string;
  name: string;
  /** Saldo ya formateado; solo se usa en el nombre accesible (no se muestra en el chip). */
  balanceLabel?: string;
}

export interface AccountPickerProps {
  /** Cuentas disponibles. El componente NO accede a datos: la lista llega por props. */
  accounts: readonly AccountOption[];
  /** Id de la cuenta elegida, o null si no hay selección. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Etiqueta del grupo (p. ej. "Cuenta"). */
  label?: string;
  /** Texto cuando no hay cuentas. */
  emptyText?: string;
  style?: StyleProp<ViewStyle>;
}

/** Selector de una cuenta: chips (Pill) con salto de línea, como en Nueva transacción. */
export function AccountPicker({ accounts, selectedId, onSelect, label, emptyText, style }: AccountPickerProps) {
  const { space } = useTheme();
  return (
    <View style={[{ gap: space[2] }, style]}>
      {label ? <Text variant="label">{label}</Text> : null}
      {accounts.length === 0 ? (
        emptyText ? <Text variant="bodySm">{emptyText}</Text> : null
      ) : (
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
          {accounts.map((account) => (
            <Pill
              key={account.id}
              label={account.name}
              selected={account.id === selectedId}
              onPress={() => onSelect(account.id)}
              accessibilityLabel={account.balanceLabel ? `${account.name}, ${account.balanceLabel}` : account.name}
            />
          ))}
        </View>
      )}
    </View>
  );
}
