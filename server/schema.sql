-- SC Lab Management Portal - Clean Postgres Schema (No Supabase / No RLS)
-- This is the consolidated schema from 90+ Supabase migrations

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

------------------------------------------------------------
-- 1. USERS (replaces Supabase auth.users + user_profiles)
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT 'New User',
  roll_number text,
  employee_id text,
  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  phone text,
  email text,
  address text,
  emergency_contact_name text,
  emergency_contact_phone text,
  department text,
  program_designation text,
  supervisor text,
  joining_date date DEFAULT CURRENT_DATE,
  tenure_ending_date date,
  user_role text NOT NULL DEFAULT 'user' CHECK (user_role IN ('super_admin', 'admin', 'lab_manager', 'researcher', 'student', 'guest', 'user')),
  is_active boolean DEFAULT true,
  profile_picture_url text,
  require_password_change boolean DEFAULT false,
  last_password_changed_at timestamptz,
  role_id uuid,
  temp_password_expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 2. RBAC
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES users(id),
  granted_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

-- FK for role_id in user_profiles
ALTER TABLE user_profiles ADD CONSTRAINT fk_user_profiles_role
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE SET NULL;

------------------------------------------------------------
-- 3. EXPERTISE LOOKUP TABLES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS software (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipment_types (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS processes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 4. USER EXPERTISE JUNCTION TABLES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_skills (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  proficiency_level text CHECK (proficiency_level IN ('beginner','intermediate','advanced','expert')) DEFAULT 'intermediate',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, skill_name)
);

CREATE TABLE IF NOT EXISTS user_software (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  software_name text NOT NULL,
  proficiency_level text CHECK (proficiency_level IN ('beginner','intermediate','advanced','expert')) DEFAULT 'intermediate',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, software_name)
);

CREATE TABLE IF NOT EXISTS user_equipment (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  equipment_name text NOT NULL,
  experience_level text CHECK (experience_level IN ('beginner','intermediate','advanced','expert')) DEFAULT 'intermediate',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, equipment_name)
);

CREATE TABLE IF NOT EXISTS user_processes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  process_name text NOT NULL,
  experience_level text CHECK (experience_level IN ('beginner','intermediate','advanced','expert')) DEFAULT 'intermediate',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, process_name)
);

