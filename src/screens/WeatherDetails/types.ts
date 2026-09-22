export type HorseCareAlert = {
  type: "heat" | "cold" | "severe";
  severity: "low" | "medium" | "high";
  message: string;
  recommendations: string[];
};
