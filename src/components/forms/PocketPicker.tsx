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
import type { Pocket } from '../../database/schema';

interface PocketWithBalance extends Pocket {
  balance: number;
}

interface PocketsWithImplicit {
  explicit: PocketWithBalance[];
  implicit: { name: string; balance: number };
}

interface PocketPickerProps {
  pocketsData: PocketsWithImplicit | null;
  selectedPocketId: string | null; // null = unassigned
  onSelect: (pocketId: string | null) => void; // null = "Sin asignar"
  label?: string;
  style?: ViewStyle;
}

export function PocketPicker({
  pocketsData,
  selectedPocketId,
  onSelect,
  label,
  style,
}: PocketPickerProps) {
  if (!pocketsData) {
    return (
      <View style={style}>
        {label && <Text style={styles.label}>{label}</Text>}
        <Text style={styles.empty}>Selecciona una cuenta primero</Text>
      </View>
    );
  }

  const { explicit, implicit } = pocketsData;

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    // First item is always "Sin asignar" (implicit)
    if (index === 0) {
      const isSelected = selectedPocketId === null;
      return (
        <TouchableOpacity
          style={[
            styles.pocketItem,
            isSelected && styles.pocketItemSelected,
            isSelected && styles.unassignedSelected,
          ]}
          onPress={() => onSelect(null)}
          activeOpacity={0.7}
        >
          <View style={[styles.iconContainer, styles.unassignedIcon]}>
            <MaterialCommunityIcons
              name="help-circle-outline"
              size={20}
              color={colors.textMuted}
            />
          </View>
          <View style={styles.pocketInfo}>
            <Text style={[styles.pocketName, styles.unassignedText]}>
              {implicit.name}
            </Text>
            <Text style={[styles.pocketBalance, styles.unassignedText]}>
              {formatCOP(implicit.balance)}
            </Text>
          </View>
          {isSelected && (
            <View style={styles.checkmark}>
              <MaterialCommunityIcons
                name="check-circle"
                size={20}
                color={colors.textMuted}
              />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    // Explicit pockets
    const isSelected = item.id === selectedPocketId;
    return (
      <TouchableOpacity
        style={[
          styles.pocketItem,
          isSelected && styles.pocketItemSelected,
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
            name={item.icon as any}
            size={20}
            color={item.color}
          />
        </View>
        <View style={styles.pocketInfo}>
          <Text style={styles.pocketName} numberOfLines={1}>
            {item.name}
          </Text>
          {item.goalAmount && (
            <View style={styles.goalContainer}>
              <Text style={styles.goalText}>
                Meta: {formatCOP(item.goalAmount)}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(
                        100,
                        (item.balance / item.goalAmount) * 100
                      )}%`,
                      backgroundColor: item.color,
                    },
                  ]}
                />
              </View>
            </View>
          )}
          <Text style={styles.pocketBalance}>{formatCOP(item.balance)}</Text>
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

  // Combine implicit (first) + explicit pockets
  const data = [
    { id: '__unassigned__', ...implicit, isImplicit: true },
    ...explicit.map((p) => ({ ...p, isImplicit: false })),
  ];

  return (
    <View style={style}>
      {label && <Text style={styles.label}>{label}</Text>}
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => (item.isImplicit ? '__unassigned__' : item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
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
  list: {
    paddingBottom: spacing.sm,
  },
  pocketItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  pocketItemSelected: {
    borderColor: colors.accentGreen,
    backgroundColor: colors.surface3,
  },
  unassignedSelected: {
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  unassignedIcon: {
    backgroundColor: colors.surface3,
  },
  pocketInfo: {
    flex: 1,
  },
  pocketName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 2,
  },
  unassignedText: {
    color: colors.textMuted,
  },
  pocketBalance: {
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
    fontFamily: typography.fontFamily.mono,
  },
  goalContainer: {
    marginTop: 2,
    marginBottom: 2,
  },
  goalText: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginBottom: 2,
  },
  progressBar: {
    height: 3,
    backgroundColor: colors.surface3,
    borderRadius: 2,
    width: 80,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  checkmark: {
    marginLeft: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  empty: {
    fontSize: typography.fontSize.sm,
    color: colors.textHint,
    fontStyle: 'italic',
    padding: spacing.md,
  },
});
