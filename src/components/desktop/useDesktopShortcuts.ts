import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { routes } from '../../navigation/routes';

/**
 * Atajos globales de escritorio. Ctrl+N (o Cmd+N): nueva transacción. Esc lo maneja cada ventana
 * (`DesktopDialog`). Solo se activa si `enabled` (escritorio).
 */
export function useDesktopShortcuts(enabled: boolean): void {
  const router = useRouter();
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        router.push(routes.transactionNew());
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled, router]);
}
