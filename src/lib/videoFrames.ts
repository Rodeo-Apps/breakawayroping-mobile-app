import * as VideoThumbnails from 'expo-video-thumbnails';
import { supabase } from '@/lib/supabase';

// Client-side keyframe extraction + upload, following the BarrelConnect pattern.
//
// OpenAI vision reads images, not raw video, so we pull a handful of keyframes
// from the clip with expo-video-thumbnails, upload both the source clip and the
// frames to Supabase storage, and hand the public frame URLs to the edge
// function. Only a few small JPEGs are what the model actually reads.

// Breakaway runs are short (~2-4s from barrier to catch). Sample densely early,
// then taper. Extraction stops as soon as a timestamp is past the clip end.
const FRAME_TIMES_MS = [
  0, 400, 800, 1200, 1600, 2000, 2500, 3000, 3500, 4000, 5000, 6000, 8000,
];
const MAX_FRAMES = 12;

export type ExtractedFrame = { uri: string; timeMs: number };

/** Extract up to MAX_FRAMES keyframes from a local video URI. */
export async function extractFrames(videoUri: string): Promise<ExtractedFrame[]> {
  const frames: ExtractedFrame[] = [];
  for (const timeMs of FRAME_TIMES_MS) {
    if (frames.length >= MAX_FRAMES) break;
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
        time: timeMs,
        quality: 0.7,
      });
      frames.push({ uri, timeMs });
    } catch (_e) {
      // Past the end of the clip (or a decode hiccup). If we already have a few
      // frames, stop — otherwise keep trying later offsets.
      if (frames.length > 0) break;
    }
  }
  return frames;
}

async function uploadBinary(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<string> {
  const res = await fetch(uri);
  const bytes = await res.arrayBuffer();
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload the source clip to the `videos` bucket and return its public URL. */
export async function uploadVideo(userId: string, videoUri: string): Promise<string> {
  const ext = (videoUri.split('.').pop() ?? 'mp4').split('?')[0] || 'mp4';
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  return uploadBinary('videos', path, videoUri, `video/${ext}`);
}

/** Upload extracted frames to the `video-frames` bucket; returns urls + times. */
export async function uploadFrames(
  userId: string,
  frames: ExtractedFrame[],
): Promise<{ frameUrls: string[]; frameTimesMs: number[] }> {
  const stamp = Date.now();
  const frameUrls: string[] = [];
  const frameTimesMs: number[] = [];
  let i = 0;
  for (const frame of frames) {
    const path = `${userId}/${stamp}-${i}-${frame.timeMs}.jpg`;
    const url = await uploadBinary('video-frames', path, frame.uri, 'image/jpeg');
    frameUrls.push(url);
    frameTimesMs.push(frame.timeMs);
    i++;
  }
  return { frameUrls, frameTimesMs };
}

/**
 * Full prep for one clip: extract frames, upload clip + frames, and return
 * everything the edge functions need. Frame extraction failures degrade
 * gracefully to a video-only payload.
 */
export async function prepareVideo(
  userId: string,
  videoUri: string,
): Promise<{ videoUrl: string; frameUrls: string[]; frameTimesMs: number[] }> {
  const [videoUrl, frames] = await Promise.all([
    uploadVideo(userId, videoUri),
    extractFrames(videoUri),
  ]);
  let frameUrls: string[] = [];
  let frameTimesMs: number[] = [];
  if (frames.length > 0) {
    const uploaded = await uploadFrames(userId, frames);
    frameUrls = uploaded.frameUrls;
    frameTimesMs = uploaded.frameTimesMs;
  }
  return { videoUrl, frameUrls, frameTimesMs };
}
