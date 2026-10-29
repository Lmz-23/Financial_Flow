import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../../theme';
import { MIN_TOUCH } from './constants';
import { Text } from './Text';

export interface PeriodStepperProps {
  title: string;
  subtitle?: string | null;
  onPrevious: () => void;
  onNext: () => void;
  /** false = no hay periodo anterior (p. ej. antes del primer dato): la flecha se apaga. */
  canPrevious?: boolean;
  /** false = no hay periodo siguiente (p. ej. el actual): la flecha se apaga. */
  canNext?: boolean;
  /** Qué se cambia, para lectores de pantalla ('mes', 'periodo'). */
  unitLabel: string;
}

function Chevron({ color, flip }: { color: string; flip?: boolean }) {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      accessibilityElementsHidden
      style={flip ? { transform: [{ scaleX: -1 }] } : undefined}
    >
      <Path d="M12.5 15L7.5 10L12.5 5" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Selector de periodo con flechas: ‹ Octubre 2026 ›. */
export function PeriodStepper({
  title,
  subtitle,
  onPrevious,
  onNext,
  canPrevious = true,
  canNext = true,
  unitLabel,
}: PeriodStepperProps) {
  const { colors, radius } = useTheme();
  const arrow = (enabled: boolean) => ({
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.full,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    opacity: enabled ? 1 : 0.3,
  });
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable
        onPress={onPrevious}
        disabled={!canPrevious}
        accessibilityRole="button"
        accessibilityLabel={`${unitLabel} anterior`}
        accessibilityState={{ disabled: !canPrevious }}
        style={arrow(canPrevious)}
      >
        <Chevron color={colors.inkPrimary} />
      </Pressable>
      <View style={{ flex: 1, alignItems: 'center', gap: 2 }} accessibilityLiveRegion="polite">
        <Text variant="h3" style={{ textAlign: 'center' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" tone="secondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onNext}
        disabled={!canNext}
        accessibilityRole="button"
        accessibilityLabel={`${unitLabel} siguiente`}
        accessibilityState={{ disabled: !canNext }}
        style={arrow(canNext)}
      >
        <Chevron color={colors.inkPrimary} flip />
      </Pressable>
    </View>
  );
}
