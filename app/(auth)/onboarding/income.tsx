import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card } from '../../src/components/ui';
import { AmountInput, FrequencyPicker, AccountPicker } from '../../src/components/forms';
import { Input } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useUserId } from '../../src/store/useUserStore';
import { RecurringItemRepository } from '../../src/database/repositories/recurringRepository';
import { useAccounts } from '../../src/hooks';
import type { Frequency } from '../../src/domain/utils/date';
import type { RecurringItem } from '../../src/database/schema';

interface IncomeForm {
  id: string;
  name: string;
  amount: number;
  frequency: Frequency;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  month: number | null;
  accountId: string;
  incomeSource: 'EARNED' | 'PASSIVE';
}

export default function IncomeScreen() {
  const router = useRouter();
  const userId = useUserId();
  const { accounts } = useAccounts();
  const [incomes, setIncomes] = useState<IncomeForm[]>([]);
  const [saving, setSaving] = useState(false);

  const addIncome = () => {
    const defaultAccountId = accounts[0]?.id || '';
    setIncomes([
      ...incomes,
      {
        id: Date.now().toString(),
        name: '',
        amount: 0,
        frequency: 'MONTHLY',
        dayOfMonth: 1,
        dayOfWeek: null,
        month: null,
        accountId: defaultAccountId,
        incomeSource: 'EARNED',
      },
    ]);
  };

  const removeIncome = (id: string) => {
    setIncomes(incomes.filter((i) => i.id !== id));
  };

  const updateIncome = (id: string, field: keyof IncomeForm, value: any) => {
    setIncomes(
      incomes.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      for (const income of incomes) {
        if (!income.name.trim() || income.amount <= 0) continue;

        await RecurringItemRepository.create({
          userId,
          accountId: income.accountId,
          type: 'INCOME',
          name: income.name.trim(),
          amount: income.amount,
          incomeSource: income.incomeSource,
          frequency: income.frequency,
          dayOfMonth: income.frequency === 'MONTHLY' ? income.dayOfMonth : null,
          dayOfWeek:
            income.frequency === 'WEEKLY' || income.frequency === 'BIWEEKLY'
              ? income.dayOfWeek ?? 1
              : null,
          month: income.frequency === 'ANNUAL' ? income.month : null,
          isAutoConfirm: false,
          isAutoDebit: false,
          status: 'ACTIVE',
          nextDueDate: new Date(),
        });
      }

      router.push('/onboarding/expenses');
    } catch (error) {
      console.error('Error saving incomes:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>Paso 2 de 4</Text>
          <Text style={styles.title}>¿Cuánto entra?</Text>
          <Text style={styles.subtitle}>
            Agrega tus ingresos fijos. Puedes omitir si solo tienes ingresos variables.
          </Text>
        </View>

        {/* Income list */}
        {incomes.map((income, index) => (
          <Card key={income.id} style={styles.incomeCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Ingreso {index + 1}</Text>
              <TouchableOpacity onPress={() => removeIncome(income.id)}>
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Input
              label="Nombre"
              value={income.name}
              onChangeText={(text) => updateIncome(income.id, 'name', text)}
              placeholder="Ej: Salario, Dividendo"
            />

            <AmountInput
              label="Monto"
              value={income.amount}
              onChangeValue={(val) => updateIncome(income.id, 'amount', val)}
            />

            <FrequencyPicker
              label="Frecuencia"
              value={income.frequency}
              onChange={(freq) => updateIncome(income.id, 'frequency', freq)}
              dayOfMonth={income.dayOfMonth ?? undefined}
              onDayOfMonthChange={(day) => updateIncome(income.id, 'dayOfMonth', day)}
              dayOfWeek={income.dayOfWeek ?? undefined}
              onDayOfWeekChange={(day) => updateIncome(income.id, 'dayOfWeek', day)}
              month={income.month ?? undefined}
              onMonthChange={(m) => updateIncome(income.id, 'month', m)}
            />

            {/* Account picker */}
            <Text style={styles.fieldLabel}>Cuenta destino</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[
                    styles.accountChip,
                    income.accountId === acc.id && styles.accountChipSelected,
                  ]}
                  onPress={() => updateIncome(income.id, 'accountId', acc.id)}
                >
                  <MaterialCommunityIcons
                    name="bank"
                    size={16}
                    color={income.accountId === acc.id ? colors.accentGreen : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.accountChipText,
                      income.accountId === acc.id && styles.accountChipTextSelected,
                    ]}
                  >
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Income source selector */}
            <View style={styles.sourceContainer}>
              <TouchableOpacity
                style={[
                  styles.sourceItem,
                  income.incomeSource === 'EARNED' && styles.sourceItemSelected,
                ]}
                onPress={() => updateIncome(income.id, 'incomeSource', 'EARNED')}
              >
                <MaterialCommunityIcons
                  name="briefcase"
                  size={20}
                  color={income.incomeSource === 'EARNED' ? colors.accentGreen : colors.textMuted}
                />
                <View style={styles.sourceText}>
                  <Text
                    style={[
                      styles.sourceTitle,
                      income.incomeSource === 'EARNED' && styles.sourceTitleSelected,
                    ]}
                  >
                    Trabajo activo
                  </Text>
                  <Text style={styles.sourceDesc}>Salario, freelance</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.sourceItem,
                  income.incomeSource === 'PASSIVE' && styles.sourceItemSelected,
                ]}
                onPress={() => updateIncome(income.id, 'incomeSource', 'PASSIVE')}
              >
                <MaterialCommunityIcons
                  name="chart-line"
                  size={20}
                  color={income.incomeSource === 'PASSIVE' ? colors.accentGreen : colors.textMuted}
                />
                <View style={styles.sourceText}>
                  <Text
                    style={[
                      styles.sourceTitle,
                      income.incomeSource === 'PASSIVE' && styles.sourceTitleSelected,
                    ]}
                  >
                    Ingreso pasivo
                  </Text>
                  <Text style={styles.sourceDesc}>Dividendos, arriendo</Text>
                </View>
              </TouchableOpacity>
            </View>
          </Card>
        ))}

        {/* Add another income */}
        <TouchableOpacity style={styles.addButton} onPress={addIncome}>
          <MaterialCommunityIcons name="plus" size={20} color={colors.accentGreen} />
          <Text style={styles.addButtonText}>Agregar otro ingreso</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="ghost" onPress={() => router.push('/onboarding/expenses')} disabled={saving}>
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
  incomeCard: { marginBottom: spacing.lg },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  fieldLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs, fontWeight: typography.fontWeight.medium },
  accountChip: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.surface2, marginRight: spacing.sm, gap: spacing.xs },
  accountChipSelected: { backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.accentGreen },
  accountChipText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  accountChipTextSelected: { color: colors.accentGreen },
  sourceContainer: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  sourceItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface2, gap: spacing.sm },
  sourceItemSelected: { backgroundColor: colors.surface3, borderWidth: 1, borderColor: colors.accentGreen },
  sourceText: { flex: 1 },
  sourceTitle: { fontSize: typography.fontSize.sm, color: colors.textMuted, fontWeight: typography.fontWeight.medium },
  sourceTitleSelected: { color: colors.accentGreen },
  sourceDesc: { fontSize: typography.fontSize.xs, color: colors.textHint },
  addButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: 12, borderStyle: 'dashed', gap: spacing.sm },
  addButtonText: { fontSize: typography.fontSize.md, color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
