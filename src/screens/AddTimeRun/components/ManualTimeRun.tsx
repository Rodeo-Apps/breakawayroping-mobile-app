import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { TextInput, View } from "react-native";
import { Controller, SubmitHandler, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Input } from "@/components";
import { Typography } from "@/utils/typography";
import { supabase } from "@/lib/supabase";
import { showAlert } from "@/utils/toast";
import { useAuth } from "@/provider/AuthProvider";
import { T_TIME_RUN_CHILD_HANDLE, T_TIME_RUN_CHILD_PROPS } from "./types";

type T_MANUAL_FORM = {
  breakaway1Time: string;
  breakaway2Time: string;
  breakaway3Time: string;
  penalties: string;
  notes: string;
};

const schema: yup.ObjectSchema<T_MANUAL_FORM> = yup
  .object({
    breakaway1Time: yup
      .string()
      .required("Breakaway 1 time is required")
      .test("breakaway-1", "Breakaway 1 time must be valid", (value) => {
        if (!value) return false;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      }),
    breakaway2Time: yup
      .string()
      .required("Breakaway 2 time is required")
      .test("breakaway-2", "Breakaway 2 time must be valid", (value) => {
        if (!value) return false;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      }),
    breakaway3Time: yup
      .string()
      .required("Breakaway 3 time is required")
      .test("breakaway-3", "Breakaway 3 time must be valid", (value) => {
        if (!value) return false;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      }),
    penalties: yup
      .string()
      .default("0")
      .test("penalties", "Penalties must be valid", (value) => {
        if (!value) return true;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }),
    notes: yup.string().default(""),
  })
  .required();

const ManualTimeRun = forwardRef<T_TIME_RUN_CHILD_HANDLE, T_TIME_RUN_CHILD_PROPS>(
  (
    {
      horseId,
      onSuccess,
      onSubmittingChange,
      placeholderTextColor,
    },
    ref,
  ) => {
    const { profile } = useAuth();
    const [saving, setSaving] = useState(false);

    const {
      control,
      handleSubmit,
      formState: { errors },
    } = useForm<T_MANUAL_FORM>({
      mode: "onSubmit",
      resolver: yupResolver(schema),
      defaultValues: {
        breakaway1Time: "",
        breakaway2Time: "",
        breakaway3Time: "",
        penalties: "0",
        notes: "",
      },
    });

    useEffect(() => {
      onSubmittingChange(saving);
    }, [onSubmittingChange, saving]);

    const onSubmit: SubmitHandler<T_MANUAL_FORM> = async (formData) => {
      if (!profile?.id) return;
      if (!horseId) {
        showAlert("Please select a horse first", "warning");
        return;
      }

      try {
        setSaving(true);
        const runDate = new Date().toISOString().split("T")[0];
        const payload: Record<string, unknown> = {
          user_id: profile.id,
          horse_id: horseId,
          run_date: runDate,
          time_seconds:
            Number(formData.breakaway1Time) +
            Number(formData.breakaway2Time) +
            Number(formData.breakaway3Time) +
            (formData.penalties ? Number(formData.penalties) : 0),
          breakaway1_time: formData.breakaway1Time ? Number(formData.breakaway1Time) : null,
          breakaway2_time: formData.breakaway2Time ? Number(formData.breakaway2Time) : null,
          breakaway3_time: formData.breakaway3Time ? Number(formData.breakaway3Time) : null,
          penalties: formData.penalties ? Number(formData.penalties) : 0,
          status: "complete",
          notes: formData.notes.trim() || null,
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
        void handleSubmit(onSubmit)();
      },
    }));

    return (
      <View className="gap-y-4">
        <View className="flex-row gap-x-3">
          <View className="flex-1">
            <Controller
              control={control}
              name="breakaway1Time"
              render={({ field: { value, onChange } }) => (
                <Input
                  label="Breakaway 1"
                  placeholder="Optional"
                  value={value}
                  onChangeText={onChange}
                  errorText={errors.breakaway1Time?.message}
                  inputProps={{ keyboardType: "decimal-pad" }}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="breakaway2Time"
              render={({ field: { value, onChange } }) => (
                <Input
                  label="Breakaway 2"
                  placeholder="Optional"
                  value={value}
                  onChangeText={onChange}
                  errorText={errors.breakaway2Time?.message}
                  inputProps={{ keyboardType: "decimal-pad" }}
                />
              )}
            />
          </View>
          <View className="flex-1">
            <Controller
              control={control}
              name="breakaway3Time"
              render={({ field: { value, onChange } }) => (
                <Input
                  label="Breakaway 3"
                  placeholder="Optional"
                  value={value}
                  onChangeText={onChange}
                  errorText={errors.breakaway3Time?.message}
                  inputProps={{ keyboardType: "decimal-pad" }}
                />
              )}
            />
          </View>
        </View>

        <Controller
          control={control}
          name="penalties"
          render={({ field: { value, onChange } }) => (
            <Input
              label="Penalties (seconds)"
              placeholder="0, 5, 10..."
              value={value}
              onChangeText={onChange}
              errorText={errors.penalties?.message}
              inputProps={{ keyboardType: "decimal-pad" }}
            />
          )}
        />

        <View className="gap-y-2">
          <Typography.SubHeading2 className="text-primaryText">
            Notes
          </Typography.SubHeading2>
          <View className="bg-background-secondary rounded-3xl px-4 py-4 min-h-28">
            <Controller
              control={control}
              name="notes"
              render={({ field: { value, onChange } }) => (
                <TextInput
                  placeholder="Add notes about this run..."
                  value={value}
                  onChangeText={onChange}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={placeholderTextColor}
                  className={`text-primaryText text-base min-h-20 ${value ? "font-oxygen-regular" : ""}`}
                />
              )}
            />
          </View>
        </View>
      </View>
    );
  },
);

ManualTimeRun.displayName = "ManualTimeRun";

export default ManualTimeRun;

