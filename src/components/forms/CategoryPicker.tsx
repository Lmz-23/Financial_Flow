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
import type { Category } from '../../database/schema';

interface CategoryPickerProps {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  label?: string;
  style?: ViewStyle;
}

export function CategoryPicker({
  categories,
  selectedId,
  onSelect,
  label,
  style,
}: CategoryPickerProps) {
  const renderCategory = ({ item }: { item: Category }) => {
    const isSelected = item.id === selectedId;

    return (
      <TouchableOpacity
        style={[
          styles.categoryItem,
          isSelected && styles.categoryItemSelected,
        ]}
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
          <MaterialCommunityIcons
            name={item.icon as any}
            size={20}
            color={item.color}
          />
        </View>
        <Text
          style={[styles.categoryName, isSelected && styles.categoryNameSelected]}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <MaterialCommunityIcons
              name="check"
              size={16}
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
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.row}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
      />
    </View>
  );
}

// Single-row horizontal version for quick selection
export function CategoryChipSelector({
  categories,
  selectedId,
  onSelect,
  style,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  style?: ViewStyle;
}) {
  return (
    <FlatList
      horizontal
      data={categories}
      renderItem={({ item }) => {
        const isSelected = item.id === selectedId;
        return (
          <TouchableOpacity
            style={[
              styles.chipItem,
              isSelected && { backgroundColor: item.color + '30' },
            ]}
            onPress={() => onSelect(item.id)}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={16}
              color={isSelected ? item.color : colors.textMuted}
            />
            <Text
              style={[
                styles.chipText,
                isSelected && { color: item.color },
              ]}
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
  row: {
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  categoryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    maxWidth: '48%',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryItemSelected: {
    borderColor: colors.accentGreen,
    backgroundColor: colors.surface3,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textPrimary,
  },
  categoryNameSelected: {
    fontWeight: typography.fontWeight.medium,
  },
  checkmark: {
    marginLeft: spacing.xs,
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
    gap: spacing.xs,
  },
  chipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
});
