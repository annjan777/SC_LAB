const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = 'dev-secret-change-in-production';
const PORT = 3001;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Create an admin token
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
  // Auth
  '/api/auth/me',
  // Users
  '/api/users',
  // Admin custom routes
  '/api/admin/roles',
  '/api/admin/permissions',
  // Inventory (CRUD)
  '/api/inventory',
  // Purchase Requests
  '/api/purchase-requests',
  '/api/admin/purchase-requests',
  // Procurement details
  '/api/procurement-details',
  // Leave requests
  '/api/leave-requests',
  '/api/admin/leave-requests',
  // Work tracking
  '/api/work-cycles',
  '/api/assigned-works',
  '/api/work-milestones',
  '/api/progress-updates',
  '/api/work-problems',
  '/api/mitigation-actions',
  '/api/admin-comments',
  '/api/work-dependencies',
  // Facilities
  '/api/facilities',
  // Audit logs
  '/api/audit-logs',
  // Repository
  '/api/admin/repository'
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
  console.log(`Starting API Smoke Tests with Admin Token...`);
  console.log(`===========================================`);
  const results = [];

  for (const path of routesToTest) {
    const { status, error, data } = await testEndpoint(path);
    const resultStr = `${status} - ${path}`;
    
    if (status === 200) {
      console.log(`✅ ${resultStr}`);
    } else {
      console.log(`❌ ${resultStr}`);
      if (status === 500 || status === 401 || status === 403) {
        let msg = data;
        try { msg = JSON.parse(data).error || data; } catch(e){}
        console.log(`   Error: ${msg}`);
      }
    }
    
    results.push({ path, status, error });
  }

  const failed = results.filter(r => r.status !== 200);
  console.log(`===========================================`);
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
}

runTests().catch(console.error);
