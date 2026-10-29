// Textos de progreso de una meta (Dashboard.dc.html, pantalla Metas). Puras y sin `Intl`.
import type { GoalEta } from '../domain/rules/goalEta';
import { formatCOP } from '../domain/money';
import type { GoalView } from '../domain/services/GoalService';

type GoalProgress = Pick<GoalView, 'savedMinor' | 'targetMinor' | 'eta'>;

/** Porcentaje ahorrado redondeado (sin limitar a 100: la barra lo limita sola). */
export function goalPercent(savedMinor: number, targetMinor: number): number {
  return targetMinor > 0 ? Math.round((savedMinor / targetMinor) * 100) : 0;
}

/** Meta cumplida: ahorro >= objetivo (misma regla que `GoalService.close`). */
export function isGoalComplete(goal: Pick<GoalView, 'savedMinor' | 'targetMinor'>): boolean {
  return goal.targetMinor > 0 && goal.savedMinor >= goal.targetMinor;
}

/** '1 mes' | '9 meses'. */
export function monthsLabel(months: number): string {
  return `${months} ${months === 1 ? 'mes' : 'meses'}`;
}

function etaSentence(eta: GoalEta | null): string {
  if (eta === null || eta.kind === 'UNKNOWN' || eta.kind === 'REACHED') return 'fecha por calcular.';
  if (eta.kind === 'BY_PACE') return `a este ritmo, la cumples en ${monthsLabel(eta.monthsLeft)}.`;
  return eta.overdue
    ? 'la fecha objetivo ya pasó.'
    : `para llegar a tu fecha, aparta ${formatCOP(eta.requiredMonthlyMinor)} al mes.`;
}

/**
 * Linea bajo la barra. Diseno: «¡Cumplida!» o «{pct}% — a este ritmo, la cumples en {eta}.». Las demas
 * variantes del ETA (fecha objetivo, vencida, por calcular) no estan en el diseno: son inferidas.
 */
export function goalProgressLabel(goal: GoalProgress): string {
  if (isGoalComplete(goal)) return '¡Cumplida!';
  return `${goalPercent(goal.savedMinor, goal.targetMinor)}% — ${etaSentence(goal.eta)}`;
}
