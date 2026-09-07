import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Affiliation, School } from '@/services/supabase/useCrhsr';

/**
 * Full affiliation roster for a school — used by coaches to verify pending
 * athletes and view the verified team. Enriches each row with the athlete's
 * display name from `profiles`.
 */
export function useSchoolRoster(schoolId?: string) {
  const [school, setSchool] = useState<School | null>(null);
  const [roster, setRoster] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!schoolId) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: sch } = await supabase
        .from('schools')
        .select('id, name, level, association, region, state')
        .eq('id', schoolId)
        .single();
      setSchool((sch as School) ?? null);

      const { data: rows, error: err } = await supabase
        .from('school_affiliations')
        .select('id, user_id, school_id, role, status, region, season_points, created_at')
        .eq('school_id', schoolId)
        .neq('status', 'withdrawn')
        .order('season_points', { ascending: false });
      if (err) throw err;

      const list = (rows ?? []) as Omit<Affiliation, 'school'>[];
      const ids = [...new Set(list.map((r) => r.user_id))];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', ids);
        if (profs) names = Object.fromEntries(profs.map((p) => [p.id, p.full_name ?? 'Athlete']));
      }
      setRoster(
        list.map((r) => ({ ...r, school: (sch as School) ?? null, name: names[r.user_id] ?? 'Athlete' })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    load();
  }, [load]);

  return { school, roster, loading, error, refetch: load };
}
