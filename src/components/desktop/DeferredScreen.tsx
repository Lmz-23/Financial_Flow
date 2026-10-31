import { useEffect, useState, type ReactNode } from 'react';

import { ScreenSkeleton, type SkeletonVariant } from './ScreenSkeleton';

/**
 * Monta la pantalla un cuadro después de mostrar su esqueleto. Las consultas a la BD son síncronas:
 * sin esto, el clic en el menú congelaba la ventana mientras se calculaba la pantalla nueva (hasta
 * ~300 ms con un año de datos). Así responde al instante y los datos aparecen enseguida.
 */
export function DeferredScreen({ variant, children }: { variant: SkeletonVariant; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Dos cuadros: uno para pintar el esqueleto y otro para montar la pantalla real.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return ready ? children : <ScreenSkeleton variant={variant} />;
}
