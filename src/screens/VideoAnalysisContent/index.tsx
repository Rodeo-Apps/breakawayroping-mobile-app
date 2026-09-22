import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useEvent } from "expo";
import { VideoView, useVideoPlayer } from "expo-video";
import { router } from "expo-router";
import {
  SheetFormHeader,
  TopTabs,
  Button,
  RoundedIconButton,
} from "@/components";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/provider/AuthProvider";
import {
  canCreateVideoAnalysisOnFreeTier,
  FREE_TIER_MAX_VIDEO_ANALYSES,
  hasActivePremiumAccess,
} from "@/utils/premiumEntitlement";
import { hasIapSkuConfiguration } from "@/services/iapService";
import {
  uploadVideoAndCreateAnalysis,
  runVideoAnalysis,
  validateVideoFile,
  deleteVideoAnalysisStorage,
} from "@/utils/videoUpload";
import { trackInteraction } from "@/analytics";
import { Typography } from "@/utils/typography";
import { useCSSVariable } from "uniwind";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function VideoAnalysisSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <View className="absolute inset-0 z-100 justify-end">
      <Pressable
        className="absolute inset-0 bg-black/50"
        onPress={onClose}
        accessibilityLabel="Dismiss"
      />
      <View className="w-full max-h-[85%] rounded-t-3xl border-t border-border bg-background overflow-hidden">
        <SheetFormHeader title={title} onClose={onClose} />
        {children}
      </View>
    </View>
  );
}

interface VideoAnalysis {
  id: string;
  video_url: string;
  video_duration_seconds: number;
  analysis_status: string;
  ai_insights: any;
  performance_metrics: any;
  key_moments: any[];
  processed_at: string;
  created_at: string;
  /** Storage paths in `video-frames` (set after frame extraction for cleanup). */
  analysis_frame_paths?: string[] | null;
}

interface VideoComparison {
  id: string;
  title: string;
  video_analysis_1_id: string;
  video_analysis_2_id: string;
  comparison_type: string;
  performance_diff: any;
  notes: string;
  created_at: string;
}

