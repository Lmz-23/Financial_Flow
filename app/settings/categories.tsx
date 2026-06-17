import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Button, Modal, Input } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { database } from '../../src/database';
import { categories as categoriesTable } from '../../src/database/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import type { Category } from '../../src/database/schema';

const ICONS = [
  'food', 'car', 'home', 'medical-bag', 'school', 'gamepad-variant',
  'shopping', 'shirt-shirt', 'dumbbell', 'flight', 'gift', 'paw',
  'phone', 'laptop', 'music', 'movie', 'book', 'cash', 'bank', 'bitcoin',
  'piggy-bank', 'trending-up', 'briefcase', 'wallet',
];

const COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#84CC16', '#22C55E',
  '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9', '#3B82F6',
  '#6366F1', '#8B5CF6', '#A855F7', '#D946EF', '#EC4899',
  '#F43F5E',
];

interface CategoryFormData {
  name: string;
  type: 'INCOME' | 'EXPENSE';
  icon: string;
  color: string;
}

export default function CategoriesScreen() {
  const router = useRouter();
  const [systemCategories, setSystemCategories] = useState<Category[]>([]);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    type: 'EXPENSE',
    icon: 'tag',
    color: colors.accentGreen,
  });

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const allCategories = await database.query.categories.findMany({
        orderBy: [desc(categoriesTable.order), desc(categoriesTable.createdAt)],
      });

      // Separate system (isDefault) from custom
      const system = allCategories.filter((c) => c.isDefault);
      const custom = allCategories.filter((c) => !c.isDefault);

      setSystemCategories(system);
      setCustomCategories(custom);
    } catch (err) {
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleToggleActive = async (category: Category) => {
    try {
      await database
        .update(categoriesTable)
        .set({ isActive: !category.isActive })
        .where(eq(categoriesTable.id, category.id));
      loadCategories();
    } catch (err) {
      console.error('Error toggling category:', err);
      Alert.alert('Error', 'No se pudo actualizar la categoría');
    }
  };

  const handleDeleteCategory = (category: Category) => {
    Alert.alert(
      'Eliminar categoría',
      `¿Estás seguro de que quieres eliminar "${category.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              // Soft delete - just mark as inactive
              await database
                .update(categoriesTable)
                .set({ isActive: false })
                .where(eq(categoriesTable.id, category.id));
              loadCategories();
            } catch (err) {
              console.error('Error deleting category:', err);
              Alert.alert('Error', 'No se pudo eliminar la categoría');
            }
          },
        },
      ]
    );
  };

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', type: 'EXPENSE', icon: 'tag', color: colors.accentGreen });
    setModalVisible(true);
  };

  const handleOpenEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      type: category.type,
      icon: category.icon,
      color: category.color,
    });
    setModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'El nombre es obligatorio');
      return;
    }

    try {
      if (editingCategory) {
        // Update existing
        await database
          .update(categoriesTable)
          .set({
            name: formData.name.trim(),
            icon: formData.icon,
            color: formData.color,
          })
          .where(eq(categoriesTable.id, editingCategory.id));
      } else {
        // Create new
        const id = crypto.randomUUID();
        await database.insert(categoriesTable).values({
          id,
          userId: null, // Will be updated with actual userId on first use
          name: formData.name.trim(),
          type: formData.type,
          icon: formData.icon,
          color: formData.color,
          isDefault: false,
          isActive: true,
          order: 0,
          createdAt: new Date(),
        });
      }
      setModalVisible(false);
      loadCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      Alert.alert('Error', 'No se pudo guardar la categoría');
    }
  };

  const renderCategoryItem = (category: Category, isDefault: boolean) => (
    <View key={category.id} style={styles.categoryItem}>
      <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
        <MaterialCommunityIcons name={category.icon as any} size={18} color={category.color} />
      </View>
      <View style={styles.categoryInfo}>
        <Text style={styles.categoryName}>{category.name}</Text>
        {isDefault && <Text style={styles.defaultBadge}>Por defecto</Text>}
      </View>
      {isDefault ? (
        <Switch
          value={category.isActive}
          onValueChange={() => handleToggleActive(category)}
          trackColor={{ false: colors.surface2, true: colors.accentGreen + '60' }}
          thumbColor={category.isActive ? colors.accentGreen : colors.textMuted}
        />
      ) : (
        <View style={styles.categoryActions}>
          <TouchableOpacity
            onPress={() => handleOpenEditModal(category)}
            style={styles.actionButton}
          >
            <MaterialCommunityIcons name="pencil" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteCategory(category)}
            style={styles.actionButton}
          >
            <MaterialCommunityIcons name="delete" size={18} color={colors.accentRed} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const incomeSystem = systemCategories.filter((c) => c.type === 'INCOME');
  const expenseSystem = systemCategories.filter((c) => c.type === 'EXPENSE');
  const incomeCustom = customCategories.filter((c) => c.type === 'INCOME');
  const expenseCustom = customCategories.filter((c) => c.type === 'EXPENSE');

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Categorías</Text>
            </View>

            {/* Gastos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Gastos</Text>
              <Card style={styles.card}>
                {expenseSystem.map((c) => renderCategoryItem(c, true))}
                {expenseCustom.length > 0 && <View style={styles.divider} />}
                {expenseCustom.map((c) => renderCategoryItem(c, false))}
              </Card>
            </View>

            {/* Ingresos */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingresos</Text>
              <Card style={styles.card}>
                {incomeSystem.map((c) => renderCategoryItem(c, true))}
                {incomeCustom.length > 0 && <View style={styles.divider} />}
                {incomeCustom.map((c) => renderCategoryItem(c, false))}
              </Card>
            </View>

            <View style={styles.spacer} />
          </>
        }
        contentContainerStyle={styles.scroll}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingCategory ? 'Editar categoría' : 'Nueva categoría'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Input
            label="Nombre"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Ej: Comida, Transporte..."
          />

          <Text style={styles.fieldLabel}>Tipo</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeChip,
                formData.type === 'EXPENSE' && styles.typeChipActive,
              ]}
              onPress={() => setFormData({ ...formData, type: 'EXPENSE' })}
            >
              <MaterialCommunityIcons
                name="arrow-up-circle"
                size={16}
                color={formData.type === 'EXPENSE' ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.typeChipText,
                  formData.type === 'EXPENSE' && styles.typeChipTextActive,
                ]}
              >
                Gasto
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeChip,
                formData.type === 'INCOME' && styles.typeChipActive,
              ]}
              onPress={() => setFormData({ ...formData, type: 'INCOME' })}
            >
              <MaterialCommunityIcons
                name="arrow-down-circle"
                size={16}
                color={formData.type === 'INCOME' ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.typeChipText,
                  formData.type === 'INCOME' && styles.typeChipTextActive,
                ]}
              >
                Ingreso
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.fieldLabel}>Icono</Text>
          <View style={styles.iconGrid}>
            {ICONS.map((icon) => (
              <TouchableOpacity
                key={icon}
                style={[
                  styles.iconOption,
                  formData.icon === icon && { backgroundColor: formData.color + '30' },
                ]}
                onPress={() => setFormData({ ...formData, icon })}
              >
                <MaterialCommunityIcons
                  name={icon as any}
                  size={20}
                  color={formData.icon === icon ? formData.color : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Color</Text>
          <View style={styles.colorGrid}>
            {COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorOption,
                  { backgroundColor: color },
                  formData.color === color && styles.colorOptionSelected,
                ]}
                onPress={() => setFormData({ ...formData, color })}
              >
                {formData.color === color && (
                  <MaterialCommunityIcons name="check" size={14} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.modalFooter}>
            <Button variant="ghost" onPress={() => setModalVisible(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onPress={handleSaveCategory}>
              {editingCategory ? 'Guardar' : 'Crear'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  card: { marginHorizontal: spacing.lg },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  categoryInfo: { flex: 1 },
  categoryName: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  defaultBadge: {
    fontSize: typography.fontSize.xs,
    color: colors.textHint,
    marginTop: 2,
  },
  categoryActions: { flexDirection: 'row', gap: spacing.sm },
  actionButton: {
    padding: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  spacer: { height: 80 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  typeSelector: { flexDirection: 'row', gap: spacing.sm },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surface2,
  },
  typeChipActive: { backgroundColor: colors.accentGreen },
  typeChipText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  typeChipTextActive: { color: '#fff' },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  iconOption: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surface2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorOptionSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
});
