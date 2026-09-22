import { T_RUN_STATUS } from "../types";

export type T_TIME_RUN_CHILD_HANDLE = {
  submit: () => void;
};

export type T_TIME_RUN_CHILD_PROPS = {
  horseId: string;
  onSuccess: () => void;
  onSubmittingChange: (isSubmitting: boolean) => void;
  primaryTextColor: string;
  placeholderTextColor: string;
};

export type T_STATUS_OPTION = {
  label: string;
  value: T_RUN_STATUS;
};

