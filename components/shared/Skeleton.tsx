/**
 * Skeleton Loading Components
 * مكونات التحميل المؤقتة
 */

import React from 'react';

/* ─── Base pulse class ─── */
const pulse = 'animate-pulse bg-dark-border rounded';

/* ─── Primitives ─── */
export const SkeletonLine: React.FC<{ width?: string; height?: string; className?: string }> = ({
    width = 'w-full', height = 'h-4', className = '',
}) => (
    <div className={`${pulse} ${width} ${height} ${className}`} />
);

export const SkeletonCircle: React.FC<{ size?: string; className?: string }> = ({
    size = 'w-10 h-10', className = '',
}) => (
    <div className={`${pulse} rounded-full ${size} ${className}`} />
);

export const SkeletonCard: React.FC<{ className?: string; children?: React.ReactNode }> = ({
    className = '', children,
}) => (
    <div className={`bg-dark-card border border-dark-border rounded-xl p-5 ${className}`}>
        {children ?? (
            <div className="space-y-3">
                <SkeletonLine width="w-1/3" height="h-3" />
                <SkeletonLine width="w-full" height="h-5" />
                <SkeletonLine width="w-2/3" height="h-3" />
            </div>
        )}
    </div>
);

/* ─── Page-level skeletons ─── */

/** Stats row: 4 KPI cards */
export const SkeletonStatsRow: React.FC<{ count?: number }> = ({ count = 4 }) => (
    <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4`}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i}>
                <div className="flex items-center gap-3">
                    <SkeletonCircle size="w-10 h-10" />
                    <div className="flex-1 space-y-2">
                        <SkeletonLine width="w-1/2" height="h-3" />
                        <SkeletonLine width="w-3/4" height="h-6" />
                    </div>
                </div>
            </SkeletonCard>
        ))}
    </div>
);

/** Generic table skeleton */
export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
    rows = 5, cols = 4,
}) => (
    <div className="bg-dark-card border border-dark-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex gap-4 px-4 py-3 border-b border-dark-border">
            {Array.from({ length: cols }).map((_, i) => (
                <SkeletonLine key={i} width={i === 0 ? 'w-2/5' : 'flex-1'} height="h-3" />
            ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4 px-4 py-4 border-b border-dark-border last:border-0">
                {Array.from({ length: cols }).map((_, c) => (
                    <SkeletonLine
                        key={c}
                        width={c === 0 ? 'w-2/5' : 'flex-1'}
                        height="h-4"
                        className={c === 0 ? '' : 'opacity-60'}
                    />
                ))}
            </div>
        ))}
    </div>
);

/** Card grid skeleton */
export const SkeletonCardGrid: React.FC<{ count?: number; cols?: number }> = ({
    count = 6, cols = 3,
}) => (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${cols} gap-4`}>
        {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i}>
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <SkeletonCircle size="w-10 h-10" />
                        <div className="flex-1 space-y-2">
                            <SkeletonLine width="w-2/3" height="h-4" />
                            <SkeletonLine width="w-1/2" height="h-3" />
                        </div>
                    </div>
                    <SkeletonLine height="h-3" />
                    <SkeletonLine width="w-4/5" height="h-3" />
                    <SkeletonLine width="w-1/3" height="h-8" />
                </div>
            </SkeletonCard>
        ))}
    </div>
);

/** Full page loading overlay */
export const SkeletonPageLoader: React.FC<{ label?: string }> = ({ label = 'جاري التحميل...' }) => (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-text-secondary text-sm">{label}</p>
    </div>
);

/** Dashboard skeleton */
export const SkeletonDashboard: React.FC = () => (
    <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
            <SkeletonLine width="w-48" height="h-7" />
            <SkeletonLine width="w-24" height="h-9" />
        </div>
        <SkeletonStatsRow count={4} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
                <SkeletonCard className="h-64">
                    <SkeletonLine width="w-1/4" height="h-4" className="mb-4" />
                    <div className="flex items-end gap-2 h-40">
                        {[60, 40, 75, 50, 90, 65, 80].map((h, i) => (
                            <div key={i} className={`${pulse} flex-1 rounded-t`} style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </SkeletonCard>
            </div>
            <div className="space-y-4">
                {[1, 2, 3].map(i => (
                    <SkeletonCard key={i}>
                        <div className="flex gap-3 items-center">
                            <SkeletonCircle size="w-8 h-8" />
                            <div className="flex-1 space-y-2">
                                <SkeletonLine height="h-3" />
                                <SkeletonLine width="w-2/3" height="h-3" />
                            </div>
                        </div>
                    </SkeletonCard>
                ))}
            </div>
        </div>
    </div>
);

/** Analytics skeleton */
export const SkeletonAnalytics: React.FC = () => (
    <div className="space-y-6 p-6">
        <SkeletonStatsRow count={5} />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
                <SkeletonCard key={i} className="h-56">
                    <SkeletonLine width="w-1/3" height="h-4" className="mb-4" />
                    <div className="flex items-end gap-2 h-36">
                        {[40, 70, 55, 80, 45, 90, 60].map((h, j) => (
                            <div key={j} className={`${pulse} flex-1 rounded-t`} style={{ height: `${h}%` }} />
                        ))}
                    </div>
                </SkeletonCard>
            ))}
        </div>
    </div>
);

/** Inbox skeleton */
export const SkeletonInbox: React.FC = () => (
    <div className="flex h-full">
        <div className="w-80 border-r border-dark-border p-4 space-y-3">
            <SkeletonLine height="h-10" className="mb-4" />
            {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-lg bg-dark-card">
                    <SkeletonCircle size="w-10 h-10" />
                    <div className="flex-1 space-y-2">
                        <SkeletonLine width="w-2/3" height="h-3" />
                        <SkeletonLine height="h-3" />
                        <SkeletonLine width="w-1/3" height="h-2" />
                    </div>
                </div>
            ))}
        </div>
        <div className="flex-1 p-6 space-y-4">
            <SkeletonLine width="w-1/4" height="h-6" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                    <SkeletonCircle size="w-8 h-8" />
                    <SkeletonCard className={`max-w-xs ${i % 2 === 0 ? '' : 'bg-brand-primary/10'}`}>
                        <SkeletonLine height="h-3" />
                        <SkeletonLine width="w-3/4" height="h-3" className="mt-1" />
                    </SkeletonCard>
                </div>
            ))}
        </div>
    </div>
);
