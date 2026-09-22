import * as yup from 'yup';

export type T_SINGUP_FORM = {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    describesYou: string[];
    schoolCode?: string;
    acceptedLegalTerms: boolean;
}

export const T_SIGNUP_SCHEMA = yup.object({
    fullName: yup.string().required('Full name is required').min(3, "Full name must be at least 3 characters long"),
    email: yup.string().email('Invalid email').required('Email is required'),
    password: yup.string().required('Password is required').min(6, "Password must be at least 6 characters long"),
    confirmPassword: yup.string().required('Confirm password is required').oneOf([yup.ref('password')], "Passwords do not match"),
    describesYou: yup.array().of(yup.string().required()).min(1, "Please select at least one option").required("Please select at least one option"),
    schoolCode: yup.string().optional(),
    acceptedLegalTerms: yup
        .boolean()
        .oneOf([true], "You must agree to the Terms of Use and Community Guidelines to continue"),
}).required();
