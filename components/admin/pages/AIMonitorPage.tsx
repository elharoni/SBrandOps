// components/admin/pages/AIMonitorPage.tsx
import React, { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AIMetric } from '../../../types';
import { TableComponent, ColumnDefinition } from '../shared/ui/TableComponent';
import { ChartContainer } from '../shared/ui/ChartContainer';
import { SkeletonLoader } from '../shared/ui/SkeletonLoader';


interface AIMonitorPageProps {
    metrics: AIMetric[];
    isLoading: boolean;
}

const MetricCard: React.FC<{ title: string; value: string; icon: string; }> = ({ title, value, icon }) => (
    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
                <p className="text-3xl font-bold text-light-text dark:text-dark-text mt-1">{value}</p>
            </div>
            <i className={`fas ${icon} text-2xl text-primary`}></i>
        </div>
    </div>
);

const PageSkeleton: React.FC = () => (
    <div className="space-y-6 animate-pulse">
        <SkeletonLoader className="h-10 w-64" />
        <SkeletonLoader className="h-8 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SkeletonLoader className="h-28" />
            <SkeletonLoader className="h-28" />
            <SkeletonLoader className="h-28" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonLoader className="h-80" />
            <SkeletonLoader className="h-80" />
        </div>
        <SkeletonLoader className="h-96" />
    </div>
);


export const AIMonitorPage: React.FC<AIMonitorPageProps> = ({ metrics, isLoading }) => {
    
    const overallStats = useMemo(() => {
        if (metrics.length === 0) return { totalTokens: 0, avgLatency: '0', estimatedCost: 0 };
        const totalTokens = metrics.reduce((sum, m) => sum + m.tokens, 0);
        const totalLatency = metrics.reduce((sum, m) => sum + m.latency, 0);
        const avgLatency = (totalLatency / metrics.length).toFixed(0);
        const estimatedCost = (totalTokens / 1_000_000) * 0.5; // Example: $0.50 per 1M tokens
        return { totalTokens, avgLatency, estimatedCost };
    }, [metrics]);

    const tokensByFeature = useMemo(() => {
        const featureMap = new Map<string, number>();
        metrics.forEach(m => {
            featureMap.set(m.feature, (featureMap.get(m.feature) || 0) + m.tokens);
        });
        return Array.from(featureMap.entries()).map(([name, tokens]) => ({ name, tokens }));
    }, [metrics]);

    const tokensOverTime = useMemo(() => {
        const dateMap = new Map<string, number>();
        metrics.forEach(m => {
            const date = new Date(m.timestamp).toISOString().split('T')[0];
            dateMap.set(date, (dateMap.get(date) || 0) + m.tokens);
        });
        return Array.from(dateMap.entries())
            .map(([date, tokens]) => ({ date, tokens }))
            .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [metrics]);

    const tableMetrics = useMemo(() => metrics.map(m => ({ ...m, id: m.timestamp + m.feature + Math.random() })), [metrics]);

    const columns = useMemo<ColumnDefinition<typeof tableMetrics[0]>[]>(() => [
        { header: 'Timestamp', accessor: 'timestamp', isSortable: true, cell: (item) => new Date(item.timestamp).toLocaleString() },
        { header: 'Feature', accessor: 'feature', isSortable: true },
        { header: 'Tokens', accessor: 'tokens', isSortable: true },
        { header: 'Latency (ms)', accessor: 'latency', isSortable: true },
    ], []);

    if (isLoading && metrics.length === 0) {
        return <PageSkeleton />;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-light-text dark:text-dark-text">مراقبة استخدام AI</h1>
            <p className="text-light-text-secondary dark:text-dark-text-secondary">
                نظرة عامة على استهلاك موارد Gemini API عبر المنصة.
            </p>

             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MetricCard title="إجمالي التوكنز (30 يوم)" value={overallStats.totalTokens.toLocaleString()} icon="fa-coins" />
                <MetricCard title="متوسط زمن الاستجابة" value={`${overallStats.avgLatency}ms`} icon="fa-stopwatch" />
                <MetricCard title="التكلفة التقديرية (30 يوم)" value={`$${overallStats.estimatedCost.toFixed(2)}`} icon="fa-dollar-sign" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <ChartContainer title="استخدام التوكنز حسب الميزة">
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={tokensByFeature} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis type="number" stroke="var(--color-text-secondary)" fontSize={12} />
                            <YAxis type="category" dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} width={120} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }} />
                            <Bar dataKey="tokens" name="Tokens" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartContainer>
                <ChartContainer title="استخدام التوكنز عبر الزمن">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={tokensOverTime}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={(tick) => new Date(tick).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })} />
                            <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)' }} />
                            <Line type="monotone" dataKey="tokens" name="Tokens" stroke="#82ca9d" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </div>
            
            <ChartContainer title="Detailed AI Usage Log">
                <TableComponent<AIMetric & { id: string }>
                    columns={columns}
                    data={tableMetrics}
                    filterColumn="feature"
                    filterPlaceholder="Filter by feature..."
                />
            </ChartContainer>
        </div>
    );
};