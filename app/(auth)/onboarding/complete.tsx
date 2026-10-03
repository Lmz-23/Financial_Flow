import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card } from '../../../src/components/ui';
import { colors, spacing, typography } from '../../../src/theme';
import { useUserStore } from '../../../src/store/useUserStore';
import { AccountRepository } from '../../../src/database/repositories/accountRepository';
import { database } from '../../../src/database';
import { recurringItems } from '../../../src/database/schema';
import { eq } from 'drizzle-orm';

export default function CompleteScreen() {
  const router = useRouter();
  const userId = useUserStore((s) => s.userId);
  const completeOnboarding = useUserStore((s) => s.completeOnboarding);
  const [stats, setStats] = useState({ accounts: 0, incomes: 0, expenses: 0 });

  useEffect(() => {
    async function loadStats() {
      const accounts = await AccountRepository.getAll(userId);
      const items = await database.query.recurringItems.findMany({
        where: eq(recurringItems.userId, userId),
      });
      const incomes = items.filter((i) => i.type === 'INCOME').length;
      const expenses = items.filter((i) => i.type === 'EXPENSE').length;

      setStats({ accounts: accounts.length, incomes, expenses });
    }
    loadStats();
  }, [userId]);

  const handleFinish = () => {
    completeOnboarding();
    // Navigate to tabs (will be /(tabs) in expo router)
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success icon */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="check-circle" size={80} color={colors.accentGreen} />
        </View>

        <Text style={styles.title}>¡Todo listo!</Text>
        <Text style={styles.subtitle}>
          Tu configuración inicial está completa. Empieza a registrar tus movimientos.
        </Text>

        {/* Summary card */}
        <Card style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="bank" size={24} color={colors.accentBlue} />
            <View style={styles.summaryText}>
              <Text style={styles.summaryValue}>{stats.accounts}</Text>
              <Text style={styles.summaryLabel}>
                {stats.accounts === 1 ? 'cuenta' : 'cuentas'} creada
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="arrow-down-circle" size={24} color={colors.accentGreen} />
            <View style={styles.summaryText}>
              <Text style={styles.summaryValue}>{stats.incomes}</Text>
              <Text style={styles.summaryLabel}>
                {stats.incomes === 1 ? 'ingreso' : 'ingresos'} fijo
              </Text>
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="arrow-up-circle" size={24} color={colors.accentRed} />
            <View style={styles.summaryText}>
              <Text style={styles.summaryValue}>{stats.expenses}</Text>
              <Text style={styles.summaryLabel}>
                {stats.expenses === 1 ? 'gasto' : 'gastos'} fijo
              </Text>
            </View>
          </View>
        </Card>

        {/* Tips */}
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Próximos pasos</Text>
          <View style={styles.tipItem}>
            <MaterialCommunityIcons name="1-circle" size={20} color={colors.textMuted} />
            <Text style={styles.tipText}>Registra tus transacciones diarias</Text>
          </View>
          <View style={styles.tipItem}>
            <MaterialCommunityIcons name="2-circle" size={20} color={colors.textMuted} />
            <Text style={styles.tipText}>Confirma tus ingresos cuando lleguen</Text>
          </View>
          <View style={styles.tipItem}>
            <MaterialCommunityIcons name="3-circle" size={20} color={colors.textMuted} />
            <Text style={styles.tipText}>Revisa tu Cash Flow regularmente</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Button variant="primary" onPress={handleFinish} style={styles.ctaButton}>
          Ver mi Dashboard
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
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  summaryCard: {
    marginBottom: spacing.xxl,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  summaryText: {
    marginLeft: spacing.md,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  summaryLabel: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  tips: {
    marginTop: spacing.lg,
  },
  tipsTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  tipText: {
    fontSize: typography.fontSize.md,
    color: colors.textMuted,
  },
  footer: {
    padding: spacing.lg,
  },
  ctaButton: {
    width: '100%',
  },
});
