const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'dev-secret-change-in-production';
const PORT = 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

const token = jwt.sign(
  {
    userId: '00000000-0000-0000-0000-000000000001',
    email: 'annjan0077@gmail.com',
    user_role: 'admin'
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const fetchOptions = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
};

const routesToTest = [
  '/api/dashboard/stats',
  '/api/settings/roles',
  '/api/settings/permissions',
  '/api/notifications',
  '/api/notifications/unread-count',
  '/api/expertise/suggestions',
  '/api/repository',
  '/api/admin/work/overview',
  '/api/work'
];

async function testEndpoint(path) {
  return new Promise((resolve) => {
    const req = http.request(`${BASE_URL}${path}`, fetchOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message }));
    req.end();
  });
}

async function runTests() {
  console.log(`Starting Extended API Smoke Tests...`);
  const results = [];
  for (const path of routesToTest) {
    const { status, error, data } = await testEndpoint(path);
    const resultStr = `${status} - ${path}`;
    if (status === 200) {
      console.log(`✅ ${resultStr}`);
    } else {
      console.log(`❌ ${resultStr}`);
      if (status !== 404) console.log(`   Data: ${data.substring(0, 100)}`);
    }
  }
}
runTests();
