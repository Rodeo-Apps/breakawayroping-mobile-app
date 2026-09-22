import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Input } from "@/components";
import { Typography } from "@/utils/typography";
import { T_TIME_RUN_CHILD_HANDLE, T_TIME_RUN_CHILD_PROPS } from "./types";
import { useAuth } from "@/provider/AuthProvider";
import { showAlert } from "@/utils/toast";
import { supabase } from "@/lib/supabase";

const formatStopwatchTime = (milliseconds: number) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = Math.floor((milliseconds % 1000) / 10);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(2, "0")}`;
};

const AutoTimeRun = forwardRef<T_TIME_RUN_CHILD_HANDLE, T_TIME_RUN_CHILD_PROPS>(
  (
    {
      horseId,
      onSuccess,
      onSubmittingChange,
      primaryTextColor,
      placeholderTextColor,
    },
    ref,
  ) => {
    const { profile } = useAuth();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);

    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [hasFinished, setHasFinished] = useState(false);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [splits, setSplits] = useState<number[]>([]);
    const [penalties, setPenalties] = useState("0");
    const [notes, setNotes] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
      onSubmittingChange(saving);
    }, [onSubmittingChange, saving]);

    useEffect(() => {
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }, []);

    const startTimer = () => {
      if (!horseId) {
        showAlert("Please select a horse first", "warning");
        return;
      }
      setIsRunning(true);
      setIsPaused(false);
      setHasFinished(false);
      setElapsedTime(0);
      setSplits([]);
      startTimeRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 10);
    };

    const pauseTimer = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPaused(true);
      setIsRunning(false);
      setHasFinished(false);
    };

    const resumeTimer = () => {
      setIsPaused(false);
      setIsRunning(true);
      setHasFinished(false);
      startTimeRef.current = Date.now() - elapsedTime;
      intervalRef.current = setInterval(() => {
        setElapsedTime(Date.now() - startTimeRef.current);
      }, 10);
    };

    const resetTimer = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsRunning(false);
      setIsPaused(false);
      setHasFinished(false);
      setElapsedTime(0);
      setSplits([]);
    };

    const recordSplit = () => {
      if (!isRunning) return;
      if (splits.length >= 3) return;
      setSplits((prev) => {
        const nextSplits = [...prev, elapsedTime];
        if (nextSplits.length === 3) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          setIsPaused(false);
          setHasFinished(true);
        }
        return nextSplits;
      });
    };

    const handleSave = async () => {
      if (!profile?.id) return;
      if (!horseId) {
        showAlert("Please select a horse first", "warning");
        return;
      }
      if (elapsedTime <= 0) {
        showAlert("Start and record a run before saving", "warning");
        return;
      }

      try {
        setSaving(true);
        const penaltiesSeconds = penalties ? Number(penalties) : 0;
        if (!Number.isFinite(penaltiesSeconds) || penaltiesSeconds < 0) {
          showAlert("Penalties must be a valid number", "warning");
          return;
        }

        const finalTime = elapsedTime / 1000 + penaltiesSeconds;
        const runDate = new Date().toISOString().split("T")[0];
        const payload: Record<string, unknown> = {
          user_id: profile.id,
          horse_id: horseId,
          run_date: runDate,
          time_seconds: finalTime,
          breakaway1_time: splits[0] != null ? splits[0] / 1000 : null,
          breakaway2_time: splits[1] != null ? splits[1] / 1000 : null,
          breakaway3_time: splits[2] != null ? splits[2] / 1000 : null,
          penalties: penaltiesSeconds,
          status: "complete",
          notes: notes.trim() || null,
          time_division: null,
        };

        const { error } = await supabase.from("runs").insert(payload);
        if (error) throw error;

        showAlert("Run added successfully!", "success");
        onSuccess();
      } catch (error: any) {
        showAlert(
          typeof error?.message === "string"
            ? error.message
            : "Failed to add run. Please try again.",
          "error",
        );
      } finally {
        setSaving(false);
      }
    };

    useImperativeHandle(ref, () => ({
      submit: () => {
        void handleSave();
      },
    }));

    return (
      <View className="gap-y-4">
        <View className="bg-background-secondary rounded-3xl px-4 py-5 gap-y-4">
          <View className="items-center gap-y-2">
            <Typography.Caption1 className="text-secondaryText">
              Stopwatch Time
            </Typography.Caption1>
            <Typography.Heading2 className="text-primaryText">
              {formatStopwatchTime(elapsedTime)}
            </Typography.Heading2>
          </View>

          <View className="flex-row items-center justify-center gap-x-3">
            {!isRunning && !isPaused && (
              <Pressable
                onPress={startTimer}
                className="bg-primary rounded-full px-5 py-3 flex-row items-center gap-x-2"
              >
                <Ionicons name="play" size={18} color="#ffffff" />
                <Typography.SubHeading2 className="text-onPrimary">
                  Start
                </Typography.SubHeading2>
              </Pressable>
            )}

            {isRunning && (
              <>
                <Pressable
                  onPress={recordSplit}
                  className="bg-background rounded-full px-5 py-3 flex-row items-center gap-x-2"
                >
                  <Ionicons name="flag-outline" size={18} color={primaryTextColor} />
                  <Typography.SubHeading2 className="text-primaryText">
                    {splits.length === 2 ? "Finish" : `Breakaway ${splits.length + 1}`}
                  </Typography.SubHeading2>
                </Pressable>
                <Pressable
                  onPress={pauseTimer}
                  className="bg-warning rounded-full px-5 py-3 flex-row items-center gap-x-2"
                >
                  <Ionicons name="pause" size={18} color="#ffffff" />
                  <Typography.SubHeading2 className="text-onPrimary">
                    Pause
                  </Typography.SubHeading2>
                </Pressable>
              </>
            )}

            {!isRunning && isPaused && !hasFinished && (
              <>
                <Pressable
                  onPress={resumeTimer}
                  className="bg-success rounded-full px-5 py-3 flex-row items-center gap-x-2"
                >
                  <Ionicons name="play" size={18} color="#ffffff" />
                  <Typography.SubHeading2 className="text-onPrimary">
                    Resume
                  </Typography.SubHeading2>
                </Pressable>
                <Pressable
                  onPress={resetTimer}
                  className="bg-background rounded-full px-5 py-3 flex-row items-center gap-x-2"
                >
                  <Ionicons name="refresh" size={18} color={primaryTextColor} />
                  <Typography.SubHeading2 className="text-primaryText">
                    Reset
                  </Typography.SubHeading2>
                </Pressable>
              </>
            )}

            {!isRunning && hasFinished && (
              <Pressable
                onPress={resetTimer}
                className="bg-background rounded-full px-5 py-3 flex-row items-center gap-x-2"
              >
                <Ionicons name="refresh" size={18} color={primaryTextColor} />
                <Typography.SubHeading2 className="text-primaryText">
                  Reset
                </Typography.SubHeading2>
              </Pressable>
            )}
          </View>

          {splits.length > 0 && (
            <View className="gap-y-2">
              <Typography.SubHeading2 className="text-primaryText">
                Split Times
              </Typography.SubHeading2>
              {splits.map((split, index) => (
                <View
                  key={`${split}-${index}`}
                  className="flex-row items-center justify-between px-3 py-2 bg-background rounded-xl"
                >
                  <Typography.Body2 className="text-secondaryText">
                    Breakaway {index + 1}
                  </Typography.Body2>
                  <Typography.SubHeading2 className="text-primaryText">
                    {formatStopwatchTime(split)}
                  </Typography.SubHeading2>
                </View>
              ))}
            </View>
          )}
        </View>

        <Input
          label="Penalties (seconds)"
          placeholder="0, 5, 10..."
          value={penalties}
          onChangeText={setPenalties}
          inputProps={{ keyboardType: "decimal-pad" }}
        />

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Notes
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-3xl px-4 py-4 min-h-28">
            <TextInput
              placeholder="Add notes about this run..."
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholderTextColor={placeholderTextColor}
              className={`text-primaryText text-base min-h-20 ${notes ? "font-oxygen-regular" : ""}`}
            />
          </View>
        </View>
      </View>
    );
  },
);

AutoTimeRun.displayName = "AutoTimeRun";

export default AutoTimeRun;

