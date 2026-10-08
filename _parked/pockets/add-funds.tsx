import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Card, Button } from '../../src/components/ui';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePocketsGroupedByAccount } from '../../src/hooks/usePockets';
import { TransactionRepository } from '../../src/database/repositories/transactionRepository';

export default function AddFundsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; pocketId?: string }>();
  const userId = useUserStore((s) => s.userId);
  const { accounts } = useAccounts();
  const { accounts: accountsWithPockets, refetch } = usePocketsGroupedByAccount();

  const [form, setForm] = useState({
    amount: 0,
    description: '',
    fromAccountId: '',
    fromPocketId: null as string | null,
    toAccountId: params.accountId || '',
    toPocketId: params.pocketId || null as string | null,
  });

  const [loading, setLoading] = useState(false);

  // Get pockets for selected accounts
  const fromAccount = accountsWithPockets.find((a) => a.id === form.fromAccountId);
  const toAccount = accountsWithPockets.find((a) => a.id === form.toAccountId);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const handleSave = async () => {
    if (form.amount <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }

    if (!form.fromAccountId) {
      Alert.alert('Error', 'Selecciona una cuenta de origen');
      return;
    }

    setLoading(true);
    try {
      const isSameAccount = form.fromAccountId === form.toAccountId;

      // Use createTransfer for same-account (pocket redistribution) or cross-account
      await TransactionRepository.createTransfer(
        form.fromAccountId,
        form.toAccountId,
        form.amount,
        {
          description: form.description || 'Transferencia a bolsillo',
          fromPocketId: form.fromPocketId,
          toPocketId: form.toPocketId,
          userId,
        }
      );

      Alert.alert('Éxito', 'Fondos agregados correctamente', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error adding funds:', error);
      Alert.alert('Error', 'No se pudieron agregar los fondos');
    } finally {
      setLoading(false);
    }
  };

  const handleFromAccountChange = (accountId: string) => {
    setForm({
      ...form,
      fromAccountId: accountId,
      fromPocketId: null, // Reset pocket when account changes
    });
  };

  const handleToAccountChange = (accountId: string) => {
    setForm({
      ...form,
      toAccountId: accountId,
      toPocketId: null, // Reset pocket when account changes
    });
  };

  const renderAccountOption = (account: typeof accountsWithPockets[0], selected: boolean, onSelect: () => void) => (
    <TouchableOpacity
      key={account.id}
      style={[styles.accountOption, selected && styles.accountOptionSelected]}
      onPress={onSelect}
    >
      <MaterialCommunityIcons
        name="bank"
        size={20}
        color={selected ? colors.accentGreen : colors.textMuted}
      />
      <Text style={[styles.accountOptionText, selected && styles.accountOptionTextSelected]}>
        {account.name}
      </Text>
      {selected && <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />}
    </TouchableOpacity>
  );

  const renderPocketOption = (
    pocket: { id: string; name: string; balance: number } | { name: string; balance: number; id?: string },
    selected: boolean,
    onSelect: () => void,
    isImplicit: boolean = false
  ) => (
    <TouchableOpacity
      key={isImplicit ? 'implicit' : pocket.id}
      style={[styles.pocketOption, selected && styles.pocketOptionSelected]}
      onPress={onSelect}
    >
      <View style={[styles.pocketColor, { backgroundColor: isImplicit ? colors.textMuted : (pocket as any).color || colors.accentBlue }]} />
      <View style={styles.pocketOptionInfo}>
        <Text style={[styles.pocketOptionText, selected && styles.pocketOptionTextSelected]}>
          {pocket.name}
        </Text>
        <Text style={styles.pocketOptionBalance}>{formatCurrency(pocket.balance)}</Text>
      </View>
      {selected && <MaterialCommunityIcons name="check" size={20} color={colors.accentGreen} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Agregar fondos</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Amount */}
        <View style={styles.section}>
          <AmountInput
            label="Monto a agregar"
            value={form.amount}
            onChangeValue={(val) => setForm({ ...form, amount: val })}
          />
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Input
            label="Descripción (opcional)"
            value={form.description}
            onChangeText={(text) => setForm({ ...form, description: text })}
            placeholder="Ej: Ahorro para vacaciones"
          />
        </View>

        {/* Destination Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cuenta destino</Text>
          <Card style={styles.optionsCard}>
            {accountsWithPockets.map((account) =>
              renderAccountOption(account, form.toAccountId === account.id, () => handleToAccountChange(account.id))
            )}
          </Card>
        </View>

        {/* Destination Pocket */}
        {toAccount && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bolsillo destino</Text>
            <Card style={styles.optionsCard}>
              {/* Sin asignar option */}
              {renderPocketOption(
                { id: null, name: 'Sin asignar', balance: toAccount.pockets.implicit.balance },
                form.toPocketId === null,
                () => setForm({ ...form, toPocketId: null }),
                true
              )}
              {/* Explicit pockets */}
              {toAccount.pockets.explicit.map((pocket) =>
                renderPocketOption(pocket, form.toPocketId === pocket.id, () => setForm({ ...form, toPocketId: pocket.id }))
              )}
            </Card>
          </View>
        )}

        {/* Source Account */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Cuenta origen</Text>
          <Card style={styles.optionsCard}>
            {accountsWithPockets.map((account) =>
              renderAccountOption(account, form.fromAccountId === account.id, () => handleFromAccountChange(account.id))
            )}
          </Card>
        </View>

        {/* Source Pocket (if same account) */}
        {fromAccount && form.fromAccountId === form.toAccountId && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Bolsillo origen</Text>
            <Card style={styles.optionsCard}>
              {/* Sin asignar option */}
              {renderPocketOption(
                { id: null, name: 'Sin asignar', balance: fromAccount.pockets.implicit.balance },
                form.fromPocketId === null,
                () => setForm({ ...form, fromPocketId: null }),
                true
              )}
              {/* Explicit pockets - exclude the destination pocket */}
              {fromAccount.pockets.explicit
                .filter((p) => p.id !== form.toPocketId)
                .map((pocket) =>
                  renderPocketOption(pocket, form.fromPocketId === pocket.id, () => setForm({ ...form, fromPocketId: pocket.id }))
                )}
            </Card>
          </View>
        )}

        {/* Info */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information" size={20} color={colors.accentBlue} />
          <Text style={styles.infoText}>
            Los fondos se moverán de un bolsillo a otro. Esta operación no afecta el saldo total de la cuenta.
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="ghost" onPress={() => router.back()} disabled={loading}>
          Cancelar
        </Button>
        <Button variant="primary" onPress={handleSave} loading={loading}>
          Agregar {form.amount > 0 ? formatCurrency(form.amount) : ''}
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
  sectionLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.sm, fontWeight: typography.fontWeight.medium },
  optionsCard: { padding: spacing.xs },
  accountOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, gap: spacing.md },
  accountOptionSelected: { backgroundColor: colors.accentGreen + '10' },
  accountOptionText: { flex: 1, fontSize: typography.fontSize.md, color: colors.textPrimary },
  accountOptionTextSelected: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  pocketOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, gap: spacing.md },
  pocketOptionSelected: { backgroundColor: colors.accentGreen + '10' },
  pocketColor: { width: 12, height: 32, borderRadius: 6 },
  pocketOptionInfo: { flex: 1 },
  pocketOptionText: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  pocketOptionTextSelected: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  pocketOptionBalance: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.accentBlue + '15', marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.md, borderRadius: 12, gap: spacing.sm },
  infoText: { flex: 1, fontSize: typography.fontSize.sm, color: colors.accentBlue },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border },
});
