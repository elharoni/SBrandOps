import React from 'react';

interface PageStat {
    label: string;
    value: string;
    tone?: string;
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
    description,
    actions,
    stats = [],
    children,
}) => (
    <div className="space-y-6 animate-fade-in">
        <section className="surface-panel rounded-[2rem] bg-gradient-to-br from-brand-primary/8 via-light-card to-brand-secondary/10 p-5 md:p-6 dark:from-brand-primary/12 dark:via-dark-card dark:to-brand-secondary/8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                    {kicker && <p className="section-kicker">{kicker}</p>}
                    <h1 className="metric-emphasis mt-3 text-3xl font-bold text-light-text dark:text-dark-text md:text-4xl">{title}</h1>
                    {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>}
                </div>
                {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
            </div>

            {stats.length > 0 && (
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map((stat) => (
                        <div key={`${stat.label}-${stat.value}`} className="surface-panel-soft rounded-[1.35rem] px-4 py-3">
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{stat.label}</p>
                            <p className={`mt-1 text-2xl font-bold ${stat.tone ?? 'text-light-text dark:text-dark-text'}`}>{stat.value}</p>
                        </div>
                    ))}
                </div>
            )}
        </section>

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
