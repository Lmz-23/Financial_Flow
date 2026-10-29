import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { commands, ensureNotificationPermission, readNotificationPermission } from '../../src/app-services';
import { ScreenHeader } from '../../src/components/screens/ScreenHeader';
import { Button } from '../../src/components/ui/ds/Button';
import { SCREEN_MARGIN } from '../../src/components/ui/ds/constants';
import { ListRow } from '../../src/components/ui/ds/ListRow';
import { SegmentedControl, type SegmentedOption } from '../../src/components/ui/ds/SegmentedControl';
import { Text } from '../../src/components/ui/ds/Text';
import { Toggle } from '../../src/components/ui/ds/Toggle';
import { Widget } from '../../src/components/ui/ds/Widget';
import { useSettings } from '../../src/store/useSettingsStore';
import { errorMessage } from '../../src/lib/screenErrors';
import { useTheme } from '../../src/theme';
import type { ThemePreference } from '../../src/theme/tokens';

// Textos de Dashboard.dc.html (pantalla Ajustes). La etiqueta del interruptor es la decisión 35.
const TITLE = 'Ajustes';
const SECTION_NOTIFICATIONS = 'Notificaciones';
const SECTION_APPEARANCE = 'Apariencia';
const LABEL_PAYMENTS = 'Recordatorios de pagos y cobros';
const HINT_PAYMENTS = '2 días antes y el día del vencimiento';
const LABEL_WEEKLY = 'Resumen semanal';
const HINT_WEEKLY = 'Cómo te fue con tu flujo cada domingo';
const LABEL_THEME = 'Tema';
// INFERIDOS (no están en el diseño ni en los docs).
const LABEL_HOUR = 'Hora del recordatorio';
const MSG_PERMISSION_DENIED =
  'Las notificaciones están bloqueadas. Actívalas en los ajustes de tu dispositivo para recibir recordatorios.';
const MSG_PERMISSION_NEEDED = 'Falta el permiso de notificaciones: sin él no llegarán los avisos.';

const THEME_OPTIONS: readonly SegmentedOption<ThemePreference>[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Sistema' },
];

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Ajustes (Dashboard.dc.html, onAjustes): notificaciones y tema en una sola pantalla. "Cerrar sesión"
 * del diseño no se muestra en el MVP (no hay autenticación; D19). El permiso de notificaciones se
 * pide solo al encender un interruptor (§7), nunca al abrir la pantalla.
 */
export default function SettingsScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const [error, setError] = useState<string | null>(null);
  // null = aún sin leer; solo se lee, no se pide.
  const [permission, setPermission] = useState<{ granted: boolean; canAskAgain: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    readNotificationPermission()
      .then((p) => active && setPermission(p))
      .catch(() => active && setPermission(null));
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback((action: () => unknown) => {
    setError(null);
    try {
      action();
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  /** Encender pide el permiso; si se niega, el interruptor queda apagado. Apagar nunca lo pide. */
  const toggleNotification = useCallback(
    async (key: 'notifyPaymentReminders' | 'notifyWeeklySummary', next: boolean) => {
      if (next) {
        let granted = false;
        let canAskAgain = true;
        try {
          granted = await ensureNotificationPermission();
          const state = await readNotificationPermission();
          canAskAgain = state.canAskAgain;
          setPermission(state);
        } catch {
          granted = false;
        }
        if (!granted) {
          // Con canAskAgain=false ya sale el aviso fijo; si no, todo sigue apagado y no habria aviso.
          if (canAskAgain) setError(MSG_PERMISSION_NEEDED);
          return;
        }
      }
      save(() => commands.settings.setNotifications({ [key]: next }));
    },
    [save],
  );

  const changeHour = (delta: number) => {
    const next = (settings.reminderHour + delta + 24) % 24;
    save(() => commands.settings.setNotifications({ reminderHour: next }));
  };

  const anyOn = settings.notifyPaymentReminders || settings.notifyWeeklySummary;
  const permissionHint =
    permission === null || permission.granted
      ? null
      : !permission.canAskAgain
        ? MSG_PERMISSION_DENIED
        : anyOn
          ? MSG_PERMISSION_NEEDED
          : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfacePage }}>
      <ScreenHeader title={TITLE} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: SCREEN_MARGIN,
          paddingTop: space[4],
          paddingBottom: Math.max(insets.bottom, space[5]) + space[5],
          gap: 28,
        }}
      >
        <View style={{ gap: 10 }}>
          <Text variant="label" tone="secondary" accessibilityRole="header">
            {SECTION_NOTIFICATIONS}
          </Text>
          <Widget gap={0} style={{ paddingVertical: space[1] }}>
            <ListRow
              title={LABEL_PAYMENTS}
              subtitle={HINT_PAYMENTS}
              divider
              trailing={
                <Toggle
                  value={settings.notifyPaymentReminders}
                  onValueChange={(next) => void toggleNotification('notifyPaymentReminders', next)}
                  accessibilityLabel={LABEL_PAYMENTS}
                />
              }
            />
            {settings.notifyPaymentReminders ? (
              <ListRow
                title={LABEL_HOUR}
                divider
                trailing={
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                    <Button
                      variant="ghost"
                      size="md"
                      fullWidth={false}
                      label="−"
                      accessibilityLabel="Una hora antes"
                      onPress={() => changeHour(-1)}
                    />
                    <Text variant="body" accessibilityLiveRegion="polite" style={{ minWidth: 48, textAlign: 'center' }}>
                      {formatHour(settings.reminderHour)}
                    </Text>
                    <Button
                      variant="ghost"
                      size="md"
                      fullWidth={false}
                      label="+"
                      accessibilityLabel="Una hora después"
                      onPress={() => changeHour(1)}
                    />
                  </View>
                }
              />
            ) : null}
            <ListRow
              title={LABEL_WEEKLY}
              subtitle={HINT_WEEKLY}
              trailing={
                <Toggle
                  value={settings.notifyWeeklySummary}
                  onValueChange={(next) => void toggleNotification('notifyWeeklySummary', next)}
                  accessibilityLabel={LABEL_WEEKLY}
                />
              }
            />
          </Widget>
          {permissionHint ? (
            <Text variant="bodySm" tone="secondary">
              {permissionHint}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: 10 }}>
          <Text variant="label" tone="secondary" accessibilityRole="header">
            {SECTION_APPEARANCE}
          </Text>
          <Widget gap={10}>
            <Text variant="body">{LABEL_THEME}</Text>
            <SegmentedControl
              options={THEME_OPTIONS}
              value={settings.themePreference}
              onChange={(next) => save(() => commands.settings.setTheme(next))}
              accessibilityLabel={LABEL_THEME}
            />
          </Widget>
        </View>

        {error ? (
          <Text variant="bodySm" tone="debt" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
