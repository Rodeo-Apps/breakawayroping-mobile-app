import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PostComment = {
  id: string;
  author_id: string;
  author_name: string;
  content: string;
  created_at: string;
};

/**
 * Like / unlike, create posts, and read/write comments. Denormalised counts on
 * `posts` are maintained by DB triggers, so callers only need to refetch.
 */
export function usePostSocialActions() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLike = async (postId: string, currentlyLiked: boolean): Promise<boolean> => {
    if (!user) return currentlyLiked;
    setError(null);
    try {
      if (currentlyLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
        return false;
      }
      await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      return true;
    } catch (e) {
      setError((e as Error).message);
      return currentlyLiked;
    }
  };

  const createPost = async (content: string, photoUrl?: string): Promise<boolean> => {
    if (!user) return false;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('posts').insert({
        author_id: user.id,
        content: content.trim() || null,
        photo_url: photoUrl || null,
      });
      if (err) throw err;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const getComments = async (postId: string): Promise<PostComment[]> => {
    const { data: rows } = await supabase
      .from('post_comments')
      .select('id, author_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    const list = rows ?? [];
    const ids = [...new Set(list.map((c) => c.author_id))];
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name').in('id', ids);
      if (profs) names = Object.fromEntries(profs.map((p) => [p.id, p.full_name ?? 'Rodeo athlete']));
    }
    return list.map((c) => ({
      id: c.id,
      author_id: c.author_id,
      author_name: names[c.author_id] ?? 'Rodeo athlete',
      content: c.content,
      created_at: c.created_at,
    }));
  };

  const addComment = async (postId: string, content: string): Promise<boolean> => {
    if (!user || !content.trim()) return false;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('post_comments')
        .insert({ post_id: postId, author_id: user.id, content: content.trim() });
      if (err) throw err;
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { toggleLike, createPost, getComments, addComment, busy, error };
}
