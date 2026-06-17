import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, ProgressBar, Divider, Button } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { database } from '../../src/database';
import { debtCards } from '../../src/database/schema';
import { eq } from 'drizzle-orm';
import { DebtCardRepository } from '../../src/database/repositories/debtCardRepository';
import type { DebtCard } from '../../src/database/schema';

export default function CardDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [card, setCard] = useState<DebtCard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (id) {
        const data = await DebtCardRepository.getById(id);
        setCard(data);
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const getAvailableCredit = (): number => {
    if (!card) return 0;
    return card.creditLimit - card.usedAmount;
  };

  const getUsagePercent = (): number => {
    if (!card || card.creditLimit === 0) return 0;
    return (card.usedAmount / card.creditLimit) * 100;
  };

  const getMinPayment = (): number => {
    if (!card) return 0;
    const percent = card.minPaymentPercent || 5;
    return card.usedAmount * (percent / 100);
  };

  const handlePayInstallment = () => {
    if (!card) return;
    router.push({
      pathname: '/debt/pay-installment',
      params: {
        debtId: card.id,
        debtType: 'card',
        currentBalance: card.usedAmount.toString(),
        minPayment: getMinPayment().toString(),
      },
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Eliminar tarjeta',
      '¿Estás seguro de eliminar esta tarjeta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (id) {
              await DebtCardRepository.delete(id);
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

  if (!card) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Tarjeta no encontrada</Text>
          <Button variant="ghost" onPress={() => router.back()}>Volver</Button>
        </View>
      </SafeAreaView>
    );
  }

  const usagePercent = getUsagePercent();
  const availableCredit = getAvailableCredit();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{card.name}</Text>
          <TouchableOpacity onPress={handleDelete}>
            <MaterialCommunityIcons name="delete" size={22} color={colors.accentRed} />
          </TouchableOpacity>
        </View>

        {/* Credit Card Visual */}
        <Card style={[styles.cardVisual, { backgroundColor: colors.accentRed }]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardInstitution}>{card.institution}</Text>
            <MaterialCommunityIcons name="wifi" size={20} color="rgba(255,255,255,0.6)" />
          </View>
          <Text style={styles.cardName}>{card.name}</Text>
          <View style={styles.cardFooter}>
            <View>
              <Text style={styles.cardLabel}>Disponible</Text>
              <Text style={styles.cardValue}>{formatCurrency(availableCredit)}</Text>
            </View>
            <View>
              <Text style={styles.cardLabel}>Cupo total</Text>
              <Text style={styles.cardValue}>{formatCurrency(card.creditLimit)}</Text>
            </View>
          </View>
        </Card>

        {/* Usage Bar */}
        <Card style={styles.usageCard}>
          <View style={styles.usageHeader}>
            <Text style={styles.usageLabel}>Uso del cupo</Text>
            <Text style={[styles.usagePercent, { color: usagePercent > 80 ? colors.accentRed : usagePercent > 50 ? colors.accentYellow : colors.accentGreen }]}>
              {usagePercent.toFixed(0)}%
            </Text>
          </View>
          <ProgressBar
            progress={usagePercent / 100}
            color={usagePercent > 80 ? colors.accentRed : usagePercent > 50 ? colors.accentYellow : colors.accentGreen}
          />
          <View style={styles.usageDetails}>
            <Text style={styles.usageDetailText}>
              <Text style={{ color: colors.accentRed }}>{formatCurrency(card.usedAmount)}</Text> usado de {formatCurrency(card.creditLimit)}
            </Text>
          </View>
        </Card>

        {/* Details */}
        <Card style={styles.detailsCard}>
          <Text style={styles.sectionTitle}>Información</Text>

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="calendar" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Fecha de corte</Text>
              <Text style={styles.detailValue}>Día {card.cutoffDay} de cada mes</Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="calendar-check" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Fecha de pago</Text>
              <Text style={styles.detailValue}>Día {card.paymentDay} de cada mes</Text>
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
                {card.interestRateMonthly ? `${(card.interestRateMonthly * 100).toFixed(2)}%` : 'No configurada'}
              </Text>
            </View>
          </View>

          <Divider />

          <View style={styles.detailRow}>
            <View style={styles.detailIcon}>
              <MaterialCommunityIcons name="cash-minus" size={20} color={colors.textMuted} />
            </View>
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Pago mínimo</Text>
              <Text style={styles.detailValue}>
                {card.minPaymentPercent ? `${card.minPaymentPercent}% (${formatCurrency(getMinPayment())})` : 'No configurado'}
              </Text>
            </View>
          </View>

          {card.isAutoDebit && (
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

        {/* Pay Button */}
        <View style={styles.actions}>
          <Button variant="primary" onPress={handlePayInstallment} style={styles.payButton}>
            <MaterialCommunityIcons name="credit-card-check" size={20} color="#fff" />
            <Text style={styles.payButtonText}>Pagar cuota</Text>
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
  cardVisual: { marginHorizontal: spacing.lg, borderRadius: 16, padding: spacing.lg, minHeight: 180, justifyContent: 'space-between' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardInstitution: { fontSize: typography.fontSize.md, color: 'rgba(255,255,255,0.9)', fontWeight: typography.fontWeight.medium },
  cardName: { fontSize: typography.fontSize.xl, color: '#fff', fontWeight: typography.fontWeight.bold, letterSpacing: 2 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { fontSize: typography.fontSize.xs, color: 'rgba(255,255,255,0.7)' },
  cardValue: { fontSize: typography.fontSize.lg, color: '#fff', fontWeight: typography.fontWeight.bold },
  usageCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  usageLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  usagePercent: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold },
  usageDetails: { marginTop: spacing.sm },
  usageDetailText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
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
