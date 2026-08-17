import { useState } from 'react';
import { Calendar, X } from 'lucide-react';

interface DateRangeFilterProps {
  onApply: (dateRange: { from: string; to: string } | null) => void;
  label?: string;
}

export default function DateRangeFilter({ onApply, label = 'Filter by Date Range' }: DateRangeFilterProps) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [isActive, setIsActive] = useState(false);

  const handleApply = () => {
    if (fromDate && toDate) {
      onApply({ from: fromDate, to: toDate });
      setIsActive(true);
    }
  };

  const handleClear = () => {
    setFromDate('');
    setToDate('');
    setIsActive(false);
    onApply(null);
  };

  const getQuickDateRange = (type: 'week' | 'month' | 'quarter' | 'year') => {
    const today = new Date();
    const from = new Date();

    switch (type) {
      case 'week':
        from.setDate(today.getDate() - 7);
        break;
      case 'month':
        from.setMonth(today.getMonth() - 1);
        break;
      case 'quarter':
        from.setMonth(today.getMonth() - 3);
        break;
      case 'year':
        from.setFullYear(today.getFullYear() - 1);
        break;
    }

    const fromStr = from.toISOString().split('T')[0];
    const toStr = today.toISOString().split('T')[0];

    setFromDate(fromStr);
    setToDate(toStr);
    onApply({ from: fromStr, to: toStr });
    setIsActive(true);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-gray-600" />
          <h3 className="font-medium text-gray-900">{label}</h3>
        </div>
        {isActive && (
          <button
            onClick={handleClear}
            className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <button
          onClick={() => getQuickDateRange('week')}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          Last Week
        </button>
        <button
          onClick={() => getQuickDateRange('month')}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          Last Month
        </button>
        <button
          onClick={() => getQuickDateRange('quarter')}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          Last Quarter
        </button>
        <button
          onClick={() => getQuickDateRange('year')}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          Last Year
        </button>
      </div>

      <button
        onClick={handleApply}
        disabled={!fromDate || !toDate}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium"
      >
        Apply Date Range
      </button>
    </div>
  );
}
