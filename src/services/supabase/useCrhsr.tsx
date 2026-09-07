import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type School = {
  id: string;
  name: string;
  level: string;
  association: string | null;
  region: string | null;
  state: string | null;
};

export type Affiliation = {
  id: string;
  user_id: string;
  school_id: string;
  role: 'athlete' | 'coach';
  status: 'pending' | 'verified' | 'withdrawn';
  region: string | null;
  season_points: number;
  created_at: string;
  school: School | null;
  name?: string;
};

/**
 * The current user's college / high-school rodeo (CRHSR) standing: their
 * active school affiliation, the school record, and the team standings for
 * that school (verified athletes ranked by season points).
 */
export function useCrhsr() {
  const { user } = useAuth();
  const [affiliation, setAffiliation] = useState<Affiliation | null>(null);
  const [standings, setStandings] = useState<Affiliation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: rows, error: affErr } = await supabase
        .from('school_affiliations')
        .select('id, user_id, school_id, role, status, region, season_points, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (affErr) throw affErr;

      const active =
        (rows ?? []).find((r) => r.status !== 'withdrawn') ?? (rows ?? [])[0] ?? null;

      let mine: Affiliation | null = null;
      if (active) {
        const { data: school } = await supabase
          .from('schools')
          .select('id, name, level, association, region, state')
          .eq('id', active.school_id)
          .single();
        mine = { ...active, school: (school as School) ?? null };
        setAffiliation(mine);

        // Team standings for the same school.
        const { data: peers } = await supabase
          .from('school_affiliations')
          .select('id, user_id, school_id, role, status, region, season_points, created_at')
          .eq('school_id', active.school_id)
          .eq('status', 'verified')
          .order('season_points', { ascending: false })
          .limit(50);

        const peerList = (peers ?? []) as Omit<Affiliation, 'school'>[];
        const ids = [...new Set(peerList.map((p) => p.user_id))];
        let names: Record<string, string> = {};
        if (ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('id', ids);
          if (profs)
            names = Object.fromEntries(profs.map((p) => [p.id, p.full_name ?? 'Athlete']));
        }
        setStandings(
          peerList.map((p) => ({
            ...p,
            school: mine?.school ?? null,
            name: names[p.user_id] ?? 'Athlete',
          })),
        );
      } else {
        setAffiliation(null);
        setStandings([]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async (affiliationId: string): Promise<boolean> => {
    try {
      const { error: err } = await supabase
        .from('school_affiliations')
        .update({ status: 'withdrawn' })
        .eq('id', affiliationId);
      if (err) throw err;
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  return { affiliation, standings, loading, error, refetch: load, withdraw };
}
