import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card } from '../../../src/components/ui';
import { AmountInput, FrequencyPicker, AccountPicker } from '../../../src/components/forms';
import { Input } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/theme';
import { useUserId } from '../../../src/store/useUserStore';
import { RecurringItemRepository } from '../../../src/database/repositories/recurringRepository';
import { useAccounts } from '../../../src/hooks';
import { database } from '../../../src/database';
import { categories } from '../../../src/database/schema';
import { eq, and } from 'drizzle-orm';
import { useState as useReactState, useEffect } from 'react';
import type { Frequency } from '../../../src/domain/utils/date';
import type { Category } from '../../../src/database/schema';

interface ExpenseForm {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  month: number | null;
  accountId: string;
  categoryId: string;
  isAutoDebit: boolean;
}

const EXPENSE_CATEGORIES = [
  { id: 'housing', name: 'Vivienda', icon: 'home', color: '#6366F1' },
  { id: 'food', name: 'Alimentación', icon: 'food', color: '#22C55E' },
  { id: 'transport', name: 'Transporte', icon: 'car', color: '#F59E0B' },
  { id: 'health', name: 'Salud', icon: 'hospital', color: '#EF4444' },
  { id: 'services', name: 'Servicios', icon: 'flash', color: '#64748B' },
  { id: 'debt', name: 'Deudas', icon: 'credit-card', color: '#DC2626' },
  { id: 'other', name: 'Otros', icon: 'dots-horizontal', color: '#9CA3AF' },
];

export default function ExpensesScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { accounts } = useAccounts();
  const [expenses, setExpenses] = useState<ExpenseForm[]>([]);
  const [saving, setSaving] = useState(false);

  const addExpense = () => {
    const defaultAccountId = accounts[0]?.id || '';
    setExpenses([
      ...expenses,
      {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        dayOfWeek: null,
        month: null,
        accountId: defaultAccountId,
        categoryId: 'other',
        isAutoDebit: false,
      },
    ]);
  };

  const removeExpense = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const updateExpense = (id: string, field: keyof ExpenseForm, value: any) => {
    setExpenses(
      expenses.map((e) => (e.id === id ? { ...e, [field]: value } : e))
    );
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      for (const expense of expenses) {
        if (!expense.name.trim() || expense.amount <= 0) continue;

        // Get or create category
        let categoryId = expense.categoryId;
        const existingCategory = await database.query.categories.findFirst({
          where: and(
            eq(categories.name, EXPENSE_CATEGORIES.find((c) => c.id === expense.categoryId)?.name || 'Otros'),
            eq(categories.type, 'EXPENSE')
          ),
        });
        if (existingCategory) {
          categoryId = existingCategory.id;
        }

        await RecurringItemRepository.create({
          userId,
          accountId: expense.accountId,
          type: 'EXPENSE',
          name: expense.name.trim(),
          amount: expense.amount,
          incomeSource: null,
          frequency: expense.frequency,
          dayOfMonth: expense.frequency === 'MONTHLY' ? expense.dayOfMonth : null,
          dayOfWeek:
            expense.frequency === 'WEEKLY' || expense.frequency === 'BIWEEKLY'
              ? expense.dayOfWeek ?? 1
              : null,
          month: expense.frequency === 'ANNUAL' ? expense.month : null,
          isAutoConfirm: false,
          isAutoDebit: expense.isAutoDebit,
          status: 'ACTIVE',
          nextDueDate: new Date(),
        });
      }

      router.push('/onboarding/complete');
    } catch (error) {
      console.error('Error saving expenses:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>Paso 3 de 4</Text>
          <Text style={styles.title}>¿En qué se va?</Text>
          <Text style={styles.subtitle}>
            Agrega tus gastos fijos. Puedes omitir si no tienes gastos recurrentes.
          </Text>
        </View>

        {/* Expense list */}
        {expenses.map((expense, index) => (
          <Card key={expense.id} style={styles.expenseCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Gasto {index + 1}</Text>
              <TouchableOpacity onPress={() => removeExpense(expense.id)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Input
              label="Nombre"
              value={expense.name}
              onChangeText={(text) => updateExpense(expense.id, 'name', text)}
              placeholder="Ej: Arriendo, Netflix"
            />

            <AmountInput
              label="Monto"
              value={expense.amount}
              onChangeValue={(val) => updateExpense(expense.id, 'amount', val)}
            />

            <FrequencyPicker
              label="Frecuencia"
              value={expense.frequency}
              onChange={(freq) => updateExpense(expense.id, 'frequency', freq)}
              dayOfMonth={expense.dayOfMonth ?? undefined}
              onDayOfMonthChange={(day) => updateExpense(expense.id, 'dayOfMonth', day)}
              dayOfWeek={expense.dayOfWeek ?? undefined}
              onDayOfWeekChange={(day) => updateExpense(expense.id, 'dayOfWeek', day)}
              month={expense.month ?? undefined}
              onMonthChange={(m) => updateExpense(expense.id, 'month', m)}
            />

            {/* Category picker */}
            <Text style={styles.fieldLabel}>Categoría</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryChip,
                    expense.categoryId === cat.id && { borderColor: cat.color },
                  ]}
                  onPress={() => updateExpense(expense.id, 'categoryId', cat.id)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon as any}
                    size={16}
                    color={expense.categoryId === cat.id ? cat.color : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      expense.categoryId === cat.id && { color: cat.color },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Account picker */}
            <Text style={styles.fieldLabel}>Cuenta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountChip,
                    expense.accountId === acc.id && styles.accountChipSelected,
                  ]}
                  onPress={() => updateExpense(expense.id, 'accountId', acc.id)}
                >
                  <MaterialCommunityIcons
                    name="bank"
                    size={16}
                    color={expense.accountId === acc.id ? colors.accentGreen : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.accountChipText,
                      expense.accountId === acc.id && styles.accountChipTextSelected,
                    ]}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Auto-debit toggle */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>¿Se descuenta automático?</Text>
                <Text style={styles.toggleHint}>Ya tienes pago automático con este proveedor</Text>
              </View>
              <Switch
                value={expense.isAutoDebit}
                onValueChange={(val) => updateExpense(expense.id, 'isAutoDebit', val)}
                trackColor={{ false: colors.surface3, true: colors.accentGreen }}
                thumbColor="#fff"
              />
            </View>
          </Card>
        ))}

        {/* Add another expense */}
        <TouchableOpacity style={styles.addButton} onPress={addExpense}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.accentGreen} />
          <Text style={styles.addButtonText}>Agregar otro gasto</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="ghost" onPress={() => router.push('/onboarding/complete')} disabled={saving}>
          Omitir
        </Button>
        <Button variant="primary" onPress={handleNext} loading={saving}>
          Siguiente
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.xl },
  step: { fontSize: typography.fontSize.sm, color: colors.accentGreen, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.xs },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.fontSize.md, color: colors.textMuted },
  expenseCard: { marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  fieldLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: typography.fontWeight.medium, marginTop: spacing.sm },
  categoryScroll: { marginBottom: spacing.sm },
  categoryChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.surface2, marginRight: spacing.sm, borderWidth: 1, borderColor: 'transparent', gap: spacing.xs },
  categoryChipText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  accountChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.surface2, marginRight: spacing.sm, gap: spacing.xs },
  accountChipSelected: { backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.accentGreen },
  accountChipText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  accountChipTextSelected: { color: colors.accentGreen },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  toggleHint: { fontSize: typography.fontSize.sm, color: colors.textHint },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, borderStyle: 'dashed', gap: spacing.sm },
  addButtonText: { fontSize: typography.fontSize.md, color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
