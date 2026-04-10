// components/admin/shared/ui/ChartContainer.tsx
import React from 'react';

interface ChartContainerProps {
    title: string;
    children: React.ReactNode;
}

export const ChartContainer: React.FC<ChartContainerProps> = ({ title, children }) => {
    return (
        <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
            <h3 className="font-bold text-light-text dark:text-dark-text mb-4">{title}</h3>
            {children}
        </div>
    );
};
