import type { GoalView } from '../domain/services/GoalService';
import { useDomainQuery } from './useDomainQuery';

/** Una meta (activa o gastada) o undefined si no existe. */
export function useGoal(id: string): GoalView | undefined {
  return useDomainQuery(['goals'], (domain) => domain.goals.get(id), id);
}
