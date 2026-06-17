import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, ProgressBar, Badge, Divider } from '../../src/components/ui';
import { Modal } from '../../src/components/ui/Modal';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useBudget } from '../../src/hooks/useBudget';
import { useUserStore } from '../../src/store/useUserStore';
import { useCategories } from '../../src/hooks';
import { BudgetRepository } from '../../src/database/repositories/budgetRepository';
import { getSpendingByCategory } from '../../src/domain/services/BudgetService';
import { database } from '../../src/database';
import { transactions, categories as categoriesTable } from '../../src/database/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

export default function BudgetScreen() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const { budget, categoryProgress, refresh } = useBudget();
  const { categories } = useCategories();
  const [refreshing, setRefreshing] = useState(false);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [configModalVisible, setConfigModalVisible] = useState(false);
  const [categorySpending, setCategorySpending] = useState<{ categoryId: string | null; categoryName: string | null; total: number }[]>([]);
  const [newBudget, setNewBudget] = useState({ name: '', amount: 0 });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(amount);

  const formatFullCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  // Load category spending for variable expenses
  const loadCategorySpending = useCallback(async () => {
    try {
      const spending = await getSpendingByCategory(userId, currentMonth, currentYear);
      setCategorySpending(spending.filter((s) => s.total > 0).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error('Error loading category spending:', err);
    }
  }, [userId, currentMonth, currentYear]);

  useEffect(() => {
    loadCategorySpending();
  }, [loadCategorySpending]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), loadCategorySpending()]);
    setRefreshing(false);
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return colors.textMuted;
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.color || colors.textMuted;
  };

  const getCategoryIcon = (categoryId: string | null) => {
    if (!categoryId) return 'tag';
    const cat = categories.find((c) => c.id === categoryId);
    return cat?.icon || 'tag';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return colors.accentRed;
    if (percent >= 80) return colors.accentYellow;
    return colors.accentGreen;
  };

  // Budget summary values
  const income = budget?.income || 0;
  const fixedExpenses = budget?.expenses || 0;
  const debtPayments = budget?.debts || 0;
  const freeAmount = budget?.free || 0;

  const handleCreateBudget = async () => {
    if (!newBudget.name.trim() || newBudget.amount <= 0) return;

    try {
      await BudgetRepository.create({
        userId,
        name: newBudget.name.trim(),
        amount: newBudget.amount,
        period: 'MONTHLY',
        categoryId: null,
        walletId: null,
        alertThreshold: 80,
      });

      setNewBudget({ name: '', amount: 0 });
      setBudgetModalVisible(false);
      refresh();
    } catch (error) {
      console.error('Error creating budget:', error);
    }
  };

  const handleCategoryPress = (categoryId: string | null, categoryName: string | null) => {
    router.push({
      pathname: '/category-detail',
      params: {
        categoryId: categoryId || 'UNCATEGORIZED',
        categoryName: categoryName || 'Sin categoría',
        month: currentMonth.toString(),
        year: currentYear.toString(),
      },
    });
  };

  // Calculate total variable spending
  const totalVariableSpending = categorySpending.reduce((sum, c) => sum + c.total, 0);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Presupuesto</Text>
            <Text style={styles.subtitle}>
              {new Date().toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setBudgetModalVisible(true)}>
            <MaterialCommunityIcons name="plus" size={24} color={colors.accentGreen} />
          </TouchableOpacity>
        </View>

        {/* Month Summary - Stacked Cards */}
        <View style={styles.summarySection}>
          {/* Income */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.accentGreen + '20' }]}>
                <MaterialCommunityIcons name="arrow-down" size={20} color={colors.accentGreen} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Ingresos esperados</Text>
                <Text style={[styles.summaryValue, { color: colors.accentGreen }]}>
                  {formatFullCurrency(income)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Fixed Expenses */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.accentRed + '20' }]}>
                <MaterialCommunityIcons name="arrow-up" size={20} color={colors.accentRed} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Gastos fijos</Text>
                <Text style={[styles.summaryValue, { color: colors.accentRed }]}>
                  {formatFullCurrency(fixedExpenses)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Debt Payments */}
          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.accentYellow + '20' }]}>
                <MaterialCommunityIcons name="credit-card" size={20} color={colors.accentYellow} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Cuotas deuda</Text>
                <Text style={[styles.summaryValue, { color: colors.accentYellow }]}>
                  {formatFullCurrency(debtPayments)}
                </Text>
              </View>
            </View>
          </Card>

          {/* Free Amount */}
          <Card style={[styles.summaryCard, styles.freeCard]}>
            <View style={styles.summaryRow}>
              <View style={[styles.summaryIcon, { backgroundColor: colors.accentBlue + '20' }]}>
                <MaterialCommunityIcons name="wallet" size={20} color={colors.accentBlue} />
              </View>
              <View style={styles.summaryInfo}>
                <Text style={styles.summaryLabel}>Disponible para libre</Text>
                <Text style={[styles.summaryValue, { color: freeAmount >= 0 ? colors.accentBlue : colors.accentRed }]}>
                  {formatFullCurrency(freeAmount)}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Variable Spending Distribution */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Distribución del libre</Text>
            <Text style={styles.sectionSubtitle}>
              {formatCurrency(totalVariableSpending)} gastado de {formatCurrency(freeAmount)}
            </Text>
          </View>

          {categorySpending.length === 0 ? (
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="chart-pie" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Sin gastos variables este mes</Text>
            </Card>
          ) : (
            <Card style={styles.distributionCard}>
              {categorySpending.map((cat, index) => {
                const percent = freeAmount > 0 ? (cat.total / freeAmount) * 100 : 0;
                const isOver = percent > 100;

                return (
                  <View key={cat.categoryId || 'uncategorized'}>
                    <TouchableOpacity
                      style={styles.categoryRow}
                      onPress={() => handleCategoryPress(cat.categoryId, cat.categoryName)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.categoryIcon, { backgroundColor: getCategoryColor(cat.categoryId) + '20' }]}>
                        <MaterialCommunityIcons
                          name={getCategoryIcon(cat.categoryId) as any}
                          size={18}
                          color={getCategoryColor(cat.categoryId)}
                        />
                      </View>
                      <View style={styles.categoryInfo}>
                        <View style={styles.categoryHeader}>
                          <Text style={styles.categoryName}>{cat.categoryName || 'Sin categoría'}</Text>
                          <View style={styles.categoryAmounts}>
                            <Text style={[styles.categorySpent, { color: isOver ? colors.accentRed : colors.textPrimary }]}>
                              {formatCurrency(cat.total)}
                            </Text>
                            <Text style={styles.categoryPercent}> ({percent.toFixed(0)}%)</Text>
                          </View>
                        </View>
                        <ProgressBar
                          progress={Math.min(percent / 100, 1)}
                          color={isOver ? colors.accentRed : getCategoryColor(cat.categoryId)}
                        />
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                    {index < categorySpending.length - 1 && <Divider />}
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        {/* Savings/Investment Section (if configured) */}
        {budget && (budget as any).savingsAmount > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ahorro e inversión</Text>
            <Card style={styles.savingsCard}>
              <View style={styles.savingsRow}>
                <View style={styles.savingsItem}>
                  <MaterialCommunityIcons name="piggy-bank" size={24} color={colors.accentGreen} />
                  <Text style={styles.savingsLabel}>Ahorro</Text>
                  <Text style={styles.savingsAmount}>
                    {formatCurrency((budget as any).savingsAmount || 0)}
                  </Text>
                </View>
                {(budget as any).investmentAmount > 0 && (
                  <View style={styles.savingsItem}>
                    <MaterialCommunityIcons name="chart-line" size={24} color={colors.accentBlue} />
                    <Text style={styles.savingsLabel}>Inversión</Text>
                    <Text style={styles.savingsAmount}>
                      {formatCurrency((budget as any).investmentAmount || 0)}
                    </Text>
                  </View>
                )}
              </View>
            </Card>
          </View>
        )}
      </ScrollView>

      {/* Create Budget Modal */}
      <Modal visible={budgetModalVisible} onClose={() => setBudgetModalVisible(false)} title="Nuevo Presupuesto">
        <Input
          label="Nombre del presupuesto"
          value={newBudget.name}
          onChangeText={(text) => setNewBudget({ ...newBudget, name: text })}
          placeholder="Ej: Alimentación, Transporte"
        />

        <AmountInput
          label="Monto límite mensual"
          value={newBudget.amount}
          onChangeValue={(val) => setNewBudget({ ...newBudget, amount: val })}
        />

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setBudgetModalVisible(false)}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateBudget}>
            <Text style={styles.createButtonText}>Crear</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  subtitle: { fontSize: typography.fontSize.md, color: colors.textMuted, textTransform: 'capitalize', marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  summarySection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  summaryCard: { paddingVertical: spacing.sm },
  freeCard: { borderLeftWidth: 3, borderLeftColor: colors.accentBlue },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  summaryInfo: { flex: 1 },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, marginTop: 2 },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  sectionSubtitle: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  distributionCard: { padding: 0, overflow: 'hidden' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  categoryIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  categoryInfo: { flex: 1 },
  categoryHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: spacing.xs },
  categoryName: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  categoryAmounts: { flexDirection: 'row', alignItems: 'baseline' },
  categorySpent: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  categoryPercent: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  savingsCard: { marginTop: spacing.sm },
  savingsRow: { flexDirection: 'row' },
  savingsItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm },
  savingsLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  savingsAmount: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, marginTop: 2 },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.fontSize.md, color: colors.textMuted, marginTop: spacing.sm },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xl },
  cancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  cancelButtonText: { fontSize: typography.fontSize.md, color: colors.textMuted },
  createButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.accentGreen, borderRadius: 8 },
  createButtonText: { fontSize: typography.fontSize.md, color: '#fff', fontWeight: typography.fontWeight.semibold },
});
