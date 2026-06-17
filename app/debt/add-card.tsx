import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/ui';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { DebtCardRepository } from '../../src/database/repositories/debtCardRepository';

export default function AddCardScreen() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);

  const [form, setForm] = useState({
    name: '',
    institution: '',
    creditLimit: 0,
    usedAmount: 0,
    cutoffDay: 15,
    paymentDay: 25,
    interestRateMonthly: 0,
    minPaymentPercent: 5,
    isAutoDebit: false,
  });

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Error', 'Ingresa el nombre de la tarjeta');
      return;
    }

    if (!form.institution.trim()) {
      Alert.alert('Error', 'Ingresa la institución');
      return;
    }

    if (form.creditLimit <= 0) {
      Alert.alert('Error', 'Ingresa el cupo de la tarjeta');
      return;
    }

    setSaving(true);
    try {
      await DebtCardRepository.create({
        userId,
        name: form.name.trim(),
        institution: form.institution.trim(),
        creditLimit: form.creditLimit,
        usedAmount: form.usedAmount,
        cutoffDay: form.cutoffDay,
        paymentDay: form.paymentDay,
        interestRateMonthly: form.interestRateMonthly / 100, // Convert to decimal
        minPaymentPercent: form.minPaymentPercent,
        isAutoDebit: form.isAutoDebit,
        cashflowClass: 'LIABILITY',
        isActive: true,
      });

      router.back();
    } catch (error) {
      console.error('Error creating card:', error);
      Alert.alert('Error', 'No se pudo crear la tarjeta');
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
          <Text style={styles.headerTitle}>Nueva tarjeta</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Input
            label="Nombre de la tarjeta"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Ej: Mastercard Bancolombia"
          />
        </View>

        {/* Institution */}
        <View style={styles.section}>
          <Input
            label="Institución"
            value={form.institution}
            onChangeText={(text) => setForm({ ...form, institution: text })}
            placeholder="Ej: Bancolombia"
          />
        </View>

        {/* Credit Limit */}
        <View style={styles.section}>
          <AmountInput
            label="Cupo total"
            value={form.creditLimit}
            onChangeValue={(val) => setForm({ ...form, creditLimit: val })}
          />
        </View>

        {/* Current Used Amount */}
        <View style={styles.section}>
          <AmountInput
            label="Deuda actual (opcional)"
            value={form.usedAmount}
            onChangeValue={(val) => setForm({ ...form, usedAmount: val })}
          />
          <Text style={styles.hint}>Si tienes saldo pendiente, ingrésalo aquí</Text>
        </View>

        {/* Cutoff Day */}
        <View style={styles.section}>
          <DayPicker
            label="Día de corte"
            value={form.cutoffDay}
            onChange={(v) => setForm({ ...form, cutoffDay: v })}
          />
        </View>

        {/* Payment Day */}
        <View style={styles.section}>
          <DayPicker
            label="Día de pago"
            value={form.paymentDay}
            onChange={(v) => setForm({ ...form, paymentDay: v })}
          />
        </View>

        {/* Interest Rate */}
        <View style={styles.section}>
          <Input
            label="Tasa de interés mensual (%)"
            value={form.interestRateMonthly > 0 ? form.interestRateMonthly.toString() : ''}
            onChangeText={(text) => setForm({ ...form, interestRateMonthly: parseFloat(text) || 0 })}
            placeholder="Ej: 3.5"
            keyboardType="decimal-pad"
          />
        </View>

        {/* Min Payment Percent */}
        <View style={styles.section}>
          <Input
            label="Pago mínimo (% del saldo)"
            value={form.minPaymentPercent.toString()}
            onChangeText={(text) => setForm({ ...form, minPaymentPercent: parseFloat(text) || 0 })}
            placeholder="Ej: 5"
            keyboardType="decimal-pad"
          />
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
          Crear tarjeta
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
