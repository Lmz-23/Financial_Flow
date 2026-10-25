import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { commands, refreshSettings } from '../../src/app-services';
import { BigCheckIcon } from '../../src/components/onboarding/icons';
import { OnboardingScaffold } from '../../src/components/onboarding/OnboardingScaffold';
import { Button } from '../../src/components/ui/ds/Button';
import { Text } from '../../src/components/ui/ds/Text';
import { createExclusiveRunner, safeErrorLogArgs } from '../../src/lib/errorScreen';
import {
  classifyCompleteError,
  MSG_COMPLETE_GENERIC,
  MSG_DONE_PHRASE,
  toOnboardingDraft,
} from '../../src/lib/onboardingDraft';
import { selectDraft, useOnboardingDraft } from '../../src/store/useOnboardingDraft';
import { useSettingsStore } from '../../src/store/useSettingsStore';
import { useTheme } from '../../src/theme';

/**
 * Paso 4 del onboarding: «Todo listo». «Ir a mi panel» guarda TODO con una sola llamada a
 * `commands.onboarding.complete` (A8). Al hacer COMMIT, el guard de la raíz desmonta el onboarding
 * y lleva al Dashboard. Los errores son asíncronos para el boundary, así que se tratan aquí (A10).
 */
export default function OnboardingDoneScreen() {
  const { colors, radius, space } = useTheme();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const runner = useMemo(() => createExclusiveRunner(), []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Éxito: vacía el borrador y se asegura de que el guard vea el onboarding completo. */
  function finish() {
    useOnboardingDraft.getState().reset();
    if (!useSettingsStore.getState().settings?.onboardingDone) refreshSettings();
  }

  async function submit() {
    await runner(async () => {
      setSaving(true);
      setErrorMessage(null);
      try {
        const draft = toOnboardingDraft(selectDraft(useOnboardingDraft.getState()));
        try {
          commands.onboarding.complete(draft);
        } catch (err) {
          const outcome = classifyCompleteError(err);
          if (outcome.kind !== 'success') {
            // Solo el tipo del error: el mensaje técnico puede traer SQL con datos financieros.
            console.error(...safeErrorLogArgs('Falló el guardado del onboarding.', err));
            if (mounted.current) setErrorMessage(outcome.message);
            return;
          }
        }
        finish();
      } catch (err) {
        console.error(...safeErrorLogArgs('Falló la recarga de ajustes tras el onboarding.', err));
        if (mounted.current) setErrorMessage(MSG_COMPLETE_GENERIC);
      } finally {
        if (mounted.current) setSaving(false);
      }
    });
  }

  return (
    <OnboardingScaffold
      step={4}
      scroll={false}
      onBack={() => router.back()}
      backDisabled={saving}
      footer={
        <>
          {errorMessage ? (
            <Text variant="bodySm" tone="debt" accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ textAlign: 'center' }}>
              {errorMessage}
            </Text>
          ) : null}
          <Button label="Ir a mi panel" loading={saving} onPress={submit} />
        </>
      }
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 64,
          height: 64,
          borderRadius: radius.full,
          backgroundColor: colors.signalGrowth,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <BigCheckIcon color={colors.inkOnBrand} />
      </View>
      <View style={{ gap: space[2] }}>
        <Text variant="h1" accessibilityRole="header" style={{ textAlign: 'center' }}>
          Todo listo
        </Text>
        <Text variant="bodySm" tone="secondary" style={{ textAlign: 'center' }}>
          {`Ya puedes empezar a registrar tus movimientos. ${MSG_DONE_PHRASE}`}
        </Text>
      </View>
    </OnboardingScaffold>
  );
}
