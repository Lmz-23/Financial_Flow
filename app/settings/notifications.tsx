import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Card } from '../../src/components/ui';
import { colors, spacing, typography } from '../../src/theme';
import { useUserStore } from '../../src/store/useUserStore';
import { requestPermissions } from '../../src/lib/expo/notifications';

const DAYS_OPTIONS = [1, 2, 3, 5, 7];

export default function NotificationsScreen() {
  const settings = useUserStore((s) => s.settings);
  const setNotificationsEnabled = useUserStore((s) => s.setNotificationsEnabled);
  const setReminderDaysBefore = useUserStore((s) => s.setReminderDaysBefore);

  const [notificationsEnabled, setLocalNotificationsEnabled] = useState(settings.notificationsEnabled);
  const [reminderDays, setLocalReminderDays] = useState(settings.reminderDaysBefore);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const granted = await requestPermissions();
      setHasPermission(granted);
    } catch {
      setHasPermission(false);
    }
  };

  const handleToggleNotifications = async (value: boolean) => {
    if (value) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Permisos denegados',
          'Por favor habilita las notificaciones en los ajustes de tu dispositivo.'
        );
        return;
      }
      setHasPermission(true);
    }
    setLocalNotificationsEnabled(value);
    setNotificationsEnabled(value);
  };

  const handleSelectDays = (days: number) => {
    setLocalReminderDays(days);
    setReminderDaysBefore(days);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <View style={styles.settingIcon}>
                <MaterialCommunityIcons name="bell" size={20} color={colors.textPrimary} />
              </View>
              <View>
                <Text style={styles.settingTitle}>Notificaciones</Text>
                <Text style={styles.settingDescription}>
                  Recibir recordatorios de pagos y cobros pendientes
                </Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.surface2, true: colors.accentGreen + '60' }}
              thumbColor={notificationsEnabled ? colors.accentGreen : colors.textMuted}
            />
          </View>
        </Card>

        {notificationsEnabled && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Días de anticipación</Text>
              <Text style={styles.sectionDescription}>
                ¿Cuántos días antes quieres recibir el recordatorio?
              </Text>
            </View>

            <Card style={styles.card}>
              <View style={styles.daysContainer}>
                {DAYS_OPTIONS.map((days) => (
                  <TouchableOpacity
                    key={days}
                    style={[
                      styles.dayChip,
                      reminderDays === days && styles.dayChipActive,
                    ]}
                    onPress={() => handleSelectDays(days)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        reminderDays === days && styles.dayChipTextActive,
                      ]}
                    >
                      {days}
                    </Text>
                    <Text
                      style={[
                        styles.dayChipLabel,
                        reminderDays === days && styles.dayChipTextActive,
                      ]}
                    >
                      {days === 1 ? 'día' : 'días'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Card>

            {reminderDays === 1 && (
              <Text style={styles.note}>
                Recibirás un recordatorio el mismo día del vencimiento.
              </Text>
            )}

            {reminderDays > 1 && (
              <Text style={styles.note}>
                Recibirás un recordatorio {reminderDays} días antes del vencimiento.
              </Text>
            )}
          </>
        )}

        {!notificationsEnabled && (
          <Card style={styles.disabledCard}>
            <MaterialCommunityIcons name="bell-off" size={32} color={colors.textMuted} />
            <Text style={styles.disabledText}>
              Las notificaciones están desactivadas. Actívalas para recibir recordatorios
              de tus pagos y cobros recurrentes.
            </Text>
          </Card>
        )}
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
  section: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
  },
  sectionDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.md,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.medium,
    color: colors.textPrimary,
  },
  settingDescription: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    marginTop: 2,
    maxWidth: 220,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: 12,
    backgroundColor: colors.surface2,
  },
  dayChipActive: {
    backgroundColor: colors.accentGreen,
  },
  dayChipText: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.textPrimary,
  },
  dayChipTextActive: {
    color: '#fff',
  },
  dayChipLabel: {
    fontSize: typography.fontSize.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  note: {
    fontSize: typography.fontSize.sm,
    color: colors.textHint,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  disabledCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  disabledText: {
    fontSize: typography.fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
});
