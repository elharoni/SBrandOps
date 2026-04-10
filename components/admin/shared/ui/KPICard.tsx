// components/admin/shared/ui/KPICard.tsx
import React from 'react';

interface KPICardProps {
  title: string;
  value: string;
  icon: string;
  trendValue: string;
  isPositive: boolean;
  onClick: () => void;
}

export const KPICard: React.FC<KPICardProps> = ({ title, value, icon, trendValue, isPositive, onClick }) => {
  return (
    <button
      onClick={onClick}
      className="w-full text-right bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border hover:border-primary dark:hover:border-primary transition-colors cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <i className={`fas ${icon} text-2xl text-primary`}></i>
        <div className="flex items-center gap-1">
            <span className={`font-bold text-xs ${isPositive ? 'text-success' : 'text-danger'}`}>
                <i className={`fas ${isPositive ? 'fa-arrow-up' : 'fa-arrow-down'} text-xs me-1`}></i>
                {trendValue}
            </span>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-bold text-light-text dark:text-dark-text">{value}</p>
        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
      </div>
    </button>
  );
};
