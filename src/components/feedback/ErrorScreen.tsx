import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createExclusiveRunner, errorScreenCopy, ERROR_RETRY_LABEL } from '../../lib/errorScreen';
import { useTheme } from '../../theme';
import { SCREEN_MARGIN } from '../ui/ds/constants';
import { Button } from '../ui/ds/Button';
import { Text } from '../ui/ds/Text';

const BUTTON_MIN_WIDTH = 200;

export interface ErrorScreenProps {
  /** Accion de reintento; el boton queda en estado `busy` hasta que termine. */
  onRetry: () => Promise<void> | void;
  /** Pantallas de error consecutivas, contando la inicial (con >= 3 se añade la linea de ayuda). */
  failureCount: number;
}

/**
 * Pantalla de error compartida (fallo de arranque y error boundary de rutas). Nunca recibe ni
 * muestra el error: solo textos fijos.
 */
export function ErrorScreen({ onRetry, failureCount }: ErrorScreenProps) {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const runner = useMemo(() => createExclusiveRunner(), []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const copy = errorScreenCopy(failureCount);

  async function handleRetry() {
    await runner(async () => {
      setBusy(true);
      try {
        await onRetry();
      } finally {
        if (mounted.current) setBusy(false);
      }
    });
  }

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.root,
        {
          backgroundColor: colors.surfacePage,
          paddingTop: insets.top + space[5],
          paddingBottom: insets.bottom + space[5],
          paddingHorizontal: SCREEN_MARGIN,
        },
      ]}
    >
      <Text variant="h1" accessibilityRole="header" style={styles.centered}>
        {copy.title}
      </Text>
      <Text variant="body" tone="secondary" style={[styles.centered, { marginTop: space[2] }]}>
        {copy.message}
      </Text>
      {copy.hint ? (
        <Text variant="body" tone="secondary" style={[styles.centered, { marginTop: space[2] }]}>
          {copy.hint}
        </Text>
      ) : null}
      <Button
        label={ERROR_RETRY_LABEL}
        loading={busy}
        onPress={handleRetry}
        style={{ marginTop: space[5], alignSelf: 'center', minWidth: BUTTON_MIN_WIDTH }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center' },
  centered: { textAlign: 'center' },
});
