// Piezas pequenas compartidas por los widgets del Dashboard (solo composicion de tokens del tema).
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { fontFamilyFor, useTheme } from '../../theme';
import { Text } from '../ui/ds';
import { CloseIcon, PlusIcon, SmallPlusIcon } from './icons';

/** Boton circular pequeno (26 px del diseno) con area tactil de 44 px via hitSlop. */
function CircleIconButton({
  accessibilityLabel,
  onPress,
  bordered,
  children,
  size,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  bordered: boolean;
  children: ReactNode;
  size: number;
}) {
  const { colors, radius } = useTheme();
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={{ top: slop, bottom: slop, left: slop, right: slop }}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.full,
        borderWidth: bordered ? 1 : 0,
        borderColor: colors.borderSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** Titulo de widget con una accion a la derecha (agregar o desactivar). */
export function WidgetHeader({
  title,
  addLabel,
  onAdd,
  deactivateLabel,
  onDeactivate,
}: {
  title: string;
  addLabel?: string;
  onAdd?: () => void;
  deactivateLabel?: string;
  onDeactivate?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text variant="h3" accessibilityRole="header">
        {title}
      </Text>
      {onAdd && addLabel ? (
        <CircleIconButton accessibilityLabel={addLabel} onPress={onAdd} bordered size={26}>
          <PlusIcon color={colors.inkSecondary} />
        </CircleIconButton>
      ) : null}
      {onDeactivate && deactivateLabel ? (
        <CircleIconButton accessibilityLabel={deactivateLabel} onPress={onDeactivate} bordered={false} size={28}>
          <CloseIcon color={colors.inkSecondary} />
        </CircleIconButton>
      ) : null}
    </View>
  );
}

/** Enlace de texto de marca ("Ver todas", "Ver detalle"): 13 px, peso 600, brand-primary. */
export function LinkButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1 })}
    >
      <Text variant="bodySm" tone="brand" style={{ fontFamily: fontFamilyFor('sans', 600) }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Boton punteado de "primer dato" dentro de un widget vacio (Agregar deuda, Crear meta). */
export function DashedAddButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, radius, space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space[2],
        borderRadius: radius.sm,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: colors.borderSubtle,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <SmallPlusIcon color={colors.inkSecondary} />
      <Text variant="body" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}
