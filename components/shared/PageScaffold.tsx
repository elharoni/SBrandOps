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
    description,
    actions,
    stats = [],
    children,
}) => (
    <div className="space-y-6 animate-fade-in">
        <section className="surface-panel relative overflow-hidden rounded-[2rem] p-5 md:p-8">
            {/* Decorative ambient orbs */}
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-primary/10 blur-3xl dark:bg-brand-primary/15" />
            <div className="pointer-events-none absolute -bottom-14 -left-14 h-48 w-48 rounded-full bg-brand-secondary/8 blur-2xl dark:bg-brand-secondary/12" />
            {/* Subtle gradient wash */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-primary/4 via-transparent to-brand-secondary/4 dark:from-brand-primary/7 dark:to-brand-secondary/6" />

            <div className="relative z-10">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        {kicker && (
                            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/8 px-3 py-1 dark:border-brand-primary/30 dark:bg-brand-primary/12">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-primary" />
                                <span className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-brand-primary">{kicker}</span>
                            </div>
                        )}
                        <h1 className="metric-emphasis mt-1 text-3xl font-bold text-light-text dark:text-dark-text md:text-4xl">{title}</h1>
                        {description && (
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-light-text-secondary dark:text-dark-text-secondary">
                                {description}
                            </p>
                        )}
                    </div>
                    {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
                </div>

                {stats.length > 0 && (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {stats.map((stat) => (
                            <div
                                key={`${stat.label}-${stat.value}`}
                                className="surface-panel-soft group relative overflow-hidden rounded-[1.35rem] px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                            >
                                {stat.icon && (
                                    <div className="mb-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/10 dark:bg-brand-primary/15">
                                        <i className={`fa-solid ${stat.icon} text-sm text-brand-primary`} />
                                    </div>
                                )}
                                <p className="text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary">
                                    {stat.label}
                                </p>
                                <p className={`mt-0.5 text-xl font-bold ${stat.tone ?? 'text-light-text dark:text-dark-text'}`}>
                                    {stat.value}
                                </p>
                                <div className="pointer-events-none absolute -bottom-3 -right-3 h-12 w-12 rounded-full bg-brand-primary/5 dark:bg-brand-primary/8 transition-transform duration-300 group-hover:scale-150" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
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
