import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { formatDate } from '../../domain/utils/date';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  style?: ViewStyle;
}

// Note: This is a simplified date picker using a custom UI.
// For full native date picker, install expo-date-time-picker:
// npx expo install @react-native-community/datetimepicker
//
// This component shows a date display and triggers the native picker.

export function DatePicker({
  value,
  onChange,
  label,
  minimumDate,
  maximumDate,
  style,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  // Simple date formatting
  const displayValue = formatDate(value);

  // For a full implementation, you would use:
  // import DateTimePicker from '@react-native-community/datetimepicker';
  // and conditionally render it based on showPicker state

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TouchableOpacity
        style={styles.container}
        onPress={() => setShowPicker(!showPicker)}
        activeOpacity={0.7}
      >
        <MaterialCommunityIcons
          name="calendar"
          size={20}
          color={colors.textMuted}
        />
        <Text style={styles.value}>{displayValue}</Text>
        <MaterialCommunityIcons
          name={showPicker ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textMuted}
        />
      </TouchableOpacity>

      {/* Placeholder for native DateTimePicker */}
      {/* In full implementation, this would render: */}
      {/* <DateTimePicker value={value} onChange={onChange} /> */}
    </View>
  );
}

// Compact inline date display
export function DateDisplay({
  date,
  label,
  style,
}: {
  date: Date;
  label?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.displayContainer, style]}>
      {label && <Text style={styles.displayLabel}>{label}</Text>}
      <Text style={styles.displayValue}>{formatDate(date)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  value: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  displayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  displayLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  displayValue: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontWeight: typography.fontWeight.medium,
  },
});
