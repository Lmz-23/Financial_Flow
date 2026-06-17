import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, ProgressBar, Badge, Button } from '../../src/components/ui';
import { Modal } from '../../src/components/ui/Modal';
import { Input } from '../../src/components/ui/Input';
import { AmountInput } from '../../src/components/forms';
import { colors, spacing, typography } from '../../src/theme';
import { usePockets } from '../../src/hooks/usePockets';
import { PocketRepository } from '../../src/database/repositories/pocketRepository';
import { useUserStore } from '../../src/store/useUserStore';
import type { Pocket } from '../../src/database/schema';

export default function PocketsScreen() {
  const { pockets, refresh } = usePockets();
  const userId = useUserStore((s) => s.userId);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPocket, setNewPocket] = useState({ name: '', goalAmount: 0, color: colors.accentBlue });

  const COLORS = [
    colors.accentBlue,
    colors.accentGreen,
    colors.accentRed,
    colors.accentYellow,
    '#8B5CF6',
    '#EC4899',
    '#14B8A6',
    '#F97316',
  ];

  const totalSaved = pockets.reduce((sum, p) => sum + (p.balance || 0), 0);
  const totalGoal = pockets.reduce((sum, p) => sum + (p.goalAmount || 0), 0);
  const overallProgress = totalGoal > 0 ? (totalSaved / totalGoal) * 100 : 0;

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleCreatePocket = async () => {
    if (!newPocket.name.trim()) return;

    await PocketRepository.create({
      userId,
      name: newPocket.name.trim(),
      goalAmount: newPocket.goalAmount,
      color: newPocket.color,
      icon: 'wallet',
    });

    setNewPocket({ name: '', goalAmount: 0, color: colors.accentBlue });
    setModalVisible(false);
    refresh();
  };

  const renderPocket = ({ item: pocket }: { item: Pocket }) => {
    const progress = pocket.goalAmount > 0 ? (pocket.balance / pocket.goalAmount) * 100 : 0;
    const isCompleted = progress >= 100;

    return (
      <Card style={styles.pocketCard}>
        <View style={styles.pocketHeader}>
          <View style={[styles.pocketIcon, { backgroundColor: pocket.color || colors.accentBlue }]}>
            <MaterialCommunityIcons name="wallet" size={20} color="#fff" />
          </View>
          <View style={styles.pocketInfo}>
            <Text style={styles.pocketName}>{pocket.name}</Text>
            <Text style={styles.pocketBalance}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(pocket.balance || 0)}
              {pocket.goalAmount > 0 && (
                <Text style={styles.pocketGoal}> de {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(pocket.goalAmount)}</Text>
              )}
            </Text>
          </View>
          {isCompleted && (
            <Badge variant="green" size="sm">Completado</Badge>
          )}
        </View>

        {pocket.goalAmount > 0 && (
          <View style={styles.pocketProgress}>
            <ProgressBar
              progress={Math.min(progress / 100, 1)}
              color={isCompleted ? colors.accentGreen : pocket.color || colors.accentBlue}
            />
            <Text style={[styles.pocketPercentage, { color: isCompleted ? colors.accentGreen : colors.textMuted }]}>
              {progress.toFixed(0)}%
            </Text>
          </View>
        )}

        <View style={styles.pocketActions}>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="plus" size={18} color={colors.accentGreen} />
            <Text style={styles.actionText}>Agregar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <MaterialCommunityIcons name="dots-horizontal" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bolsillos</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <MaterialCommunityIcons name="plus" size={24} color={colors.accentGreen} />
        </TouchableOpacity>
      </View>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total acumulado</Text>
            <Text style={styles.summaryAmount}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalSaved)}
            </Text>
          </View>
          <View style={styles.summaryDivider} />
          <View>
            <Text style={styles.summaryLabel}>Meta total</Text>
            <Text style={styles.summaryGoal}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(totalGoal)}
            </Text>
          </View>
        </View>
        {totalGoal > 0 && (
          <View style={styles.overallProgress}>
            <ProgressBar progress={Math.min(overallProgress / 100, 1)} color={colors.accentGreen} />
            <Text style={styles.overallPercentage}>{overallProgress.toFixed(0)}% del meta</Text>
          </View>
        )}
      </Card>

      <FlatList
        data={pockets}
        keyExtractor={(item) => item.id}
        renderItem={renderPocket}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="wallet-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No tienes bolsillos</Text>
            <Text style={styles.emptyHint}>Crea bolsillos para separar tu dinero</Text>
          </View>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      />

      <Modal visible={modalVisible} onClose={() => setModalVisible(false)} title="Nuevo Bolsillo">
        <Input
          label="Nombre"
          value={newPocket.name}
          onChangeText={(text) => setNewPocket({ ...newPocket, name: text })}
          placeholder="Ej: Vacaciones, Fondo de emergencia"
        />

        <AmountInput
          label="Meta de ahorro (opcional)"
          value={newPocket.goalAmount}
          onChangeValue={(val) => setNewPocket({ ...newPocket, goalAmount: val })}
        />

        <Text style={styles.colorLabel}>Color</Text>
        <View style={styles.colorPicker}>
          {COLORS.map((color) => (
            <TouchableOpacity
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                newPocket.color === color && styles.colorOptionSelected,
              ]}
              onPress={() => setNewPocket({ ...newPocket, color })}
            >
              {newPocket.color === color && (
                <MaterialCommunityIcons name="check" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.modalFooter}>
          <Button variant="ghost" onPress={() => setModalVisible(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onPress={handleCreatePocket}>
            Crear
          </Button>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface2, justifyContent: 'center', alignItems: 'center' },
  summaryCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  summaryRow: { flexDirection: 'row' },
  summaryLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  summaryAmount: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  summaryGoal: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.textMuted },
  summaryDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  overallProgress: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  overallPercentage: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs, textAlign: 'right' },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  pocketCard: { marginBottom: spacing.md },
  pocketHeader: { flexDirection: 'row', alignItems: 'center' },
  pocketIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  pocketInfo: { flex: 1 },
  pocketName: { fontSize: typography.fontSize.lg, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  pocketBalance: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  pocketGoal: { color: colors.textMuted },
  pocketProgress: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.sm },
  pocketPercentage: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.medium, minWidth: 40, textAlign: 'right' },
  pocketActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  actionText: { fontSize: typography.fontSize.sm, color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: typography.fontSize.lg, color: colors.textMuted, marginTop: spacing.md },
  emptyHint: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs },
  colorLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginBottom: spacing.xs, marginTop: spacing.md },
  colorPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  colorOption: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  colorOptionSelected: { borderWidth: 3, borderColor: '#fff' },
  modalFooter: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm, marginTop: spacing.md },
});