------------------------------------------------------------
-- 5. INVENTORY
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name text NOT NULL,
  category text NOT NULL CHECK (
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
  ),
  serial_number text,
  asset_tag text,
  quantity integer DEFAULT 1,
  location text,
  condition text DEFAULT 'good' CHECK (condition IN ('new','good','fair','poor','damaged')),
  assigned_to_user_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  warranty_end_date date,
  last_maintenance_date date,
  purchase_request_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 6. PROCUREMENT
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_name text NOT NULL,
  category text NOT NULL,
  quantity integer DEFAULT 1,
  purpose text,
  estimated_cost decimal(12,2),
  vendor_name text,
  attachment_url text,
  status text DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','ordered','in_transit','received','added_to_inventory')),
  requested_by uuid NOT NULL REFERENCES user_profiles(id),
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  rejection_reason text,
  -- detailed fields
  item_description text,
  specifications text,
  link text,
  manufacturer_part_no text,
  volume text,
  duration_of_consumption text,
  project_code text,
  unit_price decimal(12,2),
  total_cost decimal(12,2),
  currency text DEFAULT 'INR',
  urgency text DEFAULT 'normal' CHECK (urgency IN ('low','normal','high','critical')),
  preferred_vendor text,
  alternate_vendor text,
  vendor_contact_info text,
  quotation_number text,
  quotation_date date,
  quotation_valid_until date,
  delivery_address text,
  expected_delivery_date date,
  budget_code text,
  project_reference text,
  justification text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS procurement_details (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_request_id uuid NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
  approved_cost decimal(12,2),
  vendor_contact text,
  po_number text,
  order_date date,
  expected_delivery_date date,
  dispatch_date date,
  tracking_id text,
  remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 7. LEAVE MANAGEMENT
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  leave_type text NOT NULL CHECK (leave_type IN ('casual','medical','academic')),
  from_date date NOT NULL,
  to_date date NOT NULL,
  reason text,
  attachment_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by uuid NOT NULL REFERENCES user_profiles(id),
  approved_by uuid REFERENCES user_profiles(id),
  approved_at timestamptz,
  admin_remarks text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 8. FACILITIES
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS facilities (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  location text,
  status text DEFAULT 'operational' CHECK (status IN ('operational','under_maintenance','out_of_order','decommissioned')),
  responsible_person_id uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  image_url text,
  category text,
  model_number text,
  manufacturer text,
  installation_date date,
  last_maintenance_date date,
  next_maintenance_date date,
  specifications jsonb DEFAULT '{}',
  usage_guidelines text,
  safety_requirements text,
  booking_required boolean DEFAULT false,
  max_booking_hours integer DEFAULT 4,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 9. WORK PLANNING
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS work_cycles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  year integer NOT NULL,
  status text DEFAULT 'planning' CHECK (status IN ('planning','active','completed','archived')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(quarter, year)
);

CREATE TABLE IF NOT EXISTS assigned_works (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id uuid REFERENCES work_cycles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  assigned_by text NOT NULL,
  work_title text NOT NULL,
  description text,
  start_date date,
  end_date date,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  admin_status text DEFAULT 'pending' CHECK (admin_status IN ('pending','on_track','needs_attention','completed','approved','rejected','needs_revision')),
  admin_feedback text,
  procurement_request_ids uuid[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_milestones (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
  title text NOT NULL,
  target_date date,
  expected_outcome text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','delayed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
  update_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL CHECK (status IN ('not_started','on_track','in_progress','delayed','ahead','blocked','completed')),
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  summary text NOT NULL,
  next_steps text,
  blockers text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_problems (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  severity text DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  reported_at timestamptz DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mitigation_actions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  problem_id uuid NOT NULL REFERENCES work_problems(id) ON DELETE CASCADE,
  action_description text NOT NULL,
  support_required_from text,
  urgency_level text,
  status text DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
  comment text NOT NULL,
  commented_by uuid NOT NULL REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_dependencies (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
  depends_on_work_id uuid NOT NULL REFERENCES assigned_works(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(work_id, depends_on_work_id)
);

------------------------------------------------------------
-- 10. NOTIFICATIONS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  related_entity_type text,
  related_entity_id uuid,
  action_url text,
  is_read boolean DEFAULT false,
  is_archived boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 11. REPOSITORY DOCUMENTS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS repository_documents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename text NOT NULL,
  file_path text NOT NULL,
  file_type text,
  category text NOT NULL DEFAULT 'other_documents',
  title text NOT NULL,
  description text,
  tags text[] DEFAULT '{}',
  uploaded_by uuid NOT NULL REFERENCES user_profiles(id),
  file_size bigint,
  visibility text DEFAULT 'all_members' CHECK (visibility IN ('all_members','admin_only','private','shared')),
  shared_with_users uuid[] DEFAULT '{}',
  is_admin_only_category boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

------------------------------------------------------------
-- 12. AUDIT LOGS
------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  performed_by uuid REFERENCES user_profiles(id),
  performed_at timestamptz DEFAULT now(),
  remarks text
);

------------------------------------------------------------
-- INDEXES
------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(user_role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_supervisor ON user_profiles(supervisor);
CREATE INDEX IF NOT EXISTS idx_user_profiles_department ON user_profiles(department);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_location ON inventory_items(location);
CREATE INDEX IF NOT EXISTS idx_inventory_assigned_to ON inventory_items(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_status ON purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_requested_by ON purchase_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_requested_by ON leave_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_assigned_works_cycle ON assigned_works(cycle_id);
CREATE INDEX IF NOT EXISTS idx_assigned_works_user ON assigned_works(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_updates_work ON progress_updates(work_id);
CREATE INDEX IF NOT EXISTS idx_work_problems_work ON work_problems(work_id);
CREATE INDEX IF NOT EXISTS idx_repository_documents_uploaded_by ON repository_documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

------------------------------------------------------------
-- FUNCTIONS
------------------------------------------------------------

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT unnest(ARRAY[
      'user_profiles','inventory_items','purchase_requests','procurement_details',
      'leave_requests','facilities','work_cycles','assigned_works','work_milestones',
      'work_problems','mitigation_actions','repository_documents'
    ])
  LOOP
    EXECUTE format('
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    ', t);
  END LOOP;
END;
$$;

-- Get user permissions (replaces Supabase RPC)
CREATE OR REPLACE FUNCTION get_user_permissions(user_uuid uuid)
RETURNS TABLE(permission_name text) AS $$
BEGIN
  RETURN QUERY
  -- Direct user permissions
  SELECT p.name
  FROM user_permissions up
  JOIN permissions p ON p.id = up.permission_id
  WHERE up.user_id = user_uuid
  UNION
  -- Role-based permissions
  SELECT p.name
  FROM user_profiles prof
  JOIN role_permissions rp ON rp.role_id = prof.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE prof.id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Autocomplete functions
CREATE OR REPLACE FUNCTION autocomplete_skills(search_term text)
RETURNS TABLE(suggestion text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT us.skill_name FROM user_skills us
  WHERE us.skill_name ILIKE '%' || search_term || '%'
  UNION
  SELECT s.name FROM skills s
  WHERE s.name ILIKE '%' || search_term || '%'
  ORDER BY suggestion LIMIT 10;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION autocomplete_software(search_term text)
RETURNS TABLE(suggestion text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT us.software_name FROM user_software us
  WHERE us.software_name ILIKE '%' || search_term || '%'
  UNION
  SELECT s.name FROM software s
  WHERE s.name ILIKE '%' || search_term || '%'
  ORDER BY suggestion LIMIT 10;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION autocomplete_equipment(search_term text)
RETURNS TABLE(suggestion text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ue.equipment_name FROM user_equipment ue
  WHERE ue.equipment_name ILIKE '%' || search_term || '%'
  UNION
  SELECT e.name FROM equipment_types e
  WHERE e.name ILIKE '%' || search_term || '%'
  ORDER BY suggestion LIMIT 10;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION autocomplete_processes(search_term text)
RETURNS TABLE(suggestion text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT up.process_name FROM user_processes up
  WHERE up.process_name ILIKE '%' || search_term || '%'
  UNION
  SELECT p.name FROM processes p
  WHERE p.name ILIKE '%' || search_term || '%'
  ORDER BY suggestion LIMIT 10;
END;
$$ LANGUAGE plpgsql;

------------------------------------------------------------
-- SEED: Default permissions
------------------------------------------------------------
INSERT INTO permissions (name, display_name, description, category) VALUES
  ('view_users', 'View Users', 'Can view user list and profiles', 'users'),
  ('manage_users', 'Manage Users', 'Can create, edit, delete users', 'users'),
  ('manage_roles', 'Manage Roles', 'Can manage roles and permissions', 'users'),
  ('view_facilities', 'View Facilities', 'Can view facilities', 'facilities'),
  ('create_facilities', 'Create Facilities', 'Can create new facilities', 'facilities'),
  ('edit_facilities', 'Edit Facilities', 'Can edit facilities', 'facilities'),
  ('delete_facilities', 'Delete Facilities', 'Can delete facilities', 'facilities'),
  ('view_procurement', 'View Procurement', 'Can view purchase requests', 'procurement'),
  ('create_purchase_request', 'Create Purchase Request', 'Can create purchase requests', 'procurement'),
  ('approve_procurement', 'Approve Procurement', 'Can approve purchase requests', 'procurement'),
  ('manage_procurement', 'Manage Procurement', 'Full procurement management', 'procurement'),
  ('view_leaves', 'View Leaves', 'Can view leave requests', 'leaves'),
  ('create_leave_request', 'Create Leave Request', 'Can create leave requests', 'leaves'),
  ('approve_leaves', 'Approve Leaves', 'Can approve leave requests', 'leaves'),
  ('view_work', 'View Work', 'Can view work entries', 'work'),
  ('create_work', 'Create Work', 'Can create work entries', 'work'),
  ('edit_work', 'Edit Work', 'Can edit work entries', 'work'),
  ('delete_work', 'Delete Work', 'Can delete work entries', 'work'),
  ('manage_work_cycles', 'Manage Work Cycles', 'Can manage work cycles', 'work'),
  ('view_inventory', 'View Inventory', 'Can view inventory', 'inventory'),
  ('create_inventory', 'Create Inventory', 'Can add inventory items', 'inventory'),
  ('edit_inventory', 'Edit Inventory', 'Can edit inventory items', 'inventory'),
  ('delete_inventory', 'Delete Inventory', 'Can delete inventory items', 'inventory'),
  ('view_reports', 'View Reports', 'Can view reports', 'reports'),
  ('generate_reports', 'Generate Reports', 'Can generate reports', 'reports'),
  ('view_settings', 'View Settings', 'Can view settings', 'settings'),
  ('manage_settings', 'Manage Settings', 'Can manage settings', 'settings'),
  ('view_notifications', 'View Notifications', 'Can view notifications', 'notifications'),
  ('view_repository', 'View Repository', 'Can view repository documents', 'repository'),
  ('edit_repository_all', 'Edit Repository', 'Can edit all repository documents', 'repository'),
  ('delete_repository_all', 'Delete Repository', 'Can delete all repository documents', 'repository'),
  ('share_repository_documents', 'Share Repository Documents', 'Can share repository documents with users', 'repository')
ON CONFLICT (name) DO NOTHING;

-- Default admin role
INSERT INTO roles (name, description, is_system_role) VALUES
  ('admin', 'System Administrator', true),
  ('user', 'Regular User', true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE LOWER(r.name) = 'admin'
ON CONFLICT DO NOTHING;

-- Assign default permissions to user role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE LOWER(r.name) = 'user' 
  AND p.name IN (
    'create_leave_request', 
    'create_purchase_request', 
    'create_work', 'edit_work', 'view_work', 
    'view_inventory', 'create_inventory', 'edit_inventory', 
    'view_settings', 
    'view_notifications', 'view_facilities'
  )
ON CONFLICT DO NOTHING;

-- Email Sync Trigger: Automatically update users.email whenever user_profiles.email is inserted or updated
CREATE OR REPLACE FUNCTION sync_user_profile_email_to_users()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email IS NOT NULL AND (OLD IS NULL OR OLD.email IS DISTINCT FROM NEW.email) THEN
    UPDATE users SET email = NEW.email, updated_at = now() WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_user_profile_email ON user_profiles;
CREATE TRIGGER trigger_sync_user_profile_email
  AFTER INSERT OR UPDATE OF email ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION sync_user_profile_email_to_users();

