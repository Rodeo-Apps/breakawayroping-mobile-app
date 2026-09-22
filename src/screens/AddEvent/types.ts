import * as yup from "yup";

export type T_EVENT_TYPE = "jackpot" | "rodeo" | "clinic" | "practice";

export type T_ADD_EVENT_FORM = {
  eventName: string;
  eventType: T_EVENT_TYPE;
  organization: string;
  description: string;
  location: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  entryFee: string;
  prizePool: string;
  maxEntries: string;
  divisionsOffered: string[];
  rules: string;
};

const validNumberString = (value?: string) => {
  if (!value || value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
};

const validIntegerString = (value?: string) => {
  if (!value || value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
};

export const T_ADD_EVENT_SCHEMA: yup.ObjectSchema<T_ADD_EVENT_FORM> = yup
  .object({
    eventName: yup.string().trim().required("Event name is required"),
    eventType: yup
      .mixed<T_EVENT_TYPE>()
      .oneOf(["jackpot", "rodeo", "clinic", "practice"])
      .required()
      .default("jackpot"),
    organization: yup.string().default(""),
    description: yup.string().default(""),
    location: yup.string().trim().required("Location is required"),
    startDate: yup.string().required("Start date is required"),
    endDate: yup.string().required("End date is required"),
    registrationDeadline: yup.string().required("Deadline is required"),
    entryFee: yup
      .string()
      .default("")
      .test("valid-entry-fee", "Entry fee must be a valid number", validNumberString),
    prizePool: yup
      .string()
      .default("")
      .test("valid-prize-pool", "Prize pool must be a valid number", validNumberString),
    maxEntries: yup
      .string()
      .default("")
      .test("valid-max-entries", "Max entries must be a whole number", validIntegerString),
    divisionsOffered: yup
      .array()
      .of(yup.string().required())
      .min(1, "Select at least one division")
      .required(),
    rules: yup.string().default(""),
  })
  .required();

