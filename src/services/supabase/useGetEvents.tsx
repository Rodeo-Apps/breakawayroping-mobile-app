import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { app } from '@/constants/theme';

export type EventItem = {
  id: string;
  discipline: string | null;
  title: string;
  description: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  start_date: string | null;
  end_date: string | null;
  entries_open: string | null;
  entries_close: string | null;
  producer_id: string | null;
  created_at: string;
};

/**
 * Upcoming events for this discipline. Falls back to all disciplines if none
 * are tagged for this one yet, so the list is never empty for setup reasons.
 */
export function useGetEvents() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('events')
        .select('*')
        .or(`discipline.eq.${app.eventType},discipline.is.null`)
        .order('start_date', { ascending: true });
      if (err) throw err;
      setEvents((data as EventItem[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { events, loading, error, refetch: load };
}
