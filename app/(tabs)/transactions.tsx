import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useTransactions } from '../../src/hooks/useTransactions';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import type { Transaction } from '../../src/database/schema';

type FilterType = 'ALL' | 'INCOME' | 'EXPENSE' | 'TRANSFER';

export default function TransactionsScreen() {
  const { transactions, refresh } = useTransactions();
  const { accounts } = useAccounts();
  const { pockets } = usePockets();
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const filteredTransactions = transactions.filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'INCOME') return t.type === 'INCOME';
    if (filter === 'EXPENSE') return t.type === 'EXPENSE';
    if (filter === 'TRANSFER') return t.type === 'TRANSFER';
    return true;
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const getAccountName = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.name || 'Cuenta';
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

  const groupByDate = (txns: Transaction[]) => {
    const groups: { [key: string]: Transaction[] } = {};
    txns.forEach((txn) => {
      const date = new Date(txn.date).toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(txn);
    });
    return Object.entries(groups);
  };

  const groupedTransactions = groupByDate(filteredTransactions);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Movimientos</Text>
        <TouchableOpacity style={styles.addButton}>
          <MaterialCommunityIcons name="plus" size={24} color={colors.accentGreen} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <FilterChip type="ALL" label="Todos" />
        <FilterChip type="INCOME" label="Ingresos" />
        <FilterChip type="EXPENSE" label="Gastos" />
        <FilterChip type="TRANSFER" label="Transferencias" />
      </View>

      <FlatList
        data={groupedTransactions}
        keyExtractor={([date]) => date}
        renderItem={({ item: [date, txns] }) => (
          <View style={styles.dateGroup}>
            <Text style={styles.dateHeader}>{date}</Text>
            {txns.map((txn) => (
              <Card key={txn.id} style={styles.txnCard}>
                <View style={styles.txnRow}>
                  <View style={[styles.txnIcon, { backgroundColor: getTypeColor(txn.type) + '20' }]}>
                    <MaterialCommunityIcons
                      name={getTypeIcon(txn.type) as any}
                      size={24}
                      color={getTypeColor(txn.type)}
                    />
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnDescription}>{txn.description}</Text>
                    <Text style={styles.txnMeta}>
                      {getAccountName(txn.accountId)} • {getPocketName(txn.pocketId || null)}
                    </Text>
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
            ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="receipt" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No hay movimientos</Text>
            <Text style={styles.emptyHint}>Toca + para registrar tu primera transacción</Text>
          </View>
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  filters: { flexDirection: 'row', paddingHorizontal: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  filterChip: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 20, backgroundColor: colors.surface2 },
  filterChipActive: { backgroundColor: colors.accentGreen },
  filterChipText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  filterChipTextActive: { color: '#fff', fontWeight: typography.fontWeight.medium },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  dateGroup: { marginBottom: spacing.lg },
  dateHeader: { fontSize: typography.fontSize.sm, color: colors.textMuted, fontWeight: typography.fontWeight.medium, marginBottom: spacing.sm, textTransform: 'capitalize' },
  txnCard: { marginBottom: spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  txnInfo: { flex: 1 },
  txnDescription: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  txnMeta: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  txnAmountContainer: { alignItems: 'flex-end' },
  txnAmount: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  txnTransfer: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs },
});
