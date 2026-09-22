import * as yup from "yup";

export type T_HORSE_GENDER = "mare" | "stallion" | "gelding";
export type T_ACTIVE_STATUS = "active" | "retired";

export type T_ADD_HORSE_FORM = {
  name: string;
  breed: string;
  age: string;
  color: string;
  gender: T_HORSE_GENDER | "";
  registration_number: string;
  breed_registry: string;
  date_of_birth: string;
  color_markings: string;
  sire_name: string;
  dam_name: string;
  notes: string;
  activeStatus: T_ACTIVE_STATUS;
};

export const T_ADD_HORSE_SCHEMA: yup.ObjectSchema<T_ADD_HORSE_FORM> = yup
  .object({
    name: yup.string().trim().required("Horse name is required"),
    breed: yup.string().default(""),
    age: yup
      .string()
      .default("")
      .test("is-valid-age", "Age must be a valid number", (value) => {
        if (!value) return true;
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }),
    color: yup.string().default(""),
    gender: yup
      .mixed<T_HORSE_GENDER | "">()
      .oneOf(["", "mare", "stallion", "gelding"])
      .default(""),
    registration_number: yup.string().default(""),
    breed_registry: yup.string().default(""),
    date_of_birth: yup.string().default(""),
    color_markings: yup.string().default(""),
    sire_name: yup.string().default(""),
    dam_name: yup.string().default(""),
    notes: yup.string().default(""),
    activeStatus: yup
      .mixed<T_ACTIVE_STATUS>()
      .oneOf(["active", "retired"])
      .required()
      .default("active"),
  })
  .required();

