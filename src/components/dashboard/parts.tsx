// Piezas pequenas compartidas por los widgets del Dashboard (solo composicion de tokens del tema).
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { fontFamilyFor, useTheme } from '../../theme';
import { Text } from '../ui/ds';
import { CloseIcon, PlusIcon, SmallPlusIcon } from './icons';

/** Etiqueta de las acciones que aun no tienen pantalla (F5b). */
const COMING_SOON = 'Próximamente';

/** Boton circular pequeno (26 px del diseno) con area tactil de 44 px via hitSlop. */
function CircleIconButton({
  accessibilityLabel,
  onPress,
  bordered,
  children,
  size,
  disabled = false,
}: {
  accessibilityLabel: string;
  onPress: () => void;
  bordered: boolean;
  children: ReactNode;
  size: number;
  disabled?: boolean;
}) {
  const { colors, radius } = useTheme();
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
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
        opacity: disabled ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      {children}
    </Pressable>
  );
}

/** Titulo de widget con una accion a la derecha (agregar o desactivar). `addComingSoon` apaga la accion de agregar. */
export function WidgetHeader({
  title,
  titleAccessory,
  addLabel,
  onAdd,
  addComingSoon = false,
  deactivateLabel,
  onDeactivate,
}: {
  title: string;
  /** Elemento junto al titulo (p. ej. el icono de ayuda). */
  titleAccessory?: ReactNode;
  addLabel?: string;
  onAdd?: () => void;
  addComingSoon?: boolean;
  deactivateLabel?: string;
  onDeactivate?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
        <Text variant="h3" accessibilityRole="header">
          {title}
        </Text>
        {titleAccessory}
      </View>
      {onAdd && addLabel ? (
        <CircleIconButton
          accessibilityLabel={addComingSoon ? `${addLabel}, ${COMING_SOON}` : addLabel}
          onPress={onAdd}
          bordered
          size={26}
          disabled={addComingSoon}
        >
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

/** Enlace de texto de marca ("Ver todas", "Ver detalle"): 13 px, peso 600, brand-primary. `comingSoon` lo apaga y cambia el texto por el de pendiente. */
export function LinkButton({
  label,
  onPress,
  comingSoon = false,
}: {
  label: string;
  onPress: () => void;
  comingSoon?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ disabled: comingSoon }}
      disabled={comingSoon}
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: comingSoon ? 0.4 : pressed ? 0.7 : 1 })}
    >
      <Text variant="bodySm" tone="brand" style={{ fontFamily: fontFamilyFor('sans', 600) }}>
        {comingSoon ? COMING_SOON : label}
      </Text>
    </Pressable>
  );
}

/** Boton punteado de "primer dato" dentro de un widget vacio (Agregar deuda, Crear meta). `comingSoon` lo apaga y añade el aviso de pendiente. */
export function DashedAddButton({
  label,
  onPress,
  comingSoon = false,
}: {
  label: string;
  onPress: () => void;
  comingSoon?: boolean;
}) {
  const { colors, radius, space } = useTheme();
  const text = comingSoon ? `${label} · ${COMING_SOON}` : label;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ disabled: comingSoon }}
      disabled={comingSoon}
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
        opacity: comingSoon ? 0.4 : pressed ? 0.7 : 1,
      })}
    >
      <SmallPlusIcon color={colors.inkSecondary} />
      <Text variant="body" tone="secondary">
        {text}
      </Text>
    </Pressable>
  );
}
