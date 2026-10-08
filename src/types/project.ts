export type RAGStatus = 'Green' | 'Amber' | 'Red' | 'Grey';

export interface ProjectTeamMember {
  id?: string;
  name: string;
  email?: string;
  is_external?: boolean;
}

export interface Project {
  id: string;
  tracker_id: string;
  project_code: string | null;
  project_title: string;
  funding_agency: string | null;
  proposal_link: string | null;
  proposal_filename?: string | null;
  proposal_file_path?: string | null;
  proposal_file_size?: number | null;
  proposal_file_type?: string | null;
  category: string | null;
  status: string;
  overview: string | null;
  plan_next_phase: string | null;
  start_date: string | null;
  closing_date: string | null;
  faculty_lead_pi: string | null;
  team: ProjectTeamMember[];
  accountable_owner_poc: string | null;
  rag_status: RAGStatus;
  last_funder_review: string | null;
  data_gaps_flags: string | null;
  last_weekly_update: string | null;
  update_status: string;
  open_actions: number;
  overdue_actions: number;
  staff_on_payroll: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Computed from backend queries
  days_to_close?: number | null;
  days_since_update?: number | null;
  achievement_count?: number;
  latest_achievement_text?: string | null;
  latest_achievement_date?: string | null;
  achievements?: ProjectAchievement[];
}

export interface ProjectAchievement {
  id: string;
  project_id: string;
  user_id: string | null;
  author_name: string;
  message: string;
  created_at: string;
  updated_at: string;
  email?: string | null;
  profile_picture_url?: string | null;
}

export const PROJECT_CATEGORIES = [
  'Research & Innovation',
  'Consultancy',
  'Sponsored Research',
  'Grant-in-Aid',
  'Internal Lab Project',
  'Technology Transfer',
  'Industry Collaboration',
  'Other',
] as const;

export const PROJECT_STATUSES = [
  'Active',
  'Planning',
  'In Progress',
  'Under Review',
  'On Hold',
  'Completed',
  'Archived',
] as const;

export const RAG_OPTIONS: { value: RAGStatus; label: string; color: string; bg: string; dot: string }[] = [
  { value: 'Green', label: 'Green (On Track)', color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { value: 'Amber', label: 'Amber (Needs Attention)', color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800', dot: 'bg-amber-500' },
  { value: 'Red', label: 'Red (Critical / Blocked)', color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800', dot: 'bg-rose-500' },
  { value: 'Grey', label: 'Grey (Neutral / Inactive)', color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700', dot: 'bg-slate-400' },
];

export const UPDATE_STATUSES = [
  'On Track',
  'Needs Attention',
  'Critical',
  'Delayed',
  'Pending Review',
  'Completed',
] as const;
