import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../theme';
import { PAGE_PADDING_X } from './DesktopPage';
import type { SkeletonKind } from '../../navigation/desktop';
import { SkeletonBlock } from './Skeleton';

export type SkeletonVariant = SkeletonKind;

/** Tarjeta vacía con el borde y el radio de un widget; adentro, bloques de carga. */
function Card({ children, height, flex = 1 }: { children?: ReactNode; height?: number; flex?: number }) {
  const { colors, radius, space } = useTheme();
  return (
    <View
      style={{
        flex,
        minWidth: 0,
        height,
        gap: space[3] + 2,
        padding: space[5] - 4,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceCard,
      }}
    >
      {children}
    </View>
  );
}

function Header({ action = true }: { action?: boolean }) {
  const { space } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingTop: space[6],
        paddingBottom: space[5],
        paddingHorizontal: PAGE_PADDING_X,
      }}
    >
      <View style={{ gap: space[2] }}>
        <SkeletonBlock width={96} height={12} radius={4} />
        <SkeletonBlock width={240} height={28} />
      </View>
      {action ? <SkeletonBlock width={190} height={40} /> : null}
    </View>
  );
}

function TableRows({ rows }: { rows: number }) {
  const { colors, radius, space } = useTheme();
  return (
    <View style={{ borderWidth: 1, borderColor: colors.borderSubtle, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.surfaceCard }}>
      <View style={{ height: 40, backgroundColor: colors.surfaceRaised }} />
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[4],
            height: 48,
            paddingHorizontal: space[4],
            borderTopWidth: 1,
            borderTopColor: colors.borderSubtle,
          }}
        >
          <SkeletonBlock width={56} height={12} radius={4} />
          <SkeletonBlock width={`${30 + ((i * 17) % 25)}%`} height={14} radius={4} />
          <View style={{ flex: 1 }} />
          <SkeletonBlock width={96} height={14} radius={4} />
        </View>
      ))}
    </View>
  );
}

function Body({ variant }: { variant: SkeletonVariant }) {
  const { space } = useTheme();
  const gap = space[5];
  switch (variant) {
    case 'dashboard':
      return (
        <View style={{ gap }}>
          <View style={{ flexDirection: 'row', gap }}>
            <Card height={170}>
              <SkeletonBlock width="50%" height={16} />
              <SkeletonBlock width="35%" height={40} />
            </Card>
            <Card height={170}>
              <SkeletonBlock width="40%" height={16} />
              <SkeletonBlock height={8} radius={999} />
              <SkeletonBlock width="70%" height={22} />
            </Card>
            <Card height={170}>
              <SkeletonBlock width="55%" height={16} />
              <SkeletonBlock width="45%" height={30} />
              <SkeletonBlock height={14} />
            </Card>
          </View>
          <View style={{ flexDirection: 'row', gap }}>
            <Card flex={2} height={300}>
              <SkeletonBlock width="30%" height={16} />
              {[0, 1, 2, 3, 4].map((i) => (
                <SkeletonBlock key={i} height={18} />
              ))}
            </Card>
            <Card height={300}>
              <SkeletonBlock width="45%" height={16} />
              <SkeletonBlock height={18} />
              <SkeletonBlock height={18} />
            </Card>
          </View>
        </View>
      );
    case 'table':
      return (
        <View style={{ gap }}>
          <View style={{ flexDirection: 'row', gap: space[6] }}>
            <SkeletonBlock width={130} height={40} />
            <SkeletonBlock width={130} height={40} />
          </View>
          <TableRows rows={9} />
        </View>
      );
    case 'cards':
      return (
        <View style={{ flexDirection: 'row', gap }}>
          {[0, 1, 2].map((i) => (
            <Card key={i} height={230}>
              <SkeletonBlock width="60%" height={16} />
              <SkeletonBlock width="50%" height={30} />
              <SkeletonBlock height={8} radius={999} />
              <SkeletonBlock height={40} />
            </Card>
          ))}
        </View>
      );
    case 'weeks':
      return (
        <View style={{ flexDirection: 'row', gap: space[4] }}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} height={420}>
              <SkeletonBlock width="60%" height={12} radius={4} />
              <SkeletonBlock height={62} />
              <SkeletonBlock height={62} />
            </Card>
          ))}
        </View>
      );
    case 'chart':
      return (
        <View style={{ gap }}>
          <Card height={340}>
            <SkeletonBlock width="35%" height={22} />
            <SkeletonBlock height={250} />
          </Card>
          <View style={{ flexDirection: 'row', gap }}>
            <Card height={200}>
              <SkeletonBlock width="40%" height={16} />
              <SkeletonBlock height={14} />
              <SkeletonBlock height={14} />
            </Card>
            <Card height={200}>
              <SkeletonBlock width="40%" height={16} />
              <SkeletonBlock height={14} />
            </Card>
          </View>
        </View>
      );
    case 'cashflow':
      return (
        <View style={{ flexDirection: 'row', gap }}>
          <View style={{ flex: 1.5, gap }}>
            <SkeletonBlock height={220} radius={22} />
            <View style={{ flexDirection: 'row', gap }}>
              <Card height={100}>
                <SkeletonBlock width="60%" height={12} radius={4} />
                <SkeletonBlock width="50%" height={28} />
              </Card>
              <Card height={100}>
                <SkeletonBlock width="60%" height={12} radius={4} />
                <SkeletonBlock width="50%" height={28} />
              </Card>
            </View>
          </View>
          <View style={{ flex: 1, gap }}>
            <Card height={150}>
              <SkeletonBlock width="60%" height={16} />
              <SkeletonBlock height={18} />
            </Card>
            <Card height={180}>
              <SkeletonBlock width="45%" height={16} />
              <SkeletonBlock height={60} />
            </Card>
          </View>
        </View>
      );
    case 'settings':
      return (
        <View style={{ width: 760, maxWidth: '100%', alignSelf: 'center', gap }}>
          <Card height={100}>
            <SkeletonBlock width="25%" height={16} />
            <SkeletonBlock height={40} />
          </Card>
          <Card height={170}>
            <SkeletonBlock width="30%" height={16} />
            <SkeletonBlock height={22} />
            <SkeletonBlock height={22} />
          </Card>
        </View>
      );
  }
}

/**
 * Esqueleto de una pantalla de escritorio mientras carga: la misma estructura (cabecera, tarjetas,
 * tabla, columnas) con bloques que brillan, en vez de una pantalla en blanco o un círculo de carga.
 */
export function ScreenSkeleton({ variant }: { variant: SkeletonVariant }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <Header action={variant !== 'settings'} />
      <View style={{ paddingHorizontal: PAGE_PADDING_X, paddingBottom: space[6] }}>
        <Body variant={variant} />
      </View>
    </View>
  );
}

/** Esqueleto de toda la app de escritorio al arrancar: menú lateral y el Inicio. */
export function StartupSkeleton() {
  const { colors, space } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.surfacePage }}>
      <View
        style={{
          width: 76,
          alignItems: 'center',
          gap: space[3],
          paddingVertical: space[5] - 4,
          backgroundColor: colors.surfaceCard,
          borderRightWidth: 1,
          borderRightColor: colors.borderSubtle,
        }}
      >
        <SkeletonBlock width={32} height={32} radius={9} style={{ marginBottom: space[3] }} />
        {Array.from({ length: 8 }, (_, i) => (
          <SkeletonBlock key={i} width={44} height={36} radius={10} />
        ))}
      </View>
      <ScreenSkeleton variant="dashboard" />
    </View>
  );
}
