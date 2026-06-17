import { useRouter } from 'expo-router';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card, Divider } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';

interface SettingMenuItemProps {
  icon: string;
  label: string;
  onPress?: () => void;
  showChevron?: boolean;
}

function SettingMenuItem({ icon, label, onPress, showChevron = true }: SettingMenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} disabled={!onPress}>
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons name={icon as any} size={20} color={colors.textPrimary} />
      </View>
      <Text style={styles.menuLabel}>{label}</Text>
      {showChevron && onPress && (
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsIndexScreen() {
  const router = useRouter();

  const handleDatosPress = () => {
    Alert.alert('Función no implementada', 'Esta función estará disponible próximamente.');
  };

  const handleAcercaDePress = () => {
    Alert.alert('Acerca de', 'Financial Flow v1.0.0\n\nTu control financiero personal.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
        </View>

        <Card style={styles.card}>
          <SettingMenuItem
            icon="palette"
            label="Apariencia"
            onPress={() => router.push('/settings/appearance')}
          />
          <Divider />
          <SettingMenuItem
            icon="bell"
            label="Notificaciones"
            onPress={() => router.push('/settings/notifications')}
          />
          <Divider />
          <SettingMenuItem
            icon="tag"
            label="Categorías"
            onPress={() => router.push('/settings/categories')}
          />
          <Divider />
          <SettingMenuItem
            icon="swap-vertical"
            label="Reglas de distribución"
            onPress={() => router.push('/settings/distribution')}
          />
        </Card>

        <Card style={styles.card}>
          <SettingMenuItem
            icon="database"
            label="Datos"
            onPress={handleDatosPress}
          />
          <Divider />
          <SettingMenuItem
            icon="information"
            label="Acerca de"
            onPress={handleAcercaDePress}
            showChevron={false}
          />
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Financial Flow v1.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 100 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  card: { marginHorizontal: spacing.lg, marginBottom: spacing.lg },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: colors.textPrimary,
  },
  footer: { alignItems: 'center', paddingVertical: spacing.xl },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: colors.textHint,
  },
});
