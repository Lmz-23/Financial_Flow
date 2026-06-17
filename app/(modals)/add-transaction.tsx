import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/ui';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { Modal } from '../../src/components/ui/Modal';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import { database } from '../../src/database';
import { categories } from '../../src/database/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { TransactionRepository } from '../../src/database/repositories/transactionRepository';
import type { Category } from '../../src/database/schema';

type TransactionType = 'INCOME' | 'EXPENSE';

export default function AddTransactionModal() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const { accounts } = useAccounts();
  const { pockets } = usePockets();

  const [form, setForm] = useState({
    type: 'EXPENSE' as TransactionType,
    amount: 0,
    description: '',
    categoryId: null as string | null,
    accountId: accounts[0]?.id || '',
    pocketId: null as string | null,
    date: new Date(),
    autoDistribute: false,
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);
  const [showPocketPicker, setShowPocketPicker] = useState(false);

  // Load categories when type changes
  useState(() => {
    async function loadCategories() {
      const cats = await database.query.categories.findMany({
        where: eq(categories.type, form.type),
        orderBy: (categories, { asc }) => [asc(categories.order), asc(categories.name)],
      });
      setCategories(cats);
    }
    loadCategories();
  });

  const filteredCategories = categories.filter((c) => c.type === form.type);

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return 'Sin categoría';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.name || 'Sin categoría';
  };

  const getCategoryIcon = (categoryId: string | null) => {
    if (!categoryId) return 'tag';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.icon || 'tag';
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return colors.textMuted;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || colors.textMuted;
  };

  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.name || 'Seleccionar cuenta';
  };

  const getPocketName = (pocketId: string | null) => {
    if (!pocketId) return 'Sin asignar';
    const pocket = pockets.find((p) => p.id === pocketId);
    return pocket?.name || 'Sin asignar';
  };

  // Pockets for selected account
  const accountPockets = pockets.filter((p) => p.accountId === form.accountId);

  const handleSave = async () => {
    if (form.amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (!form.description.trim()) {
      Alert.alert('Error', 'Ingresa una descripción');
      return;
    }

    if (!form.accountId) {
      Alert.alert('Error', 'Selecciona una cuenta');
      return;
    }

    setLoading(true);
    try {
      await TransactionRepository.create({
        userId,
        accountId: form.accountId,
        toAccountId: null,
        type: form.type,
        amount: form.amount,
        description: form.description.trim(),
        categoryId: form.categoryId,
        pocketId: form.pocketId,
        date: form.date,
        status: 'CONFIRMED',
      });

      router.back();
    } catch (error) {
      console.error('Error creating transaction:', error);
      Alert.alert('Error', 'No se pudo crear la transacción');
    } finally {
      setLoading(false);
    }
  };

  const toggleType = () => {
    setForm({
      ...form,
      type: form.type === 'INCOME' ? 'EXPENSE' : 'INCOME',
      categoryId: null, // Reset category when type changes
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nueva transacción</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Type Toggle */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[styles.typeButton, form.type === 'EXPENSE' && styles.typeButtonExpenseActive]}
            onPress={() => form.type !== 'EXPENSE' && toggleType()}
          >
            <MaterialCommunityIcons
              name="arrow-up-circle"
              size={24}
              color={form.type === 'EXPENSE' ? '#fff' : colors.accentRed}
            />
            <Text style={[styles.typeButtonText, form.type === 'EXPENSE' && styles.typeButtonTextActive]}>
              Gasto
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.typeButton, form.type === 'INCOME' && styles.typeButtonIncomeActive]}
            onPress={() => form.type !== 'INCOME' && toggleType()}
          >
            <MaterialCommunityIcons
              name="arrow-down-circle"
              size={24}
              color={form.type === 'INCOME' ? '#fff' : colors.accentGreen}
            />
            <Text style={[styles.typeButtonText, form.type === 'INCOME' && styles.typeButtonTextActive]}>
              Ingreso
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <AmountInput
            label="Monto"
            value={form.amount}
            onChangeValue={(val) => setForm({ ...form, amount: val })}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Input
            label="Descripción"
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            placeholder={form.type === 'EXPENSE' ? 'Ej: Compra en supermercado' : 'Ej: Pago de nómina'}
          />
        </View>

        {/* Category */}
        <View style={styles.section}>
          <Text style={styles.label}>Categoría</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowCategoryPicker(true)}>
            <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(form.categoryId) + '20' }]}>
              <MaterialCommunityIcons name={getCategoryIcon(form.categoryId) as any} size={20} color={getCategoryColor(form.categoryId)} />
            </View>
            <Text style={styles.pickerButtonText}>{getCategoryName(form.categoryId)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Account */}
        <View style={styles.section}>
          <Text style={styles.label}>Cuenta</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowAccountPicker(true)}>
            <MaterialCommunityIcons name="bank" size={20} color={colors.textMuted} />
            <Text style={styles.pickerButtonText}>{getAccountName(form.accountId)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Pocket (optional, after account selected) */}
        <View style={styles.section}>
          <Text style={styles.label}>Bolsillo (opcional)</Text>
          <TouchableOpacity style={styles.pickerButton} onPress={() => setShowPocketPicker(true)}>
            <MaterialCommunityIcons name="wallet" size={20} color={colors.textMuted} />
            <Text style={styles.pickerButtonText}>{getPocketName(form.pocketId)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={styles.label}>Fecha</Text>
          <TouchableOpacity style={styles.pickerButton}>
            <MaterialCommunityIcons name="calendar" size={20} color={colors.textMuted} />
            <Text style={styles.pickerButtonText}>
              {form.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Auto-distribute toggle for INCOME */}
        {form.type === 'INCOME' && (
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>¿Aplicar distribución automática?</Text>
                <Text style={styles.toggleHint}>Distribuye el ingreso entre bolsillos según tus reglas</Text>
              </View>
              <Switch
                value={form.autoDistribute}
                onValueChange={(val) => setForm({ ...form, autoDistribute: val })}
                trackColor={{ false: colors.surface3, true: colors.accentGreen }}
                thumbColor="#fff"
              />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="ghost" onPress={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onPress={handleSave} loading={loading}>
          Guardar
        </Button>
      </View>

      {/* Category Picker Modal */}
      <Modal visible={showCategoryPicker} onClose={() => setShowCategoryPicker(false)} title="Seleccionar categoría">
        <ScrollView style={styles.pickerList}>
          {filteredCategories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.pickerItem, form.categoryId === cat.id && styles.pickerItemSelected]}
              onPress={() => {
                setForm({ ...form, categoryId: cat.id });
                setShowCategoryPicker(false);
              }}
            >
              <View style={[styles.pickerItemIcon, { backgroundColor: cat.color + '20' }]}>
                <MaterialCommunityIcons name={cat.icon as any} size={20} color={cat.color} />
              </View>
              <Text style={[styles.pickerItemText, form.categoryId === cat.id && styles.pickerItemTextSelected]}>
                {cat.name}
              </Text>
              {form.categoryId === cat.id && (
                <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Modal>

      {/* Account Picker Modal */}
      <Modal visible={showAccountPicker} onClose={() => setShowAccountPicker(false)} title="Seleccionar cuenta">
        <ScrollView style={styles.pickerList}>
          {accounts.map((acc) => (
            <TouchableOpacity
              key={acc.id}
              style={[styles.pickerItem, form.accountId === acc.id && styles.pickerItemSelected]}
              onPress={() => {
                setForm({ ...form, accountId: acc.id, pocketId: null }); // Reset pocket when account changes
                setShowAccountPicker(false);
              }}
            >
              <MaterialCommunityIcons name="bank" size={20} color={colors.textMuted} />
              <Text style={[styles.pickerItemText, form.accountId === acc.id && styles.pickerItemTextSelected]}>
                {acc.name}
              </Text>
              {form.accountId === acc.id && (
                <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Modal>

      {/* Pocket Picker Modal */}
      <Modal visible={showPocketPicker} onClose={() => setShowPocketPicker(false)} title="Seleccionar bolsillo">
        <ScrollView style={styles.pickerList}>
          {/* Option: No pocket (unassigned) */}
          <TouchableOpacity
            style={[styles.pickerItem, form.pocketId === null && styles.pickerItemSelected]}
            onPress={() => {
              setForm({ ...form, pocketId: null });
              setShowPocketPicker(false);
            }}
          >
            <MaterialCommunityIcons name="help-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.pickerItemText, form.pocketId === null && styles.pickerItemTextSelected]}>
              Sin asignar
            </Text>
            {form.pocketId === null && (
              <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />
            )}
          </TouchableOpacity>

          {/* Pockets for selected account */}
          {accountPockets.map((pocket) => (
            <TouchableOpacity
              key={pocket.id}
              style={[styles.pickerItem, form.pocketId === pocket.id && styles.pickerItemSelected]}
              onPress={() => {
                setForm({ ...form, pocketId: pocket.id });
                setShowPocketPicker(false);
              }}
            >
              <View style={[styles.pickerItemIcon, { backgroundColor: pocket.color + '20' }]}>
                <MaterialCommunityIcons name="wallet" size={20} color={pocket.color} />
              </View>
              <Text style={[styles.pickerItemText, form.pocketId === pocket.id && styles.pickerItemTextSelected]}>
                {pocket.name}
              </Text>
              {form.pocketId === pocket.id && (
                <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  closeButton: { padding: spacing.xs },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  placeholder: { width: 32 },
  typeToggle: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface2, borderRadius: 12, padding: spacing.xs },
  typeButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderRadius: 10, gap: spacing.sm },
  typeButtonExpenseActive: { backgroundColor: colors.accentRed },
  typeButtonIncomeActive: { backgroundColor: colors.accentGreen },
  typeButtonText: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textMuted },
  typeButtonTextActive: { color: '#fff' },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  label: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: typography.fontWeight.medium },
  pickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12, gap: spacing.md },
  pickerButtonText: { flex: 1, fontSize: typography.fontSize.md, color: colors.textPrimary },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  toggleHint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  pickerList: { maxHeight: 300 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: 10, gap: spacing.md },
  pickerItemSelected: { backgroundColor: colors.accentGreen + '15' },
  pickerItemIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  pickerItemText: { flex: 1, fontSize: typography.fontSize.md, color: colors.textPrimary },
  pickerItemTextSelected: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
});
