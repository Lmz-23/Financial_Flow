/** Textos de aviso de "Proximos pagos" segun el tipo de item (decision 34: el ingreso solo avisa el dia). */
export const EXPENSE_NOTICE = 'Te avisamos 2 días antes y el día del vencimiento.';
export const INCOME_NOTICE = 'Te avisamos el día en que esperamos el ingreso.';

/** Avisos a mostrar, uno por tipo presente en la lista (pagos primero). */
export function upcomingNotices(items: readonly { type: 'INCOME' | 'EXPENSE' }[]): string[] {
  const notices: string[] = [];
  if (items.some((i) => i.type === 'EXPENSE')) notices.push(EXPENSE_NOTICE);
  if (items.some((i) => i.type === 'INCOME')) notices.push(INCOME_NOTICE);
  return notices;
}

export const MARK_YOURSELF_NOTICE = 'También puedes marcarlo tú mismo cuando quieras.';

/**
 * Texto completo del párrafo de avisos. Lista vacía: null (no se renderiza). La frase de cierre solo
 * aparece si hay al menos un pago (los ingresos no tienen acción de "marcar").
 */
export function upcomingNoticeText(items: readonly { type: 'INCOME' | 'EXPENSE' }[]): string | null {
  const parts = upcomingNotices(items);
  if (parts.length === 0) return null;
  if (items.some((i) => i.type === 'EXPENSE')) parts.push(MARK_YOURSELF_NOTICE);
  return parts.join(' ');
}
