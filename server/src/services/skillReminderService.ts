import { query } from '../config/database.js';
import { createNotification } from './notificationService.js';
import { sendSkillReminderEmail } from '../utils/email.js';

// Admins and the super admin run the portal; they get no skill emails, notifications or pop-ups.
const SKILL_REMINDER_EXEMPT_ROLES = ['admin', 'super_admin', 'superadmin'];

export interface UserSkillStatus {
  hasSkills: boolean;
  skillCount: number;
  showPopup: boolean;
  lastReminderAt: string | null;
  lastDismissedAt: string | null;
}

/**
 * Checks if a specific user has any skills recorded and whether they
 * should see the skill reminder popup upon login.
 */
export async function checkUserNeedsSkillReminder(userId: string): Promise<UserSkillStatus> {
  try {
    const roleRes = await query('SELECT user_role FROM user_profiles WHERE id = $1', [userId]);
    if (SKILL_REMINDER_EXEMPT_ROLES.includes(String(roleRes.rows[0]?.user_role || '').toLowerCase())) {
      return { hasSkills: false, skillCount: 0, showPopup: false, lastReminderAt: null, lastDismissedAt: null };
    }

    const skillCountRes = await query(
      'SELECT COUNT(*)::int AS count FROM user_skills WHERE user_id = $1',
      [userId]
    );
    const skillCount = skillCountRes.rows[0]?.count || 0;
    const hasSkills = skillCount > 0;

    if (hasSkills) {
      return {
        hasSkills: true,
        skillCount,
        showPopup: false,
        lastReminderAt: null,
        lastDismissedAt: null,
      };
    }

    const profileRes = await query(
      `SELECT created_at, last_skill_reminder_at, last_skill_popup_dismissed_at 
       FROM user_profiles 
       WHERE id = $1`,
      [userId]
    );

    const profile = profileRes.rows[0];
    if (!profile) {
      return {
        hasSkills: false,
        skillCount: 0,
        showPopup: false,
        lastReminderAt: null,
        lastDismissedAt: null,
      };
    }

    const lastDismissed = profile.last_skill_popup_dismissed_at
      ? new Date(profile.last_skill_popup_dismissed_at)
      : null;

    // Show popup if never dismissed, or if at least 14 days have passed since dismissal
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const showPopup = !lastDismissed || (Date.now() - lastDismissed.getTime() >= FOURTEEN_DAYS_MS);

    return {
      hasSkills: false,
      skillCount: 0,
      showPopup,
      lastReminderAt: profile.last_skill_reminder_at,
      lastDismissedAt: profile.last_skill_popup_dismissed_at,
    };
  } catch (err: any) {
    console.error('[SKILL REMINDER] Error checking user skill status:', err.message);
    return {
      hasSkills: true,
      skillCount: 0,
      showPopup: false,
      lastReminderAt: null,
      lastDismissedAt: null,
    };
  }
}

/**
 * Records that the user clicked "Skip for now" / "Remind me later" on the skill reminder modal.
 * This suppresses the popup for the next 14 days.
 */
export async function dismissSkillPopup(userId: string): Promise<void> {
  await query(
    'UPDATE user_profiles SET last_skill_popup_dismissed_at = NOW() WHERE id = $1',
    [userId]
  );
  console.log(`[SKILL REMINDER] User ${userId} dismissed skill popup; snooze active for 14 days.`);
}

/**
 * Executes the 14-day / 15-day check across all active users.
 * For any active user who has 0 skills in user_skills and whose last reminder
 * was >= 14 days ago (or never sent):
 * 1. Creates an in-app notification
 * 2. Shoots an official email from erp.sclab (support@sclab.in)
 * 3. Updates last_skill_reminder_at = NOW()
 */
