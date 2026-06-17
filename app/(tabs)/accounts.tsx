import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useAccounts } from '../../src/hooks/useAccounts';

const ACCOUNT_TYPES = [
  { id: 'BANK', name: 'Cuenta Bancaria', icon: 'bank' },
  { id: 'CASH', name: 'Efectivo', icon: 'cash' },
  { id: 'SAVINGS', name: 'Ahorro', icon: 'piggy-bank' },
  { id: 'CREDIT', name: 'Tarjeta de Crédito', icon: 'credit-card' },
];

export default function AccountsScreen() {
  const router = useRouter();
  const { accounts, refresh } = useAccounts();
  const [refreshing, setRefreshing] = useState(false);

  const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const getAccountIcon = (type: string) => {
    const accType = ACCOUNT_TYPES.find((t) => t.id === type);
    return accType?.icon || 'bank';
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Cuentas</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/add-account')}
        >
          <MaterialCommunityIcons name="plus" size={24} color={colors.accentGreen} />
        </TouchableOpacity>
      </View>

      {/* Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Balance total</Text>
        <Text style={styles.summaryAmount}>{formatCurrency(totalBalance)}</Text>
        <Text style={styles.summaryCount}>{accounts.length} cuentas</Text>
      </Card>

      {/* Accounts list */}
      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/accounts/${item.id}`)}
            activeOpacity={0.7}
          >
            <Card style={styles.accountCard}>
              <View style={styles.accountRow}>
                <View style={[styles.accountIcon, { backgroundColor: item.type === 'BANK' ? colors.accentBlue + '20' : colors.accentGreen + '20' }]}>
                  <MaterialCommunityIcons
                    name={getAccountIcon(item.type) as any}
                    size={24}
                    color={item.type === 'BANK' ? colors.accentBlue : colors.accentGreen}
                  />
                </View>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountName}>{item.name}</Text>
                  <Text style={styles.accountMeta}>
                    {item.institution || ACCOUNT_TYPES.find((t) => t.id === item.type)?.name}
                  </Text>
                </View>
                <View style={styles.accountBalance}>
                  <Text style={[styles.accountBalanceText, { color: item.balance >= 0 ? colors.accentGreen : colors.accentRed }]}>
                    {formatCurrency(item.balance || 0)}
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="bank-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No tienes cuentas</Text>
            <Text style={styles.emptyHint}>Toca + para agregar tu primera cuenta</Text>
          </View>
        }
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
  summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryAmount: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, marginTop: spacing.xs },
  summaryCount: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  accountCard: { marginBottom: spacing.sm },
  accountRow: { flexDirection: 'row', alignItems: 'center' },
  accountIcon: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  accountInfo: { flex: 1 },
  accountName: { fontSize: typography.fontSize.lg, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  accountMeta: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  accountBalance: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  accountBalanceText: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs },
});
