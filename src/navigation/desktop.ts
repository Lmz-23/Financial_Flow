// Navegación de la versión de escritorio: qué hay en el menú lateral y qué rutas se abren como
// ventana centrada. Puro (sin React) para poder probarlo.
import type { Href } from 'expo-router';

import { routes } from './routes';

export interface RailItem {
  key: string;
  label: string;
  /** Abreviatura que se ve en el menú compacto (Design/escritorio, 1c). */
  short: string;
  href: Href;
  /** Prefijo de ruta que marca el ítem como activo. '/' solo coincide exacto. */
  match: string;
}

export const RAIL_ITEMS: readonly RailItem[] = [
  { key: 'home', label: 'Inicio', short: 'In', href: routes.dashboard(), match: '/' },
  { key: 'transactions', label: 'Movimientos', short: 'Mo', href: routes.transactions(), match: '/transactions' },
  { key: 'accounts', label: 'Cuentas', short: 'Cu', href: routes.accounts(), match: '/accounts' },
  { key: 'debts', label: 'Deudas', short: 'De', href: routes.debts(), match: '/debts' },
  { key: 'goals', label: 'Metas', short: 'Me', href: routes.goals(), match: '/goals' },
  { key: 'recurring', label: 'Recurrentes', short: 'Re', href: routes.recurring(), match: '/recurring' },
  { key: 'flow', label: 'Flujo', short: 'Fl', href: routes.flow(), match: '/flow' },
  { key: 'cashflow', label: 'Cashflow', short: 'Ca', href: routes.cashflow(), match: '/cashflow' },
];

export const RAIL_SETTINGS: RailItem = {
  key: 'settings',
  label: 'Ajustes',
  short: 'Aj',
  href: routes.settings(),
  match: '/settings',
};

/** Ítem activo para una ruta: el de prefijo más largo que coincida (las subrutas cuentan). */
export function activeRailKey(pathname: string, items: readonly RailItem[] = [...RAIL_ITEMS, RAIL_SETTINGS]): string | null {
  let best: RailItem | null = null;
  for (const item of items) {
    const hit = item.match === '/' ? pathname === '/' : pathname === item.match || pathname.startsWith(`${item.match}/`);
    if (hit && (!best || item.match.length > best.match.length)) best = item;
  }
  return best?.key ?? null;
}

/**
 * Rutas de formulario (nombres de expo-router dentro de `(app)`): en escritorio se abren como
 * ventana centrada sobre la pantalla actual en vez de ocuparla entera.
 */
export const DIALOG_ROUTES: ReadonlySet<string> = new Set([
  'transactions/new',
  'transactions/[id]/edit',
  'transfers/[id]/edit',
  'accounts/new',
  'debts/new',
  'debts/[id]/pay',
  'goals/new',
  'goals/[id]/contribute',
  'recurring/new',
  'recurring/[id]',
  'recurring/[id]/confirm',
]);

export function isDialogRoute(routeName: string): boolean {
  return DIALOG_ROUTES.has(routeName);
}

/** Esqueleto que se muestra mientras carga cada pantalla de escritorio (ver `ScreenSkeleton`). */
export type SkeletonKind = 'dashboard' | 'table' | 'cards' | 'weeks' | 'chart' | 'cashflow' | 'settings';

const SKELETONS: Readonly<Record<string, SkeletonKind>> = {
  index: 'dashboard',
  'goals/index': 'cards',
  'recurring/index': 'weeks',
  flow: 'chart',
  cashflow: 'cashflow',
  settings: 'settings',
};

/** Listas, detalles y lo demás usan la tabla. */
export function skeletonFor(routeName: string): SkeletonKind {
  return SKELETONS[routeName] ?? 'table';
}
