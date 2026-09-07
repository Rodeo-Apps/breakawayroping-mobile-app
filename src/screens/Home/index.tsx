import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';

import { Stat } from '@/components/ui/Stat';
import { colors, radius, spacing, app } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useHomeFeed, type FeedPost } from '@/services/supabase/useHomeFeed';
import { usePostSocialActions, type PostComment } from '@/services/supabase/usePostSocialActions';
import { useMyRuns, METRIC_TYPE } from '@/services/supabase/useMyRuns';

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function HomeScreen() {
  const { profile } = useAuth();
  const { posts, loading, refreshing, error, refetch, refresh } = useHomeFeed();
  const { createPost, busy } = usePostSocialActions();
  const { runs, personalBest } = useMyRuns();

  const [draft, setDraft] = useState('');

  const onPost = async () => {
    if (!draft.trim()) return;
    const ok = await createPost(draft);
    if (ok) {
      setDraft('');
      refetch();
    }
  };

  const pbLabel = personalBest == null ? '—' : METRIC_TYPE === 'time' ? `${personalBest}s` : String(personalBest);

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
    >
      <Text style={st.title}>{profile?.full_name ? `Howdy, ${profile.full_name.split(' ')[0]}` : app.name}</Text>

      {/* Quick dashboard */}
      <View style={st.dashCard}>
        <Stat label="Personal best" value={pbLabel} hint={app.eventLabel} />
        <View style={st.dashDivider} />
        <Stat label="Runs logged" value={String(runs.length)} hint="Practice log" />
      </View>
      <TouchableOpacity style={st.analyzeBtn} onPress={() => router.push('/analyze')}>
        <Text style={st.analyzeBtnText}>⭐ Analyze a video</Text>
      </TouchableOpacity>

      {/* Composer */}
      <View style={st.composer}>
        <TextInput
          style={st.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Share an update with the community…"
          placeholderTextColor={colors.muted}
          multiline
        />
        <TouchableOpacity style={[st.postBtn, (busy || !draft.trim()) && st.disabled]} onPress={onPost} disabled={busy || !draft.trim()}>
          <Text style={st.postBtnText}>{busy ? 'Posting…' : 'Post'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={st.sectionTitle}>Community feed</Text>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : error ? (
        <Text style={st.muted}>{error}</Text>
      ) : posts.length === 0 ? (
        <Text style={st.muted}>No posts yet. Be the first to share something with the community.</Text>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChanged={refetch} />)
      )}
    </ScrollView>
  );
}

function PostCard({ post, onChanged }: { post: FeedPost; onChanged: () => void }) {
  const { toggleLike, getComments, addComment, busy } = usePostSocialActions();
  const [liked, setLiked] = useState(post.liked_by_me);
  const [likeCount, setLikeCount] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [draft, setDraft] = useState('');

  const onLike = async () => {
    // Optimistic.
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    const confirmed = await toggleLike(post.id, liked);
    if (confirmed !== next) {
      setLiked(confirmed);
      setLikeCount((c) => c + (confirmed ? 1 : -1) - (next ? 1 : -1));
    }
  };

  const onToggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0) {
      setLoadingComments(true);
      setComments(await getComments(post.id));
      setLoadingComments(false);
    }
  };

  const onAddComment = async () => {
    if (!draft.trim()) return;
    const ok = await addComment(post.id, draft);
    if (ok) {
      setDraft('');
      setComments(await getComments(post.id));
      onChanged();
    }
  };

  return (
    <View style={st.postCard}>
      <View style={st.postHeader}>
        <View style={st.avatar}>
          <Text style={st.avatarText}>{post.author_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.author}>{post.author_name}</Text>
          <Text style={st.postTime}>{timeAgo(post.created_at)}</Text>
        </View>
      </View>
      {post.content ? <Text style={st.postBody}>{post.content}</Text> : null}

      <View style={st.actionRow}>
        <TouchableOpacity style={st.action} onPress={onLike}>
          <Text style={[st.actionText, liked && st.actionActive]}>{liked ? '♥' : '♡'} {likeCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.action} onPress={onToggleComments}>
          <Text style={st.actionText}>💬 {post.comments_count}</Text>
        </TouchableOpacity>
      </View>

      {showComments ? (
        <View style={st.comments}>
          {loadingComments ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            comments.map((c) => (
              <View key={c.id} style={st.comment}>
                <Text style={st.commentAuthor}>{c.author_name}</Text>
                <Text style={st.commentBody}>{c.content}</Text>
              </View>
            ))
          )}
          <View style={st.commentComposer}>
            <TextInput
              style={st.commentInput}
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a comment…"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity onPress={onAddComment} disabled={busy || !draft.trim()}>
              <Text style={[st.commentSend, (busy || !draft.trim()) && st.disabled]}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  dashCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dashDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border, marginHorizontal: 16 },
  analyzeBtn: { borderWidth: 1, borderColor: colors.accent, borderRadius: radius.control, padding: 14, alignItems: 'center' },
  analyzeBtnText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  composer: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  composerInput: { color: colors.text, fontSize: 15, minHeight: 44, textAlignVertical: 'top' },
  postBtn: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 8 },
  postBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.5 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 4 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 21 },
  postCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  author: { fontSize: 15, fontWeight: '600', color: colors.text },
  postTime: { fontSize: 12, color: colors.muted },
  postBody: { fontSize: 15, color: colors.text, lineHeight: 22 },
  actionRow: { flexDirection: 'row', gap: 20, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  action: { flexDirection: 'row', alignItems: 'center' },
  actionText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  actionActive: { color: colors.accent },
  comments: { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  comment: { gap: 2 },
  commentAuthor: { fontSize: 13, fontWeight: '600', color: colors.text },
  commentBody: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  commentInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 14,
  },
  commentSend: { color: colors.accent, fontWeight: '700', fontSize: 14 },
});
