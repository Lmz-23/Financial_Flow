import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, FlatList, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Button, Modal, Input, ProgressBar } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { database } from '../../src/database';
import { distributionRules as distributionRulesTable, pockets, accounts } from '../../src/database/schema';
import { eq, and, desc } from 'drizzle-orm';
import type { DistributionRule, Pocket, Account } from '../../src/database/schema';
import { useUserStore } from '../../src/store/useUserStore';

const TARGET_TYPES = [
  { value: 'POCKET', label: 'Bolsillo', icon: 'wallet' },
  { value: 'ACCOUNT', label: 'Cuenta', icon: 'bank' },
  { value: 'SAVINGS', label: 'Ahorros', icon: 'piggy-bank' },
  { value: 'INVESTMENT', label: 'Inversión', icon: 'chart-line' },
] as const;

interface RuleFormData {
  name: string;
  percentage: string;
  targetType: 'POCKET' | 'ACCOUNT' | 'SAVINGS' | 'INVESTMENT';
  targetId: string;
}

export default function DistributionScreen() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const [rules, setRules] = useState<DistributionRule[]>([]);
  const [pocketsList, setPocketsList] = useState<Pocket[]>([]);
  const [accountsList, setAccountsList] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<DistributionRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>({
    name: '',
    percentage: '',
    targetType: 'POCKET',
    targetId: '',
  });

  const loadData = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);

      const [rulesData, pocketsData, accountsData] = await Promise.all([
        database.query.distributionRules.findMany({
          where: eq(distributionRulesTable.userId, userId),
          orderBy: [desc(distributionRulesTable.order)],
        }),
        database.query.pockets.findMany({
          where: eq(pockets.userId, userId),
        }),
        database.query.accounts.findMany({
          where: eq(accounts.userId, userId),
        }),
      ]);

      setRules(rulesData);
      setPocketsList(pocketsData);
      setAccountsList(accountsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeRulesTotal = rules
    .filter((r) => r.isActive)
    .reduce((sum, r) => sum + r.percentage, 0);

  const remainingPercentage = 100 - activeRulesTotal;

  const handleToggleActive = async (rule: DistributionRule) => {
    // If deactivating, allow
    // If activating, check if we have room
    if (!rule.isActive && remainingPercentage - rule.percentage < 0) {
      Alert.alert(
        'Límite alcanzado',
        `No hay suficiente espacio. La regla usa ${rule.percentage}% pero solo queda ${remainingPercentage}% disponible.`
      );
      return;
    }

    try {
      await database
        .update(distributionRulesTable)
        .set({ isActive: !rule.isActive })
        .where(eq(distributionRulesTable.id, rule.id));
      loadData();
    } catch (err) {
      console.error('Error toggling rule:', err);
      Alert.alert('Error', 'No se pudo actualizar la regla');
    }
  };

  const handleDeleteRule = (rule: DistributionRule) => {
    Alert.alert(
      'Eliminar regla',
      `¿Estás seguro de que quieres eliminar "${rule.name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await database
                .delete(distributionRulesTable)
                .where(eq(distributionRulesTable.id, rule.id));
              loadData();
            } catch (err) {
              console.error('Error deleting rule:', err);
              Alert.alert('Error', 'No se pudo eliminar la regla');
            }
          },
        },
      ]
    );
  };

  const handleOpenAddModal = () => {
    setEditingRule(null);
    setFormData({ name: '', percentage: '', targetType: 'POCKET', targetId: '' });
    setModalVisible(true);
  };

  const handleOpenEditModal = (rule: DistributionRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      percentage: rule.percentage.toString(),
      targetType: rule.targetType as 'POCKET' | 'ACCOUNT' | 'SAVINGS' | 'INVESTMENT',
      targetId: rule.targetId,
    });
    setModalVisible(true);
  };

  const getTargetName = (rule: DistributionRule): string => {
    if (rule.targetType === 'POCKET') {
      const pocket = pocketsList.find((p) => p.id === rule.targetId);
      return pocket?.name || 'Bolsillo';
    }
    if (rule.targetType === 'ACCOUNT') {
      const account = accountsList.find((a) => a.id === rule.targetId);
      return account?.name || 'Cuenta';
    }
    if (rule.targetType === 'SAVINGS') return 'Cuenta de ahorros';
    if (rule.targetType === 'INVESTMENT') return 'Inversión';
    return rule.targetId;
  };

  const getTargetIcon = (targetType: string): string => {
    const type = TARGET_TYPES.find((t) => t.value === targetType);
    return type?.icon || 'help-circle';
  };

  const validateForm = (): string | null => {
    if (!formData.name.trim()) return 'El nombre es obligatorio';
    const pct = parseFloat(formData.percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) return 'El porcentaje debe ser entre 1 y 100';
    
    const editingPct = editingRule?.percentage || 0;
    const availablePct = remainingPercentage + editingPct;
    if (pct > availablePct) {
      return `El porcentaje excede el límite. Disponible: ${availablePct.toFixed(1)}%`;
    }
    
    if (!formData.targetId) return 'Selecciona un destino';
    return null;
  };

  const handleSaveRule = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Error', error);
      return;
    }

    try {
      if (editingRule) {
        await database
          .update(distributionRulesTable)
          .set({
            name: formData.name.trim(),
            percentage: parseFloat(formData.percentage),
            targetType: formData.targetType,
            targetId: formData.targetId,
          })
          .where(eq(distributionRulesTable.id, editingRule.id));
      } else {
        const id = crypto.randomUUID();
        await database.insert(distributionRulesTable).values({
          id,
          userId,
          name: formData.name.trim(),
          percentage: parseFloat(formData.percentage),
          targetType: formData.targetType,
          targetId: formData.targetId,
          isActive: true,
          order: 0,
          createdAt: new Date(),
        });
      }
      setModalVisible(false);
      loadData();
    } catch (err) {
      console.error('Error saving rule:', err);
      Alert.alert('Error', 'No se pudo guardar la regla');
    }
  };

  const renderRuleItem = (rule: DistributionRule) => (
    <Card key={rule.id} style={styles.ruleCard}>
      <View style={styles.ruleHeader}>
        <View style={styles.ruleInfo}>
          <View style={styles.ruleIcon}>
            <MaterialCommunityIcons
              name={getTargetIcon(rule.targetType) as any}
              size={20}
              color={colors.accentGreen}
            />
          </View>
          <View style={styles.ruleDetails}>
            <Text style={styles.ruleName}>{rule.name}</Text>
            <Text style={styles.ruleTarget}>{getTargetName(rule)}</Text>
          </View>
        </View>
        <Switch
          value={rule.isActive}
          onValueChange={() => handleToggleActive(rule)}
          trackColor={{ false: colors.surface2, true: colors.accentGreen + '60' }}
          thumbColor={rule.isActive ? colors.accentGreen : colors.textMuted}
        />
      </View>
      <View style={styles.ruleFooter}>
        <View style={styles.percentageBar}>
          <ProgressBar
            progress={rule.percentage / 100}
            color={rule.isActive ? colors.accentGreen : colors.textMuted}
            style={styles.progressBar}
          />
        </View>
        <Text style={[styles.percentageText, !rule.isActive && styles.inactiveText]}>
          {rule.percentage}%
        </Text>
      </View>
      <View style={styles.ruleActions}>
        <TouchableOpacity
          onPress={() => handleOpenEditModal(rule)}
          style={styles.actionButton}
        >
          <MaterialCommunityIcons name="pencil" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteRule(rule)}
          style={styles.actionButton}
        >
          <MaterialCommunityIcons name="delete" size={16} color={colors.accentRed} />
        </TouchableOpacity>
      </View>
    </Card>
  );

  const targetsForType = formData.targetType === 'POCKET' ? pocketsList
    : formData.targetType === 'ACCOUNT' ? accountsList
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={[]}
        renderItem={null}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Reglas de distribución</Text>
              <Text style={styles.subtitle}>
                Automatiza cómo se distribuye tu dinero entre bolsillos y cuentas.
              </Text>
            </View>

            {/* Summary Card */}
            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total distribuido</Text>
                <Text style={styles.summaryValue}>{activeRulesTotal.toFixed(1)}%</Text>
              </View>
              <ProgressBar
                progress={activeRulesTotal / 100}
                color={activeRulesTotal > 100 ? colors.accentRed : colors.accentGreen}
                style={styles.totalProgress}
              />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Disponible</Text>
                <Text
                  style={[
                    styles.summaryValue,
                    remainingPercentage < 0 && styles.warningText,
                  ]}
                >
                  {remainingPercentage.toFixed(1)}%
                </Text>
              </View>
              {remainingPercentage < 0 && (
                <Text style={styles.warningMessage}>
                  Has asignado más del 100%. Desactiva algunas reglas.
                </Text>
              )}
            </Card>

            {/* Rules List */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Reglas activas</Text>
              {rules.length === 0 ? (
                <Card style={styles.emptyCard}>
                  <MaterialCommunityIcons name="swap-vertical" size={32} color={colors.textMuted} />
                  <Text style={styles.emptyText}>No hay reglas de distribución</Text>
                  <Text style={styles.emptySubtext}>
                    Crea reglas para automatizar el распределение de tu dinero.
                  </Text>
                </Card>
              ) : (
                rules.map(renderRuleItem)
              )}
            </View>

            <View style={styles.spacer} />
          </>
        }
        contentContainerStyle={styles.scroll}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleOpenAddModal}>
        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingRule ? 'Editar regla' : 'Nueva regla'}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <Input
            label="Nombre"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="Ej: 10% a emergencias"
          />

          <Text style={styles.fieldLabel}>Porcentaje</Text>
          <View style={styles.percentageInput}>
            <TextInput
              style={styles.percentageTextInput}
              value={formData.percentage}
              onChangeText={(text) => setFormData({ ...formData, percentage: text.replace(/[^0-9.]/g, '') })}
              keyboardType="numeric"
              maxLength={5}
              placeholder="0"
            />
            <Text style={styles.percentSymbol}>%</Text>
          </View>
          <Text style={styles.helperText}>
            Disponible: {remainingPercentage.toFixed(1)}%
          </Text>

          <Text style={styles.fieldLabel}>Destino</Text>
          <View style={styles.targetTypeSelector}>
            {TARGET_TYPES.map((type) => (
              <TouchableOpacity
                key={type.value}
                style={[
                  styles.targetTypeChip,
                  formData.targetType === type.value && styles.targetTypeChipActive,
                ]}
                onPress={() => setFormData({ ...formData, targetType: type.value, targetId: '' })}
              >
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={16}
                  color={formData.targetType === type.value ? '#fff' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.targetTypeText,
                    formData.targetType === type.value && styles.targetTypeTextActive,
                  ]}
                >
                  {type.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {(formData.targetType === 'POCKET' || formData.targetType === 'ACCOUNT') && (
            <>
              <Text style={styles.fieldLabel}>Seleccionar {formData.targetType === 'POCKET' ? 'bolsillo' : 'cuenta'}</Text>
              <View style={styles.targetList}>
                {targetsForType.length === 0 ? (
                  <Text style={styles.noTargetsText}>
                    No hay {formData.targetType === 'POCKET' ? 'bolsillos' : 'cuentas'} disponibles
                  </Text>
                ) : (
                  targetsForType.map((target) => (
                    <TouchableOpacity
                      key={target.id}
                      style={[
                        styles.targetItem,
                        formData.targetId === target.id && styles.targetItemSelected,
                      ]}
                      onPress={() => setFormData({ ...formData, targetId: target.id })}
                    >
                      <Text
                        style={[
                          styles.targetItemText,
                          formData.targetId === target.id && styles.targetItemTextSelected,
                        ]}
                      >
                        {'name' in target ? target.name : 'Destino'}
                      </Text>
                      {formData.targetId === target.id && (
                        <MaterialCommunityIcons name="check" size={16} color={colors.accentGreen} />
                      )}
                    </TouchableOpacity>
                  ))
                )}
              </View>
            </>
          )}

          {(formData.targetType === 'SAVINGS' || formData.targetType === 'INVESTMENT') && (
            <View style={styles.genericTargetInfo}>
              <MaterialCommunityIcons
                name={getTargetIcon(formData.targetType) as any}
                size={24}
                color={colors.textMuted}
              />
              <Text style={styles.genericTargetText}>
                Las transferencias se harán a tu cuenta de {formData.targetType === 'SAVINGS' ? 'ahorros' : 'inversión'} registrada
              </Text>
            </View>
          )}

          <View style={styles.modalFooter}>
            <Button variant="ghost" onPress={() => setModalVisible(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onPress={handleSaveRule}>
              {editingRule ? 'Guardar' : 'Crear'}
            </Button>
          </View>
        </ScrollView>
      </Modal>
    </SafeAreaView>
  );
}

// Need to import TextInput
import { TextInput } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 120 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  warningText: { color: colors.accentRed },
  totalProgress: { marginVertical: spacing.md },
  warningMessage: {
    fontSize: typography.fontSize.sm,
    color: colors.accentRed,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  section: { paddingHorizontal: spacing.lg },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ruleCard: { marginBottom: spacing.md },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ruleInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  ruleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentGreen + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  ruleDetails: { flex: 1 },
  ruleName: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  ruleTarget: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  ruleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  percentageBar: { flex: 1, marginRight: spacing.md },
  progressBar: { height: 6, borderRadius: 3 },
  percentageText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    color: colors.accentGreen,
    minWidth: 40,
    textAlign: 'right',
  },
  inactiveText: { color: colors.textMuted },
  ruleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  actionButton: { padding: spacing.xs },
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: typography.fontSize.sm,
    color: colors.textHint,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  spacer: { height: 80 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentGreen,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  percentageInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface2,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
  },
  percentageTextInput: {
    flex: 1,
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    paddingVertical: spacing.md,
  },
  percentSymbol: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textMuted,
  },
  helperText: {
    fontSize: typography.fontSize.xs,
    color: colors.textHint,
    marginTop: spacing.xs,
  },
  targetTypeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  targetTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.surface2,
  },
  targetTypeChipActive: { backgroundColor: colors.accentGreen },
  targetTypeText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
  targetTypeTextActive: { color: '#fff' },
  targetList: { gap: spacing.xs },
  noTargetsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textHint,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  targetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: 8,
  },
  targetItemSelected: { backgroundColor: colors.accentGreen + '20' },
  targetItemText: {
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  targetItemTextSelected: { color: colors.accentGreen },
  genericTargetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface2,
    borderRadius: 10,
    marginTop: spacing.md,
  },
  genericTargetText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
  },
});
