import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, ProgressBar, Badge, Divider } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { usePocketsGroupedByAccount } from '../../src/hooks/usePockets';

export default function PocketsIndexScreen() {
  const router = useRouter();
  const { accounts, loading, refetch } = usePocketsGroupedByAccount();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(amount);

  const formatFullCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  // Calculate totals
  const totalSaved = accounts.reduce((sum, acc) => {
    const explicitTotal = acc.pockets.explicit.reduce((s, p) => s + p.balance, 0);
    return sum + explicitTotal + acc.pockets.implicit.balance;
  }, 0);

  const totalGoal = accounts.reduce((sum, acc) => {
    return sum + acc.pockets.explicit.reduce((s, p) => s + (p.goalAmount || 0), 0);
  }, 0);

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'BANK': return 'bank';
      case 'CASH': return 'cash';
      case 'SAVINGS': return 'piggy-bank';
      case 'INVESTMENT': return 'chart-line';
      default: return 'wallet';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bolsillos</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/pockets/add-funds')}
        >
          <MaterialCommunityIcons name="plus" size={22} color={colors.accentGreen} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      >
        {/* Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total acumulado</Text>
              <Text style={styles.summaryValue}>{formatFullCurrency(totalSaved)}</Text>
            </View>
            {totalGoal > 0 && (
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Meta total</Text>
                <Text style={styles.summaryValue}>{formatCurrency(totalGoal)}</Text>
              </View>
            )}
          </View>
          {totalGoal > 0 && (
            <ProgressBar
              progress={Math.min((totalSaved / totalGoal) * 100, 100) / 100}
              color={colors.accentGreen}
            />
          )}
        </Card>

        {/* Pockets by Account */}
        {accounts.map((account) => (
          <View key={account.id} style={styles.accountSection}>
            {/* Account Header */}
            <View style={styles.accountHeader}>
              <View style={[styles.accountIcon, { backgroundColor: colors.accentBlue + '20' }]}>
                <MaterialCommunityIcons name={getAccountIcon(account.type) as any} size={20} color={colors.accentBlue} />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{account.name}</Text>
                <Text style={styles.accountBalance}>{formatFullCurrency(account.balance || 0)}</Text>
              </View>
            </View>

            {/* Pockets List */}
            <Card style={styles.pocketsCard}>
              {/* Explicit Pockets */}
              {account.pockets.explicit.map((pocket, index) => {
                const progress = pocket.goalAmount && pocket.goalAmount > 0
                  ? (pocket.balance / pocket.goalAmount) * 100
                  : 0;
                const isCompleted = pocket.goalAmount && pocket.goalAmount > 0 && progress >= 100;

                return (
                  <View key={pocket.id}>
                    <TouchableOpacity
                      style={styles.pocketRow}
                      onPress={() => router.push(`/accounts/${account.id}`)}
                    >
                      <View style={[styles.pocketColor, { backgroundColor: pocket.color || colors.accentBlue }]} />
                      <View style={styles.pocketInfo}>
                        <View style={styles.pocketHeader}>
                          <Text style={styles.pocketName}>{pocket.name}</Text>
                          {isCompleted && (
                            <Badge variant="green" size="sm">Completado</Badge>
                          )}
                        </View>
                        {pocket.goalAmount && pocket.goalAmount > 0 && (
                          <>
                            <ProgressBar
                              progress={Math.min(progress, 100) / 100}
                              color={pocket.color || colors.accentBlue}
                            />
                            <Text style={styles.pocketGoal}>
                              {formatCurrency(pocket.balance)} de {formatCurrency(pocket.goalAmount)}
                            </Text>
                          </>
                        )}
                      </View>
                      <View style={styles.pocketBalance}>
                        <Text style={styles.pocketBalanceText}>{formatCurrency(pocket.balance)}</Text>
                      </View>
                    </TouchableOpacity>
                    {index < account.pockets.explicit.length - 1 && <Divider />}
                  </View>
                );
              })}

              {/* Implicit "Sin asignar" - always last */}
              <View style={[styles.pocketRow, styles.unassignedRow]}>
                <View style={[styles.pocketColor, { backgroundColor: colors.textMuted }]}>
                  <MaterialCommunityIcons name="help-circle-outline" size={16} color="#fff" />
                </View>
                <View style={styles.pocketInfo}>
                  <Text style={styles.pocketName}>Sin asignar</Text>
                  <Text style={styles.pocketSubtext}>Transacciones sin bolsillo</Text>
                </View>
                <View style={styles.pocketBalance}>
                  <Text style={styles.pocketBalanceText}>{formatCurrency(account.pockets.implicit.balance)}</Text>
                </View>
              </View>
            </Card>
          </View>
        ))}

        {/* Empty State */}
        {accounts.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <MaterialCommunityIcons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No tienes bolsillos</Text>
            <Text style={styles.emptyHint}>Crea bolsillos desde el detalle de cada cuenta</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButton: { padding: spacing.xs },
  headerTitle: { flex: 1, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  summaryCard: { marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row', marginBottom: spacing.md },
  summaryItem: { flex: 1 },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  accountSection: { marginBottom: spacing.xl },
  accountHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  accountIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  accountInfo: { flex: 1 },
  accountName: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  accountBalance: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  pocketsCard: { padding: 0, overflow: 'hidden' },
  pocketRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  unassignedRow: { backgroundColor: colors.surface2 },
  pocketColor: { width: 12, height: 40, borderRadius: 6, marginRight: spacing.md, justifyContent: 'center', alignItems: 'center' },
  pocketInfo: { flex: 1 },
  pocketHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pocketName: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  pocketSubtext: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  pocketGoal: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: 2 },
  pocketBalance: { alignItems: 'flex-end' },
  pocketBalanceText: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyText: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs, textAlign: 'center' },
});
