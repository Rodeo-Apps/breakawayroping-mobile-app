import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type TeamMember = {
  id: string;
  user_id: string;
  name: string;
  role: string;
};

export type TeamAnalysis = {
  id: string;
  athlete_name: string | null;
  video_url: string | null;
  status: string;
  result_json: any;
  created_at: string;
};

export function useTeamDetail(teamId?: string) {
  const [team, setTeam] = useState<{ id: string; name: string; owner_id: string } | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [analyses, setAnalyses] = useState<TeamAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!teamId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data: t, error: tErr } = await supabase
        .from('coaching_teams')
        .select('id, name, owner_id')
        .eq('id', teamId)
        .single();
      if (tErr) throw tErr;
      setTeam(t);

      const { data: memberRows } = await supabase
        .from('team_members')
        .select('id, user_id, role')
        .eq('team_id', teamId);
      const list = memberRows ?? [];
      const ids = [...new Set(list.map((m) => m.user_id))];
      let names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        if (profs) names = Object.fromEntries(profs.map((p) => [p.id, p.full_name ?? 'Athlete']));
      }
      setMembers(
        list.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          name: names[m.user_id] ?? 'Athlete',
          role: m.role,
        })),
      );

      const { data: analysisRows } = await supabase
        .from('team_video_analyses')
        .select('id, athlete_name, video_url, status, result_json, created_at')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(50);
      setAnalyses((analysisRows as TeamAnalysis[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  return { team, members, analyses, loading, error, refetch: load };
}
