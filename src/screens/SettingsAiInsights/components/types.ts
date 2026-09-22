import type {
  T_AI_INSIGHT_RUN,
  T_AI_RUN_INSIGHT,
} from "@/services/supabase/aiInsightsTypes";

export type RunsPickerPageSheetProps = {
  visible: boolean;
  onClose: () => void;
  runs: T_AI_INSIGHT_RUN[];
  loading: boolean;
  generating: boolean;
  onOpen: () => void;
  onSelectRun: (runId: string) => Promise<void>;
};

export type InsightDetailSheetProps = {
  open: boolean;
  insight: T_AI_RUN_INSIGHT | null;
  onClose: () => void;
};