export async function checkAndTriggerSkillReminders(options: { force?: boolean } = {}): Promise<{
  checkedCount: number;
  remindedCount: number;
  usersReminded: Array<{ id: string; email: string; name: string }>;
}> {
  console.log('[SKILL REMINDER] Running 14-day skill check for all active users...');

  try {
    // Find active users with 0 skills
    const usersWithoutSkillsRes = await query(`
      SELECT 
        u.id, 
        u.email, 
        up.full_name, 
        up.created_at, 
        up.last_skill_reminder_at
      FROM users u
      JOIN user_profiles up ON u.id = up.id
      WHERE up.is_active = true
        AND LOWER(COALESCE(up.user_role, '')) <> ALL($1::text[])
        AND NOT EXISTS (
          SELECT 1 FROM user_skills us WHERE us.user_id = u.id
        )
    `, [SKILL_REMINDER_EXEMPT_ROLES]);

    const usersWithoutSkills = usersWithoutSkillsRes.rows;
    console.log(`[SKILL REMINDER] Found ${usersWithoutSkills.length} active users with 0 skills.`);

    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const currentDayOfMonth = new Date().getDate();

    const usersToRemind: any[] = [];

    for (const u of usersWithoutSkills) {
      if (options.force) {
        usersToRemind.push(u);
        continue;
      }

      const lastReminder = u.last_skill_reminder_at ? new Date(u.last_skill_reminder_at).getTime() : null;
      const createdAt = u.created_at ? new Date(u.created_at).getTime() : 0;

      // Condition:
      // 1. If never reminded before: user is at least 14 days old, OR today is on/after the 14th of the month
      // 2. If previously reminded: at least 14 days have passed since the previous reminder
      const eligibleForFirstReminder = !lastReminder && ((now - createdAt >= FOURTEEN_DAYS_MS) || currentDayOfMonth >= 14);
      const eligibleForRecurringReminder = lastReminder && (now - lastReminder >= FOURTEEN_DAYS_MS);

      if (eligibleForFirstReminder || eligibleForRecurringReminder) {
        usersToRemind.push(u);
      }
    }

    console.log(`[SKILL REMINDER] ${usersToRemind.length} users qualify for reminder email & in-app notification.`);

    const results: Array<{ id: string; email: string; name: string }> = [];

    for (const user of usersToRemind) {
      const recipientName = user.full_name || 'Member';
      const userEmail = user.email;

      // 1. In-app Notification
      await createNotification({
        userId: user.id,
        type: 'reminder',
        title: 'Add Your Skills & Expertise',
        message: 'You have not added any skills to your SC Lab profile yet. Adding your skills and tools helps lab coordinators allocate projects accurately.',
        actionUrl: '/profile?focus=skills',
      });

      // 2. Shoot Email from erp.sclab
      if (userEmail) {
        await sendSkillReminderEmail(userEmail, recipientName);
      }

      // 3. Update last_skill_reminder_at
      await query(
        'UPDATE user_profiles SET last_skill_reminder_at = NOW(), updated_at = NOW() WHERE id = $1',
        [user.id]
      );

      results.push({
        id: user.id,
        email: userEmail,
        name: recipientName,
      });
    }

    console.log(`[SKILL REMINDER] Finished processing. Total reminded: ${results.length}`);
    return {
      checkedCount: usersWithoutSkills.length,
      remindedCount: results.length,
      usersReminded: results,
    };
  } catch (err: any) {
    console.error('[SKILL REMINDER ERROR] Failed to run skill reminders:', err.message);
    return {
      checkedCount: 0,
      remindedCount: 0,
      usersReminded: [],
    };
  }
}

/**
 * Initializes a background timer on server boot to run the 14-day skill check daily.
 */
export function startSkillReminderCron(): void {
  console.log('[SKILL REMINDER CRON] Initializing daily check service...');

  // Run initial check 15 seconds after server start
  setTimeout(async () => {
    try {
      await checkAndTriggerSkillReminders();
    } catch (e: any) {
      console.error('[SKILL REMINDER CRON ERROR]', e.message);
    }
  }, 15000);

  // Then check every 24 hours
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    try {
      await checkAndTriggerSkillReminders();
    } catch (e: any) {
      console.error('[SKILL REMINDER CRON ERROR]', e.message);
    }
  }, TWENTY_FOUR_HOURS_MS);
}
