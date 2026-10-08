import { query } from '../config/database.js';
import { createNotification } from './notificationService.js';
import { sendEquipmentReturnReminderEmail } from '../utils/email.js';

export interface ReturnReminderResult {
  dueTodayCount: number;
  overdueCount: number;
  borrowerEmailsSent: number;
  assignerEmailsSent: number;
  errors: string[];
}

/**
 * Checks for returnable equipment due today or overdue,
 * sends in-portal notifications and emails, and tracks sent dates to prevent spam.
 * Only targets active unreturned equipment (status in 'issued', 'overdue' and actual_return_date is null).
 */
export async function checkAndTriggerEquipmentReturnReminders(options: { skipEmailSend?: boolean } = {}): Promise<ReturnReminderResult> {
  const result: ReturnReminderResult = {
    dueTodayCount: 0,
    overdueCount: 0,
    borrowerEmailsSent: 0,
    assignerEmailsSent: 0,
    errors: [],
  };

  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Find all returnable requests that are currently issued or overdue,
    // and have NOT been returned (actual_return_date IS NULL and status NOT IN ('returned', 'cancelled'))
    const reqRes = await query(
      `SELECT ir.id, ir.inventory_item_id, ir.requested_by, ir.issued_by, ir.quantity, ir.is_returnable,
              ir.expected_return_date::text AS expected_return_date, ir.status,
              ir.last_borrower_reminder_sent_date::text AS last_borrower_reminder_sent_date,
              ir.last_assigner_reminder_sent_date::text AS last_assigner_reminder_sent_date,
              ir.actual_return_date,
              ii.item_name, ii.asset_tag, ii.serial_number,
              u.email, u.full_name,
              assigner.email AS assigner_email, assigner.full_name AS assigner_name
       FROM inventory_requests ir
       JOIN inventory_items ii ON ii.id = ir.inventory_item_id
       JOIN user_profiles u ON u.id = ir.requested_by
       LEFT JOIN user_profiles assigner ON assigner.id = ir.issued_by
       WHERE ir.status IN ('issued', 'overdue')
         AND ir.is_returnable = true
         AND ir.expected_return_date IS NOT NULL
         AND ir.actual_return_date IS NULL`
    );

    for (const row of reqRes.rows) {
      const expDate = row.expected_return_date?.split('T')[0] || row.expected_return_date;
      if (!expDate) continue;

      const isOverdue = expDate < todayStr;
      const isDueToday = expDate === todayStr;

      if (!isOverdue && !isDueToday) {
        continue;
      }

      const notifType = isOverdue ? 'inventory_return_overdue' : 'inventory_return_due';

      // If overdue and still marked as 'issued', transition status to 'overdue'
      if (isOverdue && row.status === 'issued') {
        await query(
          `UPDATE inventory_requests 
           SET status = 'overdue', updated_at = NOW() 
           WHERE id = $1`,
          [row.id]
        );
      }

      const title = isOverdue ? 'Equipment Return Overdue' : 'Equipment Return Due Today';
      const messageBorrower = isOverdue
        ? `The equipment "${row.item_name}" is overdue for return since ${expDate}. Please return it immediately.`
        : `The equipment "${row.item_name}" is due for return today (${expDate}). Please return it to the lab.`;

      // -----------------------------------------------------------------------
      // 1. Borrower Notification & Email (Tracked daily by date)
      // -----------------------------------------------------------------------
      const alreadySentBorrowerToday = row.last_borrower_reminder_sent_date === todayStr;

      if (!alreadySentBorrowerToday) {
        // In-portal notification deduplication
        const existingBorrowerNotif = await query(
          `SELECT id FROM notifications 
           WHERE user_id = $1 
             AND type = $2 
             AND related_entity_id = $3 
             AND created_at >= CURRENT_DATE`,
          [row.requested_by, notifType, row.id]
        );

        if (existingBorrowerNotif.rows.length === 0) {
          await createNotification({
            userId: row.requested_by,
            type: notifType,
            title,
            message: messageBorrower,
            relatedEntityType: 'inventory_request',
            relatedEntityId: row.id,
            actionUrl: '/inventory',
          });
        }

        // Send email only if not skipped and not already sent today
        if (row.email && !options.skipEmailSend) {
          try {
            await sendEquipmentReturnReminderEmail({
              to: row.email,
              recipientName: row.full_name || 'Lab Member',
              itemName: row.item_name,
              assetTag: row.asset_tag || row.serial_number || undefined,
              dueDate: expDate,
              isOverdue,
            });
            result.borrowerEmailsSent++;
          } catch (emailErr: any) {
            result.errors.push(`Email error for ${row.email}: ${emailErr.message}`);
          }
        }

        // Record in database that borrower reminder was sent for today
        await query(
          `UPDATE inventory_requests
           SET last_borrower_reminder_sent_date = CURRENT_DATE, updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
      } else {
        console.log(`[EQUIPMENT RETURN REMINDER] Skipping borrower email for request ${row.id} ("${row.item_name}"): already sent today (${todayStr})`);
      }

      // -----------------------------------------------------------------------
      // 2. Assigner Notification & Email (Tracked daily by date)
      // -----------------------------------------------------------------------
      if (row.issued_by && row.issued_by !== row.requested_by) {
        const alreadySentAssignerToday = row.last_assigner_reminder_sent_date === todayStr;

        if (!alreadySentAssignerToday) {
          const existingAssignerNotif = await query(
            `SELECT id FROM notifications 
             WHERE user_id = $1 
               AND type = $2 
               AND related_entity_id = $3 
               AND created_at >= CURRENT_DATE`,
            [row.issued_by, notifType, row.id]
          );

          if (existingAssignerNotif.rows.length === 0) {
            const messageAssigner = isOverdue
              ? `The equipment "${row.item_name}" assigned to ${row.full_name || 'user'} is overdue for return (was due ${expDate}).`
              : `The equipment "${row.item_name}" assigned to ${row.full_name || 'user'} is due for return today (${expDate}).`;

            await createNotification({
              userId: row.issued_by,
              type: notifType,
              title: isOverdue ? 'Equipment Return Overdue (Assigner Notice)' : 'Equipment Return Due Today (Assigner Notice)',
              message: messageAssigner,
              relatedEntityType: 'inventory_request',
              relatedEntityId: row.id,
              actionUrl: '/inventory',
            });
          }

          if (row.assigner_email && !options.skipEmailSend) {
            try {
              await sendEquipmentReturnReminderEmail({
                to: row.assigner_email,
                recipientName: row.assigner_name || 'Lab Manager',
                itemName: `${row.item_name} (borrowed by ${row.full_name || 'user'})`,
                assetTag: row.asset_tag || row.serial_number || undefined,
                dueDate: expDate,
                isOverdue,
              });
              result.assignerEmailsSent++;
            } catch (emailErr: any) {
              result.errors.push(`Assigner email error for ${row.assigner_email}: ${emailErr.message}`);
            }
          }

          // Record in database that assigner reminder was sent for today
          await query(
            `UPDATE inventory_requests
             SET last_assigner_reminder_sent_date = CURRENT_DATE, updated_at = NOW()
             WHERE id = $1`,
            [row.id]
          );
        } else {
          console.log(`[EQUIPMENT RETURN REMINDER] Skipping assigner email for request ${row.id} ("${row.item_name}"): already sent today (${todayStr})`);
        }
      }

      if (isOverdue) {
        result.overdueCount++;
      } else {
        result.dueTodayCount++;
      }
    }
  } catch (err: any) {
    console.error('[EQUIPMENT RETURN REMINDER ERROR]:', err);
    result.errors.push(err.message);
  }

  return result;
}

/**
 * Calculates milliseconds from now until the next 10:00 AM (local time).
 * If before 10:00 AM today -> schedules for today at 10:00 AM.
 * If at or past 10:00 AM today -> schedules for tomorrow at 10:00 AM.
 */
export function getMsUntilNext10AM(): number {
  const now = new Date();
  const next10AM = new Date(now);
  next10AM.setHours(10, 0, 0, 0);

  if (now.getTime() >= next10AM.getTime()) {
    next10AM.setDate(next10AM.getDate() + 1);
  }

  return next10AM.getTime() - now.getTime();
}

let dailyCronTimeout: NodeJS.Timeout | null = null;

/**
 * Starts the daily 10:00 AM cron scheduler for equipment return reminders.
 * Emails are ONLY sent once per day at 10:00 AM for unreturned equipment.
 * Does NOT send emails on arbitrary server boots or restarts.
 */
export function startEquipmentReturnReminderCron(): void {
  if (dailyCronTimeout) {
    clearTimeout(dailyCronTimeout);
    dailyCronTimeout = null;
  }

  function scheduleNextDailyRun() {
    const msUntil10AM = getMsUntilNext10AM();
    const hours = Math.floor(msUntil10AM / (1000 * 60 * 60));
    const minutes = Math.floor((msUntil10AM % (1000 * 60 * 60)) / (1000 * 60));

    console.log(
      `[EQUIPMENT RETURN CRON] Reminder service active. Next daily 10:00 AM run scheduled in ${hours}h ${minutes}m.`
    );

    dailyCronTimeout = setTimeout(async () => {
      try {
        console.log('[EQUIPMENT RETURN CRON] ⏰ Running daily 10:00 AM return reminder check...');
        const res = await checkAndTriggerEquipmentReturnReminders();
        console.log(
          `[EQUIPMENT RETURN CRON] 10:00 AM run complete: ${res.dueTodayCount} due today, ${res.overdueCount} overdue (${res.borrowerEmailsSent} borrower emails, ${res.assignerEmailsSent} assigner emails sent)`
        );
      } catch (e: any) {
        console.error('[EQUIPMENT RETURN CRON ERROR]:', e.message);
      } finally {
        scheduleNextDailyRun();
      }
    }, msUntil10AM);
  }

  scheduleNextDailyRun();
}
