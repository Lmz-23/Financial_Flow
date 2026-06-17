import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Button } from '../../src/components/ui';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { useAccounts } from '../../src/hooks/useAccounts';
import { AccountRepository } from '../../src/database/repositories/accountRepository';
import type { Account } from '../../src/database/schema';

const ACCOUNT_TYPES = [
  { id: 'CHECKING', name: 'Cuenta Corriente', icon: 'bank' },
  { id: 'SAVINGS', name: 'Ahorros', icon: 'piggy-bank' },
  { id: 'INVESTMENT', name: 'Inversión', icon: 'chart-line' },
  { id: 'CASH', name: 'Efectivo', icon: 'cash' },
  { id: 'POCKET', name: 'Bolsillo', icon: 'wallet' },
  { id: 'OTHER', name: 'Otro', icon: 'dots-horizontal-circle' },
];

const ICONS = [
  { id: 'bank', name: 'Banco' },
  { id: 'piggy-bank', name: 'Ahorro' },
  { id: 'chart-line', name: 'Inversión' },
  { id: 'cash', name: 'Efectivo' },
  { id: 'wallet', name: 'Bolsillo' },
  { id: 'credit-card', name: 'Tarjeta' },
  { id: 'home', name: 'Hogar' },
  { id: 'car', name: 'Vehículo' },
];

const ACCOUNT_COLORS = [
  colors.accentBlue,
  colors.accentGreen,
  colors.accentRed,
  colors.accentYellow,
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
];

