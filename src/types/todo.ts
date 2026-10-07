export interface DailyTodoTracker {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
}

export interface DailyTodoItem {
  id: string;
  tracker_id: string;
  user_id: string;
  title: string;
  is_completed: boolean;
  completed_at?: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface DailyTodoDateSummary {
  tracker_id: string;
  date: string; // YYYY-MM-DD
  created_at: string;
  updated_at: string;
  total_tasks: number;
  completed_tasks: number;
  items_preview: Array<{
    id: string;
    title: string;
    is_completed: boolean;
    order_index: number;
  }>;
}

export interface DailyTodoTodaySummary {
  date: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
}
