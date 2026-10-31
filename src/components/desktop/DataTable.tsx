import type { ReactNode } from 'react';
import { Pressable, View, type DimensionValue, type PressableStateCallbackType } from 'react-native';

import { useTheme } from '../../theme';
import { Text } from '../ui/ds/Text';

export interface DataColumn<Row> {
  key: string;
  title: string;
  /** Ancho fijo en px o `flex` relativo (por defecto flex 1). */
  width?: DimensionValue;
  flex?: number;
  align?: 'left' | 'right';
  render: (row: Row) => ReactNode;
}

export interface DataTableProps<Row> {
  columns: readonly DataColumn<Row>[];
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  selectedKey?: string | null;
  onRowPress?: (row: Row) => void;
  /** Texto cuando no hay filas. */
  empty?: string;
  rowHeight?: number;
  accessibilityLabelFor?: (row: Row) => string;
}

type WebPressableState = PressableStateCallbackType & { hovered?: boolean };

/**
 * Tabla tipo estado de cuenta (Design/escritorio, 1e): cabecera gris, filas de 48 px separadas por
 * borde, hover y fila seleccionada con tinte de marca. Los montos van alineados a la derecha
 * (`align: 'right'`) y en mono vía `<Amount>`.
 */
export function DataTable<Row>({
  columns,
  rows,
  rowKey,
  selectedKey,
  onRowPress,
  empty = 'Todavía no hay nada aquí.',
  rowHeight = 48,
  accessibilityLabelFor,
}: DataTableProps<Row>) {
  const { colors, radius, space } = useTheme();

  const cell = (col: DataColumn<Row>, content: ReactNode) => (
    <View
      key={col.key}
      style={{
        width: col.width,
        flex: col.width === undefined ? (col.flex ?? 1) : undefined,
        minWidth: 0,
        alignItems: col.align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {content}
    </View>
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceCard,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[4],
          minHeight: 40,
          paddingHorizontal: space[5] - 4,
          backgroundColor: colors.surfaceRaised,
        }}
      >
        {columns.map((col) =>
          cell(
            col,
            <Text variant="label" tone="secondary">
              {col.title}
            </Text>,
          ),
        )}
      </View>
      {rows.length === 0 ? (
        <View style={{ padding: space[5] }}>
          <Text variant="bodySm" tone="secondary">
            {empty}
          </Text>
        </View>
      ) : (
        rows.map((row) => {
          const key = rowKey(row);
          const selected = key === selectedKey;
          return (
            <Pressable
              key={key}
              onPress={onRowPress ? () => onRowPress(row) : undefined}
              disabled={!onRowPress}
              accessibilityRole={onRowPress ? 'button' : undefined}
              accessibilityState={onRowPress ? { selected } : undefined}
              accessibilityLabel={accessibilityLabelFor?.(row)}
              style={(state) => {
                const { hovered } = state as WebPressableState;
                return {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space[4],
                  minHeight: rowHeight,
                  paddingHorizontal: space[5] - 4,
                  paddingVertical: space[2],
                  borderTopWidth: 1,
                  borderTopColor: colors.borderSubtle,
                  backgroundColor: selected ? colors.surfaceRaised : hovered ? colors.surfaceRaised : 'transparent',
                  boxShadow: selected ? `inset 3px 0 0 ${colors.brandPrimary}` : undefined,
                };
              }}
            >
              {columns.map((col) => cell(col, col.render(row)))}
            </Pressable>
          );
        })
      )}
    </View>
  );
}
