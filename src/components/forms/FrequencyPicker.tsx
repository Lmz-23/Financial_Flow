import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import type { Frequency } from '../../domain/utils/date';

interface FrequencyPickerProps {
  value: Frequency;
  onChange: (frequency: Frequency) => void;
  dayOfWeek?: number | null; // 0-6 (Sunday-Saturday)
  dayOfMonth?: number | null; // 1-31
  month?: number | null; // 1-12
  onDayOfWeekChange?: (day: number) => void;
  onDayOfMonthChange?: (day: number) => void;
  onMonthChange?: (month: number) => void;
  label?: string;
  style?: ViewStyle;
}

const FREQUENCIES: { value: Frequency; label: string; icon: string }[] = [
  { value: 'WEEKLY', label: 'Semanal', icon: 'calendar-week' },
  { value: 'BIWEEKLY', label: 'Quincenal', icon: 'calendar-week-begin' },
  { value: 'MONTHLY', label: 'Mensual', icon: 'calendar-month' },
  { value: 'ANNUAL', label: 'Anual', icon: 'calendar' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Lun' },
  { value: 2, label: 'Mar' },
  { value: 3, label: 'Mié' },
  { value: 4, label: 'Jue' },
  { value: 5, label: 'Vie' },
  { value: 6, label: 'Sáb' },
];

const MONTHS = [
  { value: 1, label: 'Ene' },
  { value: 2, label: 'Feb' },
  { value: 3, label: 'Mar' },
  { value: 4, label: 'Abr' },
  { value: 5, label: 'May' },
  { value: 6, label: 'Jun' },
  { value: 7, label: 'Jul' },
  { value: 8, label: 'Ago' },
  { value: 9, label: 'Sep' },
  { value: 10, label: 'Oct' },
  { value: 11, label: 'Nov' },
  { value: 12, label: 'Dic' },
];

export function FrequencyPicker({
  value,
  onChange,
  dayOfWeek,
  dayOfMonth,
  month,
  onDayOfWeekChange,
  onDayOfMonthChange,
  onMonthChange,
  label,
  style,
}: FrequencyPickerProps) {
  const showDayOfWeek = value === 'WEEKLY' || value === 'BIWEEKLY';
  const showDayOfMonth = value === 'MONTHLY';
  const showMonth = value === 'ANNUAL';

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}

      {/* Frequency selector */}
      <View style={styles.frequencyContainer}>
        {FREQUENCIES.map((freq) => (
          <TouchableOpacity
            key={freq.value}
            style={[
              styles.frequencyItem,
              value === freq.value && styles.frequencyItemSelected,
            ]}
            onPress={() => onChange(freq.value)}
          >
            <MaterialCommunityIcons
              name={freq.icon as any}
              size={20}
              color={
                value === freq.value ? colors.accentGreen : colors.textMuted
              }
            />
            <Text
              style={[
                styles.frequencyLabel,
                value === freq.value && styles.frequencyLabelSelected,
              ]}
            >
              {freq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Day of week selector (for weekly/biweekly) */}
      {showDayOfWeek && onDayOfWeekChange && (
        <View style={styles.additionalField}>
          <Text style={styles.additionalLabel}>Día de la semana</Text>
          <View style={styles.daySelector}>
            {DAYS_OF_WEEK.map((day) => (
              <TouchableOpacity
                key={day.value}
                style={[
                  styles.dayItem,
                  dayOfWeek === day.value && styles.dayItemSelected,
                ]}
                onPress={() => onDayOfWeekChange(day.value)}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    dayOfWeek === day.value && styles.dayLabelSelected,
                  ]}
                >
                  {day.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Day of month selector (for monthly) */}
      {showDayOfMonth && onDayOfMonthChange && (
        <View style={styles.additionalField}>
          <Text style={styles.additionalLabel}>Día del mes</Text>
          <View style={styles.dayOfMonthContainer}>
            {[1, 5, 10, 15, 20, 25, 28].map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.dayOfMonthItem,
                  dayOfMonth === day && styles.dayOfMonthItemSelected,
                ]}
                onPress={() => onDayOfMonthChange(day)}
              >
                <Text
                  style={[
                    styles.dayOfMonthLabel,
                    dayOfMonth === day && styles.dayOfMonthLabelSelected,
                  ]}
                >
                  {day}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Month + day selector (for annual) */}
      {showMonth && onMonthChange && onDayOfMonthChange && (
        <View style={styles.additionalField}>
          <Text style={styles.additionalLabel}>Fecha</Text>
          <View style={styles.annualSelector}>
            <View style={styles.monthSelector}>
              {MONTHS.map((m) => (
                <TouchableOpacity
                  key={m.value}
                  style={[
                    styles.monthItem,
                    month === m.value && styles.monthItemSelected,
                  ]}
                  onPress={() => onMonthChange(m.value)}
                >
                  <Text
                    style={[
                      styles.monthLabel,
                      month === m.value && styles.monthLabelSelected,
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.dayOfMonthContainer}>
              {[1, 15].map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayOfMonthItem,
                    styles.dayOfMonthItemCompact,
                    dayOfMonth === day && styles.dayOfMonthItemSelected,
                  ]}
                  onPress={() => onDayOfMonthChange(day)}
                >
                  <Text
                    style={[
                      styles.dayOfMonthLabel,
                      dayOfMonth === day && styles.dayOfMonthLabelSelected,
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  frequencyContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: spacing.xs,
    gap: spacing.xs,
  },
  frequencyItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: 8,
    gap: spacing.xs,
  },
  frequencyItemSelected: {
    backgroundColor: colors.surface3,
  },
  frequencyLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  frequencyLabelSelected: {
    color: colors.accentGreen,
    fontWeight: typography.fontWeight.medium,
  },
  additionalField: {
    marginTop: spacing.md,
  },
  additionalLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  daySelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: spacing.xs,
    justifyContent: 'space-between',
  },
  dayItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 6,
    marginHorizontal: 1,
  },
  dayItemSelected: {
    backgroundColor: colors.accentGreen,
  },
  dayLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
  },
  dayLabelSelected: {
    color: '#000',
    fontWeight: typography.fontWeight.semibold,
  },
  dayOfMonthContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayOfMonthItem: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOfMonthItemCompact: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  dayOfMonthItemSelected: {
    backgroundColor: colors.accentGreen,
  },
  dayOfMonthLabel: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    fontWeight: typography.fontWeight.medium,
  },
  dayOfMonthLabelSelected: {
    color: '#000',
  },
  annualSelector: {
    gap: spacing.sm,
  },
  monthSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  monthItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: 6,
  },
  monthItemSelected: {
    backgroundColor: colors.accentGreen,
  },
  monthLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  monthLabelSelected: {
    color: '#000',
    fontWeight: typography.fontWeight.medium,
  },
});
