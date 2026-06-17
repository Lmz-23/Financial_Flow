import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { colors, spacing, typography } from '../../theme';
import { formatCOP, parseCOP } from '../../domain/utils/currency';

interface AmountInputProps {
  value: number; // Raw numeric value (e.g., 150000)
  onChangeValue: (value: number) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  containerStyle?: ViewStyle;
  autoFocus?: boolean;
}

export function AmountInput({
  value,
  onChangeValue,
  label,
  error,
  placeholder = '0',
  containerStyle,
  autoFocus = false,
}: AmountInputProps) {
  // Display formatted while typing
  const [displayValue, setDisplayValue] = useState(
    value > 0 ? formatCOP(value).replace('$', '') : ''
  );
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = useCallback(
    (text: string) => {
      // Remove non-numeric characters except comma and period
      const cleaned = text.replace(/[^\d]/g, '');

      if (cleaned === '') {
        setDisplayValue('');
        onChangeValue(0);
        return;
      }

      // Parse to number
      const numericValue = parseInt(cleaned, 10);

      // Format for display (without currency symbol)
      const formatted = formatCOP(numericValue).replace('$', '').trim();
      setDisplayValue(formatted);

      // Update with raw value
      onChangeValue(numericValue);
    },
    [onChangeValue]
  );

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw value when focused for easier editing
    if (value > 0) {
      setDisplayValue(value.toString());
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format again when losing focus
    if (value > 0) {
      setDisplayValue(formatCOP(value).replace('$', ''));
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputContainer, isFocused && styles.inputFocused, error && styles.inputError]}>
        <Text style={styles.currencySymbol}>$</Text>
        <TextInput
          style={styles.input}
          value={displayValue}
          onChangeText={handleChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor={colors.textHint}
          keyboardType="numeric"
          autoFocus={autoFocus}
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

// Compact version for use inside other components
export function AmountInputCompact({
  value,
  onChangeValue,
  style,
}: {
  value: number;
  onChangeValue: (value: number) => void;
  style?: ViewStyle;
}) {
  const [displayValue, setDisplayValue] = useState(value > 0 ? value.toString() : '');

  const handleChangeText = (text: string) => {
    const cleaned = text.replace(/[^\d]/g, '');
    if (cleaned === '') {
      setDisplayValue('');
      onChangeValue(0);
      return;
    }
    const numericValue = parseInt(cleaned, 10);
    setDisplayValue(cleaned);
    onChangeValue(numericValue);
  };

  return (
    <View style={[styles.compactContainer, style]}>
      <Text style={styles.currencySymbol}>$</Text>
      <TextInput
        style={styles.compactInput}
        value={displayValue}
        onChangeText={handleChangeText}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textHint}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  inputFocused: {
    borderColor: colors.accentBlue,
  },
  inputError: {
    borderColor: colors.accentRed,
  },
  currencySymbol: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textMuted,
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
    fontFamily: typography.fontFamily.mono,
  },
  error: {
    fontSize: typography.fontSize.sm,
    color: colors.accentRed,
    marginTop: spacing.xs,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
  },
  compactInput: {
    flex: 1,
    fontSize: typography.fontSize.lg,
    color: colors.textPrimary,
    paddingVertical: spacing.sm,
    fontFamily: typography.fontFamily.mono,
  },
});
