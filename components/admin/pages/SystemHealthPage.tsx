// components/admin/pages/SystemHealthPage.tsx
import React from 'react';
import { SystemHealthStatus } from '../../../types';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';

interface SystemHealthPageProps {
    healthData: SystemHealthStatus[];
    isLoading: boolean;
}

const StatusIndicator: React.FC<{ status: 'ok' | 'degraded' | 'down' }> = ({ status }) => {
    const config = {
        ok: { text: 'Operational', color: 'bg-success' },
        degraded: { text: 'Degraded Performance', color: 'bg-warning' },
        down: { text: 'Major Outage', color: 'bg-danger' },
    };

    return (
        <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${config[status].color}`}></div>
            <span className="font-semibold">{config[status].text}</span>
        </div>
    );
};

const PageSkeleton: React.FC = () => (
     <div className="space-y-6 animate-pulse">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-16" />
        <div className="space-y-4">
            <SkeletonLoader className="h-24" />
            <SkeletonLoader className="h-24" />
            <SkeletonLoader className="h-24" />
            <SkeletonLoader className="h-24" />
        </div>
    </div>
);

export const SystemHealthPage: React.FC<SystemHealthPageProps> = ({ healthData, isLoading }) => {

    if (isLoading && healthData.length === 0) {
        return <PageSkeleton />;
    }

    const overallStatus = healthData.every(s => s.status === 'ok') 
        ? 'All systems operational.' 
        : 'Some systems are experiencing issues.';
    const overallColor = overallStatus.startsWith('All') ? 'border-success' : 'border-warning';

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">حالة النظام</h1>
            
            <div className={`p-4 rounded-lg border-l-4 ${overallColor} bg-light-card dark:bg-dark-card`}>
                <h2 className="font-bold text-light-text dark:text-dark-text">{overallStatus}</h2>
            </div>
            
            <div className="space-y-4">
                {healthData.map(service => (
                    <div key={service.service} className="bg-light-card dark:bg-dark-card p-4 rounded-lg border border-light-border dark:border-dark-border">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">{service.service}</h3>
                            <StatusIndicator status={service.status} />
                        </div>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2 pt-2 border-t border-light-border dark:border-dark-border">
                            {service.details}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
};