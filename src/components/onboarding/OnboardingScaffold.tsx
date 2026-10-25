import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stepLabel, ONBOARDING_TOTAL_STEPS } from '../../lib/onboardingDraft';
import { useTheme } from '../../theme';
import { MIN_TOUCH, SCREEN_MARGIN } from '../ui/ds/constants';
import { ChevronLeftIcon } from './icons';

export interface OnboardingScaffoldProps {
  /** Paso actual, 1 a 4. */
  step: number;
  /** Si se define, muestra «Volver». El paso 1 no lo recibe (espacio vacío de 44x44). */
  onBack?: () => void;
  /** «Volver» deshabilitado (p. ej. mientras se guarda en el paso 4). */
  backDisabled?: boolean;
  /** Contenido desplazable (false lo deja fijo y centrado, como «Todo listo»). */
  scroll?: boolean;
  /** Pie fijo con los botones. */
  footer: ReactNode;
  children: ReactNode;
}

/**
 * Estructura común de los 4 pasos (Step1 a Step4 .dc.html): fila superior con «Volver» y barra de
 * progreso de 4 segmentos (anunciada como «Paso X de 4»), contenido y pie. Respeta safe areas y
 * teclado.
 */
export function OnboardingScaffold({
  step,
  onBack,
  backDisabled = false,
  scroll = true,
  footer,
  children,
}: OnboardingScaffoldProps) {
  const { colors, radius, space } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[3],
          paddingTop: insets.top + space[3] + 2,
          paddingBottom: space[2],
          paddingHorizontal: space[4],
        }}
      >
        {onBack ? (
          <Pressable
            onPress={onBack}
            disabled={backDisabled}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            accessibilityState={{ disabled: backDisabled }}
            style={{
              width: MIN_TOUCH,
              height: MIN_TOUCH,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: backDisabled ? 0.4 : 1,
            }}
          >
            <ChevronLeftIcon color={colors.inkPrimary} />
          </Pressable>
        ) : (
          <View style={{ width: MIN_TOUCH, height: MIN_TOUCH }} />
        )}
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={stepLabel(step)}
          accessibilityValue={{ min: 1, max: ONBOARDING_TOTAL_STEPS, now: step, text: stepLabel(step) }}
          style={{ flex: 1, flexDirection: 'row', gap: space[1] }}
        >
          {Array.from({ length: ONBOARDING_TOTAL_STEPS }, (_, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: i < step ? colors.brandPrimary : colors.borderSubtle,
              }}
            />
          ))}
        </View>
        <View style={{ width: MIN_TOUCH, height: MIN_TOUCH }} />
      </View>

      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ padding: SCREEN_MARGIN, paddingVertical: space[5], gap: 28 }}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: space[6],
            paddingVertical: space[5],
            gap: SCREEN_MARGIN,
          }}
        >
          {children}
        </View>
      )}

      <View
        style={{
          paddingTop: space[4],
          paddingHorizontal: SCREEN_MARGIN,
          paddingBottom: Math.max(insets.bottom, 28),
          gap: space[3],
        }}
      >
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Enlace de texto de 44 px de alto mínimo (p. ej. «Prefiero explorarlo yo mismo»). */
export function TextLink({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={{ minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </Pressable>
  );
}
