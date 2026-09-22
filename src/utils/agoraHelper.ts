import {
  createAgoraRtcEngine,
  IRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  RtcSurfaceView,
} from 'react-native-agora';
import { supabase } from '@/lib/supabase';

// Agora live-streaming helper, ported from BarrelConnect and adapted to
// Breakaway Roping (channel prefix `breakaway_`).
//
// GRACEFUL DEGRADATION: the App ID is read from EXPO_PUBLIC_AGORA_APP_ID. A real
// Agora App ID is a 32-character hex string; when it is missing or still a
// placeholder `isAgoraConfigured()` returns false and callers (the Go Live
// screen) show a "not configured" state instead of attempting to stream.
const AGORA_APP_ID = (process.env.EXPO_PUBLIC_AGORA_APP_ID || '').trim();

export const isAgoraConfigured = (): boolean => AGORA_APP_ID.length === 32;

type AgoraRole = 'publisher' | 'subscriber';

interface AgoraTokenResponse {
  token: string;
  uid: number;
  expiresAt: number;
}

export interface AgoraConfig {
  appId: string;
  channelName: string;
  token?: string;
  uid?: number;
}

export const fetchAgoraToken = async (
  channelName: string,
  role: AgoraRole,
): Promise<AgoraTokenResponse> => {
  const { data, error } = await supabase.functions.invoke('agora-token', {
    body: { channelName, role },
  });

  if (error) {
    let detail = error.message || 'Failed to fetch Agora token.';
    const response = (error as any)?.context as Response | undefined;

    if (response) {
      try {
        const responseBody = await response.clone().json();
        if (responseBody?.error) {
          detail = responseBody.error;
        }
      } catch {
        try {
          const responseText = await response.clone().text();
          if (responseText) {
            detail = responseText;
          }
        } catch {
          // Ignore parsing issues and keep original error message.
        }
      }
    }

    throw new Error(detail);
  }

  if (!data?.success || !data?.token || !data?.uid) {
    throw new Error(data?.error || 'Invalid token response from server.');
  }

  return {
    token: data.token,
    uid: data.uid,
    expiresAt: data.expiresAt,
  };
};

export class AgoraService {
  private engine: IRtcEngine | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Validate App ID format (should be a 32-character hex string).
      if (!isAgoraConfigured()) {
        throw new Error('Invalid Agora App ID configuration. Please check your App ID.');
      }

      this.engine = createAgoraRtcEngine();
      this.engine.initialize({ appId: AGORA_APP_ID });

      this.engine.enableVideo();
      this.engine.enableAudio();

      // Set channel profile and client role for preview.
      this.engine.setChannelProfile(ChannelProfileType.ChannelProfileLiveBroadcasting);
      this.engine.setClientRole(ClientRoleType.ClientRoleBroadcaster);

      // Start preview immediately so the user can see the camera before going live.
      this.engine.startPreview();

      this.isInitialized = true;
    } catch (error: any) {
      console.error('Failed to initialize Agora:', error);
      if (error?.code === 110 || error === 110) {
        throw new Error(
          'Invalid Agora App ID or token rejected. Verify EXPO_PUBLIC_AGORA_APP_ID and ensure token mode matches your Agora project settings.',
        );
      }
      throw error;
    }
  }

  async joinChannel(
    channelName: string,
    token: string | null = null,
    uid: number = 0,
    isBroadcaster: boolean = false,
  ): Promise<void> {
    if (!this.engine || !this.isInitialized) {
      throw new Error('Agora engine not initialized. Please wait for camera to initialize.');
    }

    try {
      if (!isBroadcaster) {
        this.engine.setClientRole(ClientRoleType.ClientRoleAudience);
      }

      const tokenToUse = token?.trim() || '';
      if (!tokenToUse) {
        throw new Error(
          'Missing Agora token. Generate token server-side from Supabase before joining channel.',
        );
      }

      this.engine.joinChannel(tokenToUse, channelName, uid, {
        clientRoleType: isBroadcaster
          ? ClientRoleType.ClientRoleBroadcaster
          : ClientRoleType.ClientRoleAudience,
      });
    } catch (error: any) {
      console.error('Failed to join channel:', error);
      if (error?.code === 110 || error === 110) {
        throw new Error(
          'Agora rejected the token/App ID (Error 110). Check token expiry, channel name, uid, and App ID.',
        );
      }
      throw error;
    }
  }

  async leaveChannel(): Promise<void> {
    if (!this.engine) return;
    try {
      this.engine.leaveChannel();
      this.engine.stopPreview();
    } catch (error) {
      console.error('Failed to leave channel:', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    if (!this.engine) return;
    try {
      await this.leaveChannel();
      this.engine.release();
      this.engine = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('Failed to destroy engine:', error);
    }
  }

  async switchCamera(): Promise<void> {
    if (!this.engine) return;
    await this.engine.switchCamera();
  }

  async muteLocalAudio(muted: boolean): Promise<void> {
    if (!this.engine) return;
    await this.engine.muteLocalAudioStream(muted);
  }

  async muteLocalVideo(muted: boolean): Promise<void> {
    if (!this.engine) return;
    this.engine.muteLocalVideoStream(muted);
  }

  getEngine(): IRtcEngine | null {
    return this.engine;
  }

  registerEventHandler(handler: any): void {
    if (this.engine) this.engine.registerEventHandler(handler);
  }

  unregisterEventHandler(handler: any): void {
    if (this.engine) this.engine.unregisterEventHandler(handler);
  }
}

export const generateChannelName = (sessionId: string): string => {
  // Sanitise to Agora's allowed set and the edge function's 3-64 char rule.
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 50);
  return `breakaway_${safe}`;
};

export { RtcSurfaceView, ChannelProfileType, ClientRoleType };
