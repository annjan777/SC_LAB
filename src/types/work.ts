export type IssueType =
  | 'task'
  | 'experiment'
  | 'milestone'
  | 'equipment_maintenance'
  | 'bug_incident'
  | 'procurement_task';

export type WorkPriority = 'low' | 'medium' | 'high' | 'code_red';

export type DependencyType = 'blocks' | 'is_blocked_by' | 'relates_to' | 'delayed_by_code_red';

export interface AssignedWork {
  id: string;
  issue_key?: string;
  issue_type?: IssueType;
  project_name: string;
  assigned_by: string;
  assigned_by_user_id?: string | null;
  user_id?: string;
  user_name?: string;
  user_email?: string;
  department?: string;
  work_title: string;
  description: string;
  start_date: string;
  end_date: string;
  priority: WorkPriority;
  code_red_activated_at?: string | null;
  admin_status: string;
  pending_milestone_requests_count?: number;
  blocked_by_code_red_count?: number;
  open_problems_count?: number;
  completion_percentage?: number;
  latest_status?: string;
  days_since_update?: number;
  created_at: string;
  updated_at?: string;
}

export interface WorkMilestone {
  id: string;
  work_id?: string;
  milestone_description: string;
  title?: string;
  target_date: string;
  expected_outcome?: string;
  status?: 'pending' | 'in_progress' | 'completed' | 'delayed';
  is_completed: boolean;
  completed_at?: string;
  justification?: string;
  justification_linked_work_id?: string;
  justification_status?: 'pending' | 'approved' | 'rejected' | null;
  justification_submitted_at?: string | null;
  justification_reviewed_by?: string | null;
  justification_reviewed_at?: string | null;
  justification_review_notes?: string | null;
  justification_reviewer_name?: string | null;
  linked_work_key?: string;
  linked_work_title?: string;
  linked_work_priority?: WorkPriority;
  created_at?: string;
  updated_at?: string;
}

export interface MilestoneChangeRequest {
  id: string;
  work_id: string;
  work_title?: string;
  issue_key?: string;
  project_name?: string;
  requested_by: string;
  requester_name?: string;
  requester_email?: string;
  requester_department?: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  proposed_milestones: any[];
  previous_milestones?: any[];
  admin_notes?: string;
  reviewed_by?: string;
  reviewer_name?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface WorkDependency {
  id: string;
  work_id: string;
  depends_on_work_id: string;
  dependency_type: DependencyType;
  notes?: string;
  issue_key?: string;
  work_title?: string;
  priority?: WorkPriority;
  issue_type?: IssueType;
  admin_status?: string;
  assigned_to_name?: string;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  remarks?: string;
  old_value?: any;
  new_value?: any;
  performed_at: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
}

export interface LinkableWork {
  id: string;
  issue_key: string;
  work_title: string;
  project_name: string;
  priority: WorkPriority;
  issue_type: IssueType;
  admin_status: string;
  user_name: string;
}

export interface ProgressUpdate {
  id: string;
  work_id?: string;
  update_date: string;
  status: string;
  completion_percentage: number;
  progress_notes?: string;
  created_at?: string;
}

export interface WorkProblem {
  id: string;
  work_id?: string;
  category: string;
  description: string;
  impact_level: string;
  reported_date: string;
  is_resolved: boolean;
  resolution_date?: string | null;
  mitigation_actions?: Array<{
    id: string;
    proposed_mitigation: string;
    support_required_from: string;
    urgency_level: string;
    status: string;
  }>;
}
