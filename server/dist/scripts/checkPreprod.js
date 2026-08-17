import 'dotenv/config';
import { query, pool } from '../config/database.js';
async function checkPreproductionReadiness() {
    console.log('====================================================');
    console.log('   SC LAB PORTAL — PRE-PRODUCTION HEALTH CHECK      ');
    console.log('====================================================\n');
    let errors = 0;
    let warnings = 0;
    function check(passed, title, detail, isWarning = false) {
        if (passed) {
            console.log(`  [OK] ${title}`);
        }
        else if (isWarning) {
            console.warn(`  [WARN] ${title} | ${detail}`);
            warnings++;
        }
        else {
            console.error(`  [FAIL] ${title} | ${detail}`);
            errors++;
        }
    }
    // 1. Database Connection & Schema Verification
    try {
        const res = await query('SELECT count(*) FROM information_schema.tables WHERE table_schema = \'public\'');
        const tableCount = parseInt(res.rows[0].count, 10);
        check(tableCount >= 20, 'Database Schema Integrity', `Found ${tableCount} tables in public schema`);
    }
    catch (err) {
        check(false, 'Database Connection', err.message);
    }
    // 2. Database Trigger Verification
    try {
        const triggerRes = await query(`
      SELECT trigger_name FROM information_schema.triggers 
      WHERE event_object_table = 'user_profiles' AND trigger_name = 'trigger_sync_user_profile_email'
    `);
        check(triggerRes.rows.length > 0, 'Email Sync Trigger Active', 'trigger_sync_user_profile_email is registered');
    }
    catch (err) {
        check(false, 'Email Sync Trigger Verification', err.message);
    }
    // 3. JWT Secret Strength Check
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret || jwtSecret === 'sc-lab-jwt-secret-change-in-production') {
        check(false, 'JWT Secret Configuration', 'JWT_SECRET is unset or using weak default value!');
    }
    else if (jwtSecret.length < 32) {
        check(false, 'JWT Secret Entropy', `JWT_SECRET length is ${jwtSecret.length} chars (recommend >= 32 chars)`, true);
    }
    else {
        check(true, 'JWT Secret Security', 'Configured with strong entropy');
    }
    // 4. Production Environment Mode
    const isProd = process.env.NODE_ENV === 'production';
    check(isProd, 'NODE_ENV Configuration', `NODE_ENV is set to '${process.env.NODE_ENV || 'development'}'`, true);
    console.log(`\n----------------------------------------------------`);
    console.log(`Pre-Production Health Summary: ${errors} errors, ${warnings} warnings.`);
    console.log(`----------------------------------------------------\n`);
    await pool.end();
    if (errors > 0) {
        process.exit(1);
    }
}
checkPreproductionReadiness();
