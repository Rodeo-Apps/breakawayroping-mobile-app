import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type FeedPost = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  content: string | null;
  photo_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_me: boolean;
};

/**
 * Global social feed (most recent first). Author profiles and the current
 * user's like state are fetched in bulk and merged, rather than relying on a
 * DB-level join that may not be inferable across the auth boundary.
 */
export function useHomeFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { data: rows, error: err } = await supabase
        .from('posts')
        .select('id, author_id, content, photo_url, likes_count, comments_count, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (err) throw err;

      const list = rows ?? [];
      const authorIds = [...new Set(list.map((p) => p.author_id).filter(Boolean))];

      let authorMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (authorIds.length) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', authorIds);
        if (profs) {
          authorMap = Object.fromEntries(
            profs.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]),
          );
        }
      }

      let likedSet = new Set<string>();
      if (user && list.length) {
        const { data: likes } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', user.id)
          .in('post_id', list.map((p) => p.id));
        if (likes) likedSet = new Set(likes.map((l) => l.post_id));
      }

      setPosts(
        list.map((p) => ({
          id: p.id,
          author_id: p.author_id,
          author_name: authorMap[p.author_id]?.full_name ?? 'Rodeo athlete',
          author_avatar: authorMap[p.author_id]?.avatar_url ?? null,
          content: p.content,
          photo_url: p.photo_url,
          likes_count: p.likes_count ?? 0,
          comments_count: p.comments_count ?? 0,
          created_at: p.created_at,
          liked_by_me: likedSet.has(p.id),
        })),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return { posts, loading, refreshing, error, refetch: load, refresh };
}
