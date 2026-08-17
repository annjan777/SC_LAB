import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

async function testV3() {
  const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  
  const payload = {
    "FromEmail": FROM_EMAIL,
    "FromName": "SC Lab Portal",
    "Subject": "Mailjet Integration Test",
    "Text-part": "This is a direct test of the Mailjet API to verify email delivery is working for annjan0077@gmail.com.",
    "Recipients": [
      {
        "Email": "annjan0077@gmail.com"
      }
    ]
  };

  const response = await fetch('https://api.mailjet.com/v3/send/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("Status:", response.status);
  console.log("Response:", data);
}

testV3();
