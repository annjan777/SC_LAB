import React from 'react';

export interface BrandLogoProps {
  variant?: 'sidebar' | 'mobile' | 'auth' | 'compact' | 'custom';
  className?: string;
  imgClassName?: string;
  alt?: string;
  onClick?: () => void;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'sidebar',
  className = '',
  imgClassName = '',
  alt = 'SC Lab Management Portal',
  onClick,
}) => {
  const variantStyles: Record<string, string> = {
    sidebar: 'brand-logo brand-logo-sidebar',
    mobile: 'brand-logo brand-logo-mobile',
    auth: 'brand-logo brand-logo-auth',
    compact: 'brand-logo h-8 max-h-8 w-auto',
    custom: 'brand-logo',
  };

  const containerStyles: Record<string, string> = {
    sidebar: 'brand-logo-container',
    mobile: 'flex items-center',
    auth: 'brand-logo-container mb-6',
    compact: 'flex items-center',
    custom: '',
  };

  return (
    <div
      className={`${containerStyles[variant] || ''} ${className}`}
      onClick={onClick}
    >
      <img
        src="/logo.png"
        alt={alt}
        className={`${variantStyles[variant] || 'brand-logo'} ${imgClassName}`}
        loading="eager"
      />
    </div>
  );
};
