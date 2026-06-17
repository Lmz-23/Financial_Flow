import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Button, Divider } from '../../src/components/ui';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { useAccounts } from '../../src/hooks/useAccounts';
import { TransactionRepository } from '../../src/database/repositories/transactionRepository';
import { DebtCardRepository } from '../../src/database/repositories/debtCardRepository';
import { database } from '../../src/database';
import { categories } from '../../src/database/schema';
import { eq } from 'drizzle-orm';

/**
 * DEBT PAYMENT DOCUMENTATION:
 *
 * When a debt payment is made, we create an EXPENSE transaction with a special
 * category "Pago de deuda" (DEBT_PAYMENT category).
 *
 * In CashflowService, transactions with category.type='DEBT_PAYMENT' are excluded
 * from "life expenses" calculation and instead counted as "debt payments".
 *
 * This avoids the need for a special flag and keeps the transaction model simple.
 * The category-based approach is more flexible for reporting.
 */

const DEBT_PAYMENT_CATEGORY = 'DEBT_PAYMENT';

export default function PayInstallmentScreen() {
  const router = useRouter();
  const { debtId, debtType, currentBalance, minPayment } = useLocalSearchParams<{
    debtId: string;
    debtType: string;
    currentBalance: string;
    minPayment: string;
  }>();

  const userId = useUserStore((s) => s.userId);
  const { accounts } = useAccounts();

  const [amount, setAmount] = useState(0);
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id || '');
  const [isOnTime, setIsOnTime] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

  const balance = parseFloat(currentBalance || '0');
  const min = parseFloat(minPayment || '0');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(value);

  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.name || 'Seleccionar cuenta';
  };

  const handleQuickAmount = (type: 'min' | 'total' | 'other') => {
    if (type === 'min') {
      setAmount(min);
    } else if (type === 'total') {
      setAmount(balance);
    }
  };

  const handleSave = async () => {
    if (amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (!selectedAccountId) {
      Alert.alert('Error', 'Selecciona una cuenta de origen');
      return;
    }

    setLoading(true);
    try {
      // 1. Get or create DEBT_PAYMENT category
      let debtCategory = await database.query.categories.findFirst({
        where: eq(categories.name, 'Pago de deuda'),
      });

      if (!debtCategory) {
        // Create the category
        const id = crypto.randomUUID();
        await database.insert(categories).values({
          id,
          userId: null, // System category
          name: 'Pago de deuda',
          type: 'EXPENSE',
          icon: 'credit-card-check',
          color: colors.accentYellow,
          isDefault: true,
          isActive: true,
          order: 0,
          createdAt: new Date(),
        });
        debtCategory = await database.query.categories.findFirst({
          where: eq(categories.name, 'Pago de deuda'),
        });
      }

      // 2. Create the EXPENSE transaction for the payment
      await TransactionRepository.create({
        userId,
        accountId: selectedAccountId,
        toAccountId: null,
        type: 'EXPENSE',
        amount: -amount, // Negative for expense
        description: `Pago de deuda${!isOnTime ? ' (tarde)' : ''}`,
        categoryId: debtCategory?.id || null,
        pocketId: null,
        date: new Date(),
        status: 'CONFIRMED',
      });

      // 3. Update debt balance (reduce usedAmount for cards)
      if (debtType === 'card') {
        const newUsedAmount = Math.max(0, balance - amount);
        await DebtCardRepository.updateUsedAmount(debtId!, newUsedAmount);
      }

      // 4. For loans, we'd update the loan balance similarly (future implementation)

      Alert.alert('Éxito', 'Pago registrado correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error recording payment:', error);
      Alert.alert('Error', 'No se pudo registrar el pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Pagar cuota</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Current Balance Info */}
        <Card style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Saldo actual de la deuda</Text>
          <Text style={styles.balanceAmount}>{formatCurrency(balance)}</Text>
          {min > 0 && (
            <Text style={styles.minPayment}>Pago mínimo: {formatCurrency(min)}</Text>
          )}
        </Card>

        {/* Quick Amount Buttons */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Monto a pagar</Text>
          <View style={styles.quickButtons}>
            <TouchableOpacity
              style={[styles.quickButton, amount === min && styles.quickButtonActive]}
              onPress={() => handleQuickAmount('min')}
            >
              <Text style={[styles.quickButtonText, amount === min && styles.quickButtonTextActive]}>
                Mínimo
              </Text>
              <Text style={[styles.quickButtonAmount, amount === min && styles.quickButtonTextActive]}>
                {formatCurrency(min)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickButton, amount === balance && styles.quickButtonActive]}
              onPress={() => handleQuickAmount('total')}
            >
              <Text style={[styles.quickButtonText, amount === balance && styles.quickButtonTextActive]}>
                Total
              </Text>
              <Text style={[styles.quickButtonAmount, amount === balance && styles.quickButtonTextActive]}>
                {formatCurrency(balance)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Custom Amount */}
        <View style={styles.section}>
          <AmountInput
            label="Otro monto"
            value={amount}
            onChangeValue={setAmount}
          />
        </View>

        {/* Account Picker */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cuenta de origen</Text>
          <TouchableOpacity
            style={styles.accountPicker}
            onPress={() => setShowAccountPicker(!showAccountPicker)}
          >
            <MaterialCommunityIcons name="bank" size={20} color={colors.textMuted} />
            <Text style={styles.accountPickerText}>{getAccountName(selectedAccountId)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          {showAccountPicker && (
            <Card style={styles.accountList}>
              {accounts.map((acc) => (
                <TouchableOpacity
                  key={acc.id}
                  style={[styles.accountItem, selectedAccountId === acc.id && styles.accountItemSelected]}
                  onPress={() => {
                    setSelectedAccountId(acc.id);
                    setShowAccountPicker(false);
                  }}
                >
                  <Text style={[styles.accountItemText, selectedAccountId === acc.id && styles.accountItemTextSelected]}>
                    {acc.name}
                  </Text>
                  {selectedAccountId === acc.id && (
                    <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />
                  )}
                </TouchableOpacity>
              ))}
            </Card>
          )}
        </View>

        {/* On-time toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.toggleRow, !isOnTime && styles.toggleRowInactive]}
            onPress={() => setIsOnTime(!isOnTime)}
          >
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>¿Pago a tiempo?</Text>
              <Text style={styles.toggleHint}>
                Indica si estás pagando antes o después de la fecha de vencimiento
              </Text>
            </View>
            <View style={[styles.toggleIndicator, isOnTime ? styles.toggleOnTime : styles.toggleLate]}>
              <Text style={styles.toggleIndicatorText}>{isOnTime ? 'A tiempo' : 'Tarde'}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information" size={20} color={colors.accentBlue} />
          <Text style={styles.infoText}>
            El pago se registrará como un gasto en la cuenta seleccionada y reducirá el saldo de tu deuda.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          variant="primary"
          onPress={handleSave}
          loading={loading}
          disabled={amount <= 0 || !selectedAccountId}
          style={styles.saveButton}
        >
          Registrar pago de {formatCurrency(amount)}
        </Button>
      </View>
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
  balanceCard: { marginHorizontal: spacing.lg, alignItems: 'center', paddingVertical: spacing.xl },
  balanceLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  balanceAmount: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary, marginTop: spacing.xs },
  minPayment: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: typography.fontWeight.medium },
  quickButtons: { flexDirection: 'row', gap: spacing.sm },
  quickButton: { flex: 1, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  quickButtonActive: { borderColor: colors.accentGreen, backgroundColor: colors.accentGreen + '10' },
  quickButtonText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  quickButtonTextActive: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  quickButtonAmount: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.textPrimary, marginTop: spacing.xs },
  accountPicker: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12, gap: spacing.md },
  accountPickerText: { flex: 1, fontSize: typography.fontSize.md, color: colors.textPrimary },
  accountList: { marginTop: spacing.sm, padding: spacing.xs },
  accountItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  accountItemSelected: { backgroundColor: colors.accentGreen + '10', borderRadius: 8 },
  accountItemText: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  accountItemTextSelected: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12 },
  toggleRowInactive: { backgroundColor: colors.accentYellow + '15' },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  toggleHint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  toggleIndicator: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: 8 },
  toggleOnTime: { backgroundColor: colors.accentGreen },
  toggleLate: { backgroundColor: colors.accentYellow },
  toggleIndicatorText: { fontSize: typography.fontSize.sm, color: '#fff', fontWeight: typography.fontWeight.medium },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.accentBlue + '15', marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.md, borderRadius: 12, gap: spacing.sm },
  infoText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.accentBlue },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: { width: '100%' },
});