function VideoModalPlayer({
  uri,
  style,
  paused,
}: {
  uri: string;
  style: StyleProp<ViewStyle>;
  paused: boolean;
}) {
  const trimmed = uri?.trim();
  const isRemote = Boolean(
    trimmed &&
    (trimmed.startsWith("http://") || trimmed.startsWith("https://")),
  );
  const [localUri, setLocalUri] = useState<string | null>(
    isRemote ? null : trimmed || null,
  );
  const [loading, setLoading] = useState<boolean>(Boolean(isRemote));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tempUri: string | null = null;

    async function prepare() {
      setError(null);
      if (!trimmed) {
        setLocalUri(null);
        setLoading(false);
        return;
      }
      if (!isRemote) {
        setLocalUri(trimmed);
        setLoading(false);
        return;
      }

      const base = FileSystem.cacheDirectory;
      if (!base) {
        setError("Could not access cache to play this video.");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        let ext = "mp4";
        try {
          const path = new URL(trimmed).pathname;
          const last = path.split("/").pop() || "";
          const m = last.toLowerCase().match(/\.([a-z0-9]+)$/);
          const candidate = m?.[1];
          if (candidate && ["mp4", "mov", "m4v"].includes(candidate))
            ext = candidate;
        } catch {
          ext = "mp4";
        }

        const dest = `${base}preview_${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
        const { uri: downloadedUri, status } = await FileSystem.downloadAsync(
          trimmed,
          dest,
        );
        if (status < 200 || status >= 300) {
          try {
            await FileSystem.deleteAsync(downloadedUri, { idempotent: true });
          } catch {
            /* ignore */
          }
          throw new Error(`Video download failed (HTTP ${status})`);
        }
        tempUri = downloadedUri;
        if (!cancelled) {
          setLocalUri(downloadedUri);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Could not load video preview.");
          setLocalUri(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void prepare();

    return () => {
      cancelled = true;
      if (tempUri) {
        void FileSystem.deleteAsync(tempUri, { idempotent: true });
      }
    };
  }, [trimmed, isRemote]);

  const source = localUri || "";
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
  });

  useEffect(() => {
    if (!source) return;
    if (paused) player.pause();
    else player.play();
  }, [paused, player, source]);

  const { isPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const canToggle = Boolean(source) && !loading && !error;

  return (
    <View
      style={[
        style as any,
        { overflow: "hidden", borderRadius: 12, backgroundColor: "#111827" },
      ]}
    >
      {loading && (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <ActivityIndicator size="small" color="#fff" />
          <Text
            style={{
              marginTop: 8,
              color: "#e5e7eb",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            Loading video…
          </Text>
        </View>
      )}

      {!loading && error && (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 12,
          }}
        >
          <Ionicons name="alert-circle-outline" size={28} color="#fca5a5" />
          <Text
            style={{
              marginTop: 8,
              color: "#fecaca",
              fontSize: 13,
              textAlign: "center",
            }}
          >
            {error}
          </Text>
        </View>
      )}

      {!loading && !error && source ? (
        <View style={{ flex: 1 }}>
          <VideoView
            style={{ width: "100%", height: "100%" }}
            player={player}
            allowsPictureInPicture
            fullscreenOptions={{ enable: true }}
          />

          <View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 12,
              bottom: 12,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Pressable
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(17, 24, 39, 0.72)",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
              onPress={() => {
                if (!canToggle) return;
                if (isPlaying) player.pause();
                else player.play();
              }}
              disabled={!canToggle}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={20}
                color="#fff"
              />
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

export type VideoAnalysisContentProps = {
  /** Slim intro row when embedded under Settings (stack already shows title). */
  compactHeader?: boolean;
};

export default function VideoAnalysisContent({
  compactHeader = false,
}: VideoAnalysisContentProps) {
  const primaryColor = useCSSVariable("--color-primary") as string;
  const onPrimaryColor = useCSSVariable("--color-onPrimary") as string;
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [banner, setBanner] = useState<null | {
    type: "success" | "info" | "error";
    message: string;
  }>(null);
  const [analyses, setAnalyses] = useState<VideoAnalysis[]>([]);
  const [comparisons, setComparisons] = useState<VideoComparison[]>([]);
  const [selectedTab, setSelectedTab] = useState<"analyses" | "comparisons">(
    "analyses",
  );
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] =
    useState<VideoAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [selectedVideo1, setSelectedVideo1] = useState<string>("");
  const [selectedVideo2, setSelectedVideo2] = useState<string>("");

  const premium = useMemo(
    () => hasActivePremiumAccess(profile),
    [profile],
  );
  const canUploadMoreAnalyses = useMemo(
    () => canCreateVideoAnalysisOnFreeTier(premium, analyses.length),
    [premium, analyses.length],
  );

  const alertVideoAnalysisLimit = useCallback(() => {
    Alert.alert(
      "Video analysis limit reached",
      `Free accounts include ${FREE_TIER_MAX_VIDEO_ANALYSES} stored video analysis. Subscribe to Premium for unlimited uploads and AI breakdowns.`,
      [
        { text: "OK", style: "cancel" },
        ...(hasIapSkuConfiguration()
          ? [
              {
                text: "View plans",
                onPress: () => router.push("/subscription-plans"),
              },
            ]
          : []),
      ],
    );
  }, []);

  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  const loadAnalyses = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("video_analyses")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAnalyses(data || []);
    } catch (error) {
      console.error("Error loading analyses:", error);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const loadComparisons = useCallback(async () => {
    if (!profile?.id) {
      setComparisons([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("video_comparisons")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComparisons(data || []);
    } catch (error) {
      console.error("Error loading comparisons:", error);
    }
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      setAnalyses([]);
      setComparisons([]);
      return;
    }
    void loadAnalyses();
    void loadComparisons();
  }, [profile?.id, loadAnalyses, loadComparisons]);

  const confirmDeleteAnalysis = (analysis: VideoAnalysis) => {
    const analysisId = analysis.id;
    Alert.alert(
      "Delete Analysis?",
      "This will remove the video, extracted frames, and this analysis from your list. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!profile?.id) return;
            try {
              try {
                await deleteVideoAnalysisStorage({
                  videoUrl: analysis.video_url,
                  analysisFramePaths: analysis.analysis_frame_paths ?? null,
                });
              } catch (storageErr: any) {
                Alert.alert(
                  "Delete Failed",
                  storageErr?.message ||
                    "Could not remove video or frames from storage. Try again.",
                );
                return;
              }

              const { error } = await supabase
                .from("video_analyses")
                .delete()
                .eq("id", analysisId)
                .eq("user_id", profile.id);

              if (error) throw error;

              setAnalyses((prev) => prev.filter((a) => a.id !== analysisId));
              if (selectedAnalysis?.id === analysisId) {
                setShowViewModal(false);
                setSelectedAnalysis(null);
              }
              await loadAnalyses();
              setBanner({ type: "success", message: "Analysis deleted." });
            } catch (e: any) {
              Alert.alert(
                "Delete Failed",
                e?.message || "Failed to delete analysis.",
              );
            }
          },
        },
      ],
    );
  };

  const pickVideo = async () => {
    if (!canUploadMoreAnalyses) {
      alertVideoAnalysisLimit();
      return;
    }
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow access to your media library to upload videos.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        await handleUploadVideo(result.assets[0]);
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to select a video. Please try again.");
    }
  };

  const handleUploadVideo = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!profile?.id) {
      Alert.alert("Error", "User not authenticated");
      return;
    }

    if (!canUploadMoreAnalyses) {
      alertVideoAnalysisLimit();
      return;
    }

    const validation = validateVideoFile(asset?.uri);
    if (!validation.valid) {
      Alert.alert("Invalid File", validation.error || "Invalid video file");
      return;
    }

    try {
      setUploading(true);

      const { videoUrl, analysisId } = await uploadVideoAndCreateAnalysis({
        asset: {
          uri: asset.uri,
          fileName: asset.fileName,
          fileSize: asset.fileSize,
          mimeType: asset.mimeType,
          duration: asset.duration,
        },
        userId: profile.id,
      });

      void trackInteraction("video_analysis", "video_upload", {
        analysis_id: analysisId,
      });

      Alert.alert(
        "Upload Complete",
        "Video uploaded successfully. Start AI analysis?",
        [
          { text: "Later", style: "cancel" },
          {
            text: "Analyze Now",
            onPress: () =>
              handleAnalyzeVideo(
                videoUrl,
                analysisId,
                asset.uri,
                typeof asset.duration === "number" ? asset.duration : null,
              ),
          },
        ],
      );

      loadAnalyses();
    } catch (error: any) {
      console.error("Upload error:", error);
      const rawMessage =
        typeof error?.message === "string" ? error.message : "";
      const isNetworkFailure = rawMessage
        .toLowerCase()
        .includes("network request failed");
      Alert.alert(
        "Upload Failed",
        isNetworkFailure
          ? "The video could not be uploaded right now (network/storage request failed). Please try again in a moment."
          : error?.message ||
              "The selected video could not be uploaded. Please try a shorter MP4, MOV, or M4V file and keep the app open during upload.",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeVideo = async (
    videoUrl: string,
    videoId: string,
    videoUriForFrames?: string,
    /** Total length in ms (ImagePicker); optional for remote re-analysis. */
    videoDurationMs?: number | null,
  ) => {
    try {
      setAnalyzing(true);
      const result = await runVideoAnalysis({
        videoUrl,
        videoId,
        userId: profile?.id || "",
        videoUriForFrames,
        videoDurationMs,
      });

      if (result.success) {
        void trackInteraction("video_analysis", "ai_analysis_complete", {
          analysis_id: videoId,
        });
        setBanner({
          type: "success",
          message: "Analysis complete. Open the analysis to view insights.",
        });
        loadAnalyses();
      } else {
        throw new Error("Analysis failed");
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      Alert.alert(
        "Analysis Failed",
        error?.message ||
          "The video uploaded successfully, but the AI analysis could not be completed.",
      );

      loadAnalyses();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCreateComparison = async () => {
    if (!premium) {
      Alert.alert(
        "Premium required",
        "Side-by-side video comparisons are included with Breakaway Connect Premium.",
        [
          { text: "OK", style: "cancel" },
          ...(hasIapSkuConfiguration()
            ? [
                {
                  text: "View plans",
                  onPress: () => router.push("/subscription-plans"),
                },
              ]
            : []),
        ],
      );
      return;
    }

    if (!selectedVideo1 || !selectedVideo2) {
      Alert.alert("Error", "Please select two videos to compare");
      return;
    }

    if (selectedVideo1 === selectedVideo2) {
      Alert.alert("Error", "Please select two different videos");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("video_comparisons")
        .insert({
          user_id: profile?.id,
          title: "Run Comparison",
          video_analysis_1_id: selectedVideo1,
          video_analysis_2_id: selectedVideo2,
          comparison_type: "side_by_side",
        })
        .select()
        .single();

      if (error) throw error;

      void trackInteraction("video_analysis", "comparison_create", {
        comparison_id: data.id,
      });

      Alert.alert("Success", "Comparison created successfully");
      setBanner({ type: "success", message: "Comparison created." });
      setShowCompareModal(false);
      setSelectedVideo1("");
      setSelectedVideo2("");
      loadComparisons();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create comparison");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "#10b981";
      case "processing":
        return "#f59e0b";
      case "pending":
        return "#3b82f6";
      case "failed":
        return "#ef4444";
      default:
        return "#6b7280";
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderAnalysisInsights = (analysis: VideoAnalysis) => {
    if (analysis.analysis_status !== "completed" || !analysis.ai_insights) {
      return null;
    }

    const insights = analysis.ai_insights;

    return (
      <>
        {insights.overall_score != null ? (
          <View className="items-center mb-5">
            <View className="w-[100px] h-[100px] rounded-full border-4 border-primary bg-primary/10 items-center justify-center py-2">
              <Typography.Heading2 className="text-primary">
                {insights.overall_score}
              </Typography.Heading2>
              <Typography.Body2 className="text-primary text-xs mt-0.5 font-poppins-medium">
                Overall
              </Typography.Body2>
            </View>
          </View>
        ) : null}

        {insights.confidence ? (
          <View className="items-center mb-3">
            <Typography.Body2 className="text-secondaryText text-xs font-poppins-medium">
              Confidence: {String(insights.confidence)}
            </Typography.Body2>
          </View>
        ) : null}

        {insights.summary ? (
          <View className="mb-5">
            <Typography.SubHeading2 className="text-primaryText mb-2">
              Summary
            </Typography.SubHeading2>
            <Typography.Body2 className="text-primaryText leading-5">
              {insights.summary}
            </Typography.Body2>
          </View>
        ) : null}

        {(insights.breakaway_1 || insights.breakaway_2 || insights.breakaway_3) ? (
          <View className="mb-5">
            <Typography.SubHeading2 className="text-primaryText mb-3">
              Breakaway analysis
            </Typography.SubHeading2>
            {insights.breakaway_1 ? (
              <View className="bg-card-secondary rounded-lg p-3 mb-2">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="ellipse" size={16} color={primaryColor} />
                  <Typography.SubHeading2 className="text-primaryText ml-2 flex-1">
                    Breakaway 1
                  </Typography.SubHeading2>
                  {insights.breakaway_1.score != null ? (
                    <Typography.Body2 className="text-primary font-poppins-bold">
                      {insights.breakaway_1.score}/100
                    </Typography.Body2>
                  ) : null}
                </View>
                {insights.breakaway_1.approach_angle ? (
                  <Typography.Body2 className="text-secondaryText ml-6 mb-1">
                    Approach: {insights.breakaway_1.approach_angle}
                  </Typography.Body2>
                ) : null}
                {insights.breakaway_1.turn_quality ? (
                  <Typography.Body2 className="text-secondaryText ml-6">
                    Turn: {insights.breakaway_1.turn_quality}
                  </Typography.Body2>
                ) : null}
              </View>
            ) : null}
            {insights.breakaway_2 ? (
              <View className="bg-card-secondary rounded-lg p-3 mb-2">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="ellipse" size={16} color="#10b981" />
                  <Typography.SubHeading2 className="text-primaryText ml-2 flex-1">
                    Breakaway 2
                  </Typography.SubHeading2>
                  {insights.breakaway_2.score != null ? (
                    <Typography.Body2 className="text-primary font-poppins-bold">
                      {insights.breakaway_2.score}/100
                    </Typography.Body2>
                  ) : null}
                </View>
                {insights.breakaway_2.approach_angle ? (
                  <Typography.Body2 className="text-secondaryText ml-6 mb-1">
                    Approach: {insights.breakaway_2.approach_angle}
                  </Typography.Body2>
                ) : null}
                {insights.breakaway_2.turn_quality ? (
                  <Typography.Body2 className="text-secondaryText ml-6">
                    Turn: {insights.breakaway_2.turn_quality}
                  </Typography.Body2>
                ) : null}
              </View>
            ) : null}
            {insights.breakaway_3 ? (
              <View className="bg-card-secondary rounded-lg p-3 mb-2">
                <View className="flex-row items-center mb-2">
                  <Ionicons name="ellipse" size={16} color="#f59e0b" />
                  <Typography.SubHeading2 className="text-primaryText ml-2 flex-1">
                    Breakaway 3
                  </Typography.SubHeading2>
                  {insights.breakaway_3.score != null ? (
                    <Typography.Body2 className="text-primary font-poppins-bold">
                      {insights.breakaway_3.score}/100
                    </Typography.Body2>
                  ) : null}
                </View>
                {insights.breakaway_3.approach_angle ? (
                  <Typography.Body2 className="text-secondaryText ml-6 mb-1">
                    Approach: {insights.breakaway_3.approach_angle}
                  </Typography.Body2>
                ) : null}
                {insights.breakaway_3.turn_quality ? (
                  <Typography.Body2 className="text-secondaryText ml-6">
                    Turn: {insights.breakaway_3.turn_quality}
                  </Typography.Body2>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {insights.strengths && insights.strengths.length > 0 ? (
          <View className="mb-5">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <Typography.SubHeading2 className="text-primaryText">
                Strengths
              </Typography.SubHeading2>
            </View>
            {insights.strengths.map((strength: string, index: number) => (
              <Typography.Body2 key={index} className="text-primaryText mb-2 ml-7 leading-5">
                • {strength}
              </Typography.Body2>
            ))}
          </View>
        ) : null}

        {insights.improvements && insights.improvements.length > 0 ? (
          <View className="mb-5">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="bulb" size={20} color="#f59e0b" />
              <Typography.SubHeading2 className="text-primaryText">
                Areas for improvement
              </Typography.SubHeading2>
            </View>
            {insights.improvements.map((improvement: string, index: number) => (
              <Typography.Body2 key={index} className="text-primaryText mb-2 ml-7 leading-5">
                • {improvement}
              </Typography.Body2>
            ))}
          </View>
        ) : null}

        {insights.key_moments && insights.key_moments.length > 0 ? (
          <View className="mb-4">
            <Typography.SubHeading2 className="text-primaryText mb-3">
              Key moments
            </Typography.SubHeading2>
            {insights.key_moments.map((moment: { timestamp?: string; description?: string; type?: string }, index: number) => (
              <View key={index} className="flex-row items-start mb-3">
                <Ionicons
                  name={moment.type === "good" ? "thumbs-up" : "flag"}
                  size={16}
                  color={moment.type === "good" ? "#10b981" : "#f59e0b"}
                />
                <View className="ml-3 flex-1">
                  <Typography.Caption1 className="text-primary font-poppins-semibold mb-1">
                    {moment.timestamp}
                  </Typography.Caption1>
                  <Typography.Body2 className="text-primaryText leading-5">
                    {moment.description}
                  </Typography.Body2>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  };

  return (
    <View className="flex-1 bg-background relative">
      {compactHeader ? (
        <View className="flex-row items-center gap-3 px-5 pt-4 pb-3 bg-background-secondary border-b border-border">
          <Ionicons name="film" size={26} color={primaryColor} />
          <Typography.Body2 className="flex-1 text-secondaryText">
            Upload breakaway runs, run AI analysis, and compare completed videos.
          </Typography.Body2>
          <View className={uploading ? "opacity-50" : ""}>
            <RoundedIconButton
              onPress={uploading ? () => {} : pickVideo}
              icon={
                uploading ? (
                  <ActivityIndicator size="small" color={onPrimaryColor} />
                ) : (
                  <Ionicons name="cloud-upload" size={22} color={onPrimaryColor} />
                )
              }
            />
          </View>
        </View>
      ) : (
        <View className="flex-row items-center justify-between border-b border-border px-5 py-5 bg-background-secondary">
          <View className="flex-row items-center flex-1 min-w-0">
            <Ionicons name="film" size={24} color={primaryColor} />
            <Typography.Heading3 className="text-primaryText ml-3" textProps={{ numberOfLines: 1 }}>
              Video Analysis
            </Typography.Heading3>
          </View>
          <View className={uploading ? "opacity-50" : ""}>
            <RoundedIconButton
              onPress={uploading ? () => {} : pickVideo}
              icon={
                uploading ? (
                  <ActivityIndicator size="small" color={onPrimaryColor} />
                ) : (
                  <Ionicons name="cloud-upload" size={22} color={onPrimaryColor} />
                )
              }
            />
          </View>
        </View>
      )}

      {banner ? (
        <View
          className={`mx-4 mt-3 rounded-xl px-3 py-2.5 border ${
            banner.type === "success"
              ? "bg-success/10 border-success/40"
              : banner.type === "error"
                ? "bg-danger/10 border-danger/40"
                : "bg-primary/10 border-primary/30"
          }`}
        >
          <Typography.Body2 className="text-primaryText text-center font-poppins-medium">
            {banner.message}
          </Typography.Body2>
        </View>
      ) : null}

      {(uploading || analyzing) ? (
        <View className="flex-row items-center justify-center gap-3 py-3 px-4 bg-primary/10 border-b border-border">
          <ActivityIndicator size="small" color={primaryColor} />
          <Typography.Body2 className="text-primary font-poppins-semibold">
            {uploading ? "Uploading video…" : "Analyzing video…"}
          </Typography.Body2>
        </View>
      ) : null}

      <View className="px-4 pt-3 pb-2 bg-background border-b border-border">
        <TopTabs
          options={[
            { label: "Analyses", value: "analyses" },
            { label: "Comparisons", value: "comparisons" },
          ]}
          selected={selectedTab}
          onChange={(value) =>
            setSelectedTab(value as "analyses" | "comparisons")
          }
        />
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {!premium && analyses.length >= FREE_TIER_MAX_VIDEO_ANALYSES ? (
          <View className="mb-4 rounded-2xl border border-border bg-background-secondary p-4 gap-y-2">
            <Typography.SubHeading2 className="text-primaryText">
              Free plan limit
            </Typography.SubHeading2>
            <Typography.Body2 className="text-secondaryText">
              You have used your included video analysis slot. Subscribe to
              Premium to upload and analyze unlimited runs.
            </Typography.Body2>
          </View>
        ) : null}
        {selectedTab === "analyses" ? (
          analyses.length === 0 ? (
            <View className="items-center justify-center py-16 px-6">
              <Ionicons name="videocam-outline" size={64} color="#d1d5db" />
              <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
                No video analyses yet
              </Typography.SubHeading1>
              <Typography.Body2 className="text-secondaryText mt-2 mb-6 text-center max-w-sm">
                {canUploadMoreAnalyses
                  ? "Upload a breakaway roping video to get AI-powered insights"
                  : "Subscribe to Premium to upload another video and run AI breakaway analysis."}
              </Typography.Body2>
              <Button
                title={
                  canUploadMoreAnalyses
                    ? "Upload your first video"
                    : "View subscription plans"
                }
                onPress={
                  canUploadMoreAnalyses
                    ? pickVideo
                    : () => router.push("/subscription-plans")
                }
              />
            </View>
          ) : (
            analyses.map((analysis) => (
              <View
                key={analysis.id}
                className="bg-card border border-border rounded-xl p-4 mb-4"
              >
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center">
                    <View
                      className="w-2 h-2 rounded-full mr-2"
                      style={{
                        backgroundColor: getStatusColor(
                          analysis.analysis_status,
                        ),
                      }}
                    />
                    <Typography.Body2 className="text-secondaryText font-poppins-semibold uppercase tracking-wide text-xs">
                      {analysis.analysis_status}
                    </Typography.Body2>
                  </View>
                  {analysis.video_duration_seconds ? (
                    <Typography.Body2 className="text-secondaryText">
                      {formatDuration(analysis.video_duration_seconds)}
                    </Typography.Body2>
                  ) : null}
                </View>

                {analysis.analysis_status === "processing" ? (
                  <View className="items-center py-8">
                    <ActivityIndicator size="large" color={primaryColor} />
                    <Typography.Body2 className="text-secondaryText mt-3 mb-4 text-center">
                      AI is analyzing your video…
                    </Typography.Body2>
                  </View>
                ) : null}

                {analysis.analysis_status === "pending" ? (
                  <View className="items-center py-6">
                    <Ionicons name="time-outline" size={48} color={primaryColor} />
                    <Typography.Body2 className="text-secondaryText mt-3 mb-4 text-center">
                      Ready for analysis
                    </Typography.Body2>
                    <Button
                      title="Start AI analysis"
                      onPress={() =>
                        handleAnalyzeVideo(
                          analysis.video_url,
                          analysis.id,
                          undefined,
                          typeof analysis.video_duration_seconds === "number"
                            ? analysis.video_duration_seconds * 1000
                            : null,
                        )
                      }
                    />
                  </View>
                ) : null}

                {analysis.analysis_status === "failed" ? (
                  <View className="items-center py-6">
                    <Ionicons name="alert-circle" size={48} color="#ef4444" />
                    <Typography.Body2 className="text-secondaryText mt-3 mb-4 text-center">
                      Analysis failed
                    </Typography.Body2>
                    <Button
                      title="Retry analysis"
                      onPress={() =>
                        handleAnalyzeVideo(
                          analysis.video_url,
                          analysis.id,
                          undefined,
                          typeof analysis.video_duration_seconds === "number"
                            ? analysis.video_duration_seconds * 1000
                            : null,
                        )
                      }
                    />
                  </View>
                ) : null}

                {renderAnalysisInsights(analysis)}

                <View className="flex-row flex-wrap gap-2 mt-3">
                  <Pressable
                    className="flex-1 min-w-[28%] flex-row items-center justify-center py-2.5 px-2 rounded-xl border border-border bg-background-secondary active:opacity-80"
                    onPress={() => {
                      setSelectedAnalysis(analysis);
                      setShowViewModal(true);
                    }}
                  >
                    <Ionicons name="eye" size={18} color={primaryColor} />
                    <Typography.Body2 className="text-primary ml-1.5 font-poppins-semibold">
                      View
                    </Typography.Body2>
                  </Pressable>
                  <Pressable
                    className="flex-1 min-w-[28%] flex-row items-center justify-center py-2.5 px-2 rounded-xl border border-border bg-background-secondary active:opacity-80"
                    onPress={() => confirmDeleteAnalysis(analysis)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    <Typography.Body2 className="text-danger ml-1.5 font-poppins-semibold">
                      Delete
                    </Typography.Body2>
                  </Pressable>
                  {analyses.length > 1 ? (
                    <Pressable
                      className="flex-1 min-w-[28%] flex-row items-center justify-center py-2.5 px-2 rounded-xl border border-border bg-background-secondary active:opacity-80"
                      onPress={() => setShowCompareModal(true)}
                    >
                      <Ionicons name="git-compare" size={18} color="#10b981" />
                      <Typography.Body2 className="text-success ml-1.5 font-poppins-semibold">
                        Compare
                      </Typography.Body2>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          )
        ) : comparisons.length === 0 ? (
          <View className="items-center justify-center py-16 px-6">
            <Ionicons name="git-compare-outline" size={64} color="#d1d5db" />
            <Typography.SubHeading1 className="text-secondaryText mt-4 text-center">
              No comparisons yet
            </Typography.SubHeading1>
            <Typography.Body2 className="text-secondaryText mt-2 mb-6 text-center max-w-sm">
              Compare two videos to see improvements
            </Typography.Body2>
            {analyses.length >= 2 ? (
              <Button
                title="Create comparison"
                onPress={() => setShowCompareModal(true)}
              />
            ) : null}
          </View>
        ) : (
          comparisons.map((comparison) => (
            <View
              key={comparison.id}
              className="bg-card border border-border rounded-xl p-4 mb-4"
            >
              <Typography.SubHeading1 className="text-primaryText mb-2">
                {comparison.title}
              </Typography.SubHeading1>
              <View className="flex-row items-center mb-2">
                <Ionicons name="layers" size={16} color={primaryColor} />
                <Typography.Body2 className="text-secondaryText ml-2 capitalize">
                  {comparison.comparison_type.replace("_", " ")}
                </Typography.Body2>
              </View>
              {comparison.notes ? (
                <Typography.Body2 className="text-secondaryText mb-3">
                  {comparison.notes}
                </Typography.Body2>
              ) : null}
              <Typography.Caption1 className="text-placeholderText">
                Detailed comparison view coming soon
              </Typography.Caption1>
            </View>
          ))
        )}
      </ScrollView>

      <VideoAnalysisSheet
        open={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        title="Compare Videos"
      >
            <ScrollView
              className="px-5 pt-2"
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              showsVerticalScrollIndicator={false}
            >
              <Typography.SubHeading2 className="text-primaryText mb-3">
                Select First Video
              </Typography.SubHeading2>
              <ScrollView
                className="max-h-[150px] mb-4"
                showsVerticalScrollIndicator={false}
              >
                {analyses
                  .filter((a) => a.analysis_status === "completed")
                  .map((analysis) => (
                    <Pressable
                      key={analysis.id}
                      className={`flex-row items-center p-3 rounded-lg border mb-2 ${
                        selectedVideo1 === analysis.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                      onPress={() => setSelectedVideo1(analysis.id)}
                    >
                      <Ionicons
                        name={
                          selectedVideo1 === analysis.id
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={24}
                        color={
                          selectedVideo1 === analysis.id ? primaryColor : "#6b7280"
                        }
                      />
                      <Typography.Body2 className="text-primaryText ml-3 flex-1">
                        Video from{" "}
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </Typography.Body2>
                    </Pressable>
                  ))}
              </ScrollView>

              <Typography.SubHeading2 className="text-primaryText mt-4 mb-3">
                Select Second Video
              </Typography.SubHeading2>
              <ScrollView
                className="max-h-[150px] mb-4"
                showsVerticalScrollIndicator={false}
              >
                {analyses
                  .filter((a) => a.analysis_status === "completed")
                  .map((analysis) => (
                    <Pressable
                      key={analysis.id}
                      className={`flex-row items-center p-3 rounded-lg border mb-2 ${
                        selectedVideo2 === analysis.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-card"
                      }`}
                      onPress={() => setSelectedVideo2(analysis.id)}
                    >
                      <Ionicons
                        name={
                          selectedVideo2 === analysis.id
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={24}
                        color={
                          selectedVideo2 === analysis.id ? primaryColor : "#6b7280"
                        }
                      />
                      <Typography.Body2 className="text-primaryText ml-3 flex-1">
                        Video from{" "}
                        {new Date(analysis.created_at).toLocaleDateString()}
                      </Typography.Body2>
                    </Pressable>
                  ))}
              </ScrollView>

              <View
                className={
                  !selectedVideo1 || !selectedVideo2 ? "opacity-40" : ""
                }
              >
                <Button
                  title="Create comparison"
                  onPress={() => {
                    if (selectedVideo1 && selectedVideo2) {
                      void handleCreateComparison();
                    }
                  }}
                />
              </View>
            </ScrollView>
      </VideoAnalysisSheet>

      <VideoAnalysisSheet
        open={showViewModal}
        onClose={() => setShowViewModal(false)}
        title="Video Analysis"
      >
            <ScrollView
              className="px-5 pt-2"
              contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
              showsVerticalScrollIndicator={false}
            >
              {selectedAnalysis && (
                <>
                  {selectedAnalysis.video_url ? (
                    <View className="mb-5">
                      <Typography.SubHeading2 className="text-primaryText mb-2">
                        Video
                      </Typography.SubHeading2>
                      <View className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-border relative">
                        <VideoModalPlayer
                          uri={selectedAnalysis.video_url}
                          style={StyleSheet.absoluteFill}
                          paused={!showViewModal}
                        />
                      </View>
                    </View>
                  ) : null}

                  {selectedAnalysis.analysis_status === "completed" &&
                  selectedAnalysis.ai_insights ? (
                    <View className="mt-2">
                      {renderAnalysisInsights(selectedAnalysis)}
                    </View>
                  ) : null}

                  {selectedAnalysis.analysis_status === "pending" ? (
                    <View className="items-center py-8">
                      <Ionicons name="time-outline" size={48} color={primaryColor} />
                      <Typography.Body2 className="text-secondaryText mt-3 mb-4 text-center">
                        Ready for analysis
                      </Typography.Body2>
                      <Button
                        title="Start AI analysis"
                        onPress={() => {
                          setShowViewModal(false);
                          handleAnalyzeVideo(
                            selectedAnalysis.video_url,
                            selectedAnalysis.id,
                            undefined,
                            typeof selectedAnalysis.video_duration_seconds ===
                            "number"
                              ? selectedAnalysis.video_duration_seconds * 1000
                              : null,
                          );
                        }}
                      />
                    </View>
                  ) : null}

                  {selectedAnalysis.analysis_status === "processing" ? (
                    <View className="items-center py-8">
                      <ActivityIndicator size="large" color={primaryColor} />
                      <Typography.Body2 className="text-secondaryText mt-3 text-center">
                        AI is analyzing your video…
                      </Typography.Body2>
                    </View>
                  ) : null}

                  {selectedAnalysis.analysis_status === "failed" ? (
                    <View className="items-center py-8">
                      <Ionicons name="alert-circle" size={48} color="#ef4444" />
                      <Typography.Body2 className="text-secondaryText mt-3 mb-1 text-center font-poppins-semibold">
                        Analysis failed
                      </Typography.Body2>
                      <Typography.Body2 className="text-secondaryText mb-4 text-center">
                        Please try again or upload a new video.
                      </Typography.Body2>
                      <Button
                        title="Retry analysis"
                        onPress={() =>
                          handleAnalyzeVideo(
                            selectedAnalysis.video_url,
                            selectedAnalysis.id,
                            undefined,
                            typeof selectedAnalysis.video_duration_seconds ===
                            "number"
                              ? selectedAnalysis.video_duration_seconds * 1000
                              : null,
                          )
                        }
                      />
                    </View>
                  ) : null}

                  <View className="mt-4 mb-2">
                    <Pressable
                      className="bg-danger rounded-2xl py-3.5 flex-row justify-center items-center gap-2 active:opacity-90"
                      onPress={() => {
                        if (selectedAnalysis) {
                          confirmDeleteAnalysis(selectedAnalysis);
                        }
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#fff" />
                      <Typography.Body2 className="text-white font-poppins-bold">
                        Delete analysis
                      </Typography.Body2>
                    </Pressable>
                  </View>
                </>
              )}
            </ScrollView>
      </VideoAnalysisSheet>
    </View>
  );
}
