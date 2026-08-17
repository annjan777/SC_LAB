import { test, expect } from '@playwright/test';

test.describe('SC Lab Portal E2E Tests', () => {
  test.beforeEach(async ({ page, request }) => {
    const testEmail = `admin_${Date.now()}@test.com`;
    // Create the test user
    const signupRes = await request.post('/api/auth/signup', {
      data: {
        email: testEmail,
        password: 'admin123',
        full_name: 'E2E Admin User'
      }
    });
    const signupData = await signupRes.json();
    
    // Promote user to super_admin in DB to avoid UI redirect issues
    // For E2E we'll use a hack or just test with a normal user if it works?
    // Wait, let's just make the user an admin via a quick API call if we can, 
    // or run a db query to promote them.
    // Instead of that, let's test with the existing user 'annjan0077@gmail.com'
    // BUT we will just sign up as a regular user first, to see if login works.
    
    await page.goto('/login');
    await page.fill('input[type="email"]', testEmail);
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('Check all main sidebar links', async ({ page }) => {
    // 1. Manage Users
    await page.click('text=Manage Users');
    await expect(page).toHaveURL(/.*\/admin\/users/);
    await expect(page.locator('text=Manage Users').first()).toBeVisible();

    // 2. Work Overview
    await page.click('text=Work Overview');
    await expect(page).toHaveURL(/.*\/work/);
    await expect(page.locator('text=Work Overview').first()).toBeVisible();

    // 3. Facilities
    await page.click('text=Facilities');
    await expect(page).toHaveURL(/.*\/facilities/);
    await expect(page.locator('text=Facilities').first()).toBeVisible();

    // 4. Inventory
    await page.click('text=Inventory');
    await expect(page).toHaveURL(/.*\/inventory/);
    await expect(page.locator('text=Inventory').first()).toBeVisible();

    // 5. Procurement
    await page.click('text=Procurement');
    await expect(page).toHaveURL(/.*\/procurement/);
    await expect(page.locator('text=Procurement').first()).toBeVisible();

    // 6. Leave Approvals
    await page.click('text=Leave Approvals');
    await expect(page).toHaveURL(/.*\/leaves/);
    await expect(page.locator('text=Leave Requests').first()).toBeVisible();

    // 7. Audit Logs
    await page.click('text=Audit Logs');
    await expect(page).toHaveURL(/.*\/admin\/audit-logs/);
    await expect(page.locator('text=Audit Logs').first()).toBeVisible();

    // 8. Settings
    await page.click('text=Settings');
    await expect(page).toHaveURL(/.*\/admin\/settings/);
    await expect(page.locator('text=Roles & Permissions').first()).toBeVisible();

    // 9. Reports
    await page.click('text=Reports');
    await expect(page).toHaveURL(/.*\/admin\/reports/);
    await expect(page.locator('text=System Reports').first()).toBeVisible();
  });

  test('Test Facility Creation Workflow', async ({ page }) => {
    await page.click('text=Facilities');
    await page.click('text=Add Facility');
    await page.fill('input[name="name"]', 'E2E Test Facility');
    await page.fill('input[name="building"]', 'Test Building');
    await page.fill('input[name="room"]', 'Room 101');
    await page.click('button[type="submit"]');
    
    // Wait for the modal to close and the new facility to appear
    await expect(page.locator('text=E2E Test Facility').first()).toBeVisible();
  });

  test('Test Inventory Item Creation Workflow', async ({ page }) => {
    await page.click('text=Inventory');
    await page.click('text=Add Item');
    await page.fill('input[name="item_name"]', 'E2E Test Oscilloscope');
    await page.fill('input[name="quantity"]', '5');
    await page.selectOption('select[name="status"]', 'available');
    await page.click('button:has-text("Add Item")');

    await expect(page.locator('text=E2E Test Oscilloscope').first()).toBeVisible();
  });
});
