import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { FrequencyChips } from '../../src/components/onboarding/FrequencyChips';
import { OnboardingScaffold } from '../../src/components/onboarding/OnboardingScaffold';
import { Button } from '../../src/components/ui/ds/Button';
import { Input } from '../../src/components/ui/ds/Input';
import { MoneyInput } from '../../src/components/ui/ds/MoneyInput';
import { Text } from '../../src/components/ui/ds/Text';
import { validateFlowStep, type RecurringErrors, type RecurringKind } from '../../src/lib/onboardingDraft';
import { routes } from '../../src/navigation/routes';
import { useOnboardingDraft } from '../../src/store/useOnboardingDraft';
import { useTheme } from '../../src/theme';

interface SectionCopy {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  tone: 'growth' | 'debt';
}

const SECTIONS: Record<RecurringKind, SectionCopy> = {
  income: {
    title: 'Ingreso recurrente',
    nameLabel: '¿Cómo entra tu dinero?',
    namePlaceholder: 'Ej. Sueldo, viajes, ventas',
    tone: 'growth',
  },
  expense: {
    title: 'Gasto recurrente',
    nameLabel: '¿En qué se te va la mayor parte?',
    namePlaceholder: 'Ej. Arriendo, servicios',
    tone: 'debt',
  },
};

function RecurringSection({ kind, errors }: { kind: RecurringKind; errors: RecurringErrors | null }) {
  const { colors, radius, space } = useTheme();
  const copy = SECTIONS[kind];
  const entry = useOnboardingDraft((s) => s[kind]);
  const setRecurring = useOnboardingDraft((s) => s.setRecurring);
  const dot = copy.tone === 'growth' ? colors.signalGrowth : colors.signalDebt;

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: dot }}
        />
        <Text variant="h3" accessibilityRole="header">
          {copy.title}
        </Text>
      </View>
      <Input
        label={copy.nameLabel}
        value={entry.name}
        onChangeText={(name) => setRecurring(kind, { name })}
        placeholder={copy.namePlaceholder}
        error={errors?.name ?? undefined}
        returnKeyType="next"
      />
      <MoneyInput
        label="Monto aproximado"
        value={entry.amountMinor}
        onChangeValue={(amountMinor) => setRecurring(kind, { amountMinor })}
        error={errors?.amount ?? undefined}
      />
      <FrequencyChips
        tone={copy.tone}
        value={entry.frequency}
        onChange={(frequency) => setRecurring(kind, { frequency })}
        accessibilityLabel={`Frecuencia: ${copy.title}`}
      />
    </View>
  );
}

/** Paso 2 del onboarding: ¿Cómo se mueve tu dinero? (opcional: un ingreso y un gasto recurrentes). */
export default function OnboardingFlowScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const income = useOnboardingDraft((s) => s.income);
  const expense = useOnboardingDraft((s) => s.expense);
  const [submitted, setSubmitted] = useState(false);
  const result = validateFlowStep({ income, expense });

  function next() {
    setSubmitted(true);
    if (result.ok) router.push(routes.onboardingWidgets());
  }

  return (
    <OnboardingScaffold
      step={2}
      onBack={() => router.back()}
      footer={<Button label="Continuar" onPress={next} />}
    >
      <View style={{ gap: space[2] }}>
        <Text variant="h1" accessibilityRole="header">
          ¿Cómo se mueve tu dinero?
        </Text>
        <Text variant="bodySm" tone="secondary">
          Esto es lo mínimo para armar tu panorama. Ajusta los detalles cuando quieras.
        </Text>
      </View>
      <RecurringSection kind="income" errors={submitted ? result.income : null} />
      <View style={{ height: 1, backgroundColor: colors.borderSubtle }} />
      <RecurringSection kind="expense" errors={submitted ? result.expense : null} />
    </OnboardingScaffold>
  );
}
