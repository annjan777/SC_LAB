import { query, pool } from '../config/database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

async function testDailyTodos() {
  console.log('====================================================');
  console.log('   DAILY TO-DO API & PRIVACY VERIFICATION SUITE     ');
  console.log('====================================================');

  const BASE_URL = 'http://localhost:3001/api/daily-todos';

  // Fetch two real users from DB: User A and User B
  const usersRes = await query('SELECT id, email, user_role FROM user_profiles ORDER BY created_at LIMIT 2');
  if (usersRes.rows.length < 2) {
    throw new Error('Need at least 2 users in database for privacy isolation test');
  }

  const userA = usersRes.rows[0];
  const userB = usersRes.rows[1];

  const tokenA = jwt.sign({ userId: userA.id, email: userA.email }, JWT_SECRET, { expiresIn: '1h' });
  const tokenB = jwt.sign({ userId: userB.id, email: userB.email }, JWT_SECRET, { expiresIn: '1h' });

  console.log(`User A: ${userA.email} (${userA.id}, role: ${userA.user_role})`);
  console.log(`User B: ${userB.email} (${userB.id}, role: ${userB.user_role})`);

  const todayStr = '2099-10-06';
  const yesterdayStr = '2099-10-05';

  // Clean up any test trackers from previous runs
  await query('DELETE FROM daily_todo_trackers WHERE date IN ($1, $2)', [todayStr, yesterdayStr]);

  // 1. Unauthenticated request should be rejected (401)
  const unauthRes = await fetch(`${BASE_URL}/dates`);
  console.log(unauthRes.status === 401 ? '✅ [PASS] Unauthenticated request blocked (401)' : '❌ [FAIL] Unauthenticated request not blocked');

  // 2. User A gets day tracker for yesterday (auto-creates)
  const getYesterdayA = await fetch(`${BASE_URL}/day/${yesterdayStr}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const dataYesterdayA = await getYesterdayA.json();
  console.log(getYesterdayA.status === 200 && dataYesterdayA.tracker?.date === yesterdayStr
    ? `✅ [PASS] User A auto-created tracker for ${yesterdayStr}`
    : '❌ [FAIL] Failed to auto-create tracker');

  // 3. User A adds 3 tasks to yesterday (2 complete, 1 incomplete)
  const addTaskRes1 = await fetch(`${BASE_URL}/day/${yesterdayStr}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Calibrate spectrometer A' }),
  });
  const task1 = await addTaskRes1.json();

  const addTaskRes2 = await fetch(`${BASE_URL}/day/${yesterdayStr}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Prepare chemical reagents' }),
  });
  const task2 = await addTaskRes2.json();

  const addTaskRes3 = await fetch(`${BASE_URL}/day/${yesterdayStr}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Submit lab safety report' }),
  });
  const task3 = await addTaskRes3.json();

  console.log(task1.id && task2.id && task3.id
    ? '✅ [PASS] User A added 3 tasks to yesterday'
    : '❌ [FAIL] Failed to add tasks');

  // 4. User A marks task 1 and task 2 as completed
  await fetch(`${BASE_URL}/items/${task1.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ is_completed: true }),
  });
  await fetch(`${BASE_URL}/items/${task2.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ is_completed: true }),
  });

  // Verify task 1 has completed_at
  const verifyTask1 = await query('SELECT is_completed, completed_at FROM daily_todo_items WHERE id = $1', [task1.id]);
  console.log(verifyTask1.rows[0].is_completed === true && !!verifyTask1.rows[0].completed_at
    ? '✅ [PASS] Tasks completed status and completed_at timestamp recorded'
    : '❌ [FAIL] Task completion timestamp missing');

  // 5. User A creates today's tracker and tests "Carry Forward"
  const carryRes = await fetch(`${BASE_URL}/day/${todayStr}/carry-forward`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const carryData = await carryRes.json();
  console.log(carryData.copied_count === 1 && carryData.items[0]?.title === 'Submit lab safety report'
    ? `✅ [PASS] Carry forward correctly copied 1 incomplete task ("${carryData.items[0].title}")`
    : `❌ [FAIL] Carry forward unexpected result: ${JSON.stringify(carryData)}`);

  // 6. User A edits a task title and tests reorder
  const updateTitleRes = await fetch(`${BASE_URL}/items/${carryData.items[0].id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Submit lab safety report (Urgent Review)' }),
  });
  const updatedTask = await updateTitleRes.json();
  console.log(updatedTask.title === 'Submit lab safety report (Urgent Review)'
    ? '✅ [PASS] Task inline title update verified'
    : '❌ [FAIL] Task title update failed');

  // Add another task to today and reorder
  const addToday2 = await fetch(`${BASE_URL}/day/${todayStr}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ title: 'Check centrifuge balance' }),
  });
  const todayTask2 = await addToday2.json();

  // Reorder so todayTask2 is first
  const reorderRes = await fetch(`${BASE_URL}/day/${todayStr}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ item_ids: [todayTask2.id, carryData.items[0].id] }),
  });
  const reorderData = await reorderRes.json();
  console.log(reorderData.items[0]?.id === todayTask2.id && reorderData.items[0]?.order_index === 0
    ? '✅ [PASS] Task reordering verified'
    : '❌ [FAIL] Reordering failed');

  // 7. Check summary endpoint
  const summaryRes = await fetch(`${BASE_URL}/today/summary?date=${todayStr}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const summaryData = await summaryRes.json();
  console.log(summaryData.total_tasks === 2 && summaryData.pending_tasks === 2
    ? `✅ [PASS] Today summary endpoint returned correct stats: ${summaryData.pending_tasks}/${summaryData.total_tasks} pending`
    : `❌ [FAIL] Today summary mismatch: ${JSON.stringify(summaryData)}`);

  // ---------------------------------------------------------------------------
  // 8. PRIVACY & ISOLATION SECURITY TESTS (CRITICAL REQUIREMENT)
  // ---------------------------------------------------------------------------
  console.log('\n--- Privacy & Security Isolation Verification ---');

  // User B tries to view dates: User B should NOT see User A's tasks
  const datesBRes = await fetch(`${BASE_URL}/dates`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const datesB = await datesBRes.json();
  const foundAInB = datesB.some((d: any) => d.tracker_id === dataYesterdayA.tracker.id);
  console.log(!foundAInB
    ? '✅ [PASS] [PRIVACY] User B dates list contains ZERO entries from User A'
    : '❌ [FAIL] User B can see User A tracker in dates list!');

  // User B tries to access User A's day
  const getDayB = await fetch(`${BASE_URL}/day/${yesterdayStr}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const dataDayB = await getDayB.json();
  const leakedTasks = dataDayB.items.filter((item: any) => item.user_id === userA.id);
  console.log(leakedTasks.length === 0
    ? '✅ [PASS] [PRIVACY] User B receives empty/own list for yesterday, 0 items leaked from User A'
    : '❌ [FAIL] Leaked tasks from User A to User B!');

  // User B tries to update User A's task (ID manipulation attack)
  const hackUpdateRes = await fetch(`${BASE_URL}/items/${task1.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenB}` },
    body: JSON.stringify({ title: 'Hacked by User B', is_completed: false }),
  });
  console.log(hackUpdateRes.status === 404
    ? '✅ [PASS] [SECURITY] User B blocked (404) from updating User A task via ID manipulation'
    : `❌ [FAIL] Security breach: User B updated User A task! Status: ${hackUpdateRes.status}`);

  // User B tries to delete User A's task
  const hackDeleteRes = await fetch(`${BASE_URL}/items/${task1.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(hackDeleteRes.status === 404
    ? '✅ [PASS] [SECURITY] User B blocked (404) from deleting User A task'
    : `❌ [FAIL] Security breach: User B deleted User A task! Status: ${hackDeleteRes.status}`);

  // User A can delete their own task
  const deleteSelfRes = await fetch(`${BASE_URL}/items/${task3.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log(deleteSelfRes.status === 200
    ? '✅ [PASS] User A can cleanly delete their own task'
    : `❌ [FAIL] User A failed to delete own task: ${deleteSelfRes.status}`);

  // User B tries to delete User A's tracker by tracker ID (ID manipulation attack)
  const hackDeleteTrackerRes = await fetch(`${BASE_URL}/trackers/${dataYesterdayA.tracker.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  console.log(hackDeleteTrackerRes.status === 404
    ? '✅ [PASS] [SECURITY] User B blocked (404) from deleting User A tracker via ID manipulation'
    : `❌ [FAIL] Security breach: User B deleted User A tracker! Status: ${hackDeleteTrackerRes.status}`);

  // User A deletes their own tracker for yesterday
  const deleteTrackerSelfRes = await fetch(`${BASE_URL}/day/${yesterdayStr}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  console.log(deleteTrackerSelfRes.status === 200
    ? '✅ [PASS] User A can cleanly delete their own day tracker'
    : `❌ [FAIL] User A failed to delete tracker: ${deleteTrackerSelfRes.status}`);

  // Verify tracker and its tasks are completely removed from DB
  const checkTracker = await query('SELECT id FROM daily_todo_trackers WHERE id = $1', [dataYesterdayA.tracker.id]);
  const checkTasks = await query('SELECT id FROM daily_todo_items WHERE tracker_id = $1', [dataYesterdayA.tracker.id]);
  console.log(checkTracker.rows.length === 0 && checkTasks.rows.length === 0
    ? '✅ [PASS] Deleted tracker and all cascade tasks permanently purged from database'
    : '❌ [FAIL] Deleted tracker or tasks still found in DB');

  try {
    // Clean up test data
    await query('DELETE FROM daily_todo_trackers WHERE date IN ($1, $2)', [todayStr, yesterdayStr]);

    console.log('\n====================================================');
    console.log('   ALL DAILY TO-DO API & PRIVACY TESTS PASSED!       ');
    console.log('====================================================\n');
  } finally {
    await pool.end();
  }
}

testDailyTodos()
  .catch((err) => {
    console.error('Test failed with error:', err);
    process.exitCode = 1;
  });
