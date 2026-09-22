import * as yup from "yup";

export const nutritionLogSchema = yup
  .object({
    item_name: yup.string().trim().default(""),
    calories: yup.string().trim().default(""),
    protein: yup.string().trim().default(""),
    carbs: yup.string().trim().default(""),
    fat: yup.string().trim().default(""),
    meal_type: yup.string().trim().default("meal"),
  })
  .test(
    "food-or-calories",
    "Enter a food name or calories (or both)",
    (vals) => {
      if (!vals) return false;
      const name = vals.item_name?.trim();
      const cal = vals.calories?.trim();
      return Boolean(name || cal);
    },
  );

export type T_NUTRITION_LOG_FORM = {
  item_name: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  meal_type: string;
};
