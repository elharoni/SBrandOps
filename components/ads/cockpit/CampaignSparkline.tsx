import React from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';

interface SparklinePoint {
    date:  string;
    cpa:   number | null;
    spend: number;
}

interface Props {
    data:       SparklinePoint[];
    targetCpa?: number | null;
    height?:    number;
}

const CampaignSparkline: React.FC<Props> = ({ data, targetCpa, height = 40 }) => {
    if (!data.length) {
        return (
            <div
                className="flex items-center justify-center text-xs text-gray-500 dark:text-gray-600"
                style={{ height }}
            >
                لا بيانات
            </div>
        );
    }

    const chartData = data.map(d => ({ date: d.date, cpa: d.cpa ?? 0, spend: d.spend }));

    return (
        <ResponsiveContainer width="100%" height={height}>
            <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                {targetCpa != null && (
                    <ReferenceLine y={targetCpa} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} />
                )}
                <Line
                    type="monotone"
                    dataKey="cpa"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                />
                <Tooltip
                    content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const cpa = payload[0]?.value;
                        return (
                            <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow">
                                <div className="text-gray-400">{label}</div>
                                <div>CPA: {cpa ? `${Number(cpa).toFixed(0)}` : '–'}</div>
                            </div>
                        );
                    }}
                />
            </LineChart>
        </ResponsiveContainer>
    );
};

export default CampaignSparkline;
