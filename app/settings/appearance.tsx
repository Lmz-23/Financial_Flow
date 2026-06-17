import { View, Text, StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';

export default function AppearanceScreen() {
  const theme = useUserStore((s) => s.settings.theme);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <View style={styles.themeCard}>
            <View style={[styles.themeIcon, { backgroundColor: colors.accentGreen + '20' }]}>
              <MaterialCommunityIcons name="weather-night" size={32} color={colors.accentGreen} />
            </View>
            <View style={styles.themeInfo}>
              <Text style={styles.themeTitle}>Tema oscuro</Text>
              <Text style={styles.themeStatus}>Activo</Text>
            </View>
            <MaterialCommunityIcons name="check-circle" size={24} color={colors.accentGreen} />
          </View>
        </Card>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disponible próximamente</Text>
          <Card style={styles.card}>
            <View style={styles.previewItem}>
              <View style={[styles.previewIcon, { backgroundColor: colors.surface2 }]}>
                <MaterialCommunityIcons name="weather-sunny" size={20} color={colors.textMuted} />
              </View>
              <Text style={styles.previewLabel}>Tema claro</Text>
              <MaterialCommunityIcons name="lock" size={16} color={colors.textHint} />
            </View>
          </Card>

          <Card style={styles.card}>
            <View style={styles.previewItem}>
              <View style={[styles.previewIcon, { backgroundColor: colors.surface2 }]}>
                <MaterialCommunityIcons name="theme-light-dark" size={20} color={colors.textMuted} />
              </View>
              <Text style={styles.previewLabel}>Sistema</Text>
              <MaterialCommunityIcons name="lock" size={16} color={colors.textHint} />
            </View>
          </Card>
        </View>

        <Text style={styles.note}>
          La selección de tema estará disponible en una futura actualización.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.md },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  themeIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  themeInfo: { flex: 1 },
  themeTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  themeStatus: {
    fontSize: typography.fontSize.sm,
    color: colors.accentGreen,
    marginTop: 2,
  },
  section: { paddingHorizontal: spacing.lg },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: spacing.lg,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    opacity: 0.6,
  },
  previewIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  previewLabel: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  note: {
    fontSize: typography.fontSize.sm,
    color: colors.textHint,
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
  },
});
