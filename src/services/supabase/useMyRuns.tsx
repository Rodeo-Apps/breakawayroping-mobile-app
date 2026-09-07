import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type RunRow = Record<string, any> & {
  id: string;
  created_at: string;
  notes: string | null;
};

// The discipline's primary metric column and whether lower (time) or higher
// (score) is better. Filled in per app by the build.
export const METRIC_COL = 'time_seconds';
export const METRIC_TYPE: 'time' | 'score' = 'time';

export function useMyRuns() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('breakaway_runs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (err) throw err;
      setRuns((data as RunRow[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Personal best across the primary metric.
  const personalBest = (() => {
    const values = runs
      .map((r) => Number(r[METRIC_COL]))
      .filter((v) => !Number.isNaN(v) && v > 0);
    if (!values.length) return null;
    return METRIC_TYPE === 'time' ? Math.min(...values) : Math.max(...values);
  })();

  return { runs, personalBest, loading, error, refetch: load };
}
