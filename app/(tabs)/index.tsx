import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, ProgressBar, Badge } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useAccounts } from '../../src/hooks/useAccounts';
import { useCashflow } from '../../src/hooks/useCashflow';
import { useBudget } from '../../src/hooks/useBudget';
import { usePockets } from '../../src/hooks/usePockets';
import { useUserStore } from '../../src/store/useUserStore';

export default function DashboardScreen() {
  const user = useUserStore((s) => s.user);
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const { cashflow, refresh: refreshCashflow } = useCashflow();
  const { budgets } = useBudget();
  const { pockets } = usePockets();
  const [refreshing, setRefreshing] = useState(false);

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAccounts(), refreshCashflow()]);
    setRefreshing(false);
  };

  const incomeThisMonth = cashflow?.incomeThisMonth || 0;
  const expensesThisMonth = cashflow?.expensesThisMonth || 0;
  const savingsThisMonth = incomeThisMonth - expensesThisMonth;
  const savingsRate = incomeThisMonth > 0 ? (savingsThisMonth / incomeThisMonth) * 100 : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hola, {user?.name?.split(' ')[0] || 'there'}
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Text>
        </View>

        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Balance Total</Text>
          <Text style={styles.balanceAmount}>
            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalBalance)}
          </Text>
          <View style={styles.balanceAccounts}>
            <MaterialCommunityIcons name="bank" size={14} color={colors.textMuted} />
            <Text style={styles.balanceAccountsText}>
              {accounts.length} {accounts.length === 1 ? 'cuenta' : 'cuentas'}
            </Text>
          </View>
        </Card>

        <Card style={styles.cashflowCard}>
          <Text style={styles.sectionTitle}>Cash Flow del Mes</Text>

          <View style={styles.cashflowRow}>
            <View style={styles.cashflowItem}>
              <View style={[styles.cashflowIcon, { backgroundColor: colors.accentGreen + '20' }]}>
                <MaterialCommunityIcons name="arrow-down" size={20} color={colors.accentGreen} />
              </View>
              <Text style={styles.cashflowLabel}>Ingresos</Text>
              <Text style={[styles.cashflowValue, { color: colors.accentGreen }]}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(incomeThisMonth)}
              </Text>
            </View>

            <View style={styles.cashflowDivider} />

            <View style={styles.cashflowItem}>
              <View style={[styles.cashflowIcon, { backgroundColor: colors.accentRed + '20' }]}>
                <MaterialCommunityIcons name="arrow-up" size={20} color={colors.accentRed} />
              </View>
              <Text style={styles.cashflowLabel}>Gastos</Text>
              <Text style={[styles.cashflowValue, { color: colors.accentRed }]}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(expensesThisMonth)}
              </Text>
            </View>
          </View>

          <View style={styles.savingsSection}>
            <View style={styles.savingsHeader}>
              <Text style={styles.savingsLabel}>Ahorro del mes</Text>
              <Text style={[styles.savingsRate, { color: savingsRate >= 20 ? colors.accentGreen : savingsRate >= 0 ? colors.textPrimary : colors.accentRed }]}>
                {savingsRate.toFixed(0)}%
              </Text>
            </View>
            <ProgressBar
              progress={Math.min(Math.max(savingsRate / 50, 0), 1)}
              color={savingsRate >= 20 ? colors.accentGreen : savingsRate >= 0 ? colors.textPrimary : colors.accentRed}
            />
            <Text style={styles.savingsAmount}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(savingsThisMonth)}
            </Text>
          </View>
        </Card>

        <Card style={styles.pocketsCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.sectionTitle}>Bolsillos</Text>
            <Badge variant="green" size="sm">{pockets.length}</Badge>
          </View>

          {pockets.length === 0 ? (
            <Text style={styles.emptyText}>No tienes bolsillos aún</Text>
          ) : (
            <View style={styles.pocketsList}>
              {pockets.slice(0, 4).map((pocket) => (
                <View key={pocket.id} style={styles.pocketItem}>
                  <View style={[styles.pocketColor, { backgroundColor: pocket.color || colors.accentBlue }]} />
                  <View style={styles.pocketInfo}>
                    <Text style={styles.pocketName}>{pocket.name}</Text>
                    <Text style={styles.pocketBalance}>
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(pocket.balance || 0)}
                    </Text>
                  </View>
                  {pocket.goalAmount && (
                    <Badge variant={pocket.balance >= pocket.goalAmount ? 'green' : 'yellow'} size="sm">
                      {((pocket.balance / pocket.goalAmount) * 100).toFixed(0)}%
                    </Badge>
                  )}
                </View>
              ))}
            </View>
          )}
        </Card>

        {budgets.length > 0 && (
          <Card style={styles.budgetCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.sectionTitle}>Presupuestos</Text>
            </View>
            {budgets.map((budget) => {
              const spent = budget.spent || 0;
              const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;
              const isOver = percentage > 100;
              const isWarning = percentage > 80 && percentage <= 100;

              return (
                <View key={budget.id} style={styles.budgetItem}>
                  <View style={styles.budgetHeader}>
                    <Text style={styles.budgetName}>{budget.name}</Text>
                    <Text style={[styles.budgetPercentage, { color: isOver ? colors.accentRed : isWarning ? colors.textPrimary : colors.accentGreen }]}>
                      {percentage.toFixed(0)}%
                    </Text>
                  </View>
                  <ProgressBar
                    progress={Math.min(percentage / 100, 1)}
                    color={isOver ? colors.accentRed : isWarning ? colors.textPrimary : colors.accentGreen}
                  />
                  <Text style={styles.budgetAmounts}>
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(spent)}
                    {' / '}
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(budget.amount)}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}

        <Card style={styles.quadrantCard}>
          <Text style={styles.sectionTitle}>Estado Cash Flow</Text>
          <View style={styles.quadrant}>
            <View style={[styles.quadrantItem, { borderRightColor: colors.border, borderBottomColor: colors.border }]}>
              <MaterialCommunityIcons name="lightning-bolt" size={24} color={colors.accentGreen} />
              <Text style={styles.quadrantLabel}>EARNED</Text>
              <Text style={styles.quadrantValue}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(cashflow?.earnedIncome || 0)}
              </Text>
            </View>
            <View style={[styles.quadrantItem, { borderBottomColor: colors.border }]}>
              <MaterialCommunityIcons name="leaf" size={24} color={colors.accentBlue} />
              <Text style={styles.quadrantLabel}>PASSIVE</Text>
              <Text style={styles.quadrantValue}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(cashflow?.passiveIncome || 0)}
              </Text>
            </View>
            <View style={[styles.quadrantItem, { borderRightColor: colors.border }]}>
              <MaterialCommunityIcons name="trending-up" size={24} color={colors.accentGreen} />
              <Text style={styles.quadrantLabel}>ASSETS</Text>
              <Text style={styles.quadrantValue}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(cashflow?.assets || 0)}
              </Text>
            </View>
            <View style={styles.quadrantItem}>
              <MaterialCommunityIcons name="trending-down" size={24} color={colors.accentRed} />
              <Text style={styles.quadrantLabel}>LIABILITIES</Text>
              <Text style={styles.quadrantValue}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(cashflow?.liabilities || 0)}
              </Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: 100 },
  header: { marginBottom: spacing.xl },
  greeting: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  date: { fontSize: typography.fontSize.md, color: colors.textMuted, textTransform: 'capitalize' },
  balanceCard: { backgroundColor: colors.accentGreen, marginBottom: spacing.lg },
  balanceLabel: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginBottom: spacing.xs },
  balanceAmount: { fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: '#fff', marginBottom: spacing.xs },
  balanceAccounts: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  balanceAccountsText: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.8)' },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md },
  cashflowCard: { marginBottom: spacing.lg },
  cashflowRow: { flexDirection: 'row', marginBottom: spacing.lg },
  cashflowItem: { flex: 1, alignItems: 'center' },
  cashflowDivider: { width: 1, backgroundColor: colors.border },
  cashflowIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  cashflowLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  cashflowValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  savingsSection: { paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  savingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  savingsLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  savingsRate: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  savingsAmount: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  pocketsCard: { marginBottom: spacing.lg },
  emptyText: { fontSize: typography.fontSize.md, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.lg },
  pocketsList: { gap: spacing.sm },
  pocketItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  pocketColor: { width: 8, height: 32, borderRadius: 4, marginRight: spacing.md },
  pocketInfo: { flex: 1 },
  pocketName: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  pocketBalance: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  budgetCard: { marginBottom: spacing.lg },
  budgetItem: { marginBottom: spacing.md },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  budgetName: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  budgetPercentage: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  budgetAmounts: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  quadrantCard: { marginBottom: spacing.lg },
  quadrant: { flexDirection: 'row', flexWrap: 'wrap' },
  quadrantItem: { width: '50%', padding: spacing.md, alignItems: 'center', borderWidth: 0.5, borderColor: colors.border },
  quadrantLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, fontWeight: typography.fontWeight.medium },
  quadrantValue: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold, marginTop: spacing.xs },
});
