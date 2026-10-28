import { View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import type { ActivityRow } from '../../lib/activityView';
import { routes } from '../../navigation/routes';
import { useTheme } from '../../theme';
import { Amount } from '../ui/ds/Amount';
import { ListRow } from '../ui/ds/ListRow';

/** Icono ⇄ de las transferencias (tono neutro: no es ingreso ni gasto). */
export function TransferIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 18 18" fill="none" accessibilityElementsHidden>
      <Path
        d="M3 6H14M14 6L11.5 3.5M14 6L11.5 8.5M15 12H4M4 12L6.5 9.5M4 12L6.5 14.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Fila de actividad: una transaccion o una transferencia; al tocarla abre su detalle. */
export function ActivityListRow({ row, divider = false }: { row: ActivityRow; divider?: boolean }) {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const isTransfer = row.kind === 'TRANSFER';
  return (
    <ListRow
      title={row.title}
      subtitle={row.subtitle}
      leading={
        isTransfer ? (
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceRaised,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TransferIcon color={colors.inkPrimary} />
          </View>
        ) : undefined
      }
      trailing={<Amount value={row.amountMinor} variant="amountSm" tone={row.tone} showSign={row.showSign} />}
      onPress={() => router.push(isTransfer ? routes.transfer(row.id) : routes.transaction(row.id))}
      divider={divider}
    />
  );
}
