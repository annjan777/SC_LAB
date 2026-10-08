import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  CheckCircle2,
  Circle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Trash2,
  Edit2,
  RotateCcw,
  Sparkles,
  Search,
  Check,
  Clock,
  ListTodo,
  CalendarDays,
  Menu,
} from 'lucide-react';
import { dailyTodoService } from '../../services/dailyTodoService';
import { DailyTodoDateSummary, DailyTodoItem, DailyTodoTracker } from '../../types/todo';

interface DailyTodoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTasksChanged?: () => void;
}

// Format date helper: returns "YYYY-MM-DD"
function formatToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Friendly display name for a date: "Today", "Yesterday", or "Monday, Oct 5"
function getFriendlyDateLabel(dateStr: string, todayStr: string): { label: string; sublabel: string; isToday: boolean } {
  const today = new Date(todayStr + 'T00:00:00');
  const target = new Date(dateStr + 'T00:00:00');

  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const isToday = diffDays === 0;

  let label = '';
  if (diffDays === 0) {
    label = 'Today';
  } else if (diffDays === 1) {
    label = 'Yesterday';
  } else if (diffDays === -1) {
    label = 'Tomorrow';
  } else {
    label = target.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const sublabel = target.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return { label, sublabel, isToday };
}

export default function DailyTodoModal({ isOpen, onClose, onTasksChanged }: DailyTodoModalProps) {
  const todayStr = formatToYMD(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [dateSummaries, setDateSummaries] = useState<DailyTodoDateSummary[]>([]);
  const [currentTracker, setCurrentTracker] = useState<DailyTodoTracker | null>(null);
  const [tasks, setTasks] = useState<DailyTodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [datesLoading, setDatesLoading] = useState(false);

  // New task input state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addingTask, setAddingTask] = useState(false);

  // In-line editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Mobile sidebar toggle
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Carry forward banner feedback
  const [carryMessage, setCarryMessage] = useState<string | null>(null);
  const [isCarrying, setIsCarrying] = useState(false);

  // Search filter for history
  const [searchQuery, setSearchQuery] = useState('');

  // Delete tracker state
  const [deletingTracker, setDeletingTracker] = useState(false);

  const newTaskInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTaskId) {
          setEditingTaskId(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingTaskId, onClose]);

  // Load date summaries on modal open
  useEffect(() => {
    if (isOpen) {
      loadDateSummaries();
    }
  }, [isOpen]);

  // Load tasks when selectedDate changes or modal opens
  useEffect(() => {
    if (isOpen && selectedDate) {
      loadTasksForDate(selectedDate);
    }
  }, [isOpen, selectedDate]);

  // Focus edit input when edit mode starts
  useEffect(() => {
    if (editingTaskId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTaskId]);

  const loadDateSummaries = async () => {
    setDatesLoading(true);
    try {
      const dates = await dailyTodoService.getDates();
      setDateSummaries(dates);
    } catch (err) {
      console.error('Failed to load date summaries:', err);
    } finally {
      setDatesLoading(false);
    }
  };

  const loadTasksForDate = async (date: string) => {
    setLoading(true);
    setCarryMessage(null);
    try {
      const data = await dailyTodoService.getDayTasks(date);
      setCurrentTracker(data.tracker);
      setTasks(data.items);
    } catch (err) {
      console.error(`Failed to load tasks for ${date}:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Add new task
  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim() || addingTask) return;

    const titleToAdd = newTaskTitle.trim();
    setAddingTask(true);
    try {
      const created = await dailyTodoService.addTask(selectedDate, titleToAdd);
      setTasks((prev) => [...prev, created]);
      setNewTaskTitle('');

      // Refresh date history summary in background
      loadDateSummaries();
      onTasksChanged?.();

      // Refocus input for rapid-fire entry
      setTimeout(() => {
        newTaskInputRef.current?.focus();
      }, 50);
    } catch (err) {
      console.error('Failed to add task:', err);
    } finally {
      setAddingTask(false);
    }
  };

  // Toggle completion
  const handleToggleComplete = async (task: DailyTodoItem) => {
    const updatedStatus = !task.is_completed;
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id
          ? {
              ...t,
              is_completed: updatedStatus,
              completed_at: updatedStatus ? new Date().toISOString() : null,
            }
          : t
      )
    );

    try {
      await dailyTodoService.updateTask(task.id, { is_completed: updatedStatus });
      loadDateSummaries();
      onTasksChanged?.();
    } catch (err) {
      console.error('Failed to update task completion:', err);
      // Rollback on error
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, is_completed: task.is_completed } : t))
      );
    }
  };

  // Start inline editing
  const handleStartEdit = (task: DailyTodoItem) => {
    setEditingTaskId(task.id);
    setEditingTitle(task.title);
  };

  // Save inline edit
  const handleSaveEdit = async () => {
    if (!editingTaskId) return;
    const cleanTitle = editingTitle.trim();

    if (!cleanTitle) {
      // If empty, prompt or cancel
      setEditingTaskId(null);
      return;
    }

    const currentItem = tasks.find((t) => t.id === editingTaskId);
    if (currentItem && currentItem.title === cleanTitle) {
      setEditingTaskId(null);
      return;
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === editingTaskId ? { ...t, title: cleanTitle } : t))
    );
    const targetId = editingTaskId;
    setEditingTaskId(null);

    try {
      await dailyTodoService.updateTask(targetId, { title: cleanTitle });
      loadDateSummaries();
      onTasksChanged?.();
    } catch (err) {
      console.error('Failed to update task title:', err);
      if (currentItem) {
        setTasks((prev) =>
          prev.map((t) => (t.id === targetId ? { ...t, title: currentItem.title } : t))
        );
      }
    }
  };

  // Delete task
  const handleDeleteTask = async (id: string) => {
    // Optimistic update
    const prevTasks = [...tasks];
    setTasks((prev) => prev.filter((t) => t.id !== id));

    try {
      await dailyTodoService.deleteTask(id);
      loadDateSummaries();
      onTasksChanged?.();
    } catch (err) {
      console.error('Failed to delete task:', err);
      setTasks(prevTasks);
    }
  };

  // Move task up or down
  const handleMoveTask = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= tasks.length) return;

    const newTasks = [...tasks];
    const [moved] = newTasks.splice(index, 1);
    newTasks.splice(targetIndex, 0, moved);

    // Optimistic reorder
    setTasks(newTasks);

    try {
      const itemIds = newTasks.map((t) => t.id);
      await dailyTodoService.reorderTasks(selectedDate, itemIds);
    } catch (err) {
      console.error('Failed to reorder tasks:', err);
      setTasks(tasks); // rollback
    }
  };

  // Carry forward uncompleted tasks from previous date
  const handleCarryForward = async () => {
    setIsCarrying(true);
    setCarryMessage(null);
    try {
      const result = await dailyTodoService.carryForwardTasks(selectedDate);
      if (result.copied_count > 0) {
        setCarryMessage(result.message);
        loadTasksForDate(selectedDate);
        loadDateSummaries();
        onTasksChanged?.();
      } else {
        setCarryMessage(result.message || 'No pending tasks to carry forward.');
      }
    } catch (err: any) {
      console.error('Failed to carry forward tasks:', err);
      setCarryMessage('Could not carry forward tasks.');
    } finally {
      setIsCarrying(false);
    }
  };

  // Delete entire tracker for a specific date
  const handleDeleteTracker = async (dateToDelete: string) => {
    const friendly = getFriendlyDateLabel(dateToDelete, todayStr);
    const confirm = window.confirm(
      `Are you sure you want to delete the tracker for ${friendly.label} (${dateToDelete})? All tasks for this date will be permanently deleted.`
    );
    if (!confirm) return;

    setDeletingTracker(true);
    try {
      await dailyTodoService.deleteTrackerByDate(dateToDelete);
      await loadDateSummaries();
      onTasksChanged?.();

      if (dateToDelete === selectedDate) {
        if (selectedDate === todayStr) {
          // If today's tracker was deleted, reload an empty today canvas
          setTasks([]);
          await loadTasksForDate(todayStr);
        } else {
          // If a past or future date was deleted, switch back to today
          setSelectedDate(todayStr);
        }
      }
    } catch (err) {
      console.error('Failed to delete tracker:', err);
      alert('Failed to delete tracker. Please try again.');
    } finally {
      setDeletingTracker(false);
    }
  };

  // Navigate adjacent days
  const handleShiftDate = (days: number) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    setSelectedDate(formatToYMD(current));
  };

  if (!isOpen) return null;

  // Filtered date list for sidebar
  const filteredDates = dateSummaries.filter((d) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const friendly = getFriendlyDateLabel(d.date, todayStr);
    return (
      d.date.includes(query) ||
      friendly.label.toLowerCase().includes(query) ||
      friendly.sublabel.toLowerCase().includes(query) ||
      d.items_preview.some((p) => p.title.toLowerCase().includes(query))
    );
  });

  // Ensure selectedDate is represented in sidebar even if it was just selected
  const hasSelectedInList = dateSummaries.some((d) => d.date === selectedDate);

  // Calculations for current day progress
  const totalCount = tasks.length;
  const completedCount = tasks.filter((t) => t.is_completed).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const friendlyCurrent = getFriendlyDateLabel(selectedDate, todayStr);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Modal Container */}
      <div
        className="w-full max-w-5xl h-[86vh] max-h-[800px] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 overflow-hidden transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Apple Notes Top Titlebar */}
        <div className="h-14 px-4 sm:px-6 bg-slate-100/90 dark:bg-slate-900/90 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between shrink-0 select-none">
          {/* Left: Window Dots & App Name */}
          <div className="flex items-center gap-3">
            {/* macOS traffic light dots for authentic Apple Notes feel */}
            <div className="hidden sm:flex items-center gap-1.5 mr-2">
              <button
                onClick={onClose}
                className="w-3 h-3 rounded-full bg-red-400 hover:bg-red-500 transition-colors"
                title="Close"
              />
              <span className="w-3 h-3 rounded-full bg-amber-400" />
              <span className="w-3 h-3 rounded-full bg-emerald-400" />
            </div>

            {/* Mobile Sidebar Toggle Button */}
            <button
              onClick={() => setShowMobileSidebar(!showMobileSidebar)}
              className="md:hidden p-1.5 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-800"
              title="Toggle Dates"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <ListTodo className="w-4 h-4" />
              </div>
              <span className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-base tracking-tight">
                Daily To-Do
              </span>
            </div>
          </div>

          {/* Center: Quick Date Navigation */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-1.5 py-1 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm text-xs sm:text-sm">
            <button
              onClick={() => handleShiftDate(-1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSelectedDate(todayStr)}
              className={`px-2 py-0.5 rounded font-medium transition ${
                selectedDate === todayStr
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => handleShiftDate(1)}
              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 transition"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right: Date Picker & Close */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) setSelectedDate(e.target.value);
                }}
                className="w-9 h-8 opacity-0 absolute inset-0 cursor-pointer z-10"
                title="Select Specific Date"
              />
              <button
                type="button"
                className="p-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 transition flex items-center gap-1.5 text-xs font-medium"
              >
                <CalendarDays className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="hidden sm:inline">Jump</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-gray-200 dark:hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Body (Apple Notes Split-Pane) */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* ========================================================= */}
          {/* LEFT SIDEBAR: Date & History Panel (Apple Notes Note List) */}
          {/* ========================================================= */}
          <aside
            className={`
              absolute md:relative z-20 md:z-0 inset-y-0 left-0 w-80 md:w-72 lg:w-80
              bg-slate-50/95 dark:bg-slate-900/95 md:bg-slate-50 dark:md:bg-slate-900
              border-r border-gray-200 dark:border-slate-800 flex flex-col shrink-0
              transition-transform duration-200 ease-in-out
              ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}
          >
            {/* Sidebar Search / Filter Header */}
            <div className="p-3 border-b border-gray-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                  Timeline & Days
                </span>
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  {dateSummaries.length} tracked
                </span>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search previous tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Date List Items (Apple Notes Style) */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 min-h-0">
              {/* Pinned "Today" card if not present in history yet */}
              {!hasSelectedInList && selectedDate === todayStr && (
                <button
                  onClick={() => {
                    setSelectedDate(todayStr);
                    setShowMobileSidebar(false);
                  }}
                  className="w-full text-left p-3 rounded-xl transition-all duration-150 bg-blue-600 text-white shadow-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">Today</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-blue-100 truncate">
                    {tasks.length > 0
                      ? `${tasks.filter((t) => t.is_completed).length}/${tasks.length} tasks completed`
                      : 'New daily tracker ready'}
                  </p>
                </button>
              )}

              {/* If user selected a custom date not in list */}
              {!hasSelectedInList && selectedDate !== todayStr && (
                <button
                  onClick={() => setShowMobileSidebar(false)}
                  className="w-full text-left p-3 rounded-xl transition-all duration-150 bg-blue-600 text-white shadow-md"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-sm">
                      {getFriendlyDateLabel(selectedDate, todayStr).label}
                    </span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/20 text-white">
                      Selected
                    </span>
                  </div>
                  <p className="text-xs text-blue-100 truncate">{selectedDate}</p>
                </button>
              )}

              {datesLoading && dateSummaries.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500 animate-pulse">
                  Loading dates...
                </div>
              ) : filteredDates.length === 0 && !hasSelectedInList ? (
                <div className="p-4 text-center text-xs text-gray-400 dark:text-slate-500">
                  No previous trackers match search
                </div>
              ) : (
                filteredDates.map((item) => {
                  const isSelected = item.date === selectedDate;
                  const friendly = getFriendlyDateLabel(item.date, todayStr);
                  const isAllDone = item.total_tasks > 0 && item.completed_tasks === item.total_tasks;

                  return (
                    <button
                      key={item.tracker_id}
                      onClick={() => {
                        setSelectedDate(item.date);
                        setShowMobileSidebar(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl transition-all duration-150 group relative ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-900 dark:text-slate-100 border border-gray-200/70 dark:border-slate-850'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-semibold text-sm truncate ${
                              isSelected ? 'text-white' : 'text-gray-900 dark:text-slate-100'
                            }`}
                          >
                            {friendly.label}
                          </span>
                          {friendly.isToday && (
                            <span
                              className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                                isSelected
                                  ? 'bg-white/20 text-white'
                                  : 'bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400'
                              }`}
                            >
                              Today
                            </span>
                          )}
                        </div>

                        {/* Task completion badge & delete action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isAllDone ? (
                            <span
                              className={`text-xs flex items-center gap-0.5 ${
                                isSelected ? 'text-emerald-200 font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span className="text-[11px]">Done</span>
                            </span>
                          ) : (
                            <span
                              className={`text-xs ${
                                isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-slate-400'
                              }`}
                            >
                              {item.completed_tasks}/{item.total_tasks}
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTracker(item.date);
                            }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              isSelected
                                ? 'hover:bg-white/20 text-white'
                                : 'hover:bg-red-100 dark:hover:bg-red-950/60 text-gray-400 hover:text-red-600 dark:hover:text-red-400'
                            }`}
                            title={`Delete tracker for ${friendly.label}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Apple Notes snippet preview of first tasks */}
                      <p
                        className={`text-xs line-clamp-1 ${
                          isSelected ? 'text-blue-100' : 'text-gray-500 dark:text-slate-400'
                        }`}
                      >
                        {item.items_preview.length > 0
                          ? item.items_preview.map((p) => (p.is_completed ? `✓ ${p.title}` : `• ${p.title}`)).join('  ')
                          : 'No tasks logged'}
                      </p>
                    </button>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer: Quick Today shortcut */}
            <div className="p-3 border-t border-gray-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
              <button
                onClick={() => {
                  setSelectedDate(todayStr);
                  setShowMobileSidebar(false);
                }}
                className={`w-full py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition ${
                  selectedDate === todayStr
                    ? 'bg-gray-200 dark:bg-slate-800 text-gray-700 dark:text-slate-300'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Jump to Today’s Tasks</span>
              </button>
            </div>
          </aside>

          {/* Backdrop for mobile sidebar */}
          {showMobileSidebar && (
            <div
              className="md:hidden absolute inset-0 bg-black/40 z-10"
              onClick={() => setShowMobileSidebar(false)}
            />
          )}

          {/* ========================================================= */}
          {/* RIGHT CANVAS: Apple Notes Task List Canvas                */}
          {/* ========================================================= */}
          <main className="flex-1 flex flex-col bg-white dark:bg-slate-950 overflow-hidden">
            {/* Day Header & Progress Banner */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-slate-850 shrink-0 bg-white dark:bg-slate-950">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-50 tracking-tight">
                      {friendlyCurrent.sublabel}
                    </h2>
                    {friendlyCurrent.isToday && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-200 dark:border-emerald-800/50">
                        Today
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Private daily task tracker • Changes auto-save
                  </p>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  <button
                    onClick={handleCarryForward}
                    disabled={isCarrying}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 bg-gray-50 dark:bg-slate-900 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-gray-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition shadow-sm disabled:opacity-50"
                    title="Carry forward uncompleted tasks from previous day"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isCarrying ? 'animate-spin' : ''}`} />
                    <span>Carry Forward</span>
                  </button>

                  <button
                    onClick={() => handleDeleteTracker(selectedDate)}
                    disabled={deletingTracker}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 bg-gray-50 dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition shadow-sm disabled:opacity-50"
                    title="Delete entire day's tracker and all tasks"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Day</span>
                  </button>
                </div>
              </div>

              {/* Carry Message Banner */}
              {carryMessage && (
                <div className="mt-3 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300 flex items-center justify-between animate-in fade-in">
                  <span>{carryMessage}</span>
                  <button
                    onClick={() => setCarryMessage(null)}
                    className="p-1 hover:text-blue-900 dark:hover:text-blue-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Progress Bar & Counter */}
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-300 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-600 dark:text-slate-400 shrink-0">
                  {completedCount} of {totalCount} completed ({progressPercent}%)
                </span>
              </div>
            </div>

            {/* Task Checklist Items (Apple Notes Checklist Style) */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1 min-h-0">
              {loading ? (
                <div className="py-12 text-center text-sm text-gray-400 dark:text-slate-500 animate-pulse">
                  Loading tasks for {friendlyCurrent.label}...
                </div>
              ) : tasks.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto mb-3 shadow-sm">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">
                    No tasks for this day yet
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
                    Type a task in the field below and press <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 text-[10px] font-mono">Enter</kbd> to add your first checklist item.
                  </p>
                </div>
              ) : (
                tasks.map((task, index) => {
                  const isEditing = editingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      className={`
                        group flex items-start sm:items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
                        ${task.is_completed ? 'bg-transparent' : 'bg-white dark:bg-slate-900/60 hover:bg-gray-50 dark:hover:bg-slate-850/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]'}
                      `}
                    >
                      {/* Apple Notes Circular Checkbox */}
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task)}
                        className={`mt-0.5 sm:mt-0 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-150 ${
                          task.is_completed
                            ? 'bg-emerald-500 text-white shadow-sm ring-1 ring-emerald-500'
                            : 'border-2 border-gray-300 dark:border-slate-600 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-slate-800'
                        }`}
                        aria-label={task.is_completed ? 'Mark incomplete' : 'Mark completed'}
                      >
                        {task.is_completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </button>

                      {/* Task Text / Inline Editor */}
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center gap-2">
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') setEditingTaskId(null);
                              }}
                              onBlur={handleSaveEdit}
                              className="w-full text-sm font-normal px-2 py-1 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                              onClick={handleSaveEdit}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 shrink-0"
                            >
                              Done
                            </button>
                          </div>
                        ) : (
                          <span
                            onClick={() => handleStartEdit(task)}
                            className={`text-sm select-text cursor-text block leading-relaxed break-words transition-colors ${
                              task.is_completed
                                ? 'line-through text-gray-400 dark:text-slate-500'
                                : 'text-gray-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400'
                            }`}
                            title="Click to edit"
                          >
                            {task.title}
                          </span>
                        )}
                      </div>

                      {/* Task Actions (Reorder, Edit, Delete) */}
                      {!isEditing && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {/* Reorder Buttons */}
                          <div className="flex flex-col sm:flex-row items-center">
                            <button
                              onClick={() => handleMoveTask(index, 'up')}
                              disabled={index === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-20 transition"
                              title="Move Up"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveTask(index, 'down')}
                              disabled={index === tasks.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-20 transition"
                              title="Move Down"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleStartEdit(task)}
                            className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                            title="Edit Task"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                            title="Delete Task"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Apple Notes Bottom Inline Task Creator */}
            <div className="p-4 sm:px-6 border-t border-gray-100 dark:border-slate-850 bg-gray-50/70 dark:bg-slate-900/40 shrink-0">
              <form onSubmit={handleAddTask} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 dark:border-slate-600 flex items-center justify-center shrink-0">
                  <Plus className="w-3 h-3 text-gray-400" />
                </div>
                <input
                  ref={newTaskInputRef}
                  type="text"
                  placeholder={`Add a new task for ${friendlyCurrent.label}...`}
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  disabled={addingTask}
                  className="flex-1 bg-transparent text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newTaskTitle.trim() || addingTask}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:hover:bg-blue-600 text-white text-xs font-semibold rounded-lg shadow-sm transition flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
              <div className="flex items-center justify-between mt-2 text-[11px] text-gray-400 dark:text-slate-500 px-1">
                <span>Press <kbd className="px-1 py-0.2 rounded bg-gray-200 dark:bg-slate-800 text-[10px] font-mono">Enter</kbd> to quickly add multiple items</span>
                <span>Fully encrypted & private to you</span>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
