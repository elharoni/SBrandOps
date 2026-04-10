/**
 * components/shared/SectionError.tsx
 *
 * Displays a section-level error — used when a specific part of the page
 * fails to load (not a full crash). Allows retry without full page refresh.
 *
 * Usage:
 *   const { data, isLoading, error, refetch } = useQuery(...)
 *   if (error) return <SectionError message="تعذّر تحميل التحليلات" onRetry={refetch} />
 */

import React from 'react';

interface SectionErrorProps {
    /** Arabic error message shown to the user */
    message?: string;
    /** Optional technical detail (shown only in dev) */
    detail?: string;
    /** Callback to retry the failed operation */
    onRetry?: () => void;
    /** Compact mode for use inside cards */
    compact?: boolean;
}

export function SectionError({
    message = 'تعذّر تحميل البيانات',
    detail,
    onRetry,
    compact = false,
}: SectionErrorProps) {
    if (compact) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-error-container/15 text-error text-sm">
                <span className="material-symbols-outlined text-base">error_outline</span>
                <span>{message}</span>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="mr-auto text-xs underline hover:no-underline"
                    >
                        إعادة المحاولة
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-[180px] p-6 rounded-xl bg-surface-high gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-error-container/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-error text-xl">cloud_off</span>
            </div>
            <div>
                <p className="text-on-surface font-medium">{message}</p>
                {detail && import.meta.env.DEV && (
                    <p className="text-on-surface-variant text-xs mt-1 font-mono">{detail}</p>
                )}
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-highest text-on-surface-variant text-sm hover:text-on-surface transition-colors"
                >
                    <span className="material-symbols-outlined text-base">refresh</span>
                    إعادة المحاولة
                </button>
            )}
        </div>
    );
}

/**
 * Empty state component — shown when data loaded successfully but is empty.
 */
interface EmptyStateProps {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: string; // material symbol name
}

export function EmptyState({
    title,
    description,
    actionLabel,
    onAction,
    icon = 'inbox',
}: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[220px] p-8 rounded-xl bg-surface-high gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-primary-container/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
            </div>
            <div>
                <p className="text-on-surface font-semibold">{title}</p>
                {description && (
                    <p className="text-on-surface-variant text-sm mt-1">{description}</p>
                )}
            </div>
            {actionLabel && onAction && (
                <button
                    onClick={onAction}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-container text-on-primary text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    <span className="material-symbols-outlined text-base">add</span>
                    {actionLabel}
                </button>
            )}
        </div>
    );
}
