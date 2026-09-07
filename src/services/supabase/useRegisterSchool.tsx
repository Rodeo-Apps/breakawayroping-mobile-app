import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Register the current user with a school as an athlete or coach.
 *
 * - Athletes create a `school_affiliations` row (status `pending`) awaiting
 *   verification by a school coach/admin.
 * - Coaches additionally get a `school_staff` row and have their profile
 *   flagged as a coach so the coach tools unlock.
 */
export function useRegisterSchool() {
  const { user, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = async (args: {
    schoolId: string;
    role: 'athlete' | 'coach';
    region?: string;
  }): Promise<boolean> => {
    if (!user) return false;
    setSubmitting(true);
    setError(null);
    try {
      const { error: affErr } = await supabase.from('school_affiliations').upsert(
        {
          user_id: user.id,
          school_id: args.schoolId,
          role: args.role,
          region: args.region ?? null,
          // Coaches self-verify on registration; athletes await verification.
          status: args.role === 'coach' ? 'verified' : 'pending',
        },
        { onConflict: 'user_id,school_id' },
      );
      if (affErr) throw affErr;

      if (args.role === 'coach') {
        // Best-effort staff row + profile flag so coach tooling unlocks.
        await supabase
          .from('school_staff')
          .upsert(
            { school_id: args.schoolId, user_id: user.id, role: 'coach' },
            { onConflict: 'school_id,user_id' },
          );
        await supabase
          .from('profiles')
          .update({ is_coach: true, school_id: args.schoolId })
          .eq('id', user.id);
        await refreshProfile();
      }
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Coach action: verify (or reject) a pending athlete affiliation for a
   * school the coach manages.
   */
  const setAffiliationStatus = async (
    affiliationId: string,
    status: 'verified' | 'withdrawn',
  ): Promise<boolean> => {
    setSubmitting(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('school_affiliations')
        .update({ status })
        .eq('id', affiliationId);
      if (err) throw err;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSubmitting(false);
    }
  };

  return { register, setAffiliationStatus, submitting, error };
}
