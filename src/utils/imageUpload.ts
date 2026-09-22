import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

// Image picking + upload helper, following the BarrelConnect storage pattern
// (see lib/videoFrames.ts). Used for profile avatars and marketplace listing
// photos. Buckets `avatars` and `listing-photos` are created by the Supabase
// migrations and are public-read.

export type PickedImage = { uri: string; mimeType: string };

function extFromUri(uri: string): string {
  const raw = (uri.split('.').pop() ?? 'jpg').split('?')[0];
  return (raw || 'jpg').toLowerCase();
}

function contentTypeFor(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'heic') return 'image/heic';
  return 'image/jpeg';
}

/** Prompt for library permission and let the user pick a single square-ish image. */
export async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    quality: 0.8,
  });
  if (result.canceled) return null;

  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  const ext = extFromUri(asset.uri);
  return { uri: asset.uri, mimeType: asset.mimeType ?? contentTypeFor(ext) };
}

/** Upload a local image URI to a storage bucket and return its public URL. */
export async function uploadImage(
  bucket: string,
  userId: string,
  image: PickedImage,
): Promise<string> {
  const ext = extFromUri(image.uri);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const res = await fetch(image.uri);
  const bytes = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType: image.mimeType || contentTypeFor(ext), upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
