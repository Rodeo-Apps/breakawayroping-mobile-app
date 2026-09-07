import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing, app } from '@/constants/theme';
import { useMyHorses } from '@/services/supabase/useMyHorses';

const ROUGHSTOCK = ['saddlebronc', 'bareback', 'bullriding'];

export function HorsesScreen() {
  const { horses, loading, error, refetch } = useMyHorses();
  const [refreshing, setRefreshing] = useState(false);

  const isRoughstock = ROUGHSTOCK.includes(app.eventType);
  const noun = isRoughstock ? 'Animal' : 'Horse';
  const nounPlural = isRoughstock ? 'Animals' : 'Horses';

  // Refresh when returning from the add-horse form.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
      }
    >
      <View style={st.headerRow}>
        <Text style={st.title}>My {nounPlural}</Text>
        <TouchableOpacity style={st.addBtn} onPress={() => router.push('/add-horse')}>
          <Text style={st.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : error ? (
        <EmptyState title="Could not load" body={error} actionLabel="Retry" onAction={refetch} />
      ) : horses.length === 0 ? (
        <EmptyState
          title={`No ${nounPlural.toLowerCase()} yet`}
          body={`Add the ${nounPlural.toLowerCase()} you compete on to keep notes and track performance.`}
          actionLabel={`Add a ${noun.toLowerCase()}`}
          onAction={() => router.push('/add-horse')}
        />
      ) : (
        horses.map((h) => (
          <TouchableOpacity key={h.id} style={st.card} onPress={() => router.push(`/horse/${h.id}`)}>
            <Text style={st.cardTitle}>{h.name ?? 'Unnamed'}</Text>
            <Text style={st.cardMeta}>
              {[h.breed, h.color, h.age ? `${h.age} yrs` : null].filter(Boolean).join(' · ') || 'No details yet'}
            </Text>
            {h.notes ? (
              <Text style={st.cardBody} numberOfLines={2}>
                {h.notes}
              </Text>
            ) : null}
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 13, color: colors.muted },
  cardBody: { fontSize: 14, color: colors.text, lineHeight: 20, marginTop: 4 },
});
