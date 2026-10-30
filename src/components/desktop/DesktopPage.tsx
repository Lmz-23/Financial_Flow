import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import { useTheme } from '../../theme';
import { Text } from '../ui/ds/Text';

export const PAGE_PADDING_X = 40;

export interface DesktopPageProps {
  /** Línea pequeña sobre el título (p. ej. «Octubre 2026», «Hola»). */
  eyebrow?: string;
  title?: string;
  /** Reemplaza al título (p. ej. un monto grande, como en Cuentas o Deudas). */
  heading?: ReactNode;
  /** Botones o controles a la derecha de la cabecera. */
  actions?: ReactNode;
  /** false: el contenido maneja su propio scroll (tablas largas con panel lateral). */
  scroll?: boolean;
  children: ReactNode;
}

/**
 * Página de escritorio (Design/escritorio): cabecera con eyebrow, título y acciones, y el contenido
 * debajo con 40 px de margen lateral. Las piezas dentro usan `PAGE_PADDING_X` si necesitan alinearse.
 */
export function DesktopPage({ eyebrow, title, heading, actions, scroll = true, children }: DesktopPageProps) {
  const { colors, space } = useTheme();
  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: space[5],
        paddingTop: space[6],
        paddingBottom: space[5],
        paddingHorizontal: PAGE_PADDING_X,
      }}
    >
      <View style={{ gap: 2, flexShrink: 1 }}>
        {eyebrow ? (
          <Text variant="bodySm" tone="secondary">
            {eyebrow}
          </Text>
        ) : null}
        {heading ?? (
          <Text variant="displayMd" accessibilityRole="header">
            {title}
          </Text>
        )}
      </View>
      {actions ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>{actions}</View> : null}
    </View>
  );
  const body = <View style={{ paddingHorizontal: PAGE_PADDING_X, paddingBottom: space[6] + 8, gap: space[5] }}>{children}</View>;

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
        {header}
        <View style={{ flex: 1, minHeight: 0 }}>{body}</View>
      </View>
    );
  }
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      {header}
      {body}
    </ScrollView>
  );
}
