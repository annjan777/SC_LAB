const MAILJET_API_KEY = "6462a9452bfa904a471fcf3acbf98130";
const MAILJET_SECRET_KEY = "9a1fba2a7ed1df55fa70779c41c4efa2";
const FROM_EMAIL = "erp.sclab@mailjet.com";

async function testV31() {
  const auth = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');
  
  const payload = {
    Messages: [
      {
        From: { Email: FROM_EMAIL, Name: "SC Lab Portal" },
        To: [ { Email: "annjan0077@gmail.com", Name: "Annjan" } ],
        Subject: "Mailjet Delivery Verification",
        HTMLPart: "This is a verification test to see if Mailjet is successfully delivering emails to this account."
      }
    ]
  };

  const response = await fetch('https://api.mailjet.com/v3.1/send', {
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

testV31();
