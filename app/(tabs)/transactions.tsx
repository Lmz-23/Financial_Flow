import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '../../src/components/ui';
import { Modal } from '../../src/components/ui/Modal';
import { colors, spacing, typography } from '../../src/theme';
import { useTransactions } from '../../src/hooks/useTransactions';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import { useCategories } from '../../src/hooks';
import type { Transaction } from '../../src/database/schema';

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

export default function TransactionsScreen() {
  const router = useRouter();
  const { transactions, refresh } = useTransactions();
  const { accounts } = useAccounts();
  const { pockets } = usePockets();
  const { categories } = useCategories();

  const [filter, setFilter] = useState<FilterType>('ALL');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Type filter
      if (filter !== 'ALL' && t.type !== filter) return false;
      // Account filter
      if (selectedAccountId && t.accountId !== selectedAccountId) return false;
      // Category filter
      if (selectedCategoryId && t.categoryId !== selectedCategoryId) return false;
      return true;
    });
  }, [transactions, filter, selectedAccountId, selectedCategoryId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Cuenta';
  };

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    return category?.name || null;
  };

  const getCategoryIcon = (categoryId: string | null) => {
    if (!categoryId) return 'tag';
    const category = categories.find((c) => c.id === categoryId);
    return category?.icon || 'tag';
  };

  const getPocketName = (pocketId: string | null) => {
    if (!pocketId) return 'Sin asignar';
    const pocket = pockets.find((p) => p.id === pocketId);
    return pocket?.name || 'Bolsillo';
  };

  const formatAmount = (amount: number, type: string) => {
    const formatted = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);
    if (type === 'INCOME') return `+${formatted}`;
    if (type === 'EXPENSE') return `-${formatted}`;
    return formatted;
  };

  const formatCompactCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(amount);
  };

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

  // Format date header with "Hoy", "Ayer" support
  const formatDateHeader = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) return 'Hoy';
    if (isYesterday) return 'Ayer';

    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'long',
    });
  };

  // Group transactions by date
  const groupByDate = (txns: Transaction[]) => {
    const groups: { date: Date; label: string; transactions: Transaction[] }[] = [];

    txns.forEach((txn) => {
      const txnDate = new Date(txn.date);
      const dateKey = txnDate.toDateString();

      const existing = groups.find((g) => g.date.toDateString() === dateKey);
      if (existing) {
        existing.transactions.push(txn);
      } else {
        groups.push({
          date: txnDate,
          label: formatDateHeader(txnDate),
          transactions: [txn],
        });
      }
    });

    // Sort by date descending
    return groups.sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const groupedTransactions = groupByDate(filteredTransactions);

  // Calculate totals for filter display
  const incomeTotal = filteredTransactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0);
  const expenseTotal = filteredTransactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0);

  const FilterChip = ({ type, label }: { type: FilterType; label: string }) => (
    <TouchableOpacity
      style={[styles.filterChip, filter === type && styles.filterChipActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterChipText, filter === type && styles.filterChipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const AccountChip = ({ id, name }: { id: string; name: string }) => (
    <TouchableOpacity
      style={[styles.filterChip, selectedAccountId === id && styles.filterChipActive]}
      onPress={() => setSelectedAccountId(selectedAccountId === id ? null : id)}
    >
      <Text style={[styles.filterChipText, selectedAccountId === id && styles.filterChipTextActive]}>
        {name}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Movimientos</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilters(!showFilters)}>
            <MaterialCommunityIcons name="filter-variant" size={24} color={showFilters || selectedAccountId || selectedCategoryId ? colors.accentGreen : colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/add-transaction')}>
            <MaterialCommunityIcons name="plus" size={24} color={colors.accentGreen} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <FilterChip type="ALL" label="Todos" />
          <FilterChip type="INCOME" label="Ingresos" />
          <FilterChip type="EXPENSE" label="Gastos" />
          <FilterChip type="TRANSFER" label="Transferencias" />
        </ScrollView>
      </View>

      {/* Expanded filters */}
      {showFilters && (
        <View style={styles.expandedFilters}>
          <Text style={styles.filterLabel}>Cuenta</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filterRow}>
              {accounts.map((acc) => (
                <AccountChip key={acc.id} id={acc.id} name={acc.name} />
              ))}
            </View>
          </ScrollView>

          {selectedAccountId || selectedCategoryId ? (
            <TouchableOpacity
              style={styles.clearFilters}
              onPress={() => {
                setSelectedAccountId(null);
                setSelectedCategoryId(null);
              }}
            >
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.textMuted} />
              <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Summary */}
      {filteredTransactions.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Ingresos</Text>
            <Text style={[styles.summaryValue, { color: colors.accentGreen }]}>
              {formatCompactCurrency(incomeTotal)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Gastos</Text>
            <Text style={[styles.summaryValue, { color: colors.accentRed }]}>
              {formatCompactCurrency(expenseTotal)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Neto</Text>
            <Text style={[styles.summaryValue, { color: incomeTotal - expenseTotal >= 0 ? colors.accentGreen : colors.accentRed }]}>
              {formatCompactCurrency(incomeTotal - expenseTotal)}
            </Text>
          </View>
        </View>
      )}

      {/* Transactions list */}
      <FlatList
        data={groupedTransactions}
        keyExtractor={(group) => group.date.toISOString()}
        renderItem={({ item: group }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateHeader}>{group.label}</Text>
            {group.transactions.map((txn) => (
              <TouchableOpacity
                key={txn.id}
                onPress={() => router.push({ pathname: '/transaction-detail', params: { id: txn.id } })}
                activeOpacity={0.7}
              >
                <Card style={styles.txnCard}>
                  <View style={styles.txnRow}>
                    <View style={[styles.txnIcon, { backgroundColor: getTypeColor(txn.type) + '20' }]}>
                      <MaterialCommunityIcons
                        name={getTypeIcon(txn.type) as any}
                        size={22}
                        color={getTypeColor(txn.type)}
                      />
                    </View>
                    <View style={styles.txnInfo}>
                      <Text style={styles.txnDescription} numberOfLines={1}>{txn.description}</Text>
                      <View style={styles.txnMeta}>
                        {getCategoryName(txn.categoryId) && (
                          <View style={styles.categoryTag}>
                            <MaterialCommunityIcons name={getCategoryIcon(txn.categoryId) as any} size={12} color={colors.textMuted} />
                            <Text style={styles.categoryTagText}>{getCategoryName(txn.categoryId)}</Text>
                          </View>
                        )}
                        <Text style={styles.pocketText}>{getPocketName(txn.pocketId || null)}</Text>
                      </View>
                    </View>
                    <View style={styles.txnAmountContainer}>
                      <Text style={[styles.txnAmount, { color: getTypeColor(txn.type) }]}>
                        {formatAmount(txn.amount, txn.type)}
                      </Text>
                      {txn.type === 'TRANSFER' && txn.toAccountId && (
                        <Text style={styles.txnTransfer}>
                          → {getAccountName(txn.toAccountId)}
                        </Text>
                      )}
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="receipt" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No hay movimientos</Text>
            <Text style={styles.emptyHint}>
              {filter !== 'ALL' || selectedAccountId || selectedCategoryId
                ? 'Intenta cambiar los filtros'
                : 'Toca + para registrar tu primera transacción'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-transaction')}>
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  filterButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  filterBar: { paddingVertical: spacing.sm },
  filterScroll: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  filterChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.surface2 },
  filterChipActive: { backgroundColor: colors.accentGreen },
  filterChipText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  filterChipTextActive: { color: '#fff', fontWeight: typography.fontWeight.medium },
  expandedFilters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  filterLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  filterRow: { flexDirection: 'row', gap: spacing.sm },
  clearFilters: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, gap: spacing.xs },
  clearFiltersText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryBar: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.surface },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  summaryValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, marginTop: 2 },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  dateGroup: { marginTop: spacing.lg },
  dateHeader: { fontSize: typography.fontSize.sm, color: colors.textMuted, fontWeight: typography.fontWeight.semibold, marginBottom: spacing.sm },
  txnCard: { marginBottom: spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  txnInfo: { flex: 1 },
  txnDescription: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  txnMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: spacing.sm },
  categoryTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  categoryTagText: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  pocketText: { fontSize: typography.fontSize.xs, color: colors.textHint },
  txnAmountContainer: { alignItems: 'flex-end' },
  txnAmount: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  txnTransfer: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 80, right: spacing.lg, width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentGreen, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
});
