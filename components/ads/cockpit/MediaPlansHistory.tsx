import React, { useState } from 'react';
import { MediaPlan } from '../../../services/cockpitService';

const STATUS_CONFIG: Record<MediaPlan['status'], { label: string; color: string }> = {
    draft:            { label: 'مسودة',               color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    pending_approval: { label: 'في انتظار الموافقة',  color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    approved:         { label: 'موافق عليها',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    executing:        { label: 'قيد التنفيذ',         color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    live:             { label: 'نشطة',                color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    completed:        { label: 'مكتملة',              color: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500' },
    rejected:         { label: 'مرفوضة',              color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
};

const OBJECTIVE_AR: Record<string, string> = {
    OUTCOME_AWARENESS:  'الوعي',
    OUTCOME_TRAFFIC:    'الزيارات',
    OUTCOME_LEADS:      'العملاء المحتملين',
    OUTCOME_SALES:      'المبيعات',
    OUTCOME_ENGAGEMENT: 'التفاعل',
};

interface Props {
    plans: MediaPlan[];
}

const MediaPlansHistory: React.FC<Props> = ({ plans }) => {
    const [open, setOpen] = useState(false);

    if (!plans.length) return null;

    return (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
            <button
                onClick={() => setOpen(o => !o)}
                className="flex items-center justify-between w-full text-right group"
            >
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                        <i className="fa fa-clock-rotate-left text-white text-[9px]" />
                    </div>
                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">سجل الخطط الإعلانية</span>
                    <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-bold">
                        {plans.length}
                    </span>
                </div>
                <i className={`fa fa-chevron-${open ? 'up' : 'down'} text-xs text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-all`} />
            </button>

            {open && (
                <div className="mt-3 flex flex-col gap-2">
                    {plans.map(p => {
                        const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.draft;
                        return (
                            <div
                                key={p.id}
                                className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl"
                            >
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5">
                                    <i className="fa fa-map text-white text-[9px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                                            {p.name}
                                        </span>
                                        <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${cfg.color}`}>
                                            {cfg.label}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                                        <span className="font-medium text-gray-600 dark:text-gray-300 tabular-nums">
                                            {p.totalBudget.toLocaleString('ar-EG')} {p.currency}
                                        </span>
                                        {p.objective && (
                                            <span>{OBJECTIVE_AR[p.objective] ?? p.objective}</span>
                                        )}
                                        {p.startDate && <span>{p.startDate}</span>}
                                        <span className="mr-auto">
                                            {new Date(p.createdAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}
                                        </span>
                                    </div>
                                    {p.brief && (
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 line-clamp-1" dir="rtl">
                                            {p.brief}
                                        </p>
                                    )}
                                    {p.status === 'rejected' && p.rejectedReason && (
                                        <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5">
                                            سبب الرفض: {p.rejectedReason}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MediaPlansHistory;
