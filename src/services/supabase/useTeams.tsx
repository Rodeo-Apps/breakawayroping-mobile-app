import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Team = {
  id: string;
  name: string;
  owner_id: string;
  school_id: string | null;
  created_at: string;
  role: 'owner' | 'coach' | 'athlete';
  member_count: number;
};

/**
 * Teams the current user belongs to — as owner (coach) or as a roster member.
 * Uses coaching_teams + team_members from migration 003.
 */
export function useTeams() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      // Teams I own.
      const { data: owned } = await supabase
        .from('coaching_teams')
        .select('id, name, owner_id, school_id, created_at')
        .eq('owner_id', user.id);

      // Teams I'm a member of.
      const { data: memberships } = await supabase
        .from('team_members')
        .select('team_id, role')
        .eq('user_id', user.id);

      const memberTeamIds = (memberships ?? []).map((m) => m.team_id);
      let memberTeams: any[] = [];
      if (memberTeamIds.length) {
        const { data: mt } = await supabase
          .from('coaching_teams')
          .select('id, name, owner_id, school_id, created_at')
          .in('id', memberTeamIds);
        memberTeams = mt ?? [];
      }

      const byId = new Map<string, Team>();
      for (const t of owned ?? []) {
        byId.set(t.id, { ...t, role: 'owner', member_count: 0 });
      }
      for (const t of memberTeams) {
        if (!byId.has(t.id)) {
          const role = (memberships ?? []).find((m) => m.team_id === t.id)?.role ?? 'athlete';
          byId.set(t.id, { ...t, role, member_count: 0 });
        }
      }

      const teamList = [...byId.values()];
      // Member counts.
      if (teamList.length) {
        const { data: counts } = await supabase
          .from('team_members')
          .select('team_id')
          .in('team_id', teamList.map((t) => t.id));
        const countMap: Record<string, number> = {};
        for (const row of counts ?? []) {
          countMap[row.team_id] = (countMap[row.team_id] ?? 0) + 1;
        }
        for (const t of teamList) t.member_count = countMap[t.id] ?? 0;
      }

      setTeams(teamList);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const createTeam = async (name: string): Promise<boolean> => {
    if (!user || !name.trim()) return false;
    try {
      const { error: err } = await supabase
        .from('coaching_teams')
        .insert({ name: name.trim(), owner_id: user.id });
      if (err) throw err;
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  };

  return { teams, loading, error, refetch: load, createTeam };
}
