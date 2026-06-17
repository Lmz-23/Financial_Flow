import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Badge, Divider } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { database } from '../../src/database';
import { debtCards, debtLoans } from '../../src/database/schema';
import { eq, desc } from 'drizzle-orm';
import type { DebtCard, DebtLoan } from '../../src/database/schema';

type DebtItem = {
  type: 'card' | 'loan';
  data: DebtCard | DebtLoan;
};

export default function DebtIndexScreen() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const [cards, setCards] = useState<DebtCard[]>([]);
  const [loans, setLoans] = useState<DebtLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDebts = async () => {
    try {
      const [cardsData, loansData] = await Promise.all([
        database.query.debtCards.findMany({
          where: eq(debtCards.userId, userId),
          orderBy: [desc(debtCards.createdAt)],
        }),
        database.query.debtLoans.findMany({
          where: eq(debtLoans.userId, userId),
          orderBy: [desc(debtLoans.createdAt)],
        }),
      ]);
      setCards(cardsData);
      setLoans(loansData);
    } catch (err) {
      console.error('Error loading debts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebts();
  }, [userId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDebts();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(amount);

  // Get next payment date for a loan
  const getNextPaymentDate = (loan: DebtLoan): string => {
    const today = new Date();
    const paymentDay = loan.paymentDayOfMonth;
    let nextPayment = new Date(today.getFullYear(), today.getMonth(), paymentDay);

    if (nextPayment <= today) {
      nextPayment = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
    }

    return nextPayment.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  // Get next payment date for a card
  const getCardNextPayment = (card: DebtCard): string => {
    const today = new Date();
    const paymentDay = card.paymentDay;
    let nextPayment = new Date(today.getFullYear(), today.getMonth(), paymentDay);

    if (nextPayment <= today) {
      nextPayment = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
    }

    return nextPayment.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  // Calculate available credit for card
  const getAvailableCredit = (card: DebtCard): number => {
    return card.creditLimit - card.usedAmount;
  };

  const renderCard = ({ item }: { item: DebtCard }) => {
    const available = getAvailableCredit(item);
    const usagePercent = item.creditLimit > 0 ? (item.usedAmount / item.creditLimit) * 100 : 0;

    return (
      <TouchableOpacity onPress={() => router.push(`/debt/card/${item.id}`)} activeOpacity={0.7}>
        <Card style={styles.debtCard}>
          <View style={styles.debtHeader}>
            <View style={[styles.debtIcon, { backgroundColor: colors.accentRed + '20' }]}>
              <MaterialCommunityIcons name="credit-card" size={24} color={colors.accentRed} />
            </View>
            <View style={styles.debtInfo}>
              <Text style={styles.debtName}>{item.name}</Text>
              <Text style={styles.debtInstitution}>{item.institution}</Text>
            </View>
            <Badge variant={usagePercent > 80 ? 'red' : usagePercent > 50 ? 'yellow' : 'green'} size="sm">
              {(100 - usagePercent).toFixed(0)}% libre
            </Badge>
          </View>

          <View style={styles.debtDetails}>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Usado</Text>
              <Text style={[styles.debtDetailValue, { color: colors.accentRed }]}>
                {formatCurrency(item.usedAmount)}
              </Text>
            </View>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Disponible</Text>
              <Text style={[styles.debtDetailValue, { color: colors.accentGreen }]}>
                {formatCurrency(available)}
              </Text>
            </View>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Corte</Text>
              <Text style={styles.debtDetailValue}>{item.cutoffDay}</Text>
            </View>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Pago</Text>
              <Text style={styles.debtDetailValue}>{getCardNextPayment(item)}</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const renderLoan = ({ item }: { item: DebtLoan }) => {
    const progressPercent = item.totalInstallments > 0
      ? ((item.totalInstallments - item.remainingInstallments) / item.totalInstallments) * 100
      : 0;

    return (
      <TouchableOpacity onPress={() => router.push(`/debt/loan/${item.id}`)} activeOpacity={0.7}>
        <Card style={styles.debtCard}>
          <View style={styles.debtHeader}>
            <View style={[styles.debtIcon, { backgroundColor: colors.accentYellow + '20' }]}>
              <MaterialCommunityIcons name="bank" size={24} color={colors.accentYellow} />
            </View>
            <View style={styles.debtInfo}>
              <Text style={styles.debtName}>{item.name}</Text>
              <Text style={styles.debtInstitution}>{item.institution}</Text>
            </View>
            <Badge variant="yellow" size="sm">
              {item.remainingInstallments} cuotas
            </Badge>
          </View>

          <View style={styles.debtDetails}>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Saldo</Text>
              <Text style={[styles.debtDetailValue, { color: colors.accentRed }]}>
                {formatCurrency(item.currentBalance)}
              </Text>
            </View>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Cuota</Text>
              <Text style={styles.debtDetailValue}>
                {formatCurrency(item.monthlyPayment)}
              </Text>
            </View>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Próximo</Text>
              <Text style={styles.debtDetailValue}>{getNextPaymentDate(item)}</Text>
            </View>
            <View style={styles.debtDetailItem}>
              <Text style={styles.debtDetailLabel}>Progreso</Text>
              <Text style={styles.debtDetailValue}>{progressPercent.toFixed(0)}%</Text>
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const totalDebt = [
    ...cards.map((c) => c.usedAmount),
    ...loans.map((l) => l.currentBalance),
  ].reduce((sum, val) => sum + val, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Deudas</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/debt/add-card')} style={styles.addButton}>
            <MaterialCommunityIcons name="plus" size={22} color={colors.accentGreen} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary */}
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryLabel}>Deuda total</Text>
        <Text style={[styles.summaryAmount, { color: totalDebt > 0 ? colors.accentRed : colors.textMuted }]}>
          {formatCurrency(totalDebt)}
        </Text>
        <Text style={styles.summaryHint}>{cards.length + loans.length} obligaciones activas</Text>
      </Card>

      {/* Debt Lists */}
      <FlatList
        data={[
          ...cards.map((c): DebtItem => ({ type: 'card', data: c })),
          ...loans.map((l): DebtItem => ({ type: 'loan', data: l })),
        ]}
        keyExtractor={(item) => item.data.id}
        renderItem={({ item, index }) => {
          // Add section header for cards
          if (index === 0 && cards.length > 0) {
            return (
              <View>
                <Text style={styles.sectionTitle}>Tarjetas de crédito</Text>
                {renderCard({ item: item.data as DebtCard })}
              </View>
            );
          }
          if (index === cards.length && loans.length > 0) {
            return (
              <View>
                <Text style={styles.sectionTitle}>Préstamos</Text>
                {renderLoan({ item: item.data as DebtLoan })}
              </View>
            );
          }
          if (item.type === 'card') {
            return renderCard({ item: item.data as DebtCard });
          }
          return renderLoan({ item: item.data as DebtLoan });
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="credit-card-off" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>Sin deudas</Text>
            <Text style={styles.emptyHint}>Agrega tus tarjetas y préstamos para hacer seguimiento</Text>
            <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/debt/add-card')}>
              <Text style={styles.emptyButtonText}>Agregar tarjeta</Text>
            </TouchableOpacity>
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
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButton: { padding: spacing.xs },
  headerTitle: { flex: 1, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  addButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, alignItems: 'center' },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryAmount: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, marginTop: spacing.xs },
  summaryHint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  debtCard: { marginBottom: spacing.sm },
  debtHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  debtIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  debtInfo: { flex: 1 },
  debtName: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  debtInstitution: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  debtDetails: { flexDirection: 'row', justifyContent: 'space-between' },
  debtDetailItem: { alignItems: 'center' },
  debtDetailLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  debtDetailValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs, textAlign: 'center' },
  emptyButton: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.accentGreen, borderRadius: 8 },
  emptyButtonText: { fontSize: typography.fontSize.md, color: '#fff', fontWeight: typography.fontWeight.semibold },
});
