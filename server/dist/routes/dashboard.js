import { Router } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';
import { syncOverdueMilestones } from './work.js';
const router = Router();
// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req, res) => {
    try {
        await syncOverdueMilestones();
        const isAdmin = req.user?.permissions.has('view_reports') || req.user?.permissions.has('manage_users');
        const userId = req.user.id;
        // Get active cycle if configured
        const cycleResult = await query("SELECT id, quarter, year FROM work_cycles WHERE status = 'active' LIMIT 1");
        const activeCycle = cycleResult.rows[0];
        const cycleName = activeCycle
            ? `${activeCycle.quarter || ''} ${activeCycle.year || ''}`.trim() || null
            : null;
        // Delayed work count query: counts any active work with delayed latest progress or unapproved delayed milestone
        const delayedWorksSql = `
      SELECT COUNT(DISTINCT aw.id)::int as count FROM assigned_works aw
      WHERE aw.admin_status NOT IN ('completed', 'cancelled')
        AND (
          COALESCE(
            (SELECT status FROM progress_updates WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1),
            'not_started'
          ) = 'delayed'
          OR EXISTS (
            SELECT 1 FROM work_milestones wm
            WHERE wm.work_id = aw.id
              AND wm.status = 'delayed'
              AND (wm.justification_status IS NULL OR wm.justification_status != 'approved')
          )
        )
    `;
        // User's own works progress for average completion
        const userWorksProgressResult = await query(`SELECT aw.id,
              COALESCE(
                (SELECT completion_percentage FROM progress_updates WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1),
                0
              ) as completion_percentage
       FROM assigned_works aw
       WHERE aw.user_id = $1 AND aw.admin_status NOT IN ('completed', 'cancelled')`, [userId]);
        let myAvgCompletion = 0;
        if (userWorksProgressResult.rows.length > 0) {
            const totalPct = userWorksProgressResult.rows.reduce((sum, r) => sum + Number(r.completion_percentage || 0), 0);
            myAvgCompletion = Math.round(totalPct / userWorksProgressResult.rows.length);
        }
        if (isAdmin) {
            const [users, pendingPurchases, pendingLeaves, lowStock, teamWorks, repoDocs, facilities, inventory, delayedWorks] = await Promise.all([
                query('SELECT COUNT(*) FROM user_profiles'),
                query("SELECT COUNT(*) FROM purchase_requests WHERE status IN ('submitted', 'pending')"),
                query("SELECT COUNT(*) FROM leave_requests WHERE status IN ('pending', 'submitted')"),
                query('SELECT COUNT(*) FROM inventory_items WHERE quantity < 10'),
                query("SELECT COUNT(*) FROM assigned_works WHERE admin_status NOT IN ('completed', 'cancelled')"),
                query('SELECT COUNT(*) FROM repository_documents'),
                query('SELECT COUNT(*) FROM facilities'),
                query('SELECT COUNT(*) FROM inventory_items'),
                query(delayedWorksSql),
            ]);
            // Recent docs
            const recentDocs = await query('SELECT * FROM repository_documents ORDER BY created_at DESC LIMIT 5');
            res.json({
                totalUsers: parseInt(users.rows[0].count),
                pendingPurchases: parseInt(pendingPurchases.rows[0].count),
                pendingLeaves: parseInt(pendingLeaves.rows[0].count),
                lowStockItems: parseInt(lowStock.rows[0].count),
                teamWorkCount: parseInt(teamWorks.rows[0].count),
                delayedWorkCount: parseInt(delayedWorks.rows[0]?.count || 0),
                repositoryDocuments: parseInt(repoDocs.rows[0].count),
                facilitiesCount: parseInt(facilities.rows[0].count),
                inventoryCount: parseInt(inventory.rows[0].count),
                recentDocuments: recentDocs.rows,
                cycleName,
                myWorkCount: userWorksProgressResult.rows.length,
                myWorkCompletion: myAvgCompletion,
            });
        }
        else {
            const [myPurchases, myLeaves, inventory, myWorks, repoDocs, recentDocs, myDelayedWorks] = await Promise.all([
                query("SELECT COUNT(*) FROM purchase_requests WHERE requested_by = $1 AND status IN ('submitted','pending','in_progress')", [userId]),
                query("SELECT COUNT(*) FROM leave_requests WHERE requested_by = $1 AND status IN ('pending', 'submitted')", [userId]),
                query('SELECT COUNT(*) FROM inventory_items'),
                query("SELECT COUNT(*) FROM assigned_works WHERE user_id = $1 AND admin_status NOT IN ('completed', 'cancelled')", [userId]),
                query(`SELECT COUNT(*) FROM repository_documents
           WHERE (visibility = 'all_members'
                  OR uploaded_by = $1
                  OR $1 = ANY(shared_with_users))
             AND is_admin_only_category = false`, [userId]),
                query(`SELECT * FROM repository_documents
           WHERE (visibility = 'all_members'
                  OR uploaded_by = $1
                  OR $1 = ANY(shared_with_users))
             AND is_admin_only_category = false
           ORDER BY created_at DESC LIMIT 5`, [userId]),
                query(`SELECT COUNT(DISTINCT aw.id)::int as count FROM assigned_works aw
           WHERE aw.user_id = $1
             AND aw.admin_status NOT IN ('completed', 'cancelled')
             AND (
               COALESCE(
                 (SELECT status FROM progress_updates WHERE work_id = aw.id ORDER BY update_date DESC, created_at DESC LIMIT 1),
                 'not_started'
               ) = 'delayed'
               OR EXISTS (
                 SELECT 1 FROM work_milestones wm
                 WHERE wm.work_id = aw.id
                   AND wm.status = 'delayed'
                   AND (wm.justification_status IS NULL OR wm.justification_status != 'approved')
               )
             )`, [userId]),
            ]);
            res.json({
                myPurchaseRequests: parseInt(myPurchases.rows[0].count),
                myLeaveRequests: parseInt(myLeaves.rows[0].count),
                inventoryCount: parseInt(inventory.rows[0].count),
                myWorkCount: parseInt(myWorks.rows[0].count),
                myWorkCompletion: myAvgCompletion,
                delayedWorkCount: parseInt(myDelayedWorks.rows[0]?.count || 0),
                repositoryDocuments: parseInt(repoDocs.rows[0].count),
                recentDocuments: recentDocs.rows,
                cycleName,
            });
        }
    }
    catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
export default router;
