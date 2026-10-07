import React, { useState, useEffect } from 'react';
import { ListTodo, Check } from 'lucide-react';
import DailyTodoModal from './DailyTodoModal';
import { dailyTodoService } from '../../services/dailyTodoService';
import { DailyTodoTodaySummary } from '../../types/todo';

export default function DailyTodoFloatingButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [summary, setSummary] = useState<DailyTodoTodaySummary | null>(null);

  // Helper to get local YYYY-MM-DD
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const fetchSummary = async () => {
    try {
      const data = await dailyTodoService.getTodaySummary(getTodayStr());
      setSummary(data);
    } catch (err) {
      // Non-critical, ignore error
    }
  };

  useEffect(() => {
    fetchSummary();

    // Periodic check every 60 seconds
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut: Alt + T or Option + T to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const pendingCount = summary?.pending_tasks || 0;
  const isAllDone = (summary?.total_tasks || 0) > 0 && pendingCount === 0;

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40 group select-none">
        {/* Floating Tooltip */}
        <div className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-gray-900/90 dark:bg-slate-800/95 text-white text-xs font-medium rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap border border-gray-700/50 flex items-center gap-1.5 backdrop-blur-sm">
          <span>Daily To-Do</span>
          {pendingCount > 0 && (
            <span className="text-amber-300 font-semibold">• {pendingCount} pending</span>
          )}
          {isAllDone && (
            <span className="text-emerald-300 font-semibold">• All done!</span>
          )}
          <span className="text-gray-400 text-[10px] ml-1 font-mono">(Alt+T)</span>
        </div>

        {/* Circular Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-xl hover:shadow-2xl shadow-blue-500/25 dark:shadow-blue-900/40 flex items-center justify-center transform hover:scale-105 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-blue-500/30"
          aria-label="Open Daily To-Do"
          title="Daily To-Do"
        >
          <ListTodo className="w-6 h-6 stroke-[2.2] group-hover:rotate-6 transition-transform duration-200" />

          {/* Pending Tasks Badge */}
          {pendingCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] px-1 flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-in zoom-in duration-150">
              {pendingCount > 99 ? '99+' : pendingCount}
            </span>
          )}

          {/* All Completed Badge */}
          {isAllDone && (
            <span className="absolute -top-1 -right-1 bg-emerald-500 text-white rounded-full h-5 w-5 flex items-center justify-center border-2 border-white dark:border-slate-900 shadow-sm animate-in zoom-in duration-150">
              <Check className="w-3 h-3 stroke-[3]" />
            </span>
          )}
        </button>
      </div>

      {/* Modal Dialog */}
      <DailyTodoModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onTasksChanged={fetchSummary}
      />
    </>
  );
}
