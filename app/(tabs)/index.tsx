import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, ProgressBar, Badge } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useAccounts } from '../../src/hooks/useAccounts';
import { useRecentTransactions } from '../../src/hooks/useTransactions';
import { useBudget } from '../../src/hooks/useBudget';
import { useUserStore } from '../../src/store/useUserStore';
import { database } from '../../src/database';
import { recurringItems } from '../../src/database/schema';
import { eq, or, and, gte, lte, desc } from 'drizzle-orm';
import type { Transaction, RecurringItem } from '../../src/database/schema';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const { transactions, loading: txLoading } = useRecentTransactions(8);
  const { budget, loading: budgetLoading } = useBudget();
  const [refreshing, setRefreshing] = useState(false);
  const [pendingItems, setPendingItems] = useState<RecurringItem[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  // Calculate this month's income/expenses from budget
  const incomeThisMonth = budget?.income || 0;
  const expensesThisMonth = budget?.expenses || 0;
  const netBalance = incomeThisMonth - expensesThisMonth;

  // Fetch pending recurring items for alerts
  const fetchPendingItems = useCallback(async () => {
    try {
      setPendingLoading(true);
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const items = await database.query.recurringItems.findMany({
        where: and(
          eq(recurringItems.userId, user?.id || ''),
          or(
            eq(recurringItems.status, 'PENDING_CONFIRM'),
            eq(recurringItems.status, 'PENDING_PAYMENT')
          ),
          gte(recurringItems.nextDueDate, startOfMonth),
          lte(recurringItems.nextDueDate, endOfMonth)
        ),
        orderBy: [desc(recurringItems.nextDueDate)],
        limit: 5,
      });
      setPendingItems(items);
    } catch (err) {
      console.error('Error fetching pending items:', err);
    } finally {
      setPendingLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPendingItems();
  }, [fetchPendingItems]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshAccounts(), fetchPendingItems()]);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(amount);

  const formatFullCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INCOME': return 'arrow-down-circle';
      case 'EXPENSE': return 'arrow-up-circle';
      case 'TRANSFER': return 'swap-horizontal-circle';
      default: return 'circle';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'INCOME': return colors.accentGreen;
      case 'EXPENSE': return colors.accentRed;
      case 'TRANSFER': return colors.accentBlue;
      default: return colors.textMuted;
    }
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Cuenta';
  };

  // Budget progress
  const budgetUsedPercent = budget && budget.expenses > 0 && budget.income > 0
    ? Math.min((budget.expenses / budget.income) * 100, 100)
    : 0;
  const budgetRemaining = incomeThisMonth - expensesThisMonth;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Hola, {user?.name?.split(' ')[0] || 'there'}</Text>
            <Text style={styles.date}>
              {new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={colors.textPrimary} />
            {pendingItems.length > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{pendingItems.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Hero Card - Total Net Worth */}
        <Card style={styles.heroCard}>
          <Text style={styles.heroLabel}>Patrimonio Total</Text>
          <Text style={styles.heroAmount}>{formatFullCurrency(totalBalance)}</Text>

          {/* Account chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.accountChips}>
            {accounts.map((account) => (
              <View key={account.id} style={styles.accountChip}>
                <View style={[styles.accountChipDot, { backgroundColor: account.type === 'BANK' ? colors.accentBlue : colors.accentGreen }]} />
                <Text style={styles.accountChipName}>{account.name}</Text>
                <Text style={styles.accountChipBalance}>{formatCurrency(account.balance || 0)}</Text>
              </View>
            ))}
          </ScrollView>
        </Card>

        {/* Metrics Grid */}
        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: colors.accentGreen + '20' }]}>
              <MaterialCommunityIcons name="arrow-down" size={20} color={colors.accentGreen} />
            </View>
            <Text style={styles.metricLabel}>Ingresos del mes</Text>
            <Text style={[styles.metricValue, { color: colors.accentGreen }]}>
              {formatCurrency(incomeThisMonth)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: colors.accentRed + '20' }]}>
              <MaterialCommunityIcons name="arrow-up" size={20} color={colors.accentRed} />
            </View>
            <Text style={styles.metricLabel}>Gastos del mes</Text>
            <Text style={[styles.metricValue, { color: colors.accentRed }]}>
              {formatCurrency(expensesThisMonth)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: (netBalance >= 0 ? colors.accentGreen : colors.accentRed) + '20' }]}>
              <MaterialCommunityIcons name={netBalance >= 0 ? 'cash-plus' : 'cash-minus'} size={20} color={netBalance >= 0 ? colors.accentGreen : colors.accentRed} />
            </View>
            <Text style={styles.metricLabel}>Balance neto</Text>
            <Text style={[styles.metricValue, { color: netBalance >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatCurrency(netBalance)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <View style={[styles.metricIcon, { backgroundColor: colors.accentBlue + '20' }]}>
              <MaterialCommunityIcons name="wallet" size={20} color={colors.accentBlue} />
            </View>
            <Text style={styles.metricLabel}>Disponible</Text>
            <Text style={[styles.metricValue, { color: colors.accentBlue }]}>
              {formatCurrency(budgetRemaining)}
            </Text>
          </Card>
        </View>

        {/* Alerts Section - Pending Recurring Items */}
        {pendingItems.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alertas</Text>
              <Badge variant="yellow" size="sm">{pendingItems.length}</Badge>
            </View>
            {pendingItems.map((item) => (
              <TouchableOpacity key={item.id} style={styles.alertCard}>
                <View style={[styles.alertIcon, { backgroundColor: item.type === 'INCOME' ? colors.accentGreen + '20' : colors.accentRed + '20' }]}>
                  <MaterialCommunityIcons
                    name={item.type === 'INCOME' ? 'cash-check' : 'credit-card-off'}
                    size={20}
                    color={item.type === 'INCOME' ? colors.accentGreen : colors.accentRed}
                  />
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.alertName}>{item.name}</Text>
                  <Text style={styles.alertMeta}>
                    {item.status === 'PENDING_CONFIRM' ? 'Pendiente confirmar' : 'Pendiente pago'} • {formatFullCurrency(item.amount)}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Budget Progress */}
        <Card style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <Text style={styles.budgetTitle}>Presupuesto del mes</Text>
            <Text style={styles.budgetPercent}>
              {budgetUsedPercent.toFixed(0)}% usado
            </Text>
          </View>
          <ProgressBar
            progress={budgetUsedPercent / 100}
            color={budgetUsedPercent > 90 ? colors.accentRed : budgetUsedPercent > 70 ? colors.accentYellow : colors.accentGreen}
          />
          <View style={styles.budgetFooter}>
            <Text style={styles.budgetSpent}>
              {formatCurrency(expensesThisMonth)} gastado
            </Text>
            <Text style={styles.budgetTotal}>
              de {formatCurrency(incomeThisMonth)}
            </Text>
          </View>
        </Card>

        {/* Recent Transactions */}
        <View style={styles.transactionsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Últimos movimientos</Text>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Text style={styles.seeAllText}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {transactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="receipt" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No hay movimientos aún</Text>
            </Card>
          ) : (
            transactions.map((txn) => (
              <Card key={txn.id} style={styles.txnCard}>
                <View style={styles.txnRow}>
                  <View style={[styles.txnIcon, { backgroundColor: getTypeColor(txn.type) + '20' }]}>
                    <MaterialCommunityIcons
                      name={getTypeIcon(txn.type) as any}
                      size={20}
                      color={getTypeColor(txn.type)}
                    />
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnDescription} numberOfLines={1}>{txn.description}</Text>
                    <Text style={styles.txnMeta}>{getAccountName(txn.accountId)}</Text>
                  </View>
                  <View style={styles.txnAmount}>
                    <Text style={[styles.txnAmountText, { color: getTypeColor(txn.type) }]}>
                      {txn.type === 'EXPENSE' ? '-' : txn.type === 'INCOME' ? '+' : ''}
                      {formatCurrency(txn.amount)}
                    </Text>
                    <Text style={styles.txnDate}>
                      {new Date(txn.date).toLocaleDateString('es-CO', { day: 'numeric' })}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>

      {/* FAB - Floating Action Button */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-transaction')}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  greeting: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  date: { fontSize: typography.fontSize.md, color: colors.textMuted, textTransform: 'capitalize', marginTop: 2 },
  notificationButton: { padding: spacing.xs },
  notificationBadge: { position: 'absolute', top: 0, right: 0, backgroundColor: colors.accentRed, borderRadius: 10, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  notificationBadgeText: { fontSize: 10, color: '#fff', fontWeight: typography.fontWeight.bold },
  heroCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, backgroundColor: colors.accentGreen },
  heroLabel: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.8)' },
  heroAmount: { fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold, color: '#fff', marginTop: spacing.xs },
  accountChips: { marginTop: spacing.md, flexDirection: 'row' },
  accountChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 20, marginRight: spacing.sm, gap: spacing.xs },
  accountChipDot: { width: 8, height: 8, borderRadius: 4 },
  accountChipName: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.9)' },
  accountChipBalance: { fontSize: typography.fontSize.sm, color: '#fff', fontWeight: typography.fontWeight.semibold },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg, marginTop: spacing.lg, gap: spacing.sm },
  metricCard: { width: '48%', flexGrow: 1 },
  metricIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.xs },
  metricLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  metricValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, marginTop: 2 },
  alertsSection: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: 12, marginBottom: spacing.sm },
  alertIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  alertInfo: { flex: 1 },
  alertName: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  alertMeta: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  budgetCard: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  budgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  budgetTitle: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  budgetPercent: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  budgetFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  budgetSpent: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  budgetTotal: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  transactionsSection: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  seeAllText: { fontSize: typography.fontSize.sm, color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.fontSize.md, color: colors.textMuted, marginTop: spacing.sm },
  txnCard: { marginBottom: spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  txnInfo: { flex: 1 },
  txnDescription: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  txnMeta: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  txnAmount: { alignItems: 'flex-end' },
  txnAmountText: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  txnDate: { fontSize: typography.fontSize.xs, color: colors.textHint, marginTop: 2 },
  fab: { position: 'absolute', bottom: 80, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentGreen, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
});
