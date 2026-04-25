import React from 'react';

interface PageStat {
    label: string;
    value: string;
    tone?: string;
    icon?: string;
}

interface PageScaffoldProps {
    kicker?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
    stats?: PageStat[];
    children: React.ReactNode;
}

export const PageScaffold: React.FC<PageScaffoldProps> = ({
    kicker,
    title,
    actions,
    stats = [],
    children,
}) => (
    <div className="space-y-4 animate-fade-in">
        <div className="surface-panel rounded-2xl px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-3">
                {/* Kicker + Title */}
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    {kicker && (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/8 px-2.5 py-1 dark:border-brand-primary/25 dark:bg-brand-primary/12">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
                            <span className="text-[0.62rem] font-bold uppercase tracking-[0.2em] text-brand-primary">{kicker}</span>
                        </span>
                    )}
                    <h1 className="truncate text-sm font-bold text-light-text dark:text-dark-text">{title}</h1>
                </div>

                {/* Stat chips */}
                {stats.length > 0 && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {stats.map((stat) => (
                            <div
                                key={`${stat.label}-${stat.value}`}
                                className="flex items-center gap-1.5 rounded-full border border-light-border/60 bg-light-bg/70 px-3 py-1 dark:border-dark-border/60 dark:bg-dark-bg/50"
                            >
                                {stat.icon && (
                                    <i className={`fa-solid ${stat.icon} text-[0.6rem] text-brand-primary`} />
                                )}
                                <span className="text-[0.65rem] text-light-text-secondary dark:text-dark-text-secondary">{stat.label}</span>
                                <span className="text-[0.6rem] text-light-text-secondary dark:text-dark-text-secondary opacity-40">·</span>
                                <span className={`text-[0.65rem] font-bold ${stat.tone ?? 'text-light-text dark:text-dark-text'}`}>{stat.value}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
            </div>
        </div>

        {children}
    </div>
);

interface PageSectionProps {
    title?: string;
    description?: string;
    actions?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export const PageSection: React.FC<PageSectionProps> = ({
    title,
    description,
    actions,
    className = '',
    children,
}) => (
    <section className={`surface-panel rounded-[1.75rem] p-5 md:p-6 ${className}`}>
        {(title || actions) && (
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    {title && <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">{title}</h2>}
                    {description && <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">{description}</p>}
                </div>
                {actions}
            </div>
        )}
        {children}
    </section>
);
