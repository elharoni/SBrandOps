import React, { useMemo } from 'react';

interface LineSeries {
    key: string;
    label: string;
    color: string;
}

interface LightweightLineChartProps {
    data: Array<Record<string, string | number>>;
    xKey: string;
    series: LineSeries[];
    height?: number;
    formatX?: (value: string | number, index: number) => string;
}

export const LightweightLineChart: React.FC<LightweightLineChartProps> = ({
    data,
    xKey,
    series,
    height = 320,
    formatX,
}) => {
    const chart = useMemo(() => {
        const width = 720;
        const chartHeight = height;
        const padding = { top: 18, right: 18, bottom: 38, left: 18 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = chartHeight - padding.top - padding.bottom;

        const values = data.flatMap((point) =>
            series.map((item) => Number(point[item.key] ?? 0))
        );
        const maxValue = Math.max(...values, 1);
        const safeMax = maxValue * 1.1;

        const projectX = (index: number) => {
            if (data.length <= 1) return padding.left;
            return padding.left + ((innerWidth * index) / (data.length - 1));
        };

        const projectY = (value: number) =>
            padding.top + innerHeight - ((value / safeMax) * innerHeight);

        const seriesPaths = series.map((item) => ({
            ...item,
            path: data
                .map((point, index) => {
                    const x = projectX(index);
                    const y = projectY(Number(point[item.key] ?? 0));
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                })
                .join(' '),
        }));

        const ticks = Array.from({ length: 4 }, (_, index) => {
            const value = (safeMax / 3) * index;
            return {
                label: Math.round(safeMax - value).toLocaleString(),
                y: padding.top + (innerHeight / 3) * index,
            };
        });

        const xTicks = data.length <= 6
            ? data.map((point, index) => ({
                x: projectX(index),
                label: formatX ? formatX(point[xKey] ?? '', index) : String(point[xKey] ?? ''),
            }))
            : [0, Math.floor((data.length - 1) / 2), data.length - 1].map((index) => ({
                x: projectX(index),
                label: formatX ? formatX(data[index]?.[xKey] ?? '', index) : String(data[index]?.[xKey] ?? ''),
            }));

        return { width, chartHeight, padding, innerWidth, innerHeight, seriesPaths, ticks, xTicks };
    }, [data, formatX, height, series, xKey]);

    if (data.length === 0) {
        return <div className="flex h-full items-center justify-center text-sm text-light-text-secondary dark:text-dark-text-secondary">No data</div>;
    }

    return (
        <div className="h-full w-full">
            <svg viewBox={`0 0 ${chart.width} ${chart.chartHeight}`} className="h-full w-full" role="img" aria-label="Line chart">
                {chart.ticks.map((tick) => (
                    <g key={tick.y}>
                        <line
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={tick.y}
                            y2={tick.y}
                            stroke="var(--color-border)"
                            strokeDasharray="4 6"
                        />
                        <text
                            x={chart.width - chart.padding.right}
                            y={tick.y - 6}
                            textAnchor="end"
                            fontSize="11"
                            fill="var(--color-text-secondary)"
                        >
                            {tick.label}
                        </text>
                    </g>
                ))}

                {chart.seriesPaths.map((item) => (
                    <path
                        key={item.key}
                        d={item.path}
                        fill="none"
                        stroke={item.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ))}

                {chart.xTicks.map((tick) => (
                    <text
                        key={`${tick.x}-${tick.label}`}
                        x={tick.x}
                        y={chart.chartHeight - 10}
                        textAnchor="middle"
                        fontSize="11"
                        fill="var(--color-text-secondary)"
                    >
                        {tick.label}
                    </text>
                ))}
            </svg>

            <div className="mt-4 flex flex-wrap gap-4">
                {series.map((item) => (
                    <div key={item.key} className="inline-flex items-center gap-2 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface DonutSegment {
    label: string;
    value: number;
    color: string;
}

interface DonutBreakdownProps {
    segments: DonutSegment[];
    centerLabel?: string;
}

export const DonutBreakdown: React.FC<DonutBreakdownProps> = ({ segments, centerLabel }) => {
    const total = Math.max(segments.reduce((sum, segment) => sum + segment.value, 0), 1);
    const gradient = useMemo(() => {
        let offset = 0;
        return `conic-gradient(${segments
            .map((segment) => {
                const start = (offset / total) * 360;
                offset += segment.value;
                const end = (offset / total) * 360;
                return `${segment.color} ${start}deg ${end}deg`;
            })
            .join(', ')})`;
    }, [segments, total]);

    return (
        <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full" style={{ background: gradient }}>
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-light-card text-center dark:bg-dark-card">
                    <span className="text-2xl font-bold text-light-text dark:text-dark-text">{total}%</span>
                    {centerLabel && <span className="text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{centerLabel}</span>}
                </div>
            </div>

            <div className="grid w-full gap-2">
                {segments.map((segment) => (
                    <div key={segment.label} className="flex items-center justify-between text-xs">
                        <div className="inline-flex items-center gap-2 text-light-text-secondary dark:text-dark-text-secondary">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                            <span>{segment.label}</span>
                        </div>
                        <span className="font-semibold text-light-text dark:text-dark-text">{segment.value}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface MetricBarItem {
    label: string;
    value: number;
    color?: string;
    suffix?: string;
}

interface MetricBarListProps {
    items: MetricBarItem[];
    maxValue?: number;
}

export const MetricBarList: React.FC<MetricBarListProps> = ({ items, maxValue }) => {
    const safeMax = maxValue ?? Math.max(...items.map((item) => item.value), 1);

    return (
        <div className="space-y-3">
            {items.map((item) => {
                const width = `${Math.max((item.value / safeMax) * 100, 6)}%`;
                return (
                    <div key={item.label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-light-text dark:text-dark-text">{item.label}</span>
                            <span className="text-light-text-secondary dark:text-dark-text-secondary">
                                {item.value}
                                {item.suffix ?? ''}
                            </span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                            <div
                                className="h-full rounded-full"
                                style={{ width, backgroundColor: item.color ?? 'var(--color-primary)' }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
