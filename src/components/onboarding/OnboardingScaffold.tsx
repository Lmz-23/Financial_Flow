import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useIsDesktop } from '../../hooks/useLayoutSize';
import { stepLabel, ONBOARDING_TOTAL_STEPS } from '../../lib/onboardingDraft';
import { fontFamilyFor, useTheme } from '../../theme';
import { useKeyboardVisible } from '../screens/KeyboardScreen';
import { MIN_TOUCH, SCREEN_MARGIN } from '../ui/ds/constants';
import { Text } from '../ui/ds/Text';
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
  const keyboardVisible = useKeyboardVisible();
  const desktop = useIsDesktop();

  if (desktop) {
    return (
      <DesktopOnboarding step={step} onBack={onBack} backDisabled={backDisabled} scroll={scroll} footer={footer}>
        {children}
      </DesktopOnboarding>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.surfacePage }}
      behavior="padding"
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
          paddingBottom: keyboardVisible ? space[3] : Math.max(insets.bottom, 28),
          gap: space[3],
        }}
      >
        {footer}
      </View>
    </KeyboardAvoidingView>
  );
}

/** Nombres de los 4 pasos para la columna izquierda de escritorio. */
const DESKTOP_STEPS = ['Cuentas', 'Flujo esencial', 'Más opciones', 'Todo listo'] as const;

const DESKTOP_SIDE_WIDTH = 420;
const DESKTOP_CONTENT_MAX_WIDTH = 720;

/**
 * Armazón de escritorio (Design/escritorio 2p-2s): columna izquierda de 420 px con la marca y los 4
 * pasos (el actual resaltado, los anteriores con ✓) y el contenido a la derecha, centrado en vertical
 * con ancho máximo de 720 px.
 */
function DesktopOnboarding({ step, onBack, backDisabled = false, scroll = true, footer, children }: OnboardingScaffoldProps) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.surfacePage }}>
      <View
        style={{
          width: DESKTOP_SIDE_WIDTH,
          paddingVertical: space[6],
          paddingHorizontal: space[6] + 8,
          gap: 48,
          backgroundColor: colors.surfaceCard,
          borderRightWidth: 1,
          borderRightColor: colors.borderSubtle,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.brandPrimary }}
          />
          <Text variant="h3">Financial Flow</Text>
        </View>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={stepLabel(step)}
          accessibilityValue={{ min: 1, max: ONBOARDING_TOTAL_STEPS, now: step, text: stepLabel(step) }}
          style={{ gap: space[4] }}
        >
          {DESKTOP_STEPS.map((label, i) => {
            const n = i + 1;
            const current = n === step;
            const done = n < step;
            return (
              <View
                key={label}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[3],
                  paddingVertical: space[2],
                  paddingHorizontal: space[3],
                  borderRadius: radius.sm,
                  backgroundColor: current ? colors.surfaceRaised : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 1,
                    borderColor: current || done ? colors.brandPrimary : colors.borderSubtle,
                    backgroundColor: current ? colors.brandPrimary : 'transparent',
                  }}
                >
                  <Text
                    variant="label"
                    style={{
                      color: current ? colors.inkOnBrand : done ? colors.brandPrimary : colors.inkSecondary,
                      fontFamily: fontFamilyFor('sans', 600),
                    }}
                  >
                    {done ? '✓' : String(n)}
                  </Text>
                </View>
                <Text
                  variant="body"
                  tone={current || done ? 'primary' : 'secondary'}
                  style={current ? { fontFamily: fontFamilyFor('sans', 600) } : undefined}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: space[6] + 8 }}
      >
        <View style={{ width: '100%', maxWidth: DESKTOP_CONTENT_MAX_WIDTH, gap: 28 }}>
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
                marginLeft: -space[3],
                alignItems: 'center',
                justifyContent: 'center',
                opacity: backDisabled ? 0.4 : 1,
              }}
            >
              <ChevronLeftIcon color={colors.inkPrimary} />
            </Pressable>
          ) : null}
          {scroll ? children : <View style={{ alignItems: 'center', gap: SCREEN_MARGIN }}>{children}</View>}
          <View style={{ gap: space[3], alignItems: scroll ? 'flex-start' : 'center' }}>{footer}</View>
        </View>
      </ScrollView>
    </View>
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
