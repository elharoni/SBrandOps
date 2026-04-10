import React, { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, Cell } from 'recharts';
import { AdsDashboardData, AdPlatform, AdCampaign, CampaignGoal } from '../../types';

const MetricCard: React.FC<{ title: string; value: string; icon: string; }> = ({ title, value, icon }) => (
    <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
                <p className="text-3xl font-bold text-light-text dark:text-dark-text mt-1">{value}</p>
            </div>
            <i className={`fas ${icon} text-2xl text-brand-pink`}></i>
        </div>
    </div>
);

const platformColors: { [key in AdPlatform]: string } = {
    [AdPlatform.Meta]: '#3b82f6',
    [AdPlatform.TikTok]: '#000000',
    [AdPlatform.Google]: '#ef4444',
};

export const AdsDashboard: React.FC<{ data: AdsDashboardData; campaigns: AdCampaign[] }> = ({ data, campaigns }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        if (data.performanceOverTime.length > 0) {
            setStartDate(data.performanceOverTime[0].date);
            setEndDate(data.performanceOverTime[data.performanceOverTime.length - 1].date);
        }
    }, [data.performanceOverTime]);
    
    const filteredPerformanceData = useMemo(() => {
        if (!startDate || !endDate) {
            return data.performanceOverTime;
        }
        return data.performanceOverTime.filter(item => {
            // No need to create new Date objects for string comparison
            return item.date >= startDate && item.date <= endDate;
        });
    }, [data.performanceOverTime, startDate, endDate]);

    const performanceByGoal = useMemo(() => {
        const groupedData: Record<string, { spend: number; impressions: number; roasValues: number[] }> = {};

        for (const campaign of campaigns) {
            if (!groupedData[campaign.goal]) {
                groupedData[campaign.goal] = { spend: 0, impressions: 0, roasValues: [] };
            }
            groupedData[campaign.goal].spend += campaign.metrics.spend;
            groupedData[campaign.goal].impressions += campaign.metrics.impressions;
            groupedData[campaign.goal].roasValues.push(campaign.metrics.roas);
        }

        return Object.entries(groupedData).map(([goal, metrics]) => ({
            goal: goal as CampaignGoal,
            spend: metrics.spend,
            impressions: metrics.impressions,
            avgRoas: metrics.roasValues.length > 0 ? (metrics.roasValues.reduce((a, b) => a + b, 0) / metrics.roasValues.length).toFixed(2) : 'N/A',
        }));
    }, [campaigns]);

    const roasByPlatform = useMemo(() => {
        const groupedData: Record<string, { roasValues: number[] }> = {};
        for (const campaign of campaigns) {
            if (!groupedData[campaign.platform]) {
                groupedData[campaign.platform] = { roasValues: [] };
            }
            groupedData[campaign.platform].roasValues.push(campaign.metrics.roas);
        }

        return Object.entries(groupedData).map(([platform, metrics]) => ({
            platform: platform as AdPlatform,
            avgRoas: metrics.roasValues.length > 0 ? parseFloat((metrics.roasValues.reduce((a, b) => a + b, 0) / metrics.roasValues.length).toFixed(2)) : 0,
        }));
    }, [campaigns]);

    const formatDate = (tickItem: string) => {
        const date = new Date(tickItem);
        return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard title="إجمالي الإنفاق" value={`$${data.overallMetrics.totalSpend.toLocaleString()}`} icon="fa-dollar-sign" />
                <MetricCard title="عائد الإنفاق (ROAS)" value={`${data.overallMetrics.overallRoas}x`} icon="fa-chart-line" />
                <MetricCard title="إجمالي الظهور" value={data.overallMetrics.totalImpressions.toLocaleString()} icon="fa-eye" />
                <MetricCard title="إجمالي التحويلات" value={data.overallMetrics.totalConversions.toLocaleString()} icon="fa-crosshairs" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4">الإنفاق حسب المنصة</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={data.spendByPlatform} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis type="number" stroke="var(--color-text-secondary)" fontSize={12} />
                            <YAxis type="category" dataKey="platform" stroke="var(--color-text-secondary)" fontSize={12} width={80} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                            <Bar dataKey="spend" name="الإنفاق" fill="#e024a3" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="font-bold text-light-text dark:text-dark-text">الأداء خلال الوقت</h3>
                         <div className="flex items-center gap-2">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-sm p-1 text-light-text-secondary dark:text-dark-text-secondary" style={{ colorScheme: 'dark' }}/>
                            <span className="text-light-text-secondary dark:text-dark-text-secondary text-sm">إلى</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md text-sm p-1 text-light-text-secondary dark:text-dark-text-secondary" style={{ colorScheme: 'dark' }}/>
                         </div>
                    </div>
                     <ResponsiveContainer width="100%" height={260}>
                        <LineChart data={filteredPerformanceData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={formatDate} />
                            <YAxis yAxisId="left" stroke="#e024a3" fontSize={12} />
                            <YAxis yAxisId="right" orientation="right" stroke="#7c3aed" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Line yAxisId="left" type="monotone" dataKey="spend" name="الإنفاق" stroke="#e024a3" />
                            <Line yAxisId="right" type="monotone" dataKey="roas" name="ROAS" stroke="#7c3aed" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4">أداء الحملات حسب الهدف</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-light-text-secondary dark:text-dark-text-secondary">
                             <thead className="text-xs uppercase bg-light-bg dark:bg-dark-bg">
                                <tr>
                                    <th scope="col" className="px-4 py-2">الهدف</th>
                                    <th scope="col" className="px-4 py-2">إجمالي الإنفاق</th>
                                    <th scope="col" className="px-4 py-2">إجمالي الظهور</th>
                                    <th scope="col" className="px-4 py-2">متوسط ROAS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {performanceByGoal.map(item => (
                                    <tr key={item.goal} className="border-b border-light-border dark:border-dark-border">
                                        <td className="px-4 py-2 font-semibold text-light-text dark:text-dark-text">{item.goal}</td>
                                        <td className="px-4 py-2">${item.spend.toLocaleString()}</td>
                                        <td className="px-4 py-2">{item.impressions.toLocaleString()}</td>
                                        <td className="px-4 py-2 font-bold text-light-text dark:text-dark-text">{item.avgRoas}x</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                 <div className="bg-light-card dark:bg-dark-card p-5 rounded-lg border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-4">مقارنة ROAS عبر المنصات</h3>
                     <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={roasByPlatform}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="platform" stroke="var(--color-text-secondary)" fontSize={12} />
                            <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }} />
                            <Bar dataKey="avgRoas" name="متوسط ROAS" >
                                {roasByPlatform.map((entry) => (
                                    <Cell key={`cell-${entry.platform}`} fill={platformColors[entry.platform]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};