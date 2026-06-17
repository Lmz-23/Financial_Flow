import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { formatCOP } from '../../domain/utils/currency';
import type { AccountWithBalance } from '../../hooks/useAccounts';

interface AccountPickerProps {
  accounts: AccountWithBalance[];
  selectedId: string | null;
  onSelect: (accountId: string) => void;
  label?: string;
  style?: ViewStyle;
}

export function AccountPicker({
  accounts,
  selectedId,
  onSelect,
  label,
  style,
}: AccountPickerProps) {
  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'CHECKING':
        return 'bank';
      case 'SAVINGS':
        return 'piggy-bank';
      case 'POCKET':
        return 'wallet';
      case 'INVESTMENT':
        return 'chart-line';
      case 'CASH':
        return 'cash';
      default:
        return 'wallet';
    }
  };

  const renderAccount = ({ item }: { item: AccountWithBalance }) => {
    const isSelected = item.id === selectedId;

    return (
      <TouchableOpacity
        style={[
          styles.accountItem,
          isSelected && styles.accountItemSelected,
        ]}
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: item.color + '20' },
          ]}
        >
          <MaterialCommunityIcons
            name={getAccountIcon(item.type) as any}
            size={24}
            color={item.color}
          />
        </View>
        <View style={styles.accountInfo}>
          <Text style={styles.accountName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.accountInstitution} numberOfLines={1}>
            {item.institution || item.type}
          </Text>
        </View>
        <View style={styles.balanceContainer}>
          <Text
            style={[
              styles.balance,
              item.balance < 0 && styles.balanceNegative,
            ]}
          >
            {formatCOP(item.balance)}
          </Text>
        </View>
        {isSelected && (
          <View style={styles.checkmark}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={colors.accentGreen}
            />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <FlatList
        data={accounts}
        renderItem={renderAccount}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

// Compact horizontal version for inline selection
export function AccountChipSelector({
  accounts,
  selectedId,
  onSelect,
  style,
}: {
  accounts: AccountWithBalance[];
  selectedId: string | null;
  onSelect: (accountId: string) => void;
  style?: ViewStyle;
}) {
  return (
    <FlatList
      horizontal
      data={accounts}
      renderItem={({ item }) => {
        const isSelected = item.id === selectedId;
        return (
          <TouchableOpacity
            style={[
              styles.chipItem,
              isSelected && { borderColor: item.color },
            ]}
            onPress={() => onSelect(item.id)}
          >
            <MaterialCommunityIcons
              name="bank"
              size={16}
              color={isSelected ? item.color : colors.textMuted}
            />
            <Text
              style={[
                styles.chipText,
                isSelected && { color: item.color },
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        );
      }}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipList}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    fontWeight: typography.fontWeight.medium,
  },
  list: {
    paddingBottom: spacing.sm,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  accountItemSelected: {
    borderColor: colors.accentGreen,
    backgroundColor: colors.surface3,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  accountInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  accountName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  accountInstitution: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  balanceContainer: {
    alignItems: 'flex-end',
  },
  balance: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.mono,
  },
  balanceNegative: {
    color: colors.accentRed,
  },
  checkmark: {
    marginLeft: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  // Chip styles
  chipList: {
    paddingVertical: spacing.xs,
  },
  chipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 20,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: spacing.xs,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    maxWidth: 100,
  },
});
