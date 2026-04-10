// components/admin/shared/ui/SkeletonLoader.tsx
import React from 'react';

interface SkeletonLoaderProps {
  className?: string;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({ className }) => {
  return (
    <div className={`bg-light-card dark:bg-dark-card/50 border border-light-border dark:border-dark-border rounded-lg ${className}`}></div>
  );
};
