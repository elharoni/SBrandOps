import React from 'react';
import { MediaPlanLayer, MediaPlanLayerKPIs } from '../../../services/cockpitService';

const LAYER_CONFIG = {
    tofu: {
        label:  'TOFU',
        sub:    'الوعي',
        grad:   'from-blue-500 to-indigo-600',
        badge:  'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-800',
        format: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    },
    mofu: {
        label:  'MOFU',
        sub:    'الاهتمام',
        grad:   'from-amber-500 to-orange-500',
        badge:  'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-100 dark:border-amber-800',
        format: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    },
    bofu: {
        label:  'BOFU',
        sub:    'التحويل',
        grad:   'from-green-500 to-emerald-600',
        badge:  'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-100 dark:border-green-800',
        format: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    },
} as const;

interface Props {
    layer:    'tofu' | 'mofu' | 'bofu';
    data:     MediaPlanLayer;
    currency: string;
}

const MediaPlanCard: React.FC<Props> = ({ layer, data, currency }) => {
    const cfg  = LAYER_CONFIG[layer];
    const kpis: MediaPlanLayerKPIs = data.kpis ?? { cpa_target: null, roas_target: null, impressions_target: null, ctr_target: null };
    const hasKpis = kpis.cpa_target != null || kpis.impressions_target != null
        || kpis.ctr_target != null || kpis.roas_target != null;

    return (
        <div className={`flex flex-col gap-3 p-4 bg-white dark:bg-gray-900 border rounded-xl shadow-sm ${cfg.badge}`}>
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${cfg.grad} flex items-center justify-center shrink-0 shadow-sm`}>
                        <span className="text-[10px] font-black text-white tracking-wide">{cfg.label}</span>
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{cfg.sub}</p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-1">{data.objective}</p>
                    </div>
                </div>
                <div className="text-left shrink-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                        {data.budget_amount.toLocaleString('ar-EG')}
                        <span className="text-xs font-normal text-gray-500 dark:text-gray-400 mr-0.5"> {currency}</span>
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 text-left">{data.budget_pct}% من الميزانية</p>
                </div>
            </div>

            {/* KPIs */}
            {hasKpis && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                    {kpis.cpa_target != null && (
                        <span>
                            CPA: <strong className="text-gray-700 dark:text-gray-300">
                                {kpis.cpa_target.toLocaleString('ar-EG')} {currency}
                            </strong>
                        </span>
                    )}
                    {kpis.impressions_target != null && (
                        <span>
                            مشاهدات: <strong className="text-gray-700 dark:text-gray-300">
                                {kpis.impressions_target.toLocaleString('ar-EG')}
                            </strong>
                        </span>
                    )}
                    {kpis.ctr_target != null && (
                        <span>
                            CTR: <strong className="text-gray-700 dark:text-gray-300">{kpis.ctr_target}%</strong>
                        </span>
                    )}
                    {kpis.roas_target != null && (
                        <span>
                            ROAS: <strong className="text-gray-700 dark:text-gray-300">{kpis.roas_target}×</strong>
                        </span>
                    )}
                </div>
            )}

            {/* Audience notes */}
            {data.audience_notes && (
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed" dir="rtl">
                    <i className="fa fa-users text-gray-400 ml-1.5 text-[10px]" />
                    {data.audience_notes}
                </p>
            )}

            {/* Ad formats */}
            {data.ad_formats?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {data.ad_formats.map((f, i) => (
                        <span
                            key={i}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.format}`}
                        >
                            {f}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MediaPlanCard;
