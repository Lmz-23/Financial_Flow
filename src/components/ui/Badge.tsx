import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'pending';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      <Text style={[styles.text, styles[`${variant}Text`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },

  default: {
    backgroundColor: colors.surface2,
  },
  success: {
    backgroundColor: 'rgba(45, 212, 160, 0.2)',
  },
  warning: {
    backgroundColor: 'rgba(245, 185, 66, 0.2)',
  },
  danger: {
    backgroundColor: 'rgba(242, 107, 107, 0.2)',
  },
  pending: {
    backgroundColor: 'rgba(77, 156, 248, 0.2)',
  },

  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.semibold,
    textTransform: 'uppercase',
  },

  defaultText: {
    color: colors.textMuted,
  },
  successText: {
    color: colors.accentGreen,
  },
  warningText: {
    color: colors.accentAmber,
  },
  dangerText: {
    color: colors.accentRed,
  },
  pendingText: {
    color: colors.accentBlue,
  },
});
