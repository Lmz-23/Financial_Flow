import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing } from '../../theme';

interface DividerProps {
  style?: ViewStyle;
  spacing?: 'none' | 'sm' | 'md' | 'lg';
}

export function Divider({ style, spacing: spacingProp = 'md' }: DividerProps) {
  return (
    <View
      style={[
        styles.base,
        spacingProp === 'none' && styles.noMargin,
        spacingProp === 'sm' && styles.smMargin,
        spacingProp === 'md' && styles.mdMargin,
        spacingProp === 'lg' && styles.lgMargin,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  noMargin: {
    marginVertical: 0,
  },
  smMargin: {
    marginVertical: spacing.sm,
  },
  mdMargin: {
    marginVertical: spacing.md,
  },
  lgMargin: {
    marginVertical: spacing.lg,
  },
});
