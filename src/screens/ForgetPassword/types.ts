import * as yup from "yup";

export type T_FORGOT_PASSWORD_FORM = {
  email: string;
};

export const T_FORGOT_PASSWORD_SCHEMA = yup
  .object({
    email: yup.string().email("Invalid email").required("Email is required"),
  })
  .required();

