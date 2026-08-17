import { Router, Request, Response } from 'express';
import { query } from '../config/database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const isAdmin = req.user?.permissions.has('view_reports') || req.user?.permissions.has('manage_users');
    const userId = req.user!.id;

    // Get active cycle
    const cycleResult = await query(
      "SELECT id FROM work_cycles WHERE status = 'active' LIMIT 1"
    );
    const activeCycleId = cycleResult.rows[0]?.id;

    if (isAdmin) {
      const [users, pendingPurchases, pendingLeaves, lowStock, teamWorks, repoDocs, facilities] =
        await Promise.all([
          query('SELECT COUNT(*) FROM user_profiles'),
          query("SELECT COUNT(*) FROM purchase_requests WHERE status = 'submitted'"),
          query("SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'"),
          query("SELECT COUNT(*) FROM inventory_items WHERE category = 'consumable' AND quantity < 10"),
          activeCycleId
            ? query('SELECT COUNT(*) FROM assigned_works WHERE cycle_id = $1', [activeCycleId])
            : Promise.resolve({ rows: [{ count: '0' }] }),
          query('SELECT COUNT(*) FROM repository_documents'),
          query('SELECT COUNT(*) FROM facilities'),
        ]);

      // Delayed work count
      let delayedCount = 0;
      if (activeCycleId) {
        const worksResult = await query(
          'SELECT id FROM assigned_works WHERE cycle_id = $1',
          [activeCycleId]
        );
        for (const w of worksResult.rows) {
          const pResult = await query(
            `SELECT status FROM progress_updates WHERE work_id = $1
             ORDER BY update_date DESC LIMIT 1`,
            [w.id]
          );
          if (pResult.rows[0]?.status === 'delayed') delayedCount++;
        }
      }

      // Recent docs
      const recentDocs = await query(
        'SELECT * FROM repository_documents ORDER BY created_at DESC LIMIT 5'
      );

      res.json({
        totalUsers: parseInt(users.rows[0].count),
        pendingPurchases: parseInt(pendingPurchases.rows[0].count),
        pendingLeaves: parseInt(pendingLeaves.rows[0].count),
        lowStockItems: parseInt(lowStock.rows[0].count),
        teamWorkCount: parseInt(teamWorks.rows[0].count),
        delayedWorkCount: delayedCount,
        repositoryDocuments: parseInt(repoDocs.rows[0].count),
        facilitiesCount: parseInt(facilities.rows[0].count),
        recentDocuments: recentDocs.rows,
      });
    } else {
      const [myPurchases, myLeaves, inventory, myWorks, repoDocs, recentDocs] = await Promise.all([
        query(
          "SELECT COUNT(*) FROM purchase_requests WHERE requested_by = $1 AND status IN ('submitted','in_progress')",
          [userId]
        ),
        query(
          "SELECT COUNT(*) FROM leave_requests WHERE requested_by = $1 AND status = 'pending'",
          [userId]
        ),
        query('SELECT COUNT(*) FROM inventory_items'),
        activeCycleId
          ? query(
              'SELECT COUNT(*) FROM assigned_works WHERE user_id = $1 AND cycle_id = $2',
              [userId, activeCycleId]
            )
          : Promise.resolve({ rows: [{ count: '0' }] }),
        query(
          `SELECT COUNT(*) FROM repository_documents
           WHERE (visibility = 'all_members'
                  OR uploaded_by = $1
                  OR $1 = ANY(shared_with_users))
             AND is_admin_only_category = false`,
          [userId]
        ),
        query(
          `SELECT * FROM repository_documents
           WHERE (visibility = 'all_members'
                  OR uploaded_by = $1
                  OR $1 = ANY(shared_with_users))
             AND is_admin_only_category = false
           ORDER BY created_at DESC LIMIT 5`,
          [userId]
        ),
      ]);

      // Avg completion
      let avgCompletion = 0;
      if (activeCycleId) {
        const myWorkIds = await query(
          'SELECT id FROM assigned_works WHERE user_id = $1 AND cycle_id = $2',
          [userId, activeCycleId]
        );
        if (myWorkIds.rows.length > 0) {
          let total = 0;
          for (const w of myWorkIds.rows) {
            const p = await query(
              'SELECT completion_percentage FROM progress_updates WHERE work_id = $1 ORDER BY update_date DESC LIMIT 1',
              [w.id]
            );
            total += p.rows[0]?.completion_percentage || 0;
          }
          avgCompletion = Math.round(total / myWorkIds.rows.length);
        }
      }

      res.json({
        myPurchaseRequests: parseInt(myPurchases.rows[0].count),
        myLeaveRequests: parseInt(myLeaves.rows[0].count),
        inventoryCount: parseInt(inventory.rows[0].count),
        myWorkCount: parseInt(myWorks.rows[0].count),
        myWorkCompletion: avgCompletion,
        repositoryDocuments: parseInt(repoDocs.rows[0].count),
        recentDocuments: recentDocs.rows,
      });
    }
  } catch (err: any) {
    console.error('Dashboard error:', err);
    console.error(err); res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
