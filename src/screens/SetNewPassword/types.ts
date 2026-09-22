import * as yup from "yup";

export type T_RESET_PASSWORD_FORM = {
  password: string;
  confirmPassword: string;
};

export const T_RESET_PASSWORD_SCHEMA = yup
  .object({
    password: yup
      .string()
      .required("New password is required")
      .min(6, "Password must be at least 6 characters long"),
    confirmPassword: yup
      .string()
      .required("Confirm password is required")
      .oneOf([yup.ref("password")], "Passwords do not match"),
  })
  .required();

