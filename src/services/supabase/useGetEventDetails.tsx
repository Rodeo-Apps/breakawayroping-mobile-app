import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { EventItem } from './useGetEvents';

export function useGetEventDetails(eventId?: string) {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [producerName, setProducerName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eventId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (err) throw err;
      setEvent(data as EventItem);

      if (data?.producer_id) {
        const { data: prod } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.producer_id)
          .maybeSingle();
        setProducerName(prod?.full_name ?? null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  return { event, producerName, loading, error, refetch: load };
}
