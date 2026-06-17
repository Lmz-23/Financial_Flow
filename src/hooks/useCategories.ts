import { useState, useEffect, useCallback } from 'react';
import { database } from '../database';
import { categories } from '../database/schema';
import { eq, asc } from 'drizzle-orm';
import { useUserId } from '../store/useUserStore';
import type { Category } from '../database/schema';

// =============================================================================
// USE CATEGORIES HOOK
// =============================================================================

interface UseCategoriesState {
  categories: Category[];
  loading: boolean;
  error: Error | null;
}

export function useCategories(): UseCategoriesState {
  const [categoriesList, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        // Get both system defaults (userId = null) and user's custom categories
        const allCategories = await database.query.categories.findMany({
          orderBy: [asc(categories.order), asc(categories.name)],
        });
        setCategories(allCategories);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetch();
  }, []);

  return { categories: categoriesList, loading, error };
}

// Hook for categories filtered by type
export function useCategoriesByType(type: 'INCOME' | 'EXPENSE') {
  const { categories: allCategories, loading, error } = useCategories();

  const filteredCategories = allCategories.filter((c) => c.type === type);

  return { categories: filteredCategories, loading, error };
}
