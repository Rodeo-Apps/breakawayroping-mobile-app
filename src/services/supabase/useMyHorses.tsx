import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type Horse = {
  id: string;
  owner_id: string;
  name: string | null;
  breed: string | null;
  age: number | null;
  color: string | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string;
};

export function useMyHorses() {
  const { user } = useAuth();
  const [horses, setHorses] = useState<Horse[]>([]);
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
        .from('horses')
        .select('id, owner_id, name, breed, age, color, notes, photo_url, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false });
      if (err) throw err;
      setHorses((data as Horse[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { horses, loading, error, refetch: load };
}
