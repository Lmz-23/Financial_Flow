import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, ProgressBar } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useCategories } from '../../src/hooks';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import { database } from '../../src/database';
import { transactions, categories as categoriesTable } from '../../src/database/schema';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import type { Transaction } from '../../src/database/schema';

function getMonthDateRange(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month - 1 + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export default function CategoryDetailModal() {
  const router = useRouter();
  const { categoryId, categoryName, month, year } = useLocalSearchParams<{
    categoryId: string;
    categoryName: string;
    month: string;
    year: string;
  }>();

  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const { pockets } = usePockets();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);

  const monthNum = parseInt(month || '1', 10);
  const yearNum = parseInt(year || '2024', 10);
  const { start, end } = getMonthDateRange(monthNum, yearNum);

  const categoryColor = categories.find((c) => c.id === categoryId)?.color || colors.textMuted;
  const categoryIcon = categories.find((c) => c.id === categoryId)?.icon || 'tag';

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const whereCondition = categoryId === 'UNCATEGORIZED'
          ? and(
              eq(transactions.userId, ''), // Will be filtered below
              eq(transactions.type, 'EXPENSE'),
              eq(transactions.status, 'CONFIRMED'),
              gte(transactions.date, start),
              lte(transactions.date, end)
            )
          : and(
              eq(transactions.categoryId, categoryId || ''),
              eq(transactions.type, 'EXPENSE'),
              eq(transactions.status, 'CONFIRMED'),
              gte(transactions.date, start),
              lte(transactions.date, end)
            );

        // Query transactions
        const txns = await database.query.transactions.findMany({
          where: (t) => and(
            eq(t.type, 'EXPENSE'),
            eq(t.status, 'CONFIRMED'),
            gte(t.date, start),
            lte(t.date, end),
            categoryId === 'UNCATEGORIZED' ? eq(t.categoryId, null as any) : eq(t.categoryId, categoryId || '')
          ),
          orderBy: [desc(transactions.date), desc(transactions.createdAt)],
        });

        setTransactions(txns);
        setTotalSpent(Math.abs(txns.reduce((sum, t) => sum + t.amount, 0)));
      } catch (err) {
        console.error('Error loading transactions:', err);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [categoryId, month, year]);

  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.name || 'Cuenta';
  };

  const getPocketName = (pocketId: string | null) => {
    if (!pocketId) return 'Sin asignar';
    const pocket = pockets.find((p) => p.id === pocketId);
    return pocket?.name || 'Bolsillo';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle de categoría</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Category Hero */}
        <View style={[styles.hero, { backgroundColor: categoryColor + '15' }]}>
          <View style={[styles.heroIcon, { backgroundColor: categoryColor + '20' }]}>
            <MaterialCommunityIcons name={categoryIcon as any} size={32} color={categoryColor} />
          </View>
          <Text style={styles.heroCategory}>{categoryName}</Text>
          <Text style={styles.heroTotal}>{formatCurrency(totalSpent)}</Text>
          <Text style={styles.heroLabel}>total gastado en {new Date(yearNum, monthNum - 1).toLocaleDateString('es-CO', { month: 'long' })}</Text>
        </View>

        {/* Transactions List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {transactions.length} {transactions.length === 1 ? 'transacción' : 'transacciones'}
          </Text>

          {transactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="receipt" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Sin transacciones</Text>
            </Card>
          ) : (
            transactions.map((txn) => (
              <Card key={txn.id} style={styles.txnCard}>
                <View style={styles.txnRow}>
                  <View style={[styles.txnIcon, { backgroundColor: colors.accentRed + '15' }]}>
                    <MaterialCommunityIcons name="arrow-up-circle" size={20} color={colors.accentRed} />
                  </View>
                  <View style={styles.txnInfo}>
                    <Text style={styles.txnDescription} numberOfLines={1}>{txn.description}</Text>
                    <Text style={styles.txnMeta}>
                      {getAccountName(txn.accountId)} • {getPocketName(txn.pocketId || null)}
                    </Text>
                  </View>
                  <View style={styles.txnAmount}>
                    <Text style={styles.txnAmountText}>{formatCurrency(Math.abs(txn.amount))}</Text>
                    <Text style={styles.txnDate}>{formatDate(txn.date)}</Text>
                  </View>
                </View>
              </Card>
            ))
          )}
        </View>
      </ScrollView>
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
  hero: { alignItems: 'center', paddingVertical: spacing.xxl, marginHorizontal: spacing.lg, borderRadius: 16 },
  heroIcon: { width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  heroCategory: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  heroTotal: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.accentRed, marginTop: spacing.xs },
  heroLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, textTransform: 'capitalize' },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionTitle: { fontSize: typography.fontSize.md, color: colors.textMuted, marginBottom: spacing.md },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.fontSize.md, color: colors.textMuted, marginTop: spacing.sm },
  txnCard: { marginBottom: spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  txnInfo: { flex: 1 },
  txnDescription: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  txnMeta: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  txnAmount: { alignItems: 'flex-end' },
  txnAmountText: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.accentRed },
  txnDate: { fontSize: typography.fontSize.xs, color: colors.textHint, marginTop: 2 },
});
