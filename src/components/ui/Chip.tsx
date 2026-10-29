import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, typography } from '../../theme';

type ChipVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

interface ChipProps {
  label: string;
  variant?: ChipVariant;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Chip({ label, variant = 'default', icon, style }: ChipProps) {
  return (
    <View style={[styles.base, styles[variant], style]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, styles[`${variant}Text`]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 20,
  },

  default: {
    backgroundColor: colors.surface2,
  },
  success: {
    backgroundColor: 'rgba(45, 212, 160, 0.15)',
  },
  warning: {
    backgroundColor: 'rgba(245, 185, 66, 0.15)',
  },
  danger: {
    backgroundColor: 'rgba(242, 107, 107, 0.15)',
  },
  info: {
    backgroundColor: 'rgba(77, 156, 248, 0.15)',
  },

  icon: {
    marginRight: spacing.xs,
  },

  text: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
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
  infoText: {
    color: colors.accentBlue,
  },
});
