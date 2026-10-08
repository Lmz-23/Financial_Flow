import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button, Divider } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import { database } from '../../src/database';
import { transactions } from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import { TransactionRepository } from '../../src/database/repositories/transactionRepository';
import type { Transaction } from '../../src/database/schema';

export default function TransactionDetailModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { accounts } = useAccounts();
  const { pockets } = usePockets();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function load() {
      if (id) {
        const txn = await TransactionRepository.getById(id);
        setTransaction(txn);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.name || 'Cuenta';
  };

  const getPocketName = (pocketId: string | null) => {
    if (!pocketId) return 'Sin asignar';
    const pocket = pockets.find((p) => p.id === pocketId);
    return pocket?.name || 'Bolsillo';
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'INCOME': return 'Ingreso';
      case 'EXPENSE': return 'Gasto';
      case 'TRANSFER': return 'Transferencia';
      default: return type;
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const handleDelete = () => {
    Alert.alert(
      'Eliminar transacción',
      '¿Estás seguro de eliminar esta transacción? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;

            setDeleting(true);
            try {
              await TransactionRepository.delete(id);
              router.back();
            } catch (error) {
              console.error('Error deleting transaction:', error);
              Alert.alert('Error', 'No se pudo eliminar la transacción');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Transacción no encontrada</Text>
          <Button variant="ghost" onPress={() => router.back()}>
            Volver
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Detalle</Text>
          <TouchableOpacity onPress={() => Alert.alert('Editar', 'Próximamente')}>
            <MaterialCommunityIcons name="pencil" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Amount Hero */}
        <View style={[styles.amountHero, { backgroundColor: getTypeColor(transaction.type) + '15' }]}>
          <View style={[styles.amountIcon, { backgroundColor: getTypeColor(transaction.type) + '20' }]}>
            <MaterialCommunityIcons
              name={getTypeIcon(transaction.type) as any}
              size={32}
              color={getTypeColor(transaction.type)}
            />
          </View>
          <Text style={[styles.amountLabel]}>{getTypeLabel(transaction.type)}</Text>
          <Text style={[styles.amountValue, { color: getTypeColor(transaction.type) }]}>
            {transaction.type === 'EXPENSE' ? '-' : transaction.type === 'INCOME' ? '+' : ''}
            {formatCurrency(transaction.amount)}
          </Text>
        </View>

        {/* Details Card */}
        <View style={styles.detailsCard}>
          {/* Description */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="text" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Descripción</Text>
              <Text style={styles.detailValue}>{transaction.description}</Text>
            </View>
          </View>

          <Divider />

          {/* Account */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="bank" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Cuenta</Text>
              <Text style={styles.detailValue}>{getAccountName(transaction.accountId)}</Text>
            </View>
          </View>

          {/* Pocket */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="wallet" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Bolsillo</Text>
              <Text style={styles.detailValue}>{getPocketName(transaction.pocketId || null)}</Text>
            </View>
          </View>

          <Divider />

          {/* Date */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="calendar" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Fecha</Text>
              <Text style={styles.detailValue}>{formatDate(transaction.date)}</Text>
            </View>
          </View>

          {/* Status */}
          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons
                name={transaction.status === 'CONFIRMED' ? 'check-circle' : 'clock-outline'}
                size={20}
                color={transaction.status === 'CONFIRMED' ? colors.accentGreen : colors.accentYellow}
              />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Estado</Text>
              <Text style={[
                styles.detailValue,
                { color: transaction.status === 'CONFIRMED' ? colors.accentGreen : colors.accentYellow }
              ]}>
                {transaction.status === 'CONFIRMED' ? 'Confirmada' :
                 transaction.status === 'PENDING' ? 'Pendiente' :
                 transaction.status === 'CANCELLED' ? 'Cancelada' : transaction.status}
              </Text>
            </View>
          </View>

          {/* Transfer destination */}
          {transaction.type === 'TRANSFER' && transaction.toAccountId && (
            <>
              <Divider />
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <MaterialCommunityIcons name="arrow-right" size={20} color={colors.textMuted} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Destino</Text>
                  <Text style={styles.detailValue}>{getAccountName(transaction.toAccountId)}</Text>
                </View>
              </View>
            </>
          )}

          {/* Notes */}
          {transaction.notes && (
            <>
              <Divider />
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <MaterialCommunityIcons name="note-text" size={20} color={colors.textMuted} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Notas</Text>
                  <Text style={styles.detailValue}>{transaction.notes}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete} disabled={deleting}>
          <MaterialCommunityIcons name="delete" size={20} color={colors.accentRed} />
          <Text style={styles.deleteButtonText}>Eliminar transacción</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
  loadingText: { fontSize: typography.fontSize.md, color: colors.textMuted },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  closeButton: { padding: spacing.xs },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  amountHero: { alignItems: 'center', paddingVertical: spacing.xxl, marginHorizontal: spacing.lg, borderRadius: 16 },
  amountIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md },
  amountLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  amountValue: { fontSize: typography.fontSize['3xl'], fontWeight: typography.fontWeight.bold },
  detailsCard: { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  detailIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  detailValue: { fontSize: typography.fontSize.md, color: colors.textPrimary, marginTop: 2 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, marginTop: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  deleteButtonText: { fontSize: typography.fontSize.md, color: colors.accentRed },
});
