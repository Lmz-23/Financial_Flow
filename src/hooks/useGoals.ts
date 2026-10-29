import type { GoalView } from '../domain/services/GoalService';
import { useDomainQuery } from './useDomainQuery';

/** Metas activas (las gastadas no aparecen). */
export function useGoals(): GoalView[] {
  return useDomainQuery(['goals'], (domain) => domain.goals.list('ACTIVE'));
}
