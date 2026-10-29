import { Pressable, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { fontFamilyFor, useTheme } from '../../theme';
import { Button, Sheet, Text } from '../ui/ds';

const LABEL = 'Qué es un ingreso pasivo';

/** Ícono ⓘ con área táctil de 44 px. */
export function PassiveIncomeInfoButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={LABEL}
      onPress={onPress}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={12} r={9.5} stroke={colors.inkSecondary} strokeWidth={1.8} />
        <Path d="M12 11v5.5" stroke={colors.inkSecondary} strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={12} cy={7.7} r={1.1} fill={colors.inkSecondary} />
      </Svg>
    </Pressable>
  );
}

/** Hoja con la explicación de ingreso pasivo (reutilizable). */
export function PassiveIncomeHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Sheet visible={visible} onClose={onClose} accessibilityLabel="¿Qué es un ingreso pasivo?">
      <View style={{ gap: 12 }}>
        <Text variant="h3" accessibilityRole="header">
          ¿Qué es un ingreso pasivo?
        </Text>
        <Text variant="bodySm">
          Es plata que te entra sin que tengas que trabajar cada vez para recibirla: arriendos, intereses, dividendos
          o ventas de algo que ya creaste (un curso, un ebook). Tu salario o un trabajo por encargo no cuentan.
        </Text>
        <Text variant="bodySm">
          Al marcarlo, la app calcula qué parte de tus gastos ya cubren estos ingresos. Eso es tu{' '}
          <Text variant="bodySm" style={{ fontFamily: fontFamilyFor('sans', 600) }}>
            Índice de flujo de caja
          </Text>
          .
        </Text>
        <Button label="Entendido" onPress={onClose} />
      </View>
    </Sheet>
  );
}
