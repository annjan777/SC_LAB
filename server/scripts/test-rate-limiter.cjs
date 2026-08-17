const http = require('http');

async function loginAttempt(email, password) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ email, password });
    const req = http.request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log("Sending 15 failed login attempts...");
  for (let i = 1; i <= 15; i++) {
    const res = await loginAttempt('admin@admin.com', 'wrongpassword');
    if (i === 15) {
      console.log(`Attempt 15: Status ${res.status} - ${res.body}`);
    }
  }

  console.log("Sending 16th failed login attempt (should be blocked)...");
  const res16 = await loginAttempt('admin@admin.com', 'wrongpassword');
  console.log(`Attempt 16: Status ${res16.status} - ${res16.body}`);

  console.log("Wait, we need the server to be running. Please start the server to test.");
}

run();
