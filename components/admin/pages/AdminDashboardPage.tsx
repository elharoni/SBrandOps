import React, { useMemo, useState } from 'react';
import { AdminDashboardStats, ActivityLog, AIInsight } from '../../../types';
import { KPICard } from '../shared/ui/KPICard';
import { ChartContainer } from '../shared/ui/ChartContainer';
import { EntityDrawer } from '../shared/ui/EntityDrawer';
import { useAIInsights } from '../../../hooks/admin/useAIInsights';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';
import { LightweightLineChart, MetricBarList } from '../../shared/LightweightCharts';

interface AdminDashboardPageProps {
    stats: AdminDashboardStats | null;
    activityLogs: ActivityLog[];
}

const AIInsightsSection: React.FC = () => {
    const { data: insights, isLoading } = useAIInsights();

    return (
        <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg border border-light-border dark:border-dark-border">
            <h3 className="font-bold text-light-text dark:text-dark-text text-base flex items-center gap-2">
                <i className="fas fa-brain text-primary"></i>
                AI Insights
            </h3>
            {isLoading && <p className="text-sm text-center p-4 text-light-text-secondary dark:text-dark-text-secondary">Generating insights...</p>}
            {insights && (
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-2">
                    💡 {insights[0]?.text}
                </p>
            )}
        </div>
    );
};

const LatestActivities: React.FC<{ logs: ActivityLog[] }> = ({ logs }) => (
     <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
        <h3 className="font-bold text-light-text dark:text-dark-text mb-4">Latest System Activities</h3>
        <div className="space-y-3">
            {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                        <i className="fas fa-user-shield text-light-text-secondary dark:text-dark-text-secondary"></i>
                    </div>
                    <div>
                        <p className="text-light-text dark:text-dark-text">
                            <span className="font-bold">{log.user.name}</span> {log.action}
                        </p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const DashboardSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <SkeletonLoader className="h-16" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SkeletonLoader className="h-28" />
            <SkeletonLoader className="h-28" />
            <SkeletonLoader className="h-28" />
            <SkeletonLoader className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader className="h-80" />
            <SkeletonLoader className="h-80" />
        </div>
        <SkeletonLoader className="h-64" />
    </div>
);

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ stats, activityLogs }) => {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerTitle, setDrawerTitle] = useState('');

    const handleCardClick = (title: string) => {
        setDrawerTitle(title);
        setDrawerOpen(true);
    };

    if (!stats) {
        return <DashboardSkeleton />;
    }

    const growthAndRevenue = useMemo(
        () => stats.userGrowth.map((entry, index) => ({
            ...entry,
            revenue: stats.revenueOverTime[index]?.revenue ?? 0,
        })),
        [stats.revenueOverTime, stats.userGrowth]
    );

    const tokenUsageByPlan = [
        { label: 'Basic', value: 1200000, color: '#2563eb' },
        { label: 'Pro', value: 8500000, color: '#8b5cf6' },
        { label: 'Agency', value: 4300000, color: '#10b981' },
    ];
    
    return (
        <div className="space-y-6">
            <AIInsightsSection />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <KPICard title="TOTAL TENANTS" value={stats.activeTenants.toLocaleString()} icon="fa-building" trendValue="+5 this month" isPositive onClick={() => handleCardClick("Total Tenants")} />
                <KPICard title="MONTHLY RECURRING" value={`$${stats.totalRevenue.toLocaleString()}`} icon="fa-dollar-sign" trendValue="+$1.2k" isPositive onClick={() => handleCardClick("MRR Details")} />
                <KPICard title="ACTIVE USERS" value={stats.totalUsers.toLocaleString()} icon="fa-users" trendValue="+11 this week" isPositive onClick={() => handleCardClick("Active Users")} />
                <KPICard title="AI TOKENS (24H)" value="1.2M" icon="fa-brain" trendValue="-5% vs yesterday" isPositive={false} onClick={() => handleCardClick("AI Token Usage")} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartContainer title="User Growth vs. Revenue (Last 30 Days)">
                    <div className="h-[300px]">
                        <LightweightLineChart
                            data={growthAndRevenue}
                            xKey="date"
                            formatX={(value) => new Date(String(value)).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}
                            series={[
                                { key: 'count', label: 'New Users', color: '#2563eb' },
                                { key: 'revenue', label: 'Revenue', color: '#10b981' },
                            ]}
                        />
                    </div>
                </ChartContainer>
                
                <ChartContainer title="AI Token Usage by Subscription Plan">
                    <div className="space-y-4">
                        <MetricBarList
                            items={tokenUsageByPlan.map((plan) => ({
                                ...plan,
                                suffix: '',
                            }))}
                            maxValue={Math.max(...tokenUsageByPlan.map((plan) => plan.value))}
                        />
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            {tokenUsageByPlan.map((plan) => (
                                <div key={plan.label} className="rounded-xl border border-light-border bg-light-bg px-3 py-2 dark:border-dark-border dark:bg-dark-bg">
                                    <div className="mb-1 flex items-center gap-2">
                                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: plan.color }} />
                                        <span className="font-medium text-light-text dark:text-dark-text">{plan.label}</span>
                                    </div>
                                    <p className="text-light-text-secondary dark:text-dark-text-secondary">
                                        {plan.value.toLocaleString()} tokens
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </ChartContainer>
            </div>
            
            <LatestActivities logs={activityLogs} />

            <EntityDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={drawerTitle}>
                <p>Detailed information and historical data for '{drawerTitle}' would be displayed here.</p>
            </EntityDrawer>
        </div>
    );
};
