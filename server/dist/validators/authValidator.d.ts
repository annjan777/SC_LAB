import { z } from 'zod';
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const signupSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    full_name: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["admin", "user", "coordinator", "member"]>>;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
    full_name: string;
    role?: "user" | "admin" | "coordinator" | "member" | undefined;
}, {
    email: string;
    password: string;
    full_name: string;
    role?: "user" | "admin" | "coordinator" | "member" | undefined;
}>;
export declare const changePasswordSchema: z.ZodObject<{
    currentPassword: z.ZodOptional<z.ZodString>;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    currentPassword?: string | undefined;
}, {
    password: string;
    currentPassword?: string | undefined;
}>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
}, {
    email: string;
}>;
