import * as yup from "yup";

export type T_EDIT_PROFILE_FORM = {
  name: string;
  bio: string;
  describesYou: string[];
};

export const T_EDIT_PROFILE_SCHEMA: yup.ObjectSchema<T_EDIT_PROFILE_FORM> = yup
  .object({
    name: yup.string().trim().required("Name is required"),
    bio: yup.string().default(""),
    describesYou: yup
      .array()
      .of(yup.string().required())
      .min(1, "Please select at least one role")
      .required("Please select at least one role"),
  })
  .required();

