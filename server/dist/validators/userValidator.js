import { z } from 'zod';
export const updateUserProfileSchema = z.object({
    full_name: z.string().min(1).optional(),
    roll_number: z.string().nullable().optional(),
    employee_id: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),
    joining_date: z.string().nullable().optional(),
    tenure_ending_date: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    program_designation: z.string().nullable().optional(),
    supervisor: z.string().nullable().optional(),
    emergency_contact_name: z.string().nullable().optional(),
    emergency_contact_phone: z.string().nullable().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
    require_password_change: z.boolean().optional(),
    email: z.string().email().nullable().optional(),
    user_role: z.string().optional(),
    role_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
    updated_at: z.string().nullable().optional(),
});
export const adminUserPermissionsSchema = z.object({
    role_id: z.string().uuid().nullable().optional(),
    user_role: z.string().optional(),
    individual_permissions: z.array(z.string()).optional(),
    permission_ids: z.array(z.string()).optional(),
});
