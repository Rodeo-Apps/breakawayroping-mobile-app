import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type NewHorse = {
  name: string;
  breed?: string;
  age?: string;
  color?: string;
  notes?: string;
  photo_url?: string;
};

export function useAddHorse() {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addHorse = async (input: NewHorse): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        owner_id: user.id,
        name: input.name.trim(),
        breed: input.breed?.trim() || null,
        age: input.age ? Number(input.age) : null,
        color: input.color?.trim() || null,
        notes: input.notes?.trim() || null,
        photo_url: input.photo_url || null,
      };
      const { error: err } = await supabase.from('horses').insert(payload);
      if (err) throw err;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { addHorse, saving, error };
}
