import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  PermissionsAndroid,
  Platform,
  Pressable,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { IRtcEngineEventHandler } from "react-native-agora";
import { useCSSVariable } from "uniwind";
import { Button, Input, ScreenWrapper, TextArea } from "@/components";
import { Typography } from "@/utils/typography";
import { showAlert } from "@/utils/toast";
import { useAuth } from "@/provider/AuthProvider";
import { hasActivePremiumAccess } from "@/utils/premiumEntitlement";
import SubscriptionPaywall from "@/components/ui/SubscriptionPaywall";
import { supabase } from "@/lib/supabase";
import { useTrackScreenFocus, trackInteraction } from "@/analytics";
import {
  AgoraService,
  fetchAgoraToken,
  generateChannelName,
  RtcSurfaceView,
} from "@/utils/agoraHelper";

const SettingsGoLiveScreen = () => {
  useTrackScreenFocus("live");
  const router = useRouter();
  const { profile } = useAuth();
  const primaryColor = useCSSVariable("--color-primary") as string;
  const dangerColor = useCSSVariable("--color-danger") as string;
  const secondaryText = useCSSVariable("--color-secondaryText") as string;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [ending, setEnding] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  const agoraService = useRef(new AgoraService()).current;
  const isLiveRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === "android") {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.CAMERA,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        return (
          grants["android.permission.CAMERA"] ===
            PermissionsAndroid.RESULTS.GRANTED &&
          grants["android.permission.RECORD_AUDIO"] ===
            PermissionsAndroid.RESULTS.GRANTED
        );
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  }, []);

  const cleanup = useCallback(async () => {
    const sid = sessionIdRef.current;
    if (isLiveRef.current && sid) {
      try {
        await agoraService.leaveChannel();
        await supabase
          .from("live_sessions")
          .update({
            status: "ended",
            ended_at: new Date().toISOString(),
          })
          .eq("id", sid);
        void trackInteraction("live", "stream_ended", { session_id: sid });
      } catch (e) {
        console.error("Error ending stream on cleanup:", e);
      }
    }
    await agoraService.destroy();
  }, [agoraService]);

  const initializeAgora = useCallback(async () => {
    setIsInitializing(true);
    try {
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        showAlert(
          "Camera and microphone permissions are required to go live.",
          "warning",
        );
        setIsInitializing(false);
        return;
      }

      await agoraService.initialize();
      setIsCameraReady(true);
      setIsInitializing(false);

      const eventHandler: IRtcEngineEventHandler = {
        onJoinChannelSuccess: () => {},
        onUserJoined: () => {},
        onUserOffline: () => {},
        onError: (err) => {
          console.error("Agora error:", err);
          if (err === 110) {
            showAlert(
              "Failed to connect to live stream. Check Agora App ID or contact support.",
              "error",
            );
          }
        },
      };

      agoraService.registerEventHandler(eventHandler);
    } catch (error) {
      console.error("Failed to initialize Agora:", error);
      setIsInitializing(false);
      showAlert("Failed to initialize camera. Please try again.", "error");
    }
  }, [agoraService, requestPermissions]);

  useEffect(() => {
    void initializeAgora();
    return () => {
      void cleanup();
    };
  }, [initializeAgora, cleanup]);

  useEffect(() => {
    if (!sessionId || !isLive) return;

    const subscription = supabase
      .channel(`live_session_${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "live_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const next = payload.new as { viewer_count?: number };
          if (next.viewer_count !== undefined) {
            setViewerCount(next.viewer_count);
          }
        },
      )
      .subscribe();

    return () => {
      void subscription.unsubscribe();
    };
  }, [sessionId, isLive]);

  const endStream = useCallback(async () => {
    const sid = sessionId;
    if (!sid) return;

    setEnding(true);
    try {
      await agoraService.leaveChannel();
      await supabase
        .from("live_sessions")
        .update({
          status: "ended",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sid);

      void trackInteraction("live", "stream_ended", { session_id: sid });
      setIsLive(false);
      setSessionId(null);
      setViewerCount(0);

      Alert.alert("Stream ended", "Your live stream has ended successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error("Error ending stream:", error);
      showAlert("Failed to end stream properly.", "error");
    } finally {
      setEnding(false);
    }
  }, [agoraService, router, sessionId]);

  const handleGoLive = useCallback(async () => {
    if (!profile?.id) {
      showAlert("Sign in to go live.", "warning");
      return;
    }

    if (!title.trim()) {
      showAlert("Please enter a title for your stream.", "error");
      return;
    }

    if (!isCameraReady || isInitializing) {
      showAlert(
        "Please wait for the camera to initialize before going live.",
        "warning",
      );
      return;
    }

    const engine = agoraService.getEngine();
    if (!engine) {
      showAlert("Camera engine is not ready. Trying again…", "warning");
      await initializeAgora();
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("live_sessions")
        .insert({
          user_id: profile.id,
          title: title.trim(),
          description: description.trim(),
          status: "live",
          started_at: new Date().toISOString(),
          viewer_count: 0,
        })
        .select()
        .single();

      if (error) throw error;

      const channelName = generateChannelName(data.id);
      const { token, uid } = await fetchAgoraToken(channelName, "publisher");
      await agoraService.joinChannel(channelName, token, uid, true);

      setSessionId(data.id);
      setIsLive(true);
      setViewerCount(0);
      void trackInteraction("live", "stream_started", { session_id: data.id });
    } catch (error: unknown) {
      console.error("Error starting live stream:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to start live stream. Please try again.";
      showAlert(message, "error");
    } finally {
      setLoading(false);
    }
  }, [
    agoraService,
    description,
    initializeAgora,
    isCameraReady,
    isInitializing,
    profile?.id,
    title,
  ]);

  const toggleMute = useCallback(async () => {
    await agoraService.muteLocalAudio(!isMuted);
    setIsMuted((m) => !m);
  }, [agoraService, isMuted]);

  const toggleVideo = useCallback(async () => {
    await agoraService.muteLocalVideo(!isVideoOff);
    setIsVideoOff((v) => !v);
  }, [agoraService, isVideoOff]);

  const switchCamera = useCallback(async () => {
    await agoraService.switchCamera();
  }, [agoraService]);

  const onHeaderClose = useCallback(() => {
    if (isLive) {
      void endStream();
    } else {
      router.back();
    }
  }, [endStream, isLive, router]);

  if (!profile?.id) {
    return (
      <ScreenWrapper>
        <View className="flex-1 px-5 pt-4 justify-center">
          <Typography.Body2 className="text-secondaryText text-center">
            Sign in to start a live stream.
          </Typography.Body2>
        </View>
      </ScreenWrapper>
    );
  }

  if (!hasActivePremiumAccess(profile)) {
    return (
      <ScreenWrapper>
        <View className="flex-1 justify-center">
          <SubscriptionPaywall
            title="Premium required"
            description="Live streaming is available to Breakaway Connect Premium subscribers. Subscribe to go live with your audience."
          />
        </View>
      </ScreenWrapper>
    );
  }

  const headerBusy = loading || ending;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-1">
        <KeyboardAwareScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-6 gap-y-6"
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View className="rounded-2xl overflow-hidden border border-border bg-background">
            {isCameraReady ? (
              <View className="bg-black" style={{ aspectRatio: 16 / 9 }}>
                <RtcSurfaceView
                  style={{ width: "100%", height: "100%" }}
                  canvas={{ uid: 0 }}
                />
                {isLive ? (
                  <View className="absolute top-4 left-4 right-4 flex-row justify-between items-center">
                    <View className="flex-row items-center gap-x-2 rounded-full bg-danger/90 px-3 py-2">
                      <View className="w-2 h-2 rounded-full bg-white" />
                      <Typography.Caption1 className="text-white font-poppins-bold tracking-wide">
                        LIVE
                      </Typography.Caption1>
                    </View>
                    <View className="flex-row items-center gap-x-2 rounded-2xl bg-black/70 px-3 py-2">
                      <Ionicons name="eye" size={16} color="#ffffff" />
                      <Typography.Body2 className="text-white font-poppins-semibold">
                        {viewerCount}
                      </Typography.Body2>
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <View
                className="bg-neutral-800 items-center justify-center px-6"
                style={{ aspectRatio: 16 / 9 }}
              >
                <Ionicons name="videocam" size={56} color={secondaryText} />
                <Typography.SubHeading2 className="text-white mt-3">
                  Camera preview
                </Typography.SubHeading2>
                <Typography.Body2 className="text-secondaryText mt-2 text-center">
                  Initializing camera…
                </Typography.Body2>
              </View>
            )}
          </View>

          {isLive ? (
            <View className="flex-row flex-wrap justify-around gap-x-3 gap-y-3 p-4 rounded-2xl bg-background border border-border">
              <Pressable
                onPress={() => void toggleMute()}
                className="items-center min-w-[72px] py-2 active:opacity-70"
              >
                <Ionicons
                  name={isMuted ? "mic-off" : "mic"}
                  size={24}
                  color={isMuted ? dangerColor : primaryColor}
                />
                <Typography.Caption1 className="text-primaryText mt-1">
                  {isMuted ? "Unmute" : "Mute"}
                </Typography.Caption1>
              </Pressable>
              <Pressable
                onPress={() => void toggleVideo()}
                className="items-center min-w-[72px] py-2 active:opacity-70"
              >
                <Ionicons
                  name={isVideoOff ? "videocam-off" : "videocam"}
                  size={24}
                  color={isVideoOff ? dangerColor : primaryColor}
                />
                <Typography.Caption1 className="text-primaryText mt-1">
                  {isVideoOff ? "Camera on" : "Camera off"}
                </Typography.Caption1>
              </Pressable>
              <Pressable
                onPress={() => void switchCamera()}
                className="items-center min-w-[72px] py-2 active:opacity-70"
              >
                <Ionicons
                  name="camera-reverse"
                  size={24}
                  color={primaryColor}
                />
                <Typography.Caption1 className="text-primaryText mt-1">
                  Flip
                </Typography.Caption1>
              </Pressable>
              <Pressable
                onPress={() => void endStream()}
                disabled={ending}
                className="items-center min-w-[72px] py-2 rounded-xl bg-danger px-2 active:opacity-90"
              >
                <Ionicons name="stop-circle" size={24} color="#ffffff" />
                <Typography.Caption1 className="text-white mt-1">
                  End
                </Typography.Caption1>
              </Pressable>
            </View>
          ) : null}

          {!isLive ? (
            <>
              <Input
                label="Stream title *"
                placeholder="What are you streaming?"
                value={title}
                onChangeText={setTitle}
                inputProps={{
                  autoCapitalize: "sentences",
                  editable: true,
                }}
              />

              <TextArea
                label="Description (optional)"
                placeholder="Tell viewers what to expect…"
                value={description}
                onChangeText={setDescription}
              />

              <View className="flex-row gap-x-3 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <Ionicons
                  name="information-circle"
                  size={24}
                  color={primaryColor}
                />
                <View className="flex-1 gap-y-2">
                  <Typography.SubHeading2 className="text-primary">
                    Live streaming tips
                  </Typography.SubHeading2>
                  <Typography.Body2 className="text-primaryText">
                    • Interact with viewers in the chat{"\n"}• Share your breakaway
                    racing experience{"\n"}• Show training techniques or runs
                    {"\n"}• Answer questions from followers
                  </Typography.Body2>
                </View>
              </View>

              <View className="flex-row gap-x-3 p-4 rounded-2xl bg-danger/10 border border-danger/25">
                <Ionicons name="warning" size={22} color={dangerColor} />
                <Typography.Body2 className="text-primaryText flex-1">
                  Use a stable internet connection before you go live.
                </Typography.Body2>
              </View>

              <Button
                title="Start live stream"
                onPress={() => void handleGoLive()}
                loading={loading || isInitializing || !isCameraReady}
              />
            </>
          ) : null}
        </KeyboardAwareScrollView>
      </View>
    </View>
  );
};

export default SettingsGoLiveScreen;
