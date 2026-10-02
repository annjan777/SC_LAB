import { z } from 'zod';
import { extractIndianPhone, validateEmail } from '../utils/userValidation.js';
export const updateUserProfileSchema = z.object({
    full_name: z.string().min(1).optional(),
    roll_number: z.string().nullable().optional(),
    employee_id: z.string().nullable().optional(),
    date_of_birth: z.string().nullable().optional(),
    joining_date: z.string().nullable().optional(),
    tenure_ending_date: z.string().nullable().optional(),
    phone: z.string().nullable().optional().refine(val => {
        if (!val)
            return true;
        return extractIndianPhone(val, false).isValid;
    }, {
        message: 'Phone number must be a 10-digit Indian contact number (e.g. 9876543210 or +91 98765 43210)',
    }),
    address: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    program_designation: z.string().nullable().optional(),
    supervisor: z.string().nullable().optional(),
    emergency_contact_name: z.string().nullable().optional(),
    emergency_contact_phone: z.string().nullable().optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).nullable().optional(),
    require_password_change: z.boolean().optional(),
    email: z.string().nullable().optional().refine(val => {
        if (!val)
            return true;
        return validateEmail(val).isValid;
    }, {
        message: 'Email must be a valid domain (e.g., @gmail.com or @kgpian.iitkgp.ac.in). Dummy domains are not allowed',
    }),
    user_role: z.string().optional(),
    role_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
    is_profile_completed: z.boolean().optional(),
    designation: z.string().nullable().optional(),
    project_name: z.string().nullable().optional(),
    project_code: z.string().nullable().optional(),
    project_start_date: z.string().nullable().optional(),
    project_end_date: z.string().nullable().optional(),
    project_tenure: z.string().nullable().optional(),
    staff_contract_start_date: z.string().nullable().optional(),
    staff_contract_end_date: z.string().nullable().optional(),
    contract_tenure: z.string().nullable().optional(),
    project_role_responsibility: z.string().nullable().optional(),
    project_pi_coordinator: z.string().nullable().optional(),
    reporting_manager: z.string().nullable().optional(),
    current_status: z.string().nullable().optional(),
    contract_status: z.string().nullable().optional(),
    remarks_staff: z.string().nullable().optional(),
    remarks_manager: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
});
export const adminUserPermissionsSchema = z.object({
    role_id: z.string().uuid().nullable().optional(),
    user_role: z.string().optional(),
    individual_permissions: z.array(z.string()).optional(),
    permission_ids: z.array(z.string()).optional(),
});
