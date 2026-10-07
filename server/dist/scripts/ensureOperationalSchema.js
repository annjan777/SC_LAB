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
    // Ensure regular 'user' role never has admin/manager-level work or repository permissions.
    // Regular users only edit/view their own work or work they assigned as supervisor.
    await query(`
    DELETE FROM role_permissions
    WHERE role_id IN (SELECT id FROM roles WHERE LOWER(name) = 'user')
      AND permission_id IN (
        SELECT id FROM permissions
        WHERE name IN ('edit_work', 'delete_work', 'edit_repository_all', 'delete_repository_all', 'share_repository_documents')
      );
  `);
    // Keep existing databases compatible with the current UI behavior.
    await query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_password_token text,
    ADD COLUMN IF NOT EXISTS reset_password_expires timestamp with time zone;

    ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS is_profile_completed boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS designation text,
    ADD COLUMN IF NOT EXISTS project_name text,
    ADD COLUMN IF NOT EXISTS project_code text,
    ADD COLUMN IF NOT EXISTS project_start_date date,
    ADD COLUMN IF NOT EXISTS project_end_date date,
    ADD COLUMN IF NOT EXISTS project_tenure text,
    ADD COLUMN IF NOT EXISTS staff_contract_start_date date,
    ADD COLUMN IF NOT EXISTS staff_contract_end_date date,
    ADD COLUMN IF NOT EXISTS contract_tenure text,
    ADD COLUMN IF NOT EXISTS project_role_responsibility text,
    ADD COLUMN IF NOT EXISTS project_pi_coordinator text,
    ADD COLUMN IF NOT EXISTS reporting_manager text,
    ADD COLUMN IF NOT EXISTS current_status text,
    ADD COLUMN IF NOT EXISTS contract_status text,
    ADD COLUMN IF NOT EXISTS remarks_staff text,
    ADD COLUMN IF NOT EXISTS remarks_manager text,
    ADD COLUMN IF NOT EXISTS last_skill_reminder_at timestamp with time zone,
    ADD COLUMN IF NOT EXISTS last_skill_popup_dismissed_at timestamp with time zone;

    ALTER TABLE user_profiles ALTER COLUMN current_status DROP DEFAULT;
    ALTER TABLE user_profiles ALTER COLUMN contract_status DROP DEFAULT;
  `);
    // Ensure any existing users prior to this change are not locked out
    await query(`
    UPDATE user_profiles
    SET is_profile_completed = true
    WHERE is_profile_completed IS NULL OR (is_profile_completed = false AND require_password_change = false);
  `);
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

    ALTER TABLE assigned_works
    ADD COLUMN IF NOT EXISTS assigned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

    UPDATE assigned_works
    SET assigned_by_user_id = '00000000-0000-0000-0000-000000000001'
    WHERE assigned_by_user_id IS NULL AND (assigned_by = 'Annjan' OR assigned_by = 'Supervisor');
  `);
    if (await constraintExists('inventory_items', 'inventory_items_category_check')) {
        await query(`
      ALTER TABLE inventory_items
      DROP CONSTRAINT inventory_items_category_check;
    `);
    }
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
    // --- Work Module Enhancements: Issue Keys, Issue Types, Code-Red, Dependencies, and Milestone Approvals ---
    await query(`
    CREATE SEQUENCE IF NOT EXISTS work_issue_key_seq START 1;

    ALTER TABLE assigned_works
    ADD COLUMN IF NOT EXISTS issue_key text,
    ADD COLUMN IF NOT EXISTS issue_type text DEFAULT 'task',
    ADD COLUMN IF NOT EXISTS code_red_activated_at timestamptz;

    UPDATE assigned_works
    SET issue_key = 'SCLAB-' || nextval('work_issue_key_seq')
    WHERE issue_key IS NULL;

    ALTER TABLE assigned_works
    ALTER COLUMN issue_key SET DEFAULT ('SCLAB-' || nextval('work_issue_key_seq'));

    CREATE UNIQUE INDEX IF NOT EXISTS idx_assigned_works_issue_key ON assigned_works(issue_key);
  `);
    if (await constraintExists('assigned_works', 'assigned_works_priority_check')) {
        await query(`
      ALTER TABLE assigned_works
      DROP CONSTRAINT assigned_works_priority_check;
    `);
    }
    await query(`
    ALTER TABLE assigned_works
    ADD CONSTRAINT assigned_works_priority_check
    CHECK (lower(priority) IN ('low', 'medium', 'high', 'code_red'));
  `).catch(async () => {
        // Constraint may already exist
    });
    await query(`
    ALTER TABLE work_milestones
    ADD COLUMN IF NOT EXISTS justification text,
    ADD COLUMN IF NOT EXISTS justification_linked_work_id uuid REFERENCES assigned_works(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS justification_status text DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS justification_submitted_at timestamptz DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS justification_reviewed_by uuid REFERENCES user_profiles(id) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS justification_reviewed_at timestamptz DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS justification_review_notes text DEFAULT NULL;

    ALTER TABLE work_dependencies
    ADD COLUMN IF NOT EXISTS dependency_type text DEFAULT 'blocks',
    ADD COLUMN IF NOT EXISTS notes text;

    CREATE TABLE IF NOT EXISTS milestone_change_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
      requested_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      reason text NOT NULL,
      status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      proposed_milestones jsonb NOT NULL,
      previous_milestones jsonb DEFAULT '[]'::jsonb,
      admin_notes text,
      reviewed_by uuid REFERENCES user_profiles(id),
      reviewed_at timestamptz,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE milestone_change_requests
    ADD COLUMN IF NOT EXISTS previous_milestones jsonb DEFAULT '[]'::jsonb;

    CREATE INDEX IF NOT EXISTS idx_milestone_change_requests_work_id ON milestone_change_requests(work_id);
    CREATE INDEX IF NOT EXISTS idx_milestone_change_requests_status ON milestone_change_requests(status);

    ALTER TABLE facilities
    ADD COLUMN IF NOT EXISTS assigned_to_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS make_model text,
    ADD COLUMN IF NOT EXISTS serial_number text,
    ADD COLUMN IF NOT EXISTS asset_tag text,
    ADD COLUMN IF NOT EXISTS warranty_end_date date,
    ADD COLUMN IF NOT EXISTS user_manual_url text,
    ADD COLUMN IF NOT EXISTS vendor_name text,
    ADD COLUMN IF NOT EXISTS vendor_contact text,
    ADD COLUMN IF NOT EXISTS capacity integer DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS features text[] DEFAULT '{}';

    UPDATE facilities
    SET assigned_to_user_id = responsible_person_id
    WHERE assigned_to_user_id IS NULL AND responsible_person_id IS NOT NULL;

    UPDATE facilities
    SET responsible_person_id = assigned_to_user_id
    WHERE responsible_person_id IS NULL AND assigned_to_user_id IS NOT NULL;

    UPDATE facilities
    SET location = 'Main Building'
    WHERE location IS NULL OR trim(location) = '';

    ALTER TABLE facilities
    ALTER COLUMN location SET NOT NULL;

    -- Inventory items facility linkage
    ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL;

    -- Facility to Equipment junction table (supports many-to-many relationship)
    CREATE TABLE IF NOT EXISTS facility_equipment (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      UNIQUE(facility_id, inventory_item_id)
    );
    CREATE INDEX IF NOT EXISTS idx_facility_equipment_facility ON facility_equipment(facility_id);
    CREATE INDEX IF NOT EXISTS idx_facility_equipment_item ON facility_equipment(inventory_item_id);

    -- Facility Bookings Table
    CREATE TABLE IF NOT EXISTS facility_bookings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      title text NOT NULL,
      purpose text,
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT valid_facility_booking_time CHECK (end_time > start_time)
    );
    CREATE INDEX IF NOT EXISTS idx_facility_bookings_facility_time ON facility_bookings(facility_id, start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_facility_bookings_user ON facility_bookings(user_id);

    -- Equipment Bookings Table (independent equipment booking)
    CREATE TABLE IF NOT EXISTS equipment_bookings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      title text NOT NULL,
      purpose text,
      start_time timestamptz NOT NULL,
      end_time timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      CONSTRAINT valid_equipment_booking_time CHECK (end_time > start_time)
    );
    ALTER TABLE equipment_bookings ADD COLUMN IF NOT EXISTS quantity integer DEFAULT 1;
    ALTER TABLE equipment_bookings ADD COLUMN IF NOT EXISTS notes text;
    CREATE INDEX IF NOT EXISTS idx_equipment_bookings_item_time ON equipment_bookings(inventory_item_id, start_time, end_time);
    CREATE INDEX IF NOT EXISTS idx_equipment_bookings_user ON equipment_bookings(user_id);

    -- Seed booking permissions
    INSERT INTO permissions (name, display_name, description, category) VALUES
      ('book_facilities', 'Book Facilities', 'Can book facilities and meeting spaces', 'facilities'),
      ('manage_facility_bookings', 'Manage Facility Bookings', 'Can view, edit, or cancel any facility booking', 'facilities'),
      ('book_equipment', 'Book Equipment', 'Can book equipment and instruments', 'inventory'),
      ('manage_equipment_bookings', 'Manage Equipment Bookings', 'Can view, edit, or cancel any equipment booking', 'inventory')
    ON CONFLICT (name) DO NOTHING;

    -- Grant booking permissions to all roles
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name IN ('book_facilities', 'book_equipment')
    ON CONFLICT DO NOTHING;

    -- Grant booking management to admin, super_admin, and lab_manager
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name IN ('manage_facility_bookings', 'manage_equipment_bookings')
    WHERE LOWER(r.name) IN ('admin', 'super_admin', 'lab_manager')
    ON CONFLICT DO NOTHING;

    -- Facilities Project Code & Funded By
    ALTER TABLE facilities ADD COLUMN IF NOT EXISTS project_code text;
    ALTER TABLE facilities ADD COLUMN IF NOT EXISTS funded_by text;

    -- Inventory Extended Fields
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS po_number text;
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS vendor_name text;
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS purchased_by text;
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expiry_date date;
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS classification text DEFAULT 'Equipment';
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS status text DEFAULT 'available';
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS is_returnable boolean DEFAULT false;
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS expected_return_date date;

    -- Ensure location is mandatory with safe default
    UPDATE inventory_items SET location = 'Main Lab' WHERE location IS NULL OR trim(location) = '';
    ALTER TABLE inventory_items ALTER COLUMN location SET DEFAULT 'Main Lab';
    ALTER TABLE inventory_items ALTER COLUMN location SET NOT NULL;

    -- Normalize classification for existing items
    UPDATE inventory_items SET classification = 'Consumables' WHERE lower(category) IN ('chemicals', 'consumable', 'consumables');
    UPDATE inventory_items SET classification = 'Equipment' WHERE classification IS NULL OR lower(category) NOT IN ('chemicals', 'consumable', 'consumables');

    -- Inventory Requests & Transaction History Table
    CREATE TABLE IF NOT EXISTS inventory_requests (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      inventory_item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
      requested_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
      purpose text,
      request_date timestamptz NOT NULL DEFAULT now(),
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'issued', 'returned', 'overdue', 'cancelled')),
      approved_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
      approved_at timestamptz,
      rejection_reason text,
      issued_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
      issue_date timestamptz,
      is_returnable boolean NOT NULL DEFAULT false,
      expected_return_date date,
      actual_return_date timestamptz,
      returned_condition text CHECK (returned_condition IS NULL OR returned_condition IN ('new', 'good', 'fair', 'poor', 'damaged')),
      return_remarks text,
      received_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
      remarks text,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_requests_item ON inventory_requests(inventory_item_id);
    CREATE INDEX IF NOT EXISTS idx_inventory_requests_requester ON inventory_requests(requested_by);
    CREATE INDEX IF NOT EXISTS idx_inventory_requests_status ON inventory_requests(status);
    CREATE INDEX IF NOT EXISTS idx_inventory_requests_expected_return ON inventory_requests(expected_return_date);

    -- Track sent reminder email dates to prevent duplicate/spam emails on server reloads
    ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS last_borrower_reminder_sent_date date;
    ALTER TABLE inventory_requests ADD COLUMN IF NOT EXISTS last_assigner_reminder_sent_date date;

    -- Seed inventory request permissions
    INSERT INTO permissions (name, display_name, description, category) VALUES
      ('request_inventory', 'Request Inventory Items', 'Can submit requests for consumables and equipment loans', 'inventory'),
      ('manage_inventory_requests', 'Manage Inventory Requests', 'Can approve, issue, and process returns of inventory items', 'inventory')
    ON CONFLICT (name) DO NOTHING;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name = 'request_inventory'
    ON CONFLICT DO NOTHING;

    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name = 'manage_inventory_requests'
    WHERE LOWER(r.name) IN ('admin', 'super_admin', 'lab_manager')
    ON CONFLICT DO NOTHING;

    -- User-Specific Daily To-Do System (Private Trackers & Tasks)
    CREATE TABLE IF NOT EXISTS daily_todo_trackers (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      date date NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE(user_id, date)
    );
    CREATE INDEX IF NOT EXISTS idx_daily_todo_trackers_user_date ON daily_todo_trackers(user_id, date);

    CREATE TABLE IF NOT EXISTS daily_todo_items (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tracker_id uuid NOT NULL REFERENCES daily_todo_trackers(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
      title text NOT NULL,
      is_completed boolean NOT NULL DEFAULT false,
      completed_at timestamptz,
      order_index integer NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_daily_todo_items_tracker_order ON daily_todo_items(tracker_id, order_index);
    CREATE INDEX IF NOT EXISTS idx_daily_todo_items_user ON daily_todo_items(user_id);

    -- =========================================================================
    -- PROJECT TRACKER MODULE (Tables, Sequence, Indexes, RBAC Permissions)
    -- =========================================================================
    CREATE SEQUENCE IF NOT EXISTS project_tracker_seq START WITH 1;

    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      tracker_id varchar(50) UNIQUE NOT NULL,
      project_code varchar(100),
      project_title varchar(255) NOT NULL,
      funding_agency varchar(255),
      proposal_link text,
      proposal_filename text,
      proposal_file_path text,
      proposal_file_size integer,
      proposal_file_type text,
      category varchar(100),
      status varchar(50) DEFAULT 'Active',
      overview text,
      plan_next_phase text,
      start_date date,
      closing_date date,
      faculty_lead_pi varchar(255),
      team jsonb DEFAULT '[]'::jsonb,
      accountable_owner_poc varchar(255),
      rag_status varchar(20) DEFAULT 'Green',
      last_funder_review text,
      data_gaps_flags text,
      last_weekly_update date,
      update_status varchar(50) DEFAULT 'On Track',
      open_actions integer DEFAULT 0,
      overdue_actions integer DEFAULT 0,
      staff_on_payroll varchar(100) DEFAULT '0',
      created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_rag ON projects(rag_status);
    CREATE INDEX IF NOT EXISTS idx_projects_closing_date ON projects(closing_date);

    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS proposal_filename text,
    ADD COLUMN IF NOT EXISTS proposal_file_path text,
    ADD COLUMN IF NOT EXISTS proposal_file_size integer,
    ADD COLUMN IF NOT EXISTS proposal_file_type text;

    ALTER TABLE repository_documents
    ALTER COLUMN file_path DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS document_url text;

    CREATE TABLE IF NOT EXISTS project_achievements (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
      author_name varchar(255) NOT NULL,
      message text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_project_achievements_project_id ON project_achievements(project_id, created_at DESC);

    -- Seed Project Tracker permissions
    INSERT INTO permissions (name, display_name, description, category) VALUES
      ('view_projects', 'View Projects', 'Can view project tracker entries', 'projects'),
      ('create_projects', 'Create Projects', 'Can create new projects in tracker', 'projects'),
      ('edit_projects', 'Edit Projects', 'Can edit project tracker entries', 'projects'),
      ('delete_projects', 'Delete Projects', 'Can delete project tracker entries', 'projects'),
      ('add_project_achievement', 'Add Project Achievements', 'Can post achievement updates to projects', 'projects')
    ON CONFLICT (name) DO NOTHING;

    -- Assign to admin / super_admin
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name IN ('view_projects', 'create_projects', 'edit_projects', 'delete_projects', 'add_project_achievement')
    WHERE LOWER(r.name) IN ('admin', 'super_admin')
    ON CONFLICT DO NOTHING;

    -- Assign default read & achievement permissions to user role
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id
    FROM roles r
    JOIN permissions p ON p.name IN ('view_projects', 'add_project_achievement')
    WHERE LOWER(r.name) = 'user'
    ON CONFLICT DO NOTHING;
  `);
}
