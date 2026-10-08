import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Card } from '../../src/components/ui';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { DebtLoanRepository } from '../../src/database/repositories/debtLoanRepository';
import { calculateInterestRate } from '../../src/domain/services/DebtService';

export default function AddLoanScreen() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);

  const [form, setForm] = useState({
    name: '',
    institution: '',
    originalAmount: 0,
    currentBalance: 0,
    monthlyPayment: 0,
    paymentDayOfMonth: 1,
    totalInstallments: 0,
    remainingInstallments: 0,
    interestRateMonthly: 0,
    interestRateAnnual: 0,
    startDate: new Date(),
    isAutoDebit: false,
    useCalculator: false,
  });

  const [calculatorResult, setCalculatorResult] = useState<{ rate: number; effectiveAnnual: number } | null>(null);
  const [calculatorInput, setCalculatorInput] = useState({
    principal: 0,
    monthlyPayment: 0,
    installments: 0,
  });
  const [showCalculator, setShowCalculator] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleCalculateRate = () => {
    if (calculatorInput.principal <= 0 || calculatorInput.monthlyPayment <= 0 || calculatorInput.installments <= 0) {
      Alert.alert('Error', 'Ingresa todos los valores para calcular');
      return;
    }

    try {
      const rate = calculateInterestRate(
        calculatorInput.principal,
        calculatorInput.monthlyPayment,
        calculatorInput.installments
      );

      const effectiveAnnual = Math.pow(1 + rate, 12) - 1;

      setCalculatorResult({
        rate: rate * 100, // Convert to percentage
        effectiveAnnual: effectiveAnnual * 100,
      });

      // Auto-fill the form with calculated values
      setForm({
        ...form,
        originalAmount: calculatorInput.principal,
        monthlyPayment: calculatorInput.monthlyPayment,
        totalInstallments: calculatorInput.installments,
        remainingInstallments: calculatorInput.installments,
        interestRateMonthly: rate * 100,
        interestRateAnnual: effectiveAnnual * 100,
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo calcular la tasa');
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Ingresa el nombre del préstamo');
      return;
    }

    if (!form.institution.trim()) {
      Alert.alert('Error', 'Ingresa la institución');
      return;
    }

    if (form.originalAmount <= 0) {
      Alert.alert('Error', 'Ingresa el monto original');
      return;
    }

    if (form.monthlyPayment <= 0) {
      Alert.alert('Error', 'Ingresa el valor de la cuota mensual');
      return;
    }

    if (form.totalInstallments <= 0) {
      Alert.alert('Error', 'Ingresa el número de cuotas');
      return;
    }

    setSaving(true);
    try {
      await DebtLoanRepository.create({
        userId,
        name: form.name.trim(),
        institution: form.institution.trim(),
        originalAmount: form.originalAmount,
        currentBalance: form.currentBalance || form.originalAmount,
        monthlyPayment: form.monthlyPayment,
        paymentDayOfMonth: form.paymentDayOfMonth,
        totalInstallments: form.totalInstallments,
        remainingInstallments: form.remainingInstallments || form.totalInstallments,
        interestRateMonthly: form.interestRateMonthly / 100, // Convert to decimal
        interestRateAnnual: form.interestRateAnnual / 100,
        startDate: form.startDate,
        isAutoDebit: form.isAutoDebit,
        cashflowClass: 'LIABILITY',
        isActive: true,
      });

      router.back();
    } catch (error) {
      console.error('Error creating loan:', error);
      Alert.alert('Error', 'No se pudo crear el préstamo');
    } finally {
      setSaving(false);
    }
  };

  const DayPicker = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <View style={styles.dayPickerContainer}>
      <Text style={styles.dayPickerLabel}>{label}</Text>
      <View style={styles.dayPicker}>
        {[1, 5, 10, 15, 20, 25, 28].map((day) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayOption, value === day && styles.dayOptionSelected]}
            onPress={() => onChange(day)}
          >
            <Text style={[styles.dayOptionText, value === day && styles.dayOptionTextSelected]}>
              {day}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuevo préstamo</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Calculator Toggle */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.calculatorToggle, showCalculator && styles.calculatorToggleActive]}
            onPress={() => setShowCalculator(!showCalculator)}
          >
            <MaterialCommunityIcons name="calculator" size={20} color={showCalculator ? colors.accentGreen : colors.textMuted} />
            <Text style={[styles.calculatorToggleText, showCalculator && styles.calculatorToggleTextActive]}>
              Calculadora de tasa de interés
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calculator */}
        {showCalculator && (
          <Card style={styles.calculatorCard}>
            <Text style={styles.calculatorTitle}>Calculadora de Tasa</Text>
            <Text style={styles.calculatorHint}>
              Ingresa los datos del préstamo para calcular la tasa de interés mensual
            </Text>

            <AmountInput
              label="Monto del préstamo"
              value={calculatorInput.principal}
              onChangeValue={(val) => setCalculatorInput({ ...calculatorInput, principal: val })}
            />

            <AmountInput
              label="Valor de la cuota mensual"
              value={calculatorInput.monthlyPayment}
              onChangeValue={(val) => setCalculatorInput({ ...calculatorInput, monthlyPayment: val })}
            />

            <Input
              label="Número de cuotas"
              value={calculatorInput.installments > 0 ? calculatorInput.installments.toString() : ''}
              onChangeText={(text) => setCalculatorInput({ ...calculatorInput, installments: parseInt(text) || 0 })}
              placeholder="Ej: 36"
              keyboardType="number-pad"
            />

            <Button variant="primary" onPress={handleCalculateRate} style={styles.calculateButton}>
              Calcular tasa
            </Button>

            {calculatorResult && (
              <View style={styles.resultBox}>
                <Text style={styles.resultLabel}>Tasa mensual efectiva</Text>
                <Text style={styles.resultValue}>{calculatorResult.rate.toFixed(2)}%</Text>
                <Text style={styles.resultLabel}>Tasa anual efectiva</Text>
                <Text style={styles.resultValue}>{calculatorResult.effectiveAnnual.toFixed(2)}%</Text>
              </View>
            )}
          </Card>
        )}

        {/* Name */}
        <View style={styles.section}>
          <Input
            label="Nombre del préstamo"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Ej: Préstamo de vehículo"
          />
        </View>

        {/* Institution */}
        <View style={styles.section}>
          <Input
            label="Institución"
            value={form.institution}
            onChangeText={(text) => setForm({ ...form, institution: text })}
            placeholder="Ej: Banco de Bogotá"
          />
        </View>

        {/* Original Amount */}
        <View style={styles.section}>
          <AmountInput
            label="Monto original"
            value={form.originalAmount}
            onChangeValue={(val) => setForm({ ...form, originalAmount: val })}
          />
        </View>

        {/* Monthly Payment */}
        <View style={styles.section}>
          <AmountInput
            label="Valor de la cuota mensual"
            value={form.monthlyPayment}
            onChangeValue={(val) => setForm({ ...form, monthlyPayment: val })}
          />
        </View>

        {/* Total Installments */}
        <View style={styles.section}>
          <Input
            label="Número total de cuotas"
            value={form.totalInstallments > 0 ? form.totalInstallments.toString() : ''}
            onChangeText={(text) => setForm({ ...form, totalInstallments: parseInt(text) || 0 })}
            placeholder="Ej: 36"
            keyboardType="number-pad"
          />
        </View>

        {/* Remaining Installments */}
        <View style={styles.section}>
          <Input
            label="Cuotas restantes"
            value={form.remainingInstallments > 0 ? form.remainingInstallments.toString() : ''}
            onChangeText={(text) => setForm({ ...form, remainingInstallments: parseInt(text) || 0 })}
            placeholder="Ej: 30"
            keyboardType="number-pad"
          />
        </View>

        {/* Payment Day */}
        <View style={styles.section}>
          <DayPicker
            label="Día de pago del mes"
            value={form.paymentDayOfMonth}
            onChange={(v) => setForm({ ...form, paymentDayOfMonth: v })}
          />
        </View>

        {/* Interest Rate (manual override) */}
        <View style={styles.section}>
          <Input
            label="Tasa de interés mensual (%) - opcional"
            value={form.interestRateMonthly > 0 ? form.interestRateMonthly.toString() : ''}
            onChangeText={(text) => setForm({ ...form, interestRateMonthly: parseFloat(text) || 0 })}
            placeholder="Se llena con calculadora o manualmente"
            keyboardType="decimal-pad"
          />
          {calculatorResult && (
            <Text style={styles.hint}>
              Calculada: {calculatorResult.rate.toFixed(2)}% mensual
            </Text>
          )}
        </View>

        {/* Auto Debit Toggle */}
        <View style={styles.section}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Text style={styles.toggleLabel}>Débito automático</Text>
              <Text style={styles.toggleHint}>Pago automático activado con el banco</Text>
            </View>
            <Switch
              value={form.isAutoDebit}
              onValueChange={(val) => setForm({ ...form, isAutoDebit: val })}
              trackColor={{ false: colors.surface3, true: colors.accentGreen }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="ghost" onPress={() => router.back()} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onPress={handleSave} loading={saving}>
          Crear préstamo
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
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  hint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
  calculatorToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12, gap: spacing.md },
  calculatorToggleActive: { backgroundColor: colors.accentGreen + '15', borderWidth: 1, borderColor: colors.accentGreen },
  calculatorToggleText: { fontSize: typography.fontSize.md, color: colors.textMuted, fontWeight: typography.fontWeight.medium },
  calculatorToggleTextActive: { color: colors.accentGreen },
  calculatorCard: { marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.lg },
  calculatorTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.xs },
  calculatorHint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.lg },
  calculateButton: { marginTop: spacing.lg },
  resultBox: { marginTop: spacing.lg, padding: spacing.md, backgroundColor: colors.accentGreen + '15', borderRadius: 12, alignItems: 'center' },
  resultLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  resultValue: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.accentGreen },
  dayPickerContainer: { marginBottom: spacing.md },
  dayPickerLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: typography.fontWeight.medium },
  dayPicker: { flexDirection: 'row', justifyContent: 'space-between' },
  dayOption: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  dayOptionSelected: { backgroundColor: colors.accentGreen },
  dayOptionText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  dayOptionTextSelected: { color: '#fff', fontWeight: typography.fontWeight.medium },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  toggleHint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
