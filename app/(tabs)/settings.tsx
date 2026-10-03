import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Button, Divider } from '../../src/components/ui';
import { Modal } from '../../src/components/ui/Modal';
import { Input } from '../../src/components/ui/Input';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import { useBudget } from '../../src/hooks/useBudget';
import { useDebts } from '../../src/hooks/useDebts';
import { useIntegrityCheck } from '../../src/hooks/useIntegrityCheck';

export default function SettingsScreen() {
  const user = useUserStore((s) => s.user);
  const updateUser = useUserStore((s) => s.updateUser);
  const resetStore = useUserStore((s) => s.reset);
  const { accounts } = useAccounts();
  const { pockets } = usePockets();
  const { budgets } = useBudget();
  const { debts } = useDebts();
  const { integrityStatus, checkIntegrity } = useIntegrityCheck();
  const [editNameModal, setEditNameModal] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [budgetModal, setBudgetModal] = useState(false);
  const [newBudget, setNewBudget] = useState({ name: '', amount: 0 });

  const handleSaveName = () => {
    if (newName.trim()) {
      updateUser({ name: newName.trim() });
    }
    setEditNameModal(false);
  };

  const handleCreateBudget = async () => {
    if (!newBudget.name.trim() || newBudget.amount <= 0 || !user) return;

    // Stub: BudgetRepository was removed (ticket C-01). Per-category budget
    // entity has no schema/service equivalent in the codebase yet.
    console.warn('[stub] BudgetRepository.create not implemented — see ticket C-01');

    setNewBudget({ name: '', amount: 0 });
    setBudgetModal(false);
  };

  const handleResetData = () => {
    Alert.alert(
      'Borrar todos los datos',
      'Esto eliminará todas tus cuentas, transacciones, bolsillos y presupuestos. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar todo',
          style: 'destructive',
          onPress: async () => {
            Alert.alert('Función no implementada', 'Contacta al desarrollador');
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: () => {
            resetStore();
          },
        },
      ]
    );
  };

  const SettingItem = ({
    icon,
    label,
    value,
    onPress,
    danger = false,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    danger?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.settingIcon}>
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={danger ? colors.accentRed : colors.textPrimary}
        />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, danger && styles.dangerText]}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {onPress && (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
        </View>

        <Card style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Usuario'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'Sin email'}</Text>
            </View>
            <TouchableOpacity onPress={() => { setNewName(user?.name || ''); setEditNameModal(true); }}>
              <MaterialCommunityIcons name="pencil" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Resumen de datos</Text>

          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{accounts.length}</Text>
              <Text style={styles.statLabel}>Cuentas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pockets.length}</Text>
              <Text style={styles.statLabel}>Bolsillos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{budgets.length}</Text>
              <Text style={styles.statLabel}>Presupuestos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{debts.length}</Text>
              <Text style={styles.statLabel}>Deudas</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.integrityCheck} onPress={checkIntegrity}>
            <MaterialCommunityIcons
              name={integrityStatus?.isValid ? 'check-circle' : 'alert-circle'}
              size={20}
              color={integrityStatus?.isValid ? colors.accentGreen : colors.accentYellow}
            />
            <Text style={styles.integrityText}>
              {integrityStatus?.isValid
                ? 'Integridad verificada'
                : 'Verificar integridad de datos'}
            </Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Presupuestos</Text>
            <TouchableOpacity onPress={() => setBudgetModal(true)}>
              <MaterialCommunityIcons name="plus" size={20} color={colors.accentGreen} />
            </TouchableOpacity>
          </View>

          {budgets.length === 0 ? (
            <Text style={styles.emptyText}>No tienes presupuestos</Text>
          ) : (
            budgets.map((budget) => (
              <View key={budget.id} style={styles.budgetItem}>
                <Text style={styles.budgetName}>{budget.name}</Text>
                <Text style={styles.budgetAmount}>
                  {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(budget.amount)}
                </Text>
              </View>
            ))
          )}
        </Card>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Cuentas</Text>

          {accounts.map((account) => (
            <View key={account.id} style={styles.accountItem}>
              <View style={styles.accountInfo}>
                <MaterialCommunityIcons
                  name={account.type === 'BANK' ? 'bank' : 'cash'}
                  size={20}
                  color={colors.textPrimary}
                />
                <Text style={styles.accountName}>{account.name}</Text>
              </View>
              <Text style={styles.accountBalance}>
                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(account.balance || 0)}
              </Text>
            </View>
          ))}

          <TouchableOpacity style={styles.addAccountButton}>
            <MaterialCommunityIcons name="plus" size={20} color={colors.accentGreen} />
            <Text style={styles.addAccountText}>Agregar cuenta</Text>
          </TouchableOpacity>
        </Card>

        <Card style={styles.card}>
          <Text style={[styles.sectionTitle, styles.dangerText]}>Zona de peligro</Text>

          <SettingItem
            icon="delete"
            label="Borrar todos los datos"
            onPress={handleResetData}
            danger
          />

          <Divider />

          <SettingItem
            icon="logout"
            label="Cerrar sesión"
            onPress={handleSignOut}
            danger
          />
        </Card>

        <View style={styles.appInfo}>
          <Text style={styles.appName}>Financial Flow</Text>
          <Text style={styles.appVersion}>Versión 1.0.0</Text>
        </View>
      </ScrollView>

      <Modal visible={editNameModal} onClose={() => setEditNameModal(false)} title="Editar nombre">
        <Input
          label="Nombre"
          value={newName}
          onChangeText={setNewName}
          placeholder="Tu nombre"
        />
        <View style={styles.modalFooter}>
          <Button variant="ghost" onPress={() => setEditNameModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onPress={handleSaveName}>
            Guardar
          </Button>
        </View>
      </Modal>

      <Modal visible={budgetModal} onClose={() => setBudgetModal(false)} title="Nuevo Presupuesto">
        <Input
          label="Nombre"
          value={newBudget.name}
          onChangeText={(text) => setNewBudget({ ...newBudget, name: text })}
          placeholder="Ej: Comida del mes"
        />
        <View style={{ marginTop: spacing.md }}>
          <Text style={styles.inputLabel}>Monto límite</Text>
          <View style={styles.amountInput}>
            <Text style={styles.currencySymbol}>$</Text>
            <Text style={styles.amountText}>
              {new Intl.NumberFormat('es-CO').format(newBudget.amount)}
            </Text>
          </View>
        </View>
        <View style={styles.modalFooter}>
          <Button variant="ghost" onPress={() => setBudgetModal(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onPress={handleCreateBudget}>
            Crear
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  profileHeader: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentGreen, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  profileEmail: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '25%', alignItems: 'center', paddingVertical: spacing.sm },
  statValue: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.fontSize.xs, color: colors.textMuted, marginTop: 2 },
  integrityCheck: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  integrityText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  emptyText: { fontSize: typography.fontSize.md, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  budgetItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  budgetName: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  budgetAmount: { fontSize: typography.fontSize.md, color: colors.textMuted },
  accountItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm },
  accountInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  accountName: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  accountBalance: { fontSize: typography.fontSize.md, color: colors.textMuted },
  addAccountButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: 8, marginTop: spacing.sm, borderStyle: 'dashed', gap: spacing.xs },
  addAccountText: { fontSize: typography.fontSize.md, color: colors.accentGreen },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  settingIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  settingInfo: { flex: 1 },
  settingLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  settingValue: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  dangerText: { color: colors.accentRed },
  appInfo: { alignItems: 'center', paddingVertical: spacing.xl },
  appName: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.medium, color: colors.textMuted },
  appVersion: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.xl },
  inputLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs },
  amountInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface2, padding: spacing.md, borderRadius: 8 },
  currencySymbol: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginRight: spacing.xs },
  amountText: { fontSize: typography.fontSize.xl, color: colors.textPrimary, fontWeight: typography.fontWeight.bold, flex: 1 },
});
