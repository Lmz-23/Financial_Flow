import { View } from 'react-native';

import { commands } from '../../app-services';
import type { WidgetKey } from '../../database/repositories/settingsRepository';
import { useTheme } from '../../theme';
import { InviteCard, Text } from '../ui/ds';

const OPTIONS: readonly { key: WidgetKey; title: string }[] = [
  { key: 'cashflow', title: 'Activar Índice de Flujo de Caja' },
  { key: 'debts', title: 'Activar Deudas' },
  { key: 'goals', title: 'Activar Metas de ahorro' },
];

/** "Mas opciones": una invitacion por cada widget opcional sin activar (activar es instantaneo). */
export function InactiveWidgets({ active }: { active: Record<WidgetKey, boolean> }) {
  const { colors, space } = useTheme();
  const identity: Record<WidgetKey, string> = {
    cashflow: colors.brandPrimary,
    debts: colors.signalDebt,
    goals: colors.signalGoal,
  };
  const inactive = OPTIONS.filter((option) => !active[option.key]);
  if (inactive.length === 0) return null;
  return (
    <View style={{ gap: space[3], marginTop: space[1] }}>
      <Text variant="label">Más opciones</Text>
      {inactive.map((option) => (
        <InviteCard
          key={option.key}
          title={option.title}
          identityColor={identity[option.key]}
          onPress={() => commands.settings.setWidget(option.key, true)}
        />
      ))}
    </View>
  );
}
