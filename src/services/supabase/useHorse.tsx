import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Horse } from './useMyHorses';

export type HorseRun = {
  id: string;
  created_at: string;
  metric: number | string | null;
  notes: string | null;
};

/**
 * A single horse plus any runs logged against it. Runs are matched on a
 * horse_name column when the discipline run table has one (roughstock and
 * roping events), so this degrades gracefully when it does not.
 */
export function useHorse(horseId?: string) {
  const [horse, setHorse] = useState<Horse | null>(null);
  const [runs, setRuns] = useState<HorseRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!horseId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('horses')
        .select('id, owner_id, name, breed, age, color, notes, photo_url, created_at')
        .eq('id', horseId)
        .single();
      if (err) throw err;
      setHorse(data as Horse);

      // Best-effort: link runs by horse_name if the run table supports it.
      // Wrapped independently so a table without a horse_name column never
      // breaks the horse detail screen.
      if (data?.name) {
        try {
          const { data: runRows, error: runErr } = await supabase
            .from('breakaway_runs')
            .select('id, created_at, time_seconds, notes')
            .eq('horse_name', data.name)
            .order('created_at', { ascending: false })
            .limit(20);
          if (!runErr && runRows) {
            setRuns(
              runRows.map((r: any) => ({
                id: r.id,
                created_at: r.created_at,
                metric: r.time_seconds ?? null,
                notes: r.notes ?? null,
              })),
            );
          }
        } catch {
          // discipline run table has no horse_name column — leave runs empty
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [horseId]);

  useEffect(() => {
    load();
  }, [load]);

  return { horse, runs, loading, error, refetch: load };
}
