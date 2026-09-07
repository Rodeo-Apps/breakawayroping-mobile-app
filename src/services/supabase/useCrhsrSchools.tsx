import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { School } from '@/services/supabase/useCrhsr';

/**
 * Searchable directory of schools for CRHSR registration. Debounced by the
 * caller via the `query` argument; empty query returns the first page.
 */
export function useCrhsrSchools(query: string, level?: 'college' | 'high_school') {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      let q = supabase
        .from('schools')
        .select('id, name, level, association, region, state')
        .order('name', { ascending: true })
        .limit(50);
      if (query.trim()) q = q.ilike('name', `%${query.trim()}%`);
      if (level) q = q.eq('level', level);
      const { data, error: err } = await q;
      if (err) throw err;
      setSchools((data as School[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, level]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return { schools, loading, error, refetch: load };
}
