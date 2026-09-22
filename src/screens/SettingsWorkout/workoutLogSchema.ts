import * as yup from "yup";

export const workoutLogSchema = yup
  .object({
    workout_for: yup.string().oneOf(["rider", "horse"]).required(),
    horse_id: yup.string().trim().default(""),
    horse_name: yup.string().trim().default(""),
    workout_type: yup.string().trim().required(),
    duration_minutes: yup
      .string()
      .trim()
      .required("Duration is required")
      .test("min-dur", "Enter at least 1 minute", (v) => {
        const n = parseInt(v || "0", 10);
        return Number.isFinite(n) && n >= 1;
      }),
    intensity: yup.string().trim().required(),
    calories_burned: yup.string().trim().default(""),
    notes: yup.string().trim().default(""),
  })
  .test(
    "horse-if-horse",
    "Select a horse or enter a name",
    (vals) => {
      if (!vals || vals.workout_for !== "horse") return true;
      return Boolean(
        (vals.horse_id && String(vals.horse_id).trim()) ||
          (vals.horse_name && vals.horse_name.trim()),
      );
    },
  );

export type T_WORKOUT_LOG_FORM = {
  workout_for: "rider" | "horse";
  horse_id: string;
  horse_name: string;
  workout_type: string;
  duration_minutes: string;
  intensity: string;
  calories_burned: string;
  notes: string;
};
