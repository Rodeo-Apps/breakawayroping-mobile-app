import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { colors, radius, spacing } from '@/constants/theme';

// Marketplace listing detail, ported from BarrelConnect. Shows full listing,
// seller, photos and lets a buyer save the listing or message the seller.

type Detail = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  condition: string | null;
  location_city: string | null;
  location_state: string | null;
  status: string;
  created_at: string;
};

type Seller = { id: string; name: string | null; username: string | null; avatar_url: string | null };

export function ListingDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { user } = useAuth();
  const [listing, setListing] = useState<Detail | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('marketplace_listings').select('*').eq('id', id).maybeSingle();
    const row = data as Detail | null;
    setListing(row);
    if (row) {
      const [{ data: prof }, { data: pics }] = await Promise.all([
        supabase.from('profiles').select('id, name, username, avatar_url').eq('id', row.user_id).maybeSingle(),
        supabase.from('listing_photos').select('photo_url').eq('listing_id', id).order('sort_order'),
      ]);
      setSeller((prof as Seller) ?? null);
      const urls = ((pics as { photo_url: string }[]) ?? []).map((p) => p.photo_url);
      setPhotos(urls);
      if (user) {
        const { data: sv } = await supabase
          .from('listing_saves')
          .select('listing_id')
          .eq('listing_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setSaved(!!sv);
      }
    }
    setLoading(false);
  }, [id, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSave = async () => {
    if (!user || !id) return;
    if (saved) {
      await supabase.from('listing_saves').delete().eq('listing_id', id).eq('user_id', user.id);
      setSaved(false);
    } else {
      await supabase.from('listing_saves').insert({ listing_id: id, user_id: user.id });
      setSaved(true);
    }
  };

  if (loading) {
    return (
      <View style={st.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!listing) {
    return (
      <View style={st.center}>
        <Text style={st.muted}>Listing not found.</Text>
      </View>
    );
  }

  const isOwner = user?.id === listing.user_id;

  return (
    <ScrollView style={st.container} contentContainerStyle={st.content}>
      {photos.length > 0 && photos[0] ? (
        <Image source={{ uri: photos[0] }} style={st.hero} resizeMode="cover" />
      ) : (
        <View style={[st.hero, st.heroPlaceholder]}>
          <Text style={st.muted}>No photos</Text>
        </View>
      )}

      <View style={st.head}>
        <Text style={st.title}>{listing.title}</Text>
        <Text style={st.price}>${listing.price.toLocaleString()}</Text>
      </View>

      <View style={st.metaRow}>
        <Text style={st.tag}>{listing.category}</Text>
        {listing.condition ? <Text style={st.tag}>{listing.condition}</Text> : null}
        {listing.location_city ? (
          <Text style={st.muted}>
            {listing.location_city}
            {listing.location_state ? `, ${listing.location_state}` : ''}
          </Text>
        ) : null}
      </View>

      <Text style={st.desc}>{listing.description}</Text>

      {seller ? (
        <TouchableOpacity style={st.seller} onPress={() => router.push(`/user/${seller.id}`)}>
          {seller.avatar_url ? (
            <Image source={{ uri: seller.avatar_url }} style={st.avatar} />
          ) : (
            <View style={[st.avatar, st.avatarPlaceholder]} />
          )}
          <View>
            <Text style={st.sellerName}>{seller.name ?? seller.username ?? 'Seller'}</Text>
            <Text style={st.muted}>View seller profile</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {!isOwner ? (
        <View style={st.actions}>
          <TouchableOpacity style={st.primary} onPress={() => router.push(`/messages/${listing.user_id}`)}>
            <Text style={st.primaryText}>Message seller</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[st.secondary, saved && st.savedBtn]} onPress={toggleSave}>
            <Text style={st.secondaryText}>{saved ? '♥ Saved' : '♡ Save'}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={st.ownerNote}>This is your listing.</Text>
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.screenX, gap: 14, paddingBottom: 60 },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.muted, fontSize: 13 },
  hero: { width: '100%', height: 240, borderRadius: radius.card, backgroundColor: colors.card },
  heroPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', flex: 1 },
  price: { color: colors.accent, fontSize: 22, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10 },
  tag: {
    color: colors.text,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  desc: { color: colors.text, fontSize: 15, lineHeight: 22 },
  seller: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: spacing.cardPad,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surface },
  avatarPlaceholder: { backgroundColor: colors.surface },
  sellerName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  primary: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.control,
    paddingVertical: 14,
    alignItems: 'center',
  },
  savedBtn: { borderColor: colors.accent },
  secondaryText: { color: colors.text, fontWeight: '700', fontSize: 15 },
  ownerNote: { color: colors.muted, fontSize: 14, textAlign: 'center', marginTop: 8 },
});
