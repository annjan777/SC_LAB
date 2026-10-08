import { query } from '../config/database.js';
import { createNotification } from './notificationService.js';
import { logAuditEvent } from './auditLogger.js';

/**
 * Sends notifications to relevant parties when a comment is added to a work item:
 * - When an Admin or Supervisor comments: notifies the assignee (and supervisor if someone else commented)
 * - When an Assignee comments (replies): notifies the supervisor and lab admins
 * - Prevents self-notifications
 * - Logs the comment event in audit_logs
 */
export async function notifyWorkComment(
  workId: string,
  commenterId: string,
  commentText: string
): Promise<void> {
  try {
    const cleanComment = (commentText || '').trim();
    if (!cleanComment) return;

    // 1. Fetch work details
    const workRes = await query(
      'SELECT id, work_title, issue_key, user_id, assigned_by FROM assigned_works WHERE id = $1',
      [workId]
    );
    if (workRes.rows.length === 0) return;
    const work = workRes.rows[0];

    // 2. Fetch commenter details
    const commenterRes = await query(
      'SELECT id, full_name, email, user_role FROM user_profiles WHERE id = $1',
      [commenterId]
    );
    const commenter = commenterRes.rows[0];
    const commenterName = commenter?.full_name || commenter?.email || 'Someone';

    // 3. Determine commenter role label
    let roleLabel = 'Team Member';
    const isSuper = commenter?.user_role === 'super_admin' || commenter?.user_role === 'superadmin';
    const isAdmin = commenter?.user_role === 'admin';
    const isAssignee = commenterId === work.user_id;
    const isSupervisor = Boolean(
      work.assigned_by &&
      commenter?.full_name &&
      work.assigned_by.trim().toLowerCase() === commenter.full_name.trim().toLowerCase()
    );

    if (isSuper) {
      roleLabel = 'Super Admin';
    } else if (isAdmin) {
      roleLabel = 'Admin';
    } else if (isSupervisor) {
      roleLabel = 'Supervisor';
    } else if (isAssignee) {
      roleLabel = 'Assignee';
    }

    const snippet = cleanComment.length > 80 ? cleanComment.slice(0, 77) + '...' : cleanComment;
    const issueKey = work.issue_key || 'WORK';

    // 4. Find supervisor user_id if assigned_by is set
    let supervisorId: string | null = null;
    if (work.assigned_by) {
      const supRes = await query(
        'SELECT id FROM user_profiles WHERE LOWER(TRIM(full_name)) = LOWER(TRIM($1))',
        [work.assigned_by]
      );
      if (supRes.rows.length > 0) {
        supervisorId = supRes.rows[0].id;
      }
    }

    // 5. Build recipients map (userId -> notification parameters)
    const notificationsToSend = new Map<string, { title: string; message: string; actionUrl: string }>();

    if (isAssignee) {
      // Assignee commented / replied
      const title = `New Comment: [${issueKey}] ${work.work_title}`;
      const message = `${commenterName} commented: "${snippet}"`;

      if (supervisorId && supervisorId !== commenterId) {
        notificationsToSend.set(supervisorId, {
          title,
          message,
          actionUrl: `/admin/work-overview?workId=${work.id}`,
        });
      }

      // Notify lab admins
      const adminsRes = await query(
        "SELECT id FROM user_profiles WHERE user_role IN ('admin', 'super_admin', 'superadmin')"
      );
      for (const adm of adminsRes.rows) {
        if (adm.id !== commenterId && !notificationsToSend.has(adm.id)) {
          notificationsToSend.set(adm.id, {
            title,
            message: `${commenterName} commented on [${issueKey}] ${work.work_title}: "${snippet}"`,
            actionUrl: `/admin/work-overview?workId=${work.id}`,
          });
        }
      }
    } else {
      // Admin, Supervisor, or other team member commented
      // 1. Notify assignee
      if (work.user_id && work.user_id !== commenterId) {
        notificationsToSend.set(work.user_id, {
          title: `New Comment: [${issueKey}] ${work.work_title}`,
          message: `${commenterName} (${roleLabel}) commented: "${snippet}"`,
          actionUrl: `/work-overview?workId=${work.id}`,
        });
      }

      // 2. If an admin commented, also notify supervisor if different
      if (supervisorId && supervisorId !== commenterId && supervisorId !== work.user_id) {
        notificationsToSend.set(supervisorId, {
          title: `New Comment: [${issueKey}] ${work.work_title}`,
          message: `${commenterName} (${roleLabel}) commented on [${issueKey}] ${work.work_title}: "${snippet}"`,
          actionUrl: `/admin/work-overview?workId=${work.id}`,
        });
      }
    }

    // 6. Deliver notifications
    for (const [userId, n] of notificationsToSend.entries()) {
      await createNotification({
        userId,
        type: 'work_comment',
        title: n.title,
        message: n.message,
        relatedEntityType: 'assigned_work',
        relatedEntityId: work.id,
        actionUrl: n.actionUrl,
      });
    }

    // 7. Audit log activity
    await logAuditEvent({
      userId: commenterId,
      action: 'work_comment_added',
      entityType: 'assigned_work',
      entityId: work.id,
      remarks: `${commenterName} (${roleLabel}) commented: "${snippet}"`,
    });
  } catch (err: any) {
    console.error('[WORK NOTIFICATION ERROR] Failed to send work comment notification:', err.message);
  }
}
