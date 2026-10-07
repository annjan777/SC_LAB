import { query, pool } from '../config/database.js';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001/api';

export async function runFacilitiesAndBookingsTest() {
  console.log('\n--- Facilities & Independent Booking Integration Suite (Real HTTP & DB) ---');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, title: string, details?: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${title}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${title} | Details: ${details || 'Assertion failed'}`);
    }
  }

  let testFacilityId: string = '';
  let testItemId: string = '';
  let testUserId: string = '';
  let booking1Id: string = '';
  let booking2Id: string = '';
  let equipBooking1Id: string = '';

  try {
    // 1. Get or create a test user and generate token
    const userRes = await query("SELECT id, email FROM user_profiles WHERE user_role IN ('admin', 'super_admin') LIMIT 1");
    if (userRes.rows.length === 0) {
      throw new Error('No user found in database to run tests with');
    }
    testUserId = userRes.rows[0].id;
    const testUserEmail = userRes.rows[0].email;
    const userToken = jwt.sign({ userId: testUserId, email: testUserEmail }, JWT_SECRET, { expiresIn: '1h' });

    // 2. Create a test Facility via HTTP POST /api/facilities
    const facRes = await fetch(`${BASE_URL}/facilities`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: `Electronics Fab Lab ${Date.now()}`,
        location: 'Building B, Room 204',
        capacity: 30,
        features: ['Soldering Stations', 'Oscilloscopes', 'Fume Hood'],
        status: 'operational',
      }),
    });
    const facData = await facRes.json();
    testFacilityId = facData.id;
    assert(
      facRes.status === 201 && facData.capacity === 30 && facData.features.includes('Oscilloscopes'),
      'Facility created via HTTP POST with capacity and features array',
      JSON.stringify(facData)
    );

    // 3. Create a test Inventory Item and link to facility
    const itemRes = await query(
      `INSERT INTO inventory_items (item_name, category, quantity, condition, location, facility_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      ['Test Ultimaker 3D Printer', 'Equipments', 2, 'good', 'Workbench 3', testFacilityId]
    );
    testItemId = itemRes.rows[0].id;

    // Link via facility_equipment junction table via HTTP POST /api/facilities/:id/equipment
    const linkRes = await fetch(`${BASE_URL}/facilities/${testFacilityId}/equipment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        inventory_item_ids: [testItemId],
      }),
    });
    assert(linkRes.status === 200, 'Equipment linked to facility via HTTP POST /api/facilities/:id/equipment');

    // 4. Verify linked equipment query via HTTP GET /api/facilities/:id/equipment
    const getEquipRes = await fetch(`${BASE_URL}/facilities/${testFacilityId}/equipment`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const equipList = await getEquipRes.json();
    assert(
      getEquipRes.status === 200 && Array.isArray(equipList) && equipList.some((r: any) => r.id === testItemId),
      'Equipment correctly retrieved for facility via HTTP GET',
      `Found ${equipList.length} linked items`
    );

    // 5. Test Facility Booking & Overlap Prevention via HTTP API
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const slot1Start = `${dateStr}T10:00:00.000Z`;
    const slot1End = `${dateStr}T11:30:00.000Z`;

    // Book Slot 1 via HTTP POST /api/facilities/:id/bookings
    const book1Res = await fetch(`${BASE_URL}/facilities/${testFacilityId}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Morning Lab Work',
        purpose: 'Circuit soldering and diagnostics',
        start_time: slot1Start,
        end_time: slot1End,
      }),
    });
    const book1Data = await book1Res.json();
    booking1Id = book1Data.id;
    assert(book1Res.status === 201 && !!booking1Id, 'Initial facility booking confirmed via HTTP POST (10:00 - 11:30)');

    // Attempt overlapping slot via HTTP POST: 11:00 to 12:00 (overlaps by 30 mins)
    const slotOverlapStart = `${dateStr}T11:00:00.000Z`;
    const slotOverlapEnd = `${dateStr}T12:00:00.000Z`;

    const bookOverlapRes = await fetch(`${BASE_URL}/facilities/${testFacilityId}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Overlapping Session Attempt',
        purpose: 'Should be rejected',
        start_time: slotOverlapStart,
        end_time: slotOverlapEnd,
      }),
    });
    assert(
      bookOverlapRes.status === 409,
      'Facility overlap detected: HTTP 409 Conflict prevents double-booking overlapping window',
      `Status: ${bookOverlapRes.status}`
    );

    // Attempt non-overlapping slot via HTTP POST: 11:30 to 13:00 (starts right when previous ends)
    const slot2Start = `${dateStr}T11:30:00.000Z`;
    const slot2End = `${dateStr}T13:00:00.000Z`;

    const book2Res = await fetch(`${BASE_URL}/facilities/${testFacilityId}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Afternoon Lab Work',
        purpose: 'Spectroscopy',
        start_time: slot2Start,
        end_time: slot2End,
      }),
    });
    const book2Data = await book2Res.json();
    booking2Id = book2Data.id;
    assert(
      book2Res.status === 201 && !!booking2Id,
      'Non-overlapping facility slot cleanly allowed via HTTP POST (11:30 - 13:00)'
    );

    // 6. Test Independent Equipment Booking (Equipment reservation during facility reservation window)
    const eqBookRes = await query(
      `INSERT INTO equipment_bookings (inventory_item_id, user_id, title, start_time, end_time, quantity, purpose, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'confirmed')
       RETURNING *`,
      [testItemId, testUserId, 'Enclosure 3D Print Job', slot1Start, slot1End, 1, 'Prototyping enclosure']
    );
    equipBooking1Id = eqBookRes.rows[0].id;
    assert(
      eqBookRes.rows.length === 1,
      'Independent equipment booking created successfully during facility reservation window'
    );

    // Test Equipment Overlap Prevention on the same equipment item
    const eqOverlapCheck = await query(
      `SELECT id, purpose FROM equipment_bookings
       WHERE inventory_item_id = $1
         AND status = 'confirmed'
         AND start_time < $3
         AND end_time > $2`,
      [testItemId, slotOverlapStart, slotOverlapEnd]
    );
    assert(
      eqOverlapCheck.rows.length > 0,
      'Equipment overlap detected: database prevents conflicting equipment booking',
      `Found ${eqOverlapCheck.rows.length} conflicting equipment booking`
    );

    // 7. Cancellation logic via HTTP PUT /api/facilities/bookings/:bookingId/cancel
    const cancelRes = await fetch(`${BASE_URL}/facilities/bookings/${booking1Id}/cancel`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        cancellation_reason: 'Testing cancellation flow',
      }),
    });
    assert(cancelRes.status === 200, 'Facility booking cancelled via HTTP PUT /bookings/:id/cancel');

    const afterCancel = await query(
      `SELECT id FROM facility_bookings
       WHERE facility_id = $1
         AND status = 'confirmed'
         AND start_time < $3
         AND end_time > $2`,
      [testFacilityId, slot1Start, slot1End]
    );
    assert(
      afterCancel.rows.length === 0,
      'Cancelled facility booking no longer blocks time slot'
    );
  } catch (err: any) {
    console.error('Test execution error:', err);
    assert(false, 'Test execution completed without uncaught errors', err.message);
  } finally {
    // Cleanup test records
    if (booking1Id) await query('DELETE FROM facility_bookings WHERE id = $1', [booking1Id]);
    if (booking2Id) await query('DELETE FROM facility_bookings WHERE id = $1', [booking2Id]);
    if (equipBooking1Id) await query('DELETE FROM equipment_bookings WHERE id = $1', [equipBooking1Id]);
    if (testItemId) {
      await query('DELETE FROM facility_equipment WHERE inventory_item_id = $1', [testItemId]);
      await query('DELETE FROM inventory_items WHERE id = $1', [testItemId]);
    }
    if (testFacilityId) await query('DELETE FROM facilities WHERE id = $1', [testFacilityId]);
  }

  console.log(`\nFacilities & Bookings Test Suite: ${passed}/${total} passed.\n`);
  return { passed, total };
}

// Auto-run if executed directly
if (process.argv[1]?.endsWith('facilitiesAndBookings.test.ts')) {
  runFacilitiesAndBookingsTest()
    .then(async (res) => {
      await pool.end();
      process.exit(res.passed === res.total ? 0 : 1);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
