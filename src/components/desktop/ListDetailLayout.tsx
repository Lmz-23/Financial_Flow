import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../theme';

export const DETAIL_PANEL_WIDTH = 420;

/**
 * Lista a lo ancho con panel de detalle a la derecha (Design/escritorio, 1e/2b): `detail` en null
 * cierra el panel y la lista recupera el ancho.
 */
export function ListDetailLayout({ list, detail }: { list: ReactNode; detail: ReactNode | null }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', minWidth: 0 }}>
      <View style={{ flex: 1, minWidth: 0 }}>{list}</View>
      {detail ? (
        <View
          style={{
            width: DETAIL_PANEL_WIDTH,
            backgroundColor: colors.surfaceCard,
            borderLeftWidth: 1,
            borderLeftColor: colors.borderSubtle,
          }}
        >
          {detail}
        </View>
      ) : null}
    </View>
  );
}
