import React, { TableHTMLAttributes, HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes, forwardRef } from 'react';

export const TableContainer = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`w-full overflow-hidden bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm transition-colors ${className}`}
        {...props}
      >
        <div className="overflow-x-auto">{children}</div>
      </div>
    );
  }
);
TableContainer.displayName = 'TableContainer';

export const Table = forwardRef<HTMLTableElement, TableHTMLAttributes<HTMLTableElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <table ref={ref} className={`w-full text-left border-collapse ${className}`} {...props}>
        {children}
      </table>
    );
  }
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={`bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-800 ${className}`}
        {...props}
      >
        {children}
      </thead>
    );
  }
);
TableHeader.displayName = 'TableHeader';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 select-none ${className}`}
        {...props}
      >
        {children}
      </th>
    );
  }
);
TableHead.displayName = 'TableHead';

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={`divide-y divide-gray-100 dark:divide-slate-800 ${className}`}
        {...props}
      >
        {children}
      </tbody>
    );
  }
);
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={`hover:bg-gray-50/80 dark:hover:bg-slate-800/40 transition-colors duration-150 ${className}`}
        {...props}
      >
        {children}
      </tr>
    );
  }
);
TableRow.displayName = 'TableRow';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`px-4 py-3.5 text-sm text-gray-700 dark:text-slate-300 align-middle ${className}`}
        {...props}
      >
        {children}
      </td>
    );
  }
);
TableCell.displayName = 'TableCell';
