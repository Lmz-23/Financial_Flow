import { useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, ProgressBar, Divider } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useCashflow } from '../../src/hooks/useCashflow';
import CashflowIndexGauge from '../../src/components/cashflow/CashflowIndexGauge';

type TabType = 'income' | 'balance' | 'index';

export default function CashflowIndexScreen() {
  const router = useRouter();
  const { incomeStatement, balanceSheet, cashflowIndex, loading, refetch } = useCashflow();
  const [activeTab, setActiveTab] = useState<TabType>('index');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact' }).format(amount);

  const formatFullCurrency = (amount: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount);

  const TabButton = ({ id, label, icon }: { id: TabType; label: string; icon: string }) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === id && styles.tabButtonActive]}
      onPress={() => setActiveTab(id)}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color={activeTab === id ? colors.accentGreen : colors.textMuted}
      />
      <Text style={[styles.tabButtonText, activeTab === id && styles.tabButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderIncomeStatement = () => (
    <View style={styles.section}>
      {/* Income Section */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="arrow-down-circle" size={24} color={colors.accentGreen} />
          <Text style={styles.cardTitle}>Ingresos</Text>
        </View>

        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Ingreso ganado</Text>
          <Text style={[styles.lineValue, { color: colors.accentGreen }]}>
            {formatCurrency(incomeStatement?.earnedIncome || 0)}
          </Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Ingreso pasivo</Text>
          <Text style={[styles.lineValue, { color: colors.accentBlue }]}>
            {formatCurrency(incomeStatement?.passiveIncome || 0)}
          </Text>
        </View>

        <Divider />

        <View style={styles.lineItem}>
          <Text style={styles.lineLabelBold}>Total ingresos</Text>
          <Text style={[styles.lineValueBold, { color: colors.accentGreen }]}>
            {formatCurrency(incomeStatement?.totalIncome || 0)}
          </Text>
        </View>
      </Card>

      {/* Expenses Section */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="arrow-up-circle" size={24} color={colors.accentRed} />
          <Text style={styles.cardTitle}>Gastos</Text>
        </View>

        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Gastos de vida</Text>
          <Text style={[styles.lineValue, { color: colors.accentRed }]}>
            {formatCurrency(incomeStatement?.lifeExpenses || 0)}
          </Text>
        </View>
        <View style={styles.lineItem}>
          <Text style={styles.lineLabel}>Pago de pasivos</Text>
          <Text style={[styles.lineValue, { color: colors.accentYellow }]}>
            {formatCurrency(incomeStatement?.debtPayments || 0)}
          </Text>
        </View>

        <Divider />

        <View style={styles.lineItem}>
          <Text style={styles.lineLabelBold}>Total gastos</Text>
          <Text style={[styles.lineValueBold, { color: colors.accentRed }]}>
            {formatCurrency(incomeStatement?.totalExpenses || 0)}
          </Text>
        </View>
      </Card>

      {/* Net Cashflow */}
      <Card style={[styles.card, styles.netCard]}>
        <View style={styles.netHeader}>
          <Text style={styles.netLabel}>Flujo neto del mes</Text>
          <Text
            style={[
              styles.netValue,
              { color: (incomeStatement?.netCashflow || 0) >= 0 ? colors.accentGreen : colors.accentRed },
            ]}
          >
            {formatCurrency(incomeStatement?.netCashflow || 0)}
          </Text>
        </View>
        <Text style={styles.netHint}>
          {(incomeStatement?.netCashflow || 0) >= 0 ? 'Estás ahorrando este mes' : 'Gastas más de lo que ganas'}
        </Text>
      </Card>
    </View>
  );

  const renderBalanceSheet = () => (
    <View style={styles.section}>
      {/* Assets */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="trending-up" size={24} color={colors.accentGreen} />
          <Text style={styles.cardTitle}>Activos</Text>
        </View>

        {balanceSheet?.assets && balanceSheet.assets.length > 0 ? (
          balanceSheet.assets.map((asset, index) => (
            <View key={asset.accountId}>
              <View style={styles.lineItem}>
                <View style={styles.lineLabelRow}>
                  <Text style={styles.lineLabel}>{asset.name}</Text>
                  <Text style={styles.lineSubtext}>{asset.type}</Text>
                </View>
                <Text style={[styles.lineValue, { color: colors.accentGreen }]}>
                  {formatFullCurrency(asset.balance)}
                </Text>
              </View>
              {index < balanceSheet.assets.length - 1 && <Divider />}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No hay activos registrados</Text>
        )}

        <Divider />

        <View style={styles.lineItem}>
          <Text style={styles.lineLabelBold}>Total activos</Text>
          <Text style={[styles.lineValueBold, { color: colors.accentGreen }]}>
            {formatCurrency(balanceSheet?.totalAssets || 0)}
          </Text>
        </View>
      </Card>

      {/* Liabilities */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="trending-down" size={24} color={colors.accentRed} />
          <Text style={styles.cardTitle}>Pasivos</Text>
        </View>

        {balanceSheet?.liabilities && balanceSheet.liabilities.length > 0 ? (
          balanceSheet.liabilities.map((liability, index) => (
            <View key={liability.debtId}>
              <View style={styles.lineItem}>
                <View style={styles.lineLabelRow}>
                  <Text style={styles.lineLabel}>{liability.name}</Text>
                  <Text style={styles.lineSubtext}>{liability.institution} • {liability.type}</Text>
                </View>
                <Text style={[styles.lineValue, { color: colors.accentRed }]}>
                  {formatFullCurrency(liability.currentBalance)}
                </Text>
              </View>
              {index < balanceSheet.liabilities.length - 1 && <Divider />}
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>No hay pasivos registrados</Text>
        )}

        <Divider />

        <View style={styles.lineItem}>
          <Text style={styles.lineLabelBold}>Total pasivos</Text>
          <Text style={[styles.lineValueBold, { color: colors.accentRed }]}>
            {formatCurrency(balanceSheet?.totalLiabilities || 0)}
          </Text>
        </View>
      </Card>

      {/* Net Worth */}
      <Card style={[styles.card, styles.netCard]}>
        <View style={styles.netHeader}>
          <Text style={styles.netLabel}>Patrimonio neto</Text>
          <Text
            style={[
              styles.netValue,
              { color: (balanceSheet?.netWorth || 0) >= 0 ? colors.accentGreen : colors.accentRed },
            ]}
          >
            {formatCurrency(balanceSheet?.netWorth || 0)}
          </Text>
        </View>
        <Text style={styles.netHint}>
          Activos ({formatCurrency(balanceSheet?.totalAssets || 0)}) - Pasivos ({formatCurrency(balanceSheet?.totalLiabilities || 0)})
        </Text>
      </Card>
    </View>
  );

  const renderCashflowIndex = () => (
    <View style={styles.section}>
      {/* Gauge */}
      <Card style={styles.gaugeCard}>
        <Text style={styles.gaugeTitle}>Índice de Cash Flow</Text>
        <View style={styles.gaugeContainer}>
          <CashflowIndexGauge
            percentage={cashflowIndex?.coveragePercent || 0}
            size={200}
          />
        </View>
        <Text style={styles.gaugeExplanation}>
          {cashflowIndex?.coveragePercent !== undefined && cashflowIndex.coveragePercent >= 100
            ? '¡Felicidades! Tu ingreso pasivo cubre todos tus gastos.'
            : cashflowIndex?.coveragePercent !== undefined && cashflowIndex.coveragePercent >= 50
            ? 'Vas por buen camino. Sigue creciendo tu ingreso pasivo.'
            : 'Tu ingreso pasivo aún no cubre tus gastos básicos.'}
        </Text>
      </Card>

      {/* Details */}
      <Card style={styles.card}>
        <Text style={styles.cardTitle}>¿Cómo se calcula?</Text>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>Ingreso pasivo del mes</Text>
          <Text style={[styles.breakdownValue, { color: colors.accentGreen }]}>
            {formatCurrency(cashflowIndex?.passiveIncome || 0)}
          </Text>
        </View>
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabel}>Gastos totales del mes</Text>
          <Text style={[styles.breakdownValue, { color: colors.accentRed }]}>
            {formatCurrency(cashflowIndex?.totalExpenses || 0)}
          </Text>
        </View>
        <Divider />
        <View style={styles.breakdownItem}>
          <Text style={styles.breakdownLabelBold}>Cobertura</Text>
          <Text style={[styles.breakdownValueBold, { color: cashflowIndex?.coveragePercent && cashflowIndex.coveragePercent >= 100 ? colors.accentGreen : colors.accentYellow }]}>
            {cashflowIndex?.coveragePercent?.toFixed(1) || 0}%
          </Text>
        </View>
      </Card>

      {/* Freedom Message */}
      {cashflowIndex?.coveragePercent && cashflowIndex.coveragePercent >= 100 && (
        <Card style={[styles.card, styles.freedomCard]}>
          <MaterialCommunityIcons name="trophy" size={32} color={colors.accentYellow} />
          <Text style={styles.freedomTitle}>¡Alcanzaste la Libertad Financiera!</Text>
          <Text style={styles.freedomText}>
            Tu ingreso pasivo cubre el 100% de tus gastos. LosAssets que tengasgenerarán ingresos sin necesidad de trabajar.
          </Text>
        </Card>
      )}

      {/* Tip */}
      <Card style={styles.card}>
        <View style={styles.tipRow}>
          <MaterialCommunityIcons name="lightbulb-outline" size={24} color={colors.accentYellow} />
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Consejo</Text>
            <Text style={styles.tipText}>
              Para aumentar tu índice, puedes: (1) aumentar tus ingresos pasivos, (2) reducir gastos de vida, o (3) ambos.
            </Text>
          </View>
        </View>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cash Flow</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TabButton id="income" label="Estado" icon="table" />
        <TabButton id="balance" label="Balance" icon="scale" />
        <TabButton id="index" label="Índice" icon="gauge" />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accentGreen} />}
      >
        {activeTab === 'income' && renderIncomeStatement()}
        {activeTab === 'balance' && renderBalanceSheet()}
        {activeTab === 'index' && renderCashflowIndex()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  backButton: { padding: spacing.xs },
  headerTitle: { flex: 1, fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, textAlign: 'center' },
  placeholder: { width: 32 },
  tabBar: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  tabButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm, borderRadius: 10, backgroundColor: colors.surface2, gap: spacing.xs },
  tabButtonActive: { backgroundColor: colors.accentGreen + '15' },
  tabButtonText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  tabButtonTextActive: { color: colors.accentGreen, fontWeight: typography.fontWeight.medium },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  section: { marginTop: spacing.lg },
  card: { marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  cardTitle: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  lineItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  lineLabel: { fontSize: typography.fontSize.md, color: colors.textPrimary },
  lineLabelBold: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  lineLabelRow: { flex: 1 },
  lineSubtext: { fontSize: typography.fontSize.xs, color: colors.textMuted },
  lineValue: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.semibold },
  lineValueBold: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  emptyText: { fontSize: typography.fontSize.sm, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.md },
  netCard: { backgroundColor: colors.surface },
  netHeader: { alignItems: 'center' },
  netLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  netValue: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, marginTop: spacing.xs },
  netHint: { fontSize: typography.fontSize.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  gaugeCard: { alignItems: 'center', paddingVertical: spacing.xl },
  gaugeTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary, marginBottom: spacing.lg },
  gaugeContainer: { marginBottom: spacing.lg },
  gaugeExplanation: { fontSize: typography.fontSize.sm, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.lg },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs },
  breakdownLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  breakdownLabelBold: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  breakdownValue: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  breakdownValueBold: { fontSize: typography.fontSize.md, fontWeight: typography.fontWeight.bold },
  freedomCard: { alignItems: 'center', backgroundColor: colors.accentYellow + '15' },
  freedomTitle: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.bold, color: colors.accentYellow, marginTop: spacing.sm },
  freedomText: { fontSize: typography.fontSize.sm, color: colors.textPrimary, textAlign: 'center', marginTop: spacing.xs },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  tipContent: { flex: 1 },
  tipTitle: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  tipText: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: spacing.xs },
});
