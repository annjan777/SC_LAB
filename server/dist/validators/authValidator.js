import { z } from 'zod';
export const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});
export const signupSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    full_name: z.string().min(1, 'Full name is required'),
    role: z.enum(['admin', 'user', 'coordinator', 'member']).optional(),
});
export const changePasswordSchema = z.object({
    currentPassword: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
});
export const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
});
