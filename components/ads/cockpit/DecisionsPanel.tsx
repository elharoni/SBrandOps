import React, { useEffect, useState, useCallback } from 'react';
import { NotificationType } from '../../../types';
import {
    AdDecision,
    getPendingDecisions,
    approveDecision,
    rejectDecision,
    generateDecisions,
} from '../../../services/cockpitService';

interface Props {
    brandId:         string;
    currency:        string;
    addNotification: (type: NotificationType, msg: string) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DECISION_LABELS: Record<AdDecision['decisionType'], string> = {
    kill:       'إيقاف',
    scale:      'توسيع',
    duplicate:  'نسخ',
    refresh:    'تجديد',
    review:     'مراجعة',
    hold:       'انتظار',
};

const DECISION_COLORS: Record<AdDecision['decisionType'], string> = {
    kill:      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    scale:     'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    duplicate: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    refresh:   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    review:    'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    hold:      'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const DECISION_ICONS: Record<AdDecision['decisionType'], string> = {
    kill:      'fa-circle-stop',
    scale:     'fa-arrow-trend-up',
    duplicate: 'fa-copy',
    refresh:   'fa-rotate',
    review:    'fa-magnifying-glass',
    hold:      'fa-pause',
};

function fmt(n: number | null | undefined, suffix = ''): string {
    if (n == null) return '—';
    return n.toLocaleString('ar-EG', { maximumFractionDigits: 0 }) + (suffix ? ' ' + suffix : '');
}

// ── Decision Card ─────────────────────────────────────────────────────────────

interface CardProps {
    decision:        AdDecision;
    currency:        string;
    actionLoading:   string | null;
    onApprove:       (id: string) => void;
    onReject:        (id: string) => void;
}

const DecisionCard: React.FC<CardProps> = ({ decision, currency, actionLoading, onApprove, onReject }) => {
    const m = decision.supportingMetrics;
    const isLoading = actionLoading === decision.id;

    return (
        <div className="flex flex-col gap-3 p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${DECISION_COLORS[decision.decisionType]}`}>
                        <i className={`fa ${DECISION_ICONS[decision.decisionType]} text-[10px]`} />
                        {DECISION_LABELS[decision.decisionType]}
                        {decision.decisionType === 'scale' && decision.scalePercent
                            ? ` +${decision.scalePercent}%`
                            : ''}
                    </span>
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
                        {decision.targetName}
                    </span>
                </div>
                <span className="text-[10px] text-gray-400 dark:text-gray-500 shrink-0 mt-1">
                    {decision.targetType === 'campaign' ? 'حملة' : decision.targetType}
                </span>
            </div>

            {/* Supporting metrics */}
            {(m.cpa != null || m.spend != null || m.conversions != null || m.cpa_multiplier != null) && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                    {m.cpa != null && (
                        <span>
                            CPA: <strong className={
                                m.cpa_multiplier != null
                                    ? m.cpa_multiplier > 2   ? 'text-red-600 dark:text-red-400'
                                    : m.cpa_multiplier > 1   ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-green-600 dark:text-green-400'
                                    : 'text-gray-700 dark:text-gray-300'
                            }>{fmt(m.cpa, currency)}</strong>
                            {m.target_cpa != null && (
                                <span className="text-gray-400"> / هدف {fmt(m.target_cpa, currency)}</span>
                            )}
                        </span>
                    )}
                    {m.cpa_multiplier != null && (
                        <span>مضاعف: <strong className="text-gray-700 dark:text-gray-300">{m.cpa_multiplier.toFixed(2)}x</strong></span>
                    )}
                    {m.spend != null && (
                        <span>إنفاق: <strong className="text-gray-700 dark:text-gray-300">{fmt(m.spend, currency)}</strong></span>
                    )}
                    {m.conversions != null && (
                        <span>تحويلات: <strong className="text-gray-700 dark:text-gray-300">{fmt(m.conversions)}</strong></span>
                    )}
                    {m.frequency != null && (
                        <span>تكرار: <strong className="text-gray-700 dark:text-gray-300">{m.frequency.toFixed(1)}</strong></span>
                    )}
                </div>
            )}

            {/* Reasoning */}
            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed" dir="rtl">
                {decision.reasoning}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100 dark:border-gray-800">
                <button
                    onClick={() => onReject(decision.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                >
                    <i className="fa fa-xmark" />
                    رفض
                </button>
                <button
                    onClick={() => onApprove(decision.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50"
                >
                    {isLoading
                        ? <i className="fa fa-spinner fa-spin" />
                        : <i className="fa fa-check" />
                    }
                    موافقة
                </button>
            </div>
        </div>
    );
};

// ── DecisionsPanel ────────────────────────────────────────────────────────────

const DecisionsPanel: React.FC<Props> = ({ brandId, currency, addNotification }) => {
    const [decisions,    setDecisions]    = useState<AdDecision[]>([]);
    const [loading,      setLoading]      = useState(false);
    const [generating,   setGenerating]   = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const loadDecisions = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPendingDecisions(brandId);
            setDecisions(data);
        } catch {
            // non-fatal — panel stays empty
        } finally {
            setLoading(false);
        }
    }, [brandId]);

    useEffect(() => { loadDecisions(); }, [loadDecisions]);

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const { decisions: fresh } = await generateDecisions(brandId);
            setDecisions(fresh);
            if (fresh.length === 0) {
                addNotification(NotificationType.Info, 'لا توجد مقترحات جديدة — جميع الحملات في وضع جيد');
            } else {
                addNotification(NotificationType.Success, `تم توليد ${fresh.length} مقترح قرار`);
            }
        } catch (e) {
            addNotification(NotificationType.Error, e instanceof Error ? e.message : 'فشل توليد المقترحات');
        } finally {
            setGenerating(false);
        }
    };

    const handleApprove = async (id: string) => {
        setActionLoading(id);
        try {
            const { ok, error, message_ar } = await approveDecision(id);
            if (!ok) { addNotification(NotificationType.Error, error ?? 'فشل تنفيذ القرار'); return; }
            setDecisions(prev => prev.filter(d => d.id !== id));
            addNotification(NotificationType.Success, message_ar ?? 'تم تنفيذ القرار بنجاح');
        } catch {
            addNotification(NotificationType.Error, 'فشل تنفيذ القرار');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async (id: string) => {
        setActionLoading(id);
        try {
            const { ok, error } = await rejectDecision(id);
            if (!ok) { addNotification(NotificationType.Error, error ?? 'فشل الرفض'); return; }
            setDecisions(prev => prev.filter(d => d.id !== id));
            addNotification(NotificationType.Info, 'تم رفض القرار');
        } catch {
            addNotification(NotificationType.Error, 'فشل الرفض');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-hidden" dir="rtl">
            {/* Panel header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0">
                        <i className="fa fa-brain text-white text-sm" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">مقترحات القرارات</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {loading ? 'جاري التحميل…'
                                : decisions.length > 0
                                    ? `${decisions.length} مقترح في انتظار المراجعة`
                                    : 'لا توجد مقترحات معلقة'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={generating || loading}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-50 shrink-0"
                >
                    {generating
                        ? <><i className="fa fa-spinner fa-spin" /> جاري التحليل…</>
                        : <><i className="fa fa-bolt" /> توليد مقترحات</>
                    }
                </button>
            </div>

            {/* Body */}
            <div className="p-4">
                {loading ? (
                    <div className="flex flex-col gap-3">
                        {[1, 2].map(i => (
                            <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                        ))}
                    </div>
                ) : decisions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            <i className="fa fa-check-double text-gray-400 dark:text-gray-500 text-lg" />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            لا توجد مقترحات معلقة
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                            اضغط "توليد مقترحات" ليحلّل البيير حملاتك ويقترح قرارات
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {decisions.map(d => (
                            <DecisionCard
                                key={d.id}
                                decision={d}
                                currency={currency}
                                actionLoading={actionLoading}
                                onApprove={handleApprove}
                                onReject={handleReject}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DecisionsPanel;
