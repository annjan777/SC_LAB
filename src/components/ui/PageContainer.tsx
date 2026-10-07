import React, { ReactNode } from 'react';

export interface PageContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full';
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = '',
  maxWidth = '7xl',
}) => {
  const maxWMap = {
    '5xl': 'max-w-5xl',
    '6xl': 'max-w-6xl',
    '7xl': 'max-w-7xl',
    full: 'max-w-full',
  }[maxWidth];

  return (
    <div className={`w-full ${maxWMap} mx-auto space-y-6 ${className}`}>
      {children}
    </div>
  );
};
