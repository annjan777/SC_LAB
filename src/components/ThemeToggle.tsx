import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

interface ThemeToggleProps {
  className?: string;
}

export default function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      id="theme-toggle-btn"
      type="button"
      onClick={toggleTheme}
      className={`relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-600 dark:text-slate-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${className}`}
      aria-label={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-5 h-5 text-amber-400 hover:text-amber-300 transition-transform duration-300 rotate-0 hover:rotate-45" />
        ) : (
          <Moon className="w-5 h-5 text-gray-600 hover:text-gray-900 transition-transform duration-300 -rotate-12 hover:rotate-0" />
        )}
      </div>
    </button>
  );
}
