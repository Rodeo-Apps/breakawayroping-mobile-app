import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Generic run insert for the discipline's run table. Callers pass a payload of
 * the discipline-specific columns (time, score, catch type, etc.); user_id is
 * attached here.
 */
export function useAddRun() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRun = async (payload: Record<string, any>): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('breakaway_runs')
        .insert({ user_id: user.id, ...payload });
      if (err) throw err;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { addRun, saving, error };
}
