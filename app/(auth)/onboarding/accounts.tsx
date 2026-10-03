import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, Input } from '../../../src/components/ui';
import { AmountInput } from '../../../src/components/forms';
import { colors, spacing, typography } from '../../../src/theme';
import { useUserId } from '../../../src/store/useUserStore';
import { AccountRepository } from '../../../src/database/repositories/accountRepository';
import { TransactionRepository } from '../../../src/database/repositories/transactionRepository';
import type { Account } from '../../../src/database/schema';

const ACCOUNT_TYPES = [
  { value: 'CHECKING', label: 'Nómina/Corriente', icon: 'bank' },
  { value: 'SAVINGS', label: 'Ahorros', icon: 'piggy-bank' },
  { value: 'POCKET', label: 'Bolsillo digital', icon: 'wallet' },
  { value: 'INVESTMENT', label: 'Inversión', icon: 'chart-line' },
  { value: 'CASH', label: 'Efectivo', icon: 'cash' },
  { value: 'OTHER', label: 'Otra', icon: 'dots-horizontal' },
] as const;

interface AccountForm {
  id: string;
  name: string;
  type: 'CHECKING' | 'SAVINGS' | 'POCKET' | 'INVESTMENT' | 'CASH' | 'OTHER';
  initialBalance: number;
  color: string;
}

const ACCOUNT_COLORS = [
  '#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#06B6D4',
];

export default function AccountsScreen() {
  const router = useRouter();
  const userId = useUserId();
  const [accounts, setAccounts] = useState<AccountForm[]>([
    { id: '1', name: '', type: 'CHECKING', initialBalance: 0, color: ACCOUNT_COLORS[0] },
  ]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addAccount = () => {
    if (accounts.length >= 5) return; // Max 5 accounts in onboarding
    const newColor = ACCOUNT_COLORS[accounts.length % ACCOUNT_COLORS.length];
    setAccounts([
      ...accounts,
      { id: Date.now().toString(), name: '', type: 'CHECKING', initialBalance: 0, color: newColor },
    ]);
  };

  const removeAccount = (id: string) => {
    if (accounts.length <= 1) return;
    setAccounts(accounts.filter((a) => a.id !== id));
  };

  const updateAccount = (id: string, field: keyof AccountForm, value: any) => {
    setAccounts(
      accounts.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    accounts.forEach((acc, index) => {
      if (!acc.name.trim()) {
        newErrors[`name_${acc.id}`] = 'El nombre es requerido';
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      for (const acc of accounts) {
        if (!acc.name.trim()) continue;

        // Create the account
        const newAccount = await AccountRepository.create({
          userId,
          name: acc.name.trim(),
          type: acc.type,
          institution: null,
          color: acc.color,
          icon: ACCOUNT_TYPES.find((t) => t.value === acc.type)?.icon || 'wallet',
          cashflowClass: 'NEUTRAL',
          isActive: true,
          order: accounts.indexOf(acc),
        });

        // If there's an initial balance, create an INCOME transaction
        if (acc.initialBalance > 0) {
          await TransactionRepository.create({
            userId,
            accountId: newAccount.id,
            pocketId: null,
            type: 'INCOME',
            amount: acc.initialBalance,
            description: 'Saldo inicial',
            date: new Date(),
            status: 'CONFIRMED',
            isConfirmed: true,
          });
        }
      }

      router.push('/onboarding/income');
    } catch (error) {
      console.error('Error saving accounts:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.step}>Paso 1 de 4</Text>
          <Text style={styles.title}>¿Dónde está tu dinero?</Text>
          <Text style={styles.subtitle}>
            Agrega tus cuentas financieras. Empieza con una o agrega varias.
          </Text>
        </View>

        {/* Accounts form */}
        {accounts.map((account, index) => (
          <Card key={account.id} style={styles.accountCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Cuenta {index + 1}</Text>
              {accounts.length > 1 && (
                <TouchableOpacity onPress={() => removeAccount(account.id)}>
                  <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Name input */}
            <Input
              label="Nombre"
              value={account.name}
              onChangeText={(text) => updateAccount(account.id, 'name', text)}
              placeholder="Ej: Banco Falabella"
              error={errors[`name_${account.id}`]}
            />

            {/* Type selector */}
            <Text style={styles.fieldLabel}>Tipo de cuenta</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
              {ACCOUNT_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeItem,
                    account.type === type.value && styles.typeItemSelected,
                  ]}
                  onPress={() => updateAccount(account.id, 'type', type.value)}
                >
                  <MaterialCommunityIcons
                    name={type.icon as any}
                    size={20}
                    color={account.type === type.value ? colors.accentGreen : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      account.type === type.value && styles.typeLabelSelected,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Color selector */}
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.colorRow}>
              {ACCOUNT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorItem,
                    { backgroundColor: color },
                    account.color === color && styles.colorItemSelected,
                  ]}
                  onPress={() => updateAccount(account.id, 'color', color)}
                >
                  {account.color === color && (
                    <MaterialCommunityIcons name="check" size={16} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Initial balance */}
            <AmountInput
              label="Saldo inicial (opcional)"
              value={account.initialBalance}
              onChangeValue={(val) => updateAccount(account.id, 'initialBalance', val)}
              placeholder="0"
            />
          </Card>
        ))}

        {/* Add another account */}
        {accounts.length < 5 && (
          <TouchableOpacity style={styles.addButton} onPress={addAccount}>
            <MaterialCommunityIcons name="plus" size={20} color={colors.accentGreen} />
            <Text style={styles.addButtonText}>Agregar otra cuenta</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          variant="ghost"
          onPress={() => router.push('/onboarding/income')}
          disabled={saving}
        >
          Omitir
        </Button>
        <Button variant="primary" onPress={handleNext} loading={saving}>
          Siguiente
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  header: {
    marginBottom: spacing.xl,
  },
  step: {
    fontSize: typography.fontSize.sm,
    color: colors.accentGreen,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
  },
  accountCard: {
    marginBottom: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    fontWeight: typography.fontWeight.medium,
  },
  typeScroll: {
    marginBottom: spacing.md,
  },
  typeItem: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    marginRight: spacing.sm,
    minWidth: 90,
  },
  typeItemSelected: {
    backgroundColor: colors.surface3,
    borderWidth: 1,
    borderColor: colors.accentGreen,
  },
  typeLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  typeLabelSelected: {
    color: colors.accentGreen,
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  colorItem: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorItemSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    borderStyle: 'dashed',
    gap: spacing.sm,
  },
  addButtonText: {
    fontSize: typography.fontSize.md,
    color: colors.accentGreen,
    fontWeight: typography.fontWeight.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
