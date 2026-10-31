import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../theme';

export interface SkeletonBlockProps {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bloque gris que ocupa el lugar de un contenido mientras carga. En web (`Skeleton.web.tsx`) lleva
 * un brillo que lo recorre de izquierda a derecha; aquí, en nativo, es estático.
 */
export function SkeletonBlock({ width = '100%', height, radius, style }: SkeletonBlockProps) {
  const { colors, radius: r } = useTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius ?? r.sm, backgroundColor: colors.borderSubtle }, style]}
    />
  );
}