export default function AddAccountModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const userId = useUserStore((s) => s.userId);
  const { accounts, refresh } = useAccounts();
  const isEditing = !!id;

  const existingAccount = accounts.find((a) => a.id === id);

  const [form, setForm] = useState({
    name: '',
    type: 'CHECKING' as Account['type'],
    icon: 'bank',
    color: colors.accentBlue,
    institution: '',
    cashflowClass: 'NEUTRAL' as 'ASSET' | 'NEUTRAL',
    isPassiveIncome: false,
    balance: 0,
  });

  const [saving, setSaving] = useState(false);

  // Load existing account data if editing
  useEffect(() => {
    if (existingAccount) {
      setForm({
        name: existingAccount.name,
        type: existingAccount.type,
        icon: existingAccount.icon || 'bank',
        color: existingAccount.color || colors.accentBlue,
        institution: existingAccount.institution || '',
        cashflowClass: existingAccount.cashflowClass || 'NEUTRAL',
        isPassiveIncome: existingAccount.cashflowClass === 'ASSET',
        balance: 0,
      });
    }
  }, [existingAccount]);

  const isInvestment = form.type === 'INVESTMENT';

  const handleSave = async () => {
    if (!form.name.trim()) return;

    setSaving(true);
    try {
      const cashflowClass = form.isPassiveIncome ? 'ASSET' : form.type === 'INVESTMENT' ? 'ASSET' : 'NEUTRAL';

      if (isEditing && id) {
        await AccountRepository.update(id, {
          name: form.name.trim(),
          type: form.type,
          icon: form.icon,
          color: form.color,
          institution: form.institution.trim() || null,
          cashflowClass,
        });
      } else {
        await AccountRepository.create({
          userId,
          name: form.name.trim(),
          type: form.type,
          icon: form.icon,
          color: form.color,
          institution: form.institution.trim() || null,
          cashflowClass,
          balance: 0,
          isActive: true,
          order: 0,
        });

        // If initial balance, create an INCOME transaction
        if (form.balance > 0) {
          const { TransactionRepository } = await import('../../src/database/repositories/transactionRepository');
          const newAccount = (await import('../../src/database/repositories/accountRepository')).AccountRepository;
          // Find the just-created account
          const allAccounts = await import('../../src/hooks/useAccounts').then(m => m.useAccounts());
        }
      }

      refresh();
      router.back();
    } catch (error) {
      console.error('Error saving account:', error);
    } finally {
      setSaving(false);
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
          <Text style={styles.headerTitle}>{isEditing ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Account Type */}
        <View style={styles.section}>
          <Text style={styles.label}>Tipo de cuenta</Text>
          <View style={styles.typeGrid}>
            {ACCOUNT_TYPES.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={[styles.typeCard, form.type === type.id && styles.typeCardSelected]}
                onPress={() => setForm({ ...form, type: type.id as Account['type'] })}
              >
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={24}
                  color={form.type === type.id ? colors.accentGreen : colors.textMuted}
                />
                <Text style={[styles.typeName, form.type === type.id && styles.typeNameSelected]}>
                  {type.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Name */}
        <View style={styles.section}>
          <Input
            label="Nombre de la cuenta"
            value={form.name}
            onChangeText={(text) => setForm({ ...form, name: text })}
            placeholder="Ej: Cuenta de ahorros Bancolombia"
          />
        </View>

        {/* Institution */}
        <View style={styles.section}>
          <Input
            label="Institución (opcional)"
            value={form.institution}
            onChangeText={(text) => setForm({ ...form, institution: text })}
            placeholder="Ej: Bancolombia, Davivienda"
          />
        </View>

        {/* Icon */}
        <View style={styles.section}>
          <Text style={styles.label}>Ícono</Text>
          <View style={styles.iconGrid}>
            {ICONS.map((icon) => (
              <TouchableOpacity
                key={icon.id}
                style={[styles.iconCard, form.icon === icon.id && styles.iconCardSelected]}
                onPress={() => setForm({ ...form, icon: icon.id })}
              >
                <MaterialCommunityIcons
                  name={icon.id as any}
                  size={24}
                  color={form.icon === icon.id ? colors.accentGreen : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color */}
        <View style={styles.section}>
          <Text style={styles.label}>Color</Text>
          <View style={styles.colorGrid}>
            {ACCOUNT_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorCard,
                  { backgroundColor: color },
                  form.color === color && styles.colorCardSelected,
                ]}
                onPress={() => setForm({ ...form, color })}
              >
                {form.color === color && (
                  <MaterialCommunityIcons name="check" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Investment: Passive Income Toggle */}
        {isInvestment && (
          <View style={styles.section}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleLabel}>¿Genera ingreso pasivo?</Text>
                <Text style={styles.toggleHint}>
                  Si esta inversión genera rendimientos (dividendos, intereses), actívala
                </Text>
              </View>
              <Switch
                value={form.isPassiveIncome}
                onValueChange={(val) => setForm({ ...form, isPassiveIncome: val })}
                trackColor={{ false: colors.surface3, true: colors.accentGreen }}
                thumbColor="#fff"
              />
            </View>
            {form.isPassiveIncome && (
              <View style={styles.infoBox}>
                <MaterialCommunityIcons name="information" size={16} color={colors.accentBlue} />
                <Text style={styles.infoText}>
                  Esta cuenta se clasificará como ACTIVO en tu Cash Flow
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Initial Balance (only for new accounts) */}
        {!isEditing && (
          <View style={styles.section}>
            <AmountInput
              label="Saldo inicial"
              value={form.balance}
              onChangeValue={(val) => setForm({ ...form, balance: val })}
            />
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="ghost" onPress={() => router.back()} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="primary" onPress={handleSave} loading={saving}>
          {isEditing ? 'Guardar' : 'Crear cuenta'}
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
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  label: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: typography.fontWeight.medium },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeCard: { width: '31%', padding: spacing.md, borderRadius: 12, backgroundColor: colors.surface2, alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  typeCardSelected: { borderColor: colors.accentGreen, backgroundColor: colors.accentGreen + '10' },
  typeName: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'center' },
  typeNameSelected: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  iconCard: { width: 48, height: 48, borderRadius: 12, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent' },
  iconCardSelected: { borderColor: colors.accentGreen, backgroundColor: colors.accentGreen + '10' },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  colorCard: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  colorCardSelected: { borderWidth: 3, borderColor: '#fff' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 12 },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  toggleHint: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.accentBlue + '15', padding: spacing.md, borderRadius: 8, marginTop: spacing.sm, gap: spacing.sm },
  infoText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.accentBlue },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
