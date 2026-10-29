import { Pressable, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../../theme';
import { MIN_TOUCH } from './constants';
import { Text } from './Text';
import { useFocusRing } from './useFocusRing';

export interface InviteCardProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  description?: string;
  /** Color de identidad del widget (punto y estado activo): brand-primary, signal-debt o signal-goal. */
  identityColor: string;
  /**
   * Si se define, la tarjeta es un interruptor (Step3-Invitacion): `true` = activada (borde
   * sólido de 1.5 px en el color de identidad y punto relleno). Si no se define, es una
   * invitación inactiva con borde punteado border-subtle.
   */
  selected?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Tarjeta de invitación a un widget opcional no activado: borde punteado, radio sm, color de identidad. */
export function InviteCard({
  title,
  description,
  identityColor,
  selected,
  disabled,
  style,
  accessibilityLabel,
  onFocus,
  onBlur,
  ...rest
}: InviteCardProps) {
  const { colors, radius, space } = useTheme();
  const ring = useFocusRing();
  const isToggle = selected !== undefined;
  const active = selected === true;

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      accessibilityRole={isToggle ? 'checkbox' : 'button'}
      accessibilityLabel={accessibilityLabel ?? (description ? `${title}. ${description}` : title)}
      accessibilityState={{ disabled: Boolean(disabled), ...(isToggle ? { checked: active } : null) }}
      onFocus={(e) => {
        ring.onFocus();
        onFocus?.(e);
      }}
      onBlur={(e) => {
        ring.onBlur();
        onBlur?.(e);
      }}
      style={({ pressed }) => [
        {
          minHeight: MIN_TOUCH,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space[3],
          padding: space[4],
          borderRadius: radius.sm,
          backgroundColor: colors.surfaceCard,
          borderWidth: 1.5,
          borderStyle: active ? 'solid' : 'dashed',
          borderColor: active ? identityColor : colors.borderSubtle,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        ring.style,
        style,
      ]}
    >
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        {isToggle ? null : (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no"
            style={{ width: 8, height: 8, borderRadius: radius.full, backgroundColor: identityColor }}
          />
        )}
        <View style={{ flex: 1, gap: space[1] }}>
          <Text variant="h3">{title}</Text>
          {description ? <Text variant="bodySm">{description}</Text> : null}
        </View>
      </View>
      {isToggle ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            width: 22,
            height: 22,
            borderRadius: radius.full,
            borderWidth: 1.5,
            borderColor: active ? identityColor : colors.borderSubtle,
            backgroundColor: active ? identityColor : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {active ? <Text variant="label" tone="onBrand">{'✓'}</Text> : null}
        </View>
      ) : null}
    </Pressable>
  );
}
