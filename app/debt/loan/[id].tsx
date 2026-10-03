import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, ProgressBar, Divider, Button } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/theme';
import { useUserStore } from '../../../src/store/useUserStore';
import { DebtLoanRepository } from '../../../src/database/repositories/debtLoanRepository';
import type { DebtLoan } from '../../../src/database/schema';

export default function LoanDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loan, setLoan] = useState<DebtLoan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (id) {
        const data = await DebtLoanRepository.getById(id);
        setLoan(data);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const getProgressPercent = (): number => {
    if (!loan || loan.totalInstallments === 0) return 0;
    return ((loan.totalInstallments - loan.remainingInstallments) / loan.totalInstallments) * 100;
  };

  const getNextPaymentDate = (): string => {
    if (!loan) return '';
    const today = new Date();
    const paymentDay = loan.paymentDayOfMonth;
    let nextPayment = new Date(today.getFullYear(), today.getMonth(), paymentDay);

    if (nextPayment <= today) {
      nextPayment = new Date(today.getFullYear(), today.getMonth() + 1, paymentDay);
    }

    return nextPayment.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar préstamo',
      '¿Estás seguro de eliminar este préstamo? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await DebtLoanRepository.delete(id);
              router.back();
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

  if (!loan) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Préstamo no encontrado</Text>
          <Button variant="ghost" onPress={() => router.back()}>Volver</Button>
        </View>
      </SafeAreaView>
    );
  }

  const progress = getProgressPercent();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{loan.name}</Text>
          <TouchableOpacity onPress={handleDelete}>
            <MaterialCommunityIcons name="delete" size={22} color={colors.accentRed} />
          </TouchableOpacity>
        </View>

        {/* Loan Summary */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Saldo actual</Text>
              <Text style={[styles.summaryValue, { color: colors.accentRed }]}>
                {formatCurrency(loan.currentBalance)}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cuota mensual</Text>
              <Text style={styles.summaryValue}>{formatCurrency(loan.monthlyPayment)}</Text>
            </View>
          </View>

          <View style={styles.progressSection}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Progreso del préstamo</Text>
              <Text style={styles.progressPercent}>{progress.toFixed(0)}%</Text>
            </View>
            <ProgressBar progress={progress / 100} color={colors.accentGreen} />
            <Text style={styles.progressDetail}>
              {loan.totalInstallments - loan.remainingInstallments} de {loan.totalInstallments} cuotas pagadas
            </Text>
          </View>
        </Card>

        {/* Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Información</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="bank" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Institución</Text>
              <Text style={styles.detailValue}>{loan.institution}</Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="cash" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Monto original</Text>
              <Text style={styles.detailValue}>{formatCurrency(loan.originalAmount)}</Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="calendar" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Fecha de inicio</Text>
              <Text style={styles.detailValue}>{formatDate(loan.startDate)}</Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="calendar-check" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Próximo pago</Text>
              <Text style={styles.detailValue}>{getNextPaymentDate()}</Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="percent" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Tasa de interés mensual</Text>
              <Text style={styles.detailValue}>
                {loan.interestRateMonthly ? `${(loan.interestRateMonthly * 100).toFixed(2)}%` : 'No configurada'}
              </Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="percent" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Tasa de interés anual</Text>
              <Text style={styles.detailValue}>
                {loan.interestRateAnnual ? `${(loan.interestRateAnnual * 100).toFixed(2)}%` : 'No configurada'}
              </Text>
            </View>
          </View>

          {loan.isAutoDebit && (
            <>
              <Divider />
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}>
                  <MaterialCommunityIcons name="autorenew" size={20} color={colors.accentGreen} />
                </View>
                <View style={styles.detailInfo}>
                  <Text style={styles.detailLabel}>Débito automático</Text>
                  <Text style={[styles.detailValue, { color: colors.accentGreen }]}>Activado</Text>
                </View>
              </View>
            </>
          )}
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button variant="primary" onPress={() => router.push({
            pathname: '/debt/pay-installment',
            params: {
              debtId: loan.id,
              debtType: 'loan',
              currentBalance: loan.currentBalance.toString(),
              minPayment: loan.monthlyPayment.toString(),
            },
          })} style={styles.payButton}>
            <MaterialCommunityIcons name="cash-check" size={20} color="#fff" />
            <Text style={styles.payButtonText}>Registrar pago</Text>
          </Button>
        </View>
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
  backButton: { padding: spacing.xs },
  headerTitle: { flex: 1, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' },
  summaryCard: { marginHorizontal: spacing.lg },
  summaryRow: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryValue: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, marginTop: spacing.xs },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  progressSection: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  progressLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  progressPercent: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.accentGreen },
  progressDetail: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  detailsCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  sectionTitle: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  detailIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  detailInfo: { flex: 1 },
  detailLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  detailValue: { fontSize: typography.fontSize.md, color: colors.textPrimary, marginTop: 2 },
  actions: { marginHorizontal: spacing.lg, marginTop: spacing.xl },
  payButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  payButtonText: { fontSize: typography.fontSize.md, color: '#fff', fontWeight: typography.fontWeight.semibold },
});
