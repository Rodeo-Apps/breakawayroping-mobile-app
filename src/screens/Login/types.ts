import * as yup from 'yup';

export type T_LOGIN_FORM = {
    email: string;
    password: string;
}

export const T_LOGIN_SCHEMA = yup.object({
    email: yup.string().email('Invalid email').required('Email is required'),
    password: yup.string().required('Password is required').min(6, "Password must be at least 6 characters long"),
}).required();
