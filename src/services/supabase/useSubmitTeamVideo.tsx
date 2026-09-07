import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { app } from '@/constants/theme';

/**
 * Create a team_video_analyses row (status=processing), then kick off the
 * analyze-team-video edge function. Returns the analysis id so the caller can
 * navigate to the processing screen and poll the row.
 */
export function useSubmitTeamVideo() {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (args: {
    teamId: string;
    videoUrl: string;
    frameUrls?: string[];
    athleteId?: string;
    athleteName?: string;
  }): Promise<string | null> => {
    if (!user) return null;
    setSubmitting(true);
    setError(null);
    try {
      const { data: inserted, error: insErr } = await supabase
        .from('team_video_analyses')
        .insert({
          team_id: args.teamId,
          submitted_by: user.id,
          athlete_id: args.athleteId ?? null,
          athlete_name: args.athleteName ?? null,
          video_url: args.videoUrl,
          status: 'processing',
        })
        .select('id')
        .single();
      if (insErr) throw insErr;

      const analysisId = inserted.id as string;

      // Fire the edge function (best-effort — the row is already tracking state).
      supabase.functions
        .invoke('analyze-team-video', {
          body: {
            analysis_id: analysisId,
            team_id: args.teamId,
            video_url: args.videoUrl,
            frame_urls: args.frameUrls,
            athlete_name: args.athleteName,
            event_type: app.eventType,
          },
        })
        .catch(() => {
          // Network/edge errors are reflected in the row status by the function.
        });

      return analysisId;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setSubmitting(false);
    }
  };

  const getAnalysis = async (analysisId: string) => {
    const { data } = await supabase
      .from('team_video_analyses')
      .select('id, athlete_name, video_url, status, result_json, created_at')
      .eq('id', analysisId)
      .single();
    return data;
  };

  return { submit, getAnalysis, submitting, error };
}
