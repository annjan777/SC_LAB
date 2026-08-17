import { loginSchema, signupSchema } from '../validators/authValidator.js';
import { ZodError } from 'zod';
export async function runValidatorTest() {
    console.log('--- Zod Request Validation Unit Test ---');
    // 1. Valid login payload
    const validLogin = loginSchema.parse({ email: 'user@example.com', password: 'password123' });
    if (validLogin.email !== 'user@example.com') {
        throw new Error('Valid login payload parsing failed!');
    }
    console.log('  [PASS] Valid payload parsing');
    // 2. Invalid email format
    try {
        loginSchema.parse({ email: 'not-an-email', password: '123' });
        throw new Error('Should have failed invalid email validation!');
    }
    catch (err) {
        if (err instanceof ZodError) {
            console.log('  [PASS] Invalid email rejected with Zod error');
        }
        else {
            throw err;
        }
    }
    // 3. Short password validation
    try {
        signupSchema.parse({ email: 'valid@example.com', password: '123', full_name: 'Test' });
        throw new Error('Should have failed short password validation!');
    }
    catch (err) {
        if (err instanceof ZodError) {
            console.log('  [PASS] Short password rejected with Zod error');
        }
        else {
            throw err;
        }
    }
}
