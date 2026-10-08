import { api } from '../lib/api';
import {
  DailyTodoDateSummary,
  DailyTodoItem,
  DailyTodoTodaySummary,
  DailyTodoTracker,
} from '../types/todo';

export const dailyTodoService = {
  /**
   * Fetch all previous dates and today's date summary for the authenticated user
   */
  async getDates(): Promise<DailyTodoDateSummary[]> {
    const res = await api.get<DailyTodoDateSummary[]>('/api/daily-todos/dates');
    if (res.error) throw res.error;
    return res.data || [];
  },

  /**
   * Fetch summary of today's tasks for the floating button badge
   */
  async getTodaySummary(date?: string): Promise<DailyTodoTodaySummary> {
    const res = await api.get<DailyTodoTodaySummary>('/api/daily-todos/today/summary', { date });
    if (res.error) throw res.error;
    return res.data || { date: date || '', total_tasks: 0, completed_tasks: 0, pending_tasks: 0 };
  },

  /**
   * Get (or auto-create) the tracker and its tasks for a specific date (YYYY-MM-DD)
   */
  async getDayTasks(date: string): Promise<{ tracker: DailyTodoTracker; items: DailyTodoItem[] }> {
    const res = await api.get<{ tracker: DailyTodoTracker; items: DailyTodoItem[] }>(
      `/api/daily-todos/day/${date}`
    );
    if (res.error) throw res.error;
    return res.data || { tracker: {} as DailyTodoTracker, items: [] };
  },

  /**
   * Add a new task to a specific date
   */
  async addTask(date: string, title: string): Promise<DailyTodoItem> {
    const res = await api.post<DailyTodoItem>(`/api/daily-todos/day/${date}/items`, { title });
    if (res.error) throw res.error;
    return res.data!;
  },

  /**
   * Update an existing task (title, is_completed, order_index)
   */
  async updateTask(
    id: string,
    updates: { title?: string; is_completed?: boolean; order_index?: number }
  ): Promise<DailyTodoItem> {
    const res = await api.put<DailyTodoItem>(`/api/daily-todos/items/${id}`, updates);
    if (res.error) throw res.error;
    return res.data!;
  },

  /**
   * Delete a task
   */
  async deleteTask(id: string): Promise<void> {
    const res = await api.delete(`/api/daily-todos/items/${id}`);
    if (res.error) throw res.error;
  },

  /**
   * Delete an entire day's tracker by date
   */
  async deleteTrackerByDate(date: string): Promise<void> {
    const res = await api.delete(`/api/daily-todos/day/${date}`);
    if (res.error) throw res.error;
  },

  /**
   * Delete a tracker by tracker ID
   */
  async deleteTrackerById(id: string): Promise<void> {
    const res = await api.delete(`/api/daily-todos/trackers/${id}`);
    if (res.error) throw res.error;
  },

  /**
   * Reorder tasks for a specific date
   */
  async reorderTasks(date: string, itemIds: string[]): Promise<DailyTodoItem[]> {
    const res = await api.put<{ items: DailyTodoItem[] }>(`/api/daily-todos/day/${date}/reorder`, {
      item_ids: itemIds,
    });
    if (res.error) throw res.error;
    return res.data?.items || [];
  },

  /**
   * Carry forward uncompleted tasks from the most recent previous date
   */
  async carryForwardTasks(
    date: string
  ): Promise<{ copied_count: number; message: string; from_date?: string; items: DailyTodoItem[] }> {
    const res = await api.post<{
      copied_count: number;
      message: string;
      from_date?: string;
      items: DailyTodoItem[];
    }>(`/api/daily-todos/day/${date}/carry-forward`);
    if (res.error) throw res.error;
    return res.data || { copied_count: 0, message: '', items: [] };
  },
};
