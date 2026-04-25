import React from 'react';
import { AnalyticsData } from '../../../types';

interface RevenueModelTabProps {
    data: AnalyticsData;
}

export const RevenueModelTab: React.FC<RevenueModelTabProps> = ({ data }) => {
    const ga4Revenue = data.connectedSources?.ga4?.revenue ?? 0;
    const hasGA4 = Boolean(data.connectedSources?.ga4);

    return (
        <div className="space-y-6">
            {/* GA4 revenue if connected */}
            {hasGA4 && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                            <i className="fas fa-dollar-sign text-green-500" /> GA4 Revenue
                        </p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">${Math.round(ga4Revenue).toLocaleString()}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{data.connectedSources?.ga4?.propertyName}</p>
                    </div>
                    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                            <i className="fas fa-mouse-pointer text-blue-500" /> Key Events
                        </p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">{(data.connectedSources?.ga4?.keyEvents ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">conversions / key events</p>
                    </div>
                    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-xl border border-light-border dark:border-dark-border">
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary flex items-center gap-2">
                            <i className="fas fa-users text-purple-500" /> Sessions
                        </p>
                        <p className="text-2xl font-bold text-light-text dark:text-dark-text mt-1">{(data.connectedSources?.ga4?.sessions ?? 0).toLocaleString()}</p>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                            bounce {((data.connectedSources?.ga4?.bounceRate ?? 0) * 100).toFixed(1)}%
                        </p>
                    </div>
                </div>
            )}

            {/* Empty state for channel breakdown */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg py-16 text-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10">
                    <i className="fas fa-chart-column text-2xl text-purple-500" />
                </div>
                <div className="max-w-md">
                    <p className="text-base font-bold text-light-text dark:text-dark-text">نموذج الإيرادات غير متاح بعد</p>
                    <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                        لرؤية توزيع الإيرادات حسب القناة ومقارنة نماذج Attribution (First Touch / Last Touch / Linear / Time Decay)،
                        يجب ربط حسابات <strong className="text-light-text dark:text-dark-text">Facebook Ads</strong> و<strong className="text-light-text dark:text-dark-text">Google Ads</strong>
                        {!hasGA4 && <> و<strong className="text-light-text dark:text-dark-text">Google Analytics 4</strong></>} من صفحة التكاملات.
                    </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {[
                        { label: 'Facebook Ads', icon: 'fa-facebook', color: 'text-blue-500 bg-blue-500/10' },
                        { label: 'Google Ads', icon: 'fa-google', color: 'text-red-500 bg-red-500/10' },
                        ...(!hasGA4 ? [{ label: 'Google Analytics 4', icon: 'fa-chart-area', color: 'text-teal-500 bg-teal-500/10' }] : []),
                    ].map(({ label, icon, color }) => (
                        <span key={label} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
                            <i className={`fab ${icon} text-[11px]`} /> {label}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};
