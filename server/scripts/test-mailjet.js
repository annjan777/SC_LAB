import { sendPasswordResetLinkEmail } from '../dist/utils/email.js';

async function test() {
  console.log("Sending test Mailjet email...");
  const res = await sendPasswordResetLinkEmail('test@example.com', 'Test User', 'http://localhost:5173/reset-password?token=test');
  console.log("Result:", res);
}
test();
