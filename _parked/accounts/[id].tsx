import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl, Alert, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, ProgressBar, Badge, Divider } from '../../src/components/ui';
import { Modal } from '../../src/components/ui/Modal';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePocketsByAccount } from '../../src/hooks/usePockets';
import { useRecentTransactions } from '../../src/hooks/useTransactions';
import { AccountRepository } from '../../src/database/repositories/accountRepository';
import { PocketRepository } from '../../src/database/repositories/pocketRepository';
import { TransactionRepository } from '../../src/database/repositories/transactionRepository';
import type { Account } from '../../src/database/schema';

const ACCOUNT_TYPES = [
  { id: 'BANK', name: 'Cuenta Bancaria', icon: 'bank' },
  { id: 'CASH', name: 'Efectivo', icon: 'cash' },
  { id: 'SAVINGS', name: 'Ahorro', icon: 'piggy-bank' },
  { id: 'CREDIT', name: 'Tarjeta de Crédito', icon: 'credit-card' },
];

export default function AccountDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts, refresh: refreshAccounts } = useAccounts();
  const { data: pocketsData, loading: pocketsLoading } = usePocketsByAccount(id);
  const { transactions, loading: txLoading } = useRecentTransactionsForAccount(id, 10);
  const [refreshing, setRefreshing] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [pocketModalVisible, setPocketModalVisible] = useState(false);
  const [newPocket, setNewPocket] = useState({ name: '', goalAmount: 0, color: colors.accentBlue });

  // Load account data
  useEffect(() => {
    async function load() {
      if (id) {
        const acc = await AccountRepository.getById(id);
        setAccount(acc);
      }
    }
    load();
  }, [id, accounts]);

  const onRefresh = async () => {
    setRefreshing(true);
    const acc = id ? await AccountRepository.getById(id) : null;
    setAccount(acc);
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const getAccountIcon = (type: string) => {
    const accType = ACCOUNT_TYPES.find((t) => t.id === type);
    return accType?.icon || 'bank';
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'INCOME': return colors.accentGreen;
      case 'EXPENSE': return colors.accentRed;
      case 'TRANSFER': return colors.accentBlue;
      default: return colors.textMuted;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'INCOME': return 'arrow-down-circle';
      case 'EXPENSE': return 'arrow-up-circle';
      case 'TRANSFER': return 'swap-horizontal-circle';
      default: return 'circle';
    }
  };

  const handleCreatePocket = async () => {
    if (!newPocket.name.trim() || !id) return;

    try {
      await PocketRepository.create({
        userId: account?.userId || '',
        accountId: id,
        name: newPocket.name.trim(),
        goalAmount: newPocket.goalAmount,
        color: newPocket.color,
        icon: 'wallet',
      });

      setNewPocket({ name: '', goalAmount: 0, color: colors.accentBlue });
      setPocketModalVisible(false);
      onRefresh();
    } catch (error) {
      Alert.alert('Error', 'No se pudo crear el bolsillo');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      '¿Estás seguro de eliminar esta cuenta? Las transacciones se moverán a "Sin asignar".',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await AccountRepository.delete(id);
              router.back();
            }
          },
        },
      ]
    );
  };

  const COLORS = [
    colors.accentBlue,
    colors.accentGreen,
    colors.accentRed,
    colors.accentYellow,
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
  ];

  if (!account) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{account.name}</Text>
          <TouchableOpacity onPress={() => router.push({ pathname: '/add-account', params: { id: account.id } })}>
            <MaterialCommunityIcons name="pencil" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Hero Card */}
        <Card style={styles.heroCard}>
          <View style={[styles.heroIcon, { backgroundColor: account.type === 'BANK' ? colors.accentBlue + '20' : colors.accentGreen + '20' }]}>
            <MaterialCommunityIcons
              name={getAccountIcon(account.type) as any}
              size={32}
              color={account.type === 'BANK' ? colors.accentBlue : colors.accentGreen}
            />
          </View>
          <Text style={styles.heroLabel}>
            {account.institution || ACCOUNT_TYPES.find((t) => t.id === account.type)?.name}
          </Text>
          <Text style={[styles.heroBalance, { color: account.balance >= 0 ? colors.accentGreen : colors.accentRed }]}>
            {formatCurrency(account.balance || 0)}
          </Text>
        </Card>

        {/* Pockets Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Bolsillos de esta cuenta</Text>
            <TouchableOpacity
              style={styles.addPocketButton}
              onPress={() => setPocketModalVisible(true)}
            >
              <MaterialCommunityIcons name="plus" size={18} color={colors.accentGreen} />
              <Text style={styles.addPocketText}>Nuevo</Text>
            </TouchableOpacity>
          </View>

          {pocketsLoading ? (
            <Text style={styles.loadingText}>Cargando bolsillos...</Text>
          ) : (
            <Card style={styles.pocketsCard}>
              {/* Explicit pockets */}
              {pocketsData?.explicit.map((pocket) => (
                <View key={pocket.id}>
                  <View style={styles.pocketRow}>
                    <View style={[styles.pocketColor, { backgroundColor: pocket.color || colors.accentBlue }]} />
                    <View style={styles.pocketInfo}>
                      <Text style={styles.pocketName}>{pocket.name}</Text>
                      {pocket.goalAmount && pocket.goalAmount > 0 && (
                        <ProgressBar
                          progress={Math.min((pocket.balance / pocket.goalAmount), 1)}
                          color={pocket.balance >= pocket.goalAmount ? colors.accentGreen : pocket.color || colors.accentBlue}
                        />
                      )}
                    </View>
                    <View style={styles.pocketBalance}>
                      <Text style={styles.pocketBalanceText}>{formatCurrency(pocket.balance)}</Text>
                      {pocket.goalAmount > 0 && (
                        <Text style={styles.pocketGoal}>de {formatCurrency(pocket.goalAmount)}</Text>
                      )}
                    </View>
                  </View>
                  <Divider />
                </View>
              ))}

              {/* Implicit "Sin asignar" pocket - always at the end */}
              <View style={[styles.pocketRow, styles.unassignedRow]}>
                <View style={[styles.pocketColor, { backgroundColor: colors.textMuted }]}>
                  <MaterialCommunityIcons name="help-circle-outline" size={16} color="#fff" />
                </View>
                <View style={styles.pocketInfo}>
                  <Text style={styles.pocketName}>Sin asignar</Text>
                  <Text style={styles.pocketSubtext}>Transacciones sin bolsillo</Text>
                </View>
                <View style={styles.pocketBalance}>
                  <Text style={styles.pocketBalanceText}>{formatCurrency(pocketsData?.implicit.balance || 0)}</Text>
                </View>
              </View>
            </Card>
          )}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Últimas transacciones</Text>
            <TouchableOpacity onPress={() => router.push('/transactions')}>
              <Text style={styles.seeAllText}>Ver todas</Text>
            </TouchableOpacity>
          </View>

          {txLoading ? (
            <Text style={styles.loadingText}>Cargando...</Text>
          ) : transactions.length === 0 ? (
            <Card style={styles.emptyCard}>
              <MaterialCommunityIcons name="receipt" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>Sin transacciones</Text>
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
                    <Text style={styles.txnDate}>
                      {new Date(txn.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                  <Text style={[styles.txnAmount, { color: getTypeColor(txn.type) }]}>
                    {txn.type === 'EXPENSE' ? '-' : txn.type === 'INCOME' ? '+' : ''}
                    {formatCurrency(txn.amount)}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push({ pathname: '/add-account', params: { id: account.id } })}
          >
            <MaterialCommunityIcons name="pencil" size={20} color={colors.textPrimary} />
            <Text style={styles.actionText}>Editar cuenta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => Alert.alert('Transferir', 'Próximamente')}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.textPrimary} />
            <Text style={styles.actionText}>Transferir</Text>
          </TouchableOpacity>

          <Divider />

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeleteAccount}
          >
            <MaterialCommunityIcons name="delete" size={20} color={colors.accentRed} />
            <Text style={[styles.actionText, { color: colors.accentRed }]}>Eliminar cuenta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add Pocket Modal */}
      <Modal visible={pocketModalVisible} onClose={() => setPocketModalVisible(false)} title="Nuevo Bolsillo">
        <Input
          label="Nombre"
          value={newPocket.name}
          onChangeText={(text) => setNewPocket({ ...newPocket, name: text })}
          placeholder="Ej: Vacaciones, Fondo emergencia"
        />

        <AmountInput
          label="Meta de ahorro (opcional)"
          value={newPocket.goalAmount}
          onChangeValue={(val) => setNewPocket({ ...newPocket, goalAmount: val })}
        />

        <Text style={styles.colorLabel}>Color</Text>
        <View style={styles.colorPicker}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                newPocket.color === color && styles.colorOptionSelected,
              ]}
              onPress={() => setNewPocket({ ...newPocket, color })}
            >
              {newPocket.color === color && (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => setPocketModalVisible(false)}>
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={handleCreatePocket}>
            <Text style={styles.createButtonText}>Crear</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// Custom hook for account-specific transactions
function useRecentTransactionsForAccount(accountId: string | undefined, limit: number) {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      if (!accountId) {
        setTransactions([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const data = await TransactionRepository.getByAccount(accountId, limit);
        setTransactions(data);
      } catch (err) {
        console.error('Error fetching transactions:', err);
        setTransactions([]);
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, [accountId, limit]);

  return { transactions, loading };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: typography.fontSize.md, color: colors.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  backButton: { padding: spacing.xs },
  headerTitle: { flex: 1, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  heroCard: { marginHorizontal: spacing.lg, alignItems: 'center', paddingVertical: spacing.xl },
  heroIcon: { width: 64, height: 64, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  heroLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  heroBalance: { fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold },
  section: { marginTop: spacing.xl, paddingHorizontal: spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  addPocketButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addPocketText: { fontSize: typography.fontSize.sm, color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  pocketsCard: { padding: 0, overflow: 'hidden' },
  pocketRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  unassignedRow: { backgroundColor: colors.surface2 },
  pocketColor: { width: 12, height: 40, borderRadius: 6, marginRight: spacing.md, justifyContent: 'center', alignItems: 'center' },
  pocketInfo: { flex: 1 },
  pocketName: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  pocketSubtext: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  pocketBalance: { alignItems: 'flex-end' },
  pocketBalanceText: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.semibold },
  pocketGoal: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  seeAllText: { fontSize: typography.fontSize.sm, color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { fontSize: typography.fontSize.md, color: colors.textMuted, marginTop: spacing.sm },
  txnCard: { marginBottom: spacing.sm },
  txnRow: { flexDirection: 'row', alignItems: 'center' },
  txnIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  txnInfo: { flex: 1 },
  txnDescription: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  txnDate: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  txnAmount: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  actionText: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  deleteButton: { marginTop: spacing.sm },
  colorLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  colorOption: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  colorOptionSelected: { borderWidth: 3, borderColor: '#fff' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xl },
  cancelButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  cancelButtonText: { fontSize: typography.fontSize.md, color: colors.textMuted },
  createButton: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.accentGreen, borderRadius: 8 },
  createButtonText: { fontSize: typography.fontSize.md, color: '#fff', fontWeight: typography.fontWeight.semibold },
});
