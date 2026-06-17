import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Card, Divider } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { useAccounts } from '../../src/hooks/useAccounts';
import { usePockets } from '../../src/hooks/usePockets';
import { useDebts } from '../../src/hooks/useDebts';
import { useIntegrityCheck } from '../../src/hooks/useIntegrityCheck';

const MENU_ITEMS = [
  { id: 'debts', title: 'Deudas', icon: 'credit-card-outline', color: colors.accentRed, description: 'Tarjetas y préstamos', route: '/debt' },
  { id: 'pockets', title: 'Bolsillos', icon: 'wallet', color: colors.accentYellow, description: 'Ahorro y metas', route: '/pockets' },
  { id: 'cashflow', title: 'Cash Flow', icon: 'chart-timeline-variant', color: colors.accentGreen, description: 'Análisis de ingresos y gastos', route: '/cashflow' },
  { id: 'reports', title: 'Reportes', icon: 'file-chart', color: colors.accentBlue, description: 'Análisis detallados', route: '/reports' },
  { id: 'recurring', title: 'Recurrentes', icon: 'calendar-repeat', color: '#8B5CF6', description: 'Ingresos y gastos fijos', route: '/recurring' },
  { id: 'settings', title: 'Ajustes', icon: 'cog', color: colors.textMuted, description: 'Configuración de la app', route: '/settings' },
];

export default function MoreScreen() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const resetStore = useUserStore((s) => s.reset);
  const { accounts } = useAccounts();
  const { pockets } = usePockets();
  const { debts } = useDebts();
  const { integrityStatus, checkIntegrity } = useIntegrityCheck();

  const handleMenuPress = (route: string) => {
    router.push(route);
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
          onPress: () => resetStore(),
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Más opciones</Text>
        </View>

        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'Usuario'}</Text>
              <Text style={styles.profileEmail}>{user?.email || 'Sin email'}</Text>
            </View>
          </View>
        </Card>

        {/* Quick Stats */}
        <Card style={styles.statsCard}>
          <Text style={styles.sectionTitle}>Resumen</Text>
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
              <Text style={styles.statValue}>{debts.length}</Text>
              <Text style={styles.statLabel}>Deudas</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.integrityRow} onPress={checkIntegrity}>
            <MaterialCommunityIcons
              name={integrityStatus?.isValid ? 'check-circle' : 'alert-circle'}
              size={20}
              color={integrityStatus?.isValid ? colors.accentGreen : colors.accentYellow}
            />
            <Text style={styles.integrityText}>
              {integrityStatus?.isValid ? 'Datos íntegros' : 'Verificar integridad'}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          {MENU_ITEMS.map((item, index) => (
            <View key={item.id}>
              <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuPress(item.route)}>
                <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.color} />
                </View>
                <View style={styles.menuInfo}>
                  <Text style={styles.menuTitle}>{item.title}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
              {index < MENU_ITEMS.length - 1 && <Divider />}
            </View>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <MaterialCommunityIcons name="logout" size={22} color={colors.accentRed} />
          <Text style={styles.signOutText}>Cerrar sesión</Text>
        </TouchableOpacity>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>Financial Flow</Text>
          <Text style={styles.appVersion}>Versión 1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: typography.fontSize['2xl'], fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  profileCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentGreen, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  avatarText: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: typography.fontSize.lg, fontWeight: typography.fontWeight.semibold, color: colors.textPrimary },
  profileEmail: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  statsCard: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  sectionTitle: { fontSize: typography.fontSize.md, color: colors.textMuted, fontWeight: typography.fontWeight.medium, marginBottom: spacing.md },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: typography.fontSize.xl, fontWeight: typography.fontWeight.bold, color: colors.textPrimary },
  statLabel: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  integrityRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.sm },
  integrityText: { fontSize: typography.fontSize.sm, color: colors.textMuted },
  menuSection: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  menuIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  menuInfo: { flex: 1 },
  menuTitle: { fontSize: typography.fontSize.md, color: colors.textPrimary, fontWeight: typography.fontWeight.medium },
  menuDescription: { fontSize: typography.fontSize.sm, color: colors.textMuted, marginTop: 2 },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  signOutText: { fontSize: typography.fontSize.md, color: colors.accentRed, fontWeight: typography.fontWeight.medium },
  appInfo: { alignItems: 'center', paddingVertical: spacing.xl },
  appName: { fontSize: typography.fontSize.md, color: colors.textMuted },
  appVersion: { fontSize: typography.fontSize.sm, color: colors.textHint, marginTop: spacing.xs },
});
