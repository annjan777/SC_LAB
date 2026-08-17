import pg from 'pg';
const { Client } = pg;
const client = new Client({ connectionString: 'postgres://postgres:postgres@localhost:5432/sclab' });
async function check() {
  await client.connect();
  const { rows } = await client.query("SELECT id, email, user_role FROM user_profiles WHERE email LIKE '%john%'");
  for (const user of rows) {
    console.log(user.email, user.user_role);
    const perms = await client.query("SELECT permission_name FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id JOIN roles r ON r.id = rp.role_id WHERE r.role_name = $1", [user.user_role]);
    console.log(perms.rows.map(r => r.permission_name));
  }
  await client.end();
}
check();
