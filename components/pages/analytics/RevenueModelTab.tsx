import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AnalyticsData } from '../../../types';
import { ATTRIBUTION_MODELS, buildRevenueModelData, CHANNEL_COLORS } from './analyticsHelpers';

interface RevenueModelTabProps {
    data: AnalyticsData;
}

export const RevenueModelTab: React.FC<RevenueModelTabProps> = ({ data }) => {
    const modelData = useMemo(() => buildRevenueModelData(), [data]);
    const [activeModel, setActiveModel] = useState<typeof ATTRIBUTION_MODELS[number]>('Linear');

    const totalByModel = ATTRIBUTION_MODELS.map((model) => ({
        model,
        total: modelData.reduce((sum, channel) => sum + Number(channel[model.replace(' ', '') as keyof typeof channel] ?? 0), 0),
    }));

    const modelColors: Record<string, string> = {
        'First Touch': '#3b82f6',
        'Last Touch': '#f59e0b',
        Linear: '#10b981',
        'Time Decay': '#8b5cf6',
    };

    const modelKey: Record<typeof ATTRIBUTION_MODELS[number], keyof (typeof modelData)[0]> = {
        'First Touch': 'firstTouch',
        'Last Touch': 'lastTouch',
        Linear: 'linear',
        'Time Decay': 'timeDecay',
    };

    return (
        <div className="space-y-6">
            <div className="bg-light-card dark:bg-dark-card p-5 rounded-2xl border border-light-border dark:border-dark-border">
                <h3 className="font-bold text-light-text dark:text-dark-text mb-4">مقارنة نماذج Attribution</h3>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {totalByModel.map(({ model, total }) => (
                        <button
                            key={model}
                            onClick={() => setActiveModel(model)}
                            className={`rounded-xl border-2 p-4 text-start transition-all ${
                                activeModel === model ? 'border-brand-primary bg-brand-primary/5' : 'border-light-border dark:border-dark-border hover:border-brand-primary/50'
                            }`}
                        >
                            <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{model}</p>
                            <p className="mt-1 text-xl font-bold" style={{ color: modelColors[model] }}>${total.toLocaleString()}</p>
                            <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">Total Attributed Revenue</p>
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-5 rounded-2xl border border-light-border dark:border-dark-border">
                <h3 className="mb-4 font-bold text-light-text dark:text-dark-text">
                    Revenue by Channel — <span style={{ color: modelColors[activeModel] }}>{activeModel} Attribution</span>
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={modelData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="channel" stroke="var(--color-text-secondary)" fontSize={12} />
                        <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                        <Tooltip
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Attributed Revenue']}
                            contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <Bar dataKey={modelKey[activeModel]} fill={modelColors[activeModel]} radius={[6, 6, 0, 0]}>
                            {modelData.map((entry, index) => (
                                <Cell key={index} fill={CHANNEL_COLORS[entry.channel] ?? modelColors[activeModel]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-light-card dark:bg-dark-card p-5 rounded-2xl border border-light-border dark:border-dark-border">
                <h3 className="font-bold text-light-text dark:text-dark-text mb-4">All Models Comparison</h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={modelData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="channel" stroke="var(--color-text-secondary)" fontSize={12} />
                        <YAxis stroke="var(--color-text-secondary)" fontSize={12} tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                        <Tooltip
                            formatter={(value: number, name: string) => [`$${value.toLocaleString()}`, name]}
                            contentStyle={{ backgroundColor: 'var(--color-card)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="firstTouch" name="First Touch" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="lastTouch" name="Last Touch" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="linear" name="Linear" fill="#10b981" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="timeDecay" name="Time Decay" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
