import { query } from '../config/database.js';
async function constraintExists(tableName, constraintName) {
    const result = await query(`SELECT 1
     FROM information_schema.table_constraints
     WHERE table_name = $1 AND constraint_name = $2`, [tableName, constraintName]);
    return result.rows.length > 0;
}
export async function ensureOperationalSchema() {
    await query(`
    INSERT INTO permissions (name, display_name, description, category) VALUES
      ('view_repository', 'View Repository', 'Can view repository documents', 'repository'),
      ('edit_repository_all', 'Edit Repository', 'Can edit all repository documents', 'repository'),
      ('delete_repository_all', 'Delete Repository', 'Can delete all repository documents', 'repository'),
      ('share_repository_documents', 'Share Repository Documents', 'Can share repository documents with users', 'repository')
    ON CONFLICT (name) DO NOTHING;
  `);
    await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON TRUE
    WHERE LOWER(r.name) = 'admin'
    ON CONFLICT DO NOTHING;
  `);
    // Ensure regular 'user' role never has admin-level repository permissions.
    // These permissions (edit_repository_all, delete_repository_all, share_repository_documents)
    // should only belong to the 'admin' role.
    await query(`
    DELETE FROM role_permissions
    WHERE role_id IN (SELECT id FROM roles WHERE LOWER(name) = 'user')
      AND permission_id IN (
        SELECT id FROM permissions
        WHERE name IN ('edit_repository_all', 'delete_repository_all', 'share_repository_documents')
      );
  `);
    // Keep existing databases compatible with the current UI behavior.
    await query(`
    ALTER TABLE work_milestones
    ADD COLUMN IF NOT EXISTS expected_outcome text;
  `);
    await query(`
    ALTER TABLE mitigation_actions
    ADD COLUMN IF NOT EXISTS support_required_from text,
    ADD COLUMN IF NOT EXISTS urgency_level text;
  `);
    // Clean up any escaped -&gt; HTML entities in text columns
    await query(`
    UPDATE assigned_works SET description = REPLACE(description, '-&gt;', '->') WHERE description LIKE '%-&gt;%';
    UPDATE assigned_works SET work_title = REPLACE(work_title, '-&gt;', '->') WHERE work_title LIKE '%-&gt;%';
    UPDATE purchase_requests SET purpose = REPLACE(purpose, '-&gt;', '->') WHERE purpose LIKE '%-&gt;%';
  `);
    if (await constraintExists('inventory_items', 'inventory_items_category_check')) {
        await query(`
      ALTER TABLE inventory_items
      DROP CONSTRAINT inventory_items_category_check;
    `);
    }
    await query(`
    ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_category_check
    CHECK (
      lower(category) IN (
        'equipment',
        'consumable',
        'chemicals',
        'electronics',
        'appliances',
        'computer peripherals',
        'equipments',
        'consumables',
        'others'
      )
    );
  `).catch(async () => {
        // Constraint may already exist with the updated definition.
    });
    if (await constraintExists('assigned_works', 'assigned_works_admin_status_check')) {
        await query(`
      ALTER TABLE assigned_works
      DROP CONSTRAINT assigned_works_admin_status_check;
    `);
    }
    await query(`
    ALTER TABLE assigned_works
    ADD CONSTRAINT assigned_works_admin_status_check
    CHECK (
      lower(admin_status) IN (
        'pending',
        'on_track',
        'needs_attention',
        'completed',
        'approved',
        'rejected',
        'needs_revision'
      )
    );
  `).catch(async () => {
        // Constraint may already exist with the updated definition.
    });
    await query(`
    UPDATE user_profiles up
    SET role_id = r.id
    FROM roles r
    WHERE up.role_id IS NULL
      AND LOWER(r.name) = LOWER(up.user_role);
  `);
}
