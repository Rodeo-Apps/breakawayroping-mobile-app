import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// One-on-one conversation, ported from BarrelConnect. Reads/writes `messages`
// between the current user and the routed `userId`.

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  created_at: string;
};

export function ChatScreen() {
  const params = useLocalSearchParams<{ userId: string }>();
  const otherId =
    typeof params.userId === 'string' ? params.userId : Array.isArray(params.userId) ? params.userId[0] : undefined;
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(async () => {
    if (!user || !otherId) return;
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, content, created_at')
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${user.id})`,
      )
      .order('created_at', { ascending: true })
      .limit(200);
    setMessages((data as Message[]) ?? []);
    setLoading(false);
    // mark unread inbound as read
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', user.id)
      .eq('sender_id', otherId)
      .is('read_at', null);
  }, [user, otherId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !user || !otherId || sending) return;
    setSending(true);
    setText('');
    const { data } = await supabase
      .from('messages')
      .insert({ sender_id: user.id, recipient_id: otherId, content: body })
      .select('id, sender_id, recipient_id, content, created_at')
      .maybeSingle();
    if (data) setMessages((prev) => [...prev, data as Message]);
    setSending(false);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={st.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={st.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={<Text style={st.empty}>Say hello 👋</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === user?.id;
          return (
            <View style={[st.bubbleRow, mine ? st.rowMine : st.rowTheirs]}>
              <View style={[st.bubble, mine ? st.bubbleMine : st.bubbleTheirs]}>
                <Text style={[st.bubbleText, mine && st.bubbleTextMine]}>{item.content}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={st.inputBar}>
        <TextInput
          style={st.input}
          value={text}
          onChangeText={setText}
          placeholder="Message..."
          placeholderTextColor={colors.muted}
          multiline
        />
        <TouchableOpacity style={st.sendBtn} onPress={send} disabled={sending || !text.trim()}>
          <Text style={st.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.screenX, gap: 8, flexGrow: 1 },
  empty: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 60 },
  bubbleRow: { flexDirection: 'row' },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: radius.card, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: colors.accent },
  bubbleTheirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bubbleTextMine: { color: '#fff' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  sendText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
