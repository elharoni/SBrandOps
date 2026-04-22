import React from 'react';

interface SectionErrorProps {
    message?: string;
    detail?: string;
    onRetry?: () => void;
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
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 text-sm">
                <i className="fas fa-exclamation-circle flex-shrink-0 text-sm" />
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
        <div className="flex flex-col items-center justify-center min-h-[180px] p-6 rounded-xl bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border gap-3 text-center">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                <i className="fas fa-cloud-slash text-red-500 text-lg" />
            </div>
            <div>
                <p className="text-light-text dark:text-dark-text font-medium">{message}</p>
                {detail && import.meta.env.DEV && (
                    <p className="text-light-text-secondary dark:text-dark-text-secondary text-xs mt-1 font-mono">{detail}</p>
                )}
            </div>
            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-light-text-secondary dark:text-dark-text-secondary text-sm hover:text-light-text dark:hover:text-dark-text transition-colors"
                >
                    <i className="fas fa-rotate-right text-sm" />
                    إعادة المحاولة
                </button>
            )}
        </div>
    );
}
