import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { OnboardingScaffold, TextLink } from '../../src/components/onboarding/OnboardingScaffold';
import { Button } from '../../src/components/ui/ds/Button';
import { InviteCard } from '../../src/components/ui/ds/InviteCard';
import { Text } from '../../src/components/ui/ds/Text';
import type { WidgetKey } from '../../src/lib/onboardingDraft';
import { routes } from '../../src/navigation/routes';
import { useOnboardingDraft } from '../../src/store/useOnboardingDraft';
import { useTheme } from '../../src/theme';

const OPTIONS: readonly { key: WidgetKey; title: string; description: string }[] = [
  { key: 'cashflow', title: 'Índice de Flujo de Caja', description: 'Mide qué tanto de tus gastos ya cubre tu ingreso pasivo.' },
  { key: 'debts', title: 'Deudas', description: 'Tarjetas y préstamos, con proyección de pago automática.' },
  { key: 'goals', title: 'Metas de ahorro', description: 'Ponle número y fecha a lo que estás ahorrando.' },
];

/** Paso 3 del onboarding: ¿Quieres ir más allá? (tres tarjetas conmutables, apagadas por defecto). */
export default function OnboardingWidgetsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const widgets = useOnboardingDraft((s) => s.widgets);
  const setWidget = useOnboardingDraft((s) => s.setWidget);
  const clearWidgets = useOnboardingDraft((s) => s.clearWidgets);
  const identity: Record<WidgetKey, string> = {
    cashflow: colors.brandPrimary,
    debts: colors.signalDebt,
    goals: colors.signalGoal,
  };

  function next() {
    router.push(routes.onboardingDone());
  }

  /** «Prefiero explorarlo yo mismo» descarta lo marcado: los tres widgets quedan en NULL (A9). */
  function skip() {
    clearWidgets();
    next();
  }

  return (
    <OnboardingScaffold
      step={3}
      onBack={() => router.back()}
      footer={
        <>
          <Button label="Continuar" onPress={next} />
          <TextLink label="Prefiero explorarlo yo mismo" onPress={skip}>
            <Text variant="bodySm" tone="secondary">
              Prefiero explorarlo yo mismo
            </Text>
          </TextLink>
        </>
      }
    >
      <View style={{ gap: space[2] }}>
        <Text variant="h1" accessibilityRole="header">
          ¿Quieres ir más allá?
        </Text>
        <Text variant="bodySm" tone="secondary">
          Actívalo si te sirve ahora. Si no, lo encuentras después en tu panel — nunca se pierde nada de lo que ya cargaste.
        </Text>
      </View>
      <View style={{ gap: space[3] }}>
        {OPTIONS.map((o) => (
          <InviteCard
            key={o.key}
            title={o.title}
            description={o.description}
            identityColor={identity[o.key]}
            selected={widgets[o.key]}
            onPress={() => setWidget(o.key, !widgets[o.key])}
          />
        ))}
      </View>
    </OnboardingScaffold>
  );
}
