import React, { useEffect, useState, useCallback } from 'react';
import { NotificationType } from '../../../types';
import {
    MediaPlan,
    createMediaPlan,
    getMediaPlans,
    approveMediaPlan,
    rejectMediaPlan,
} from '../../../services/cockpitService';
import MediaPlanCard     from './MediaPlanCard';
import MediaPlansHistory from './MediaPlansHistory';

interface Props {
    brandId:         string;
    currency:        string;
    addNotification: (type: NotificationType, msg: string) => void;
}

// ── MediaPlannerPanel ─────────────────────────────────────────────────────────

const MediaPlannerPanel: React.FC<Props> = ({ brandId, currency, addNotification }) => {
    const [brief,         setBrief]         = useState('');
    const [budget,        setBudget]        = useState('');
    const [cur,           setCur]           = useState(currency);
    const [startDate,     setStartDate]     = useState('');
    const [endDate,       setEndDate]       = useState('');
    const [generating,    setGenerating]    = useState(false);
    const [plan,          setPlan]          = useState<MediaPlan | null>(null);
    const [history,       setHistory]       = useState<MediaPlan[]>([]);
    const [histLoading,   setHistLoading]   = useState(true);
    const [showInput,     setShowInput]     = useState(true);
    const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null);

    // Initial load — check for pending plan + build history
    useEffect(() => {
        let cancelled = false;
        const init = async () => {
            setHistLoading(true);
            try {
                const plans = await getMediaPlans(brandId);
                if (cancelled) return;

                const pending = plans.find(p => p.status === 'pending_approval');
                const past    = plans.filter(p => p.status !== 'pending_approval');

                setHistory(past);

                if (pending) {
                    setPlan(pending);
                    setShowInput(false);
                }
            } catch {
                // non-fatal
            } finally {
                if (!cancelled) setHistLoading(false);
            }
        };
        init();
        return () => { cancelled = true; };
    }, [brandId]);

    const refreshHistory = useCallback(async () => {
        try {
            const plans = await getMediaPlans(brandId);
            setHistory(plans.filter(p => p.status !== 'pending_approval'));
        } catch { /* non-fatal */ }
    }, [brandId]);

    const handleGenerate = async () => {
        const budgetNum = Number(budget);
        if (!brief.trim())            { addNotification(NotificationType.Error, 'الرجاء كتابة الـ brief أولاً'); return; }
        if (!budgetNum || budgetNum <= 0) { addNotification(NotificationType.Error, 'الرجاء إدخال ميزانية صحيحة'); return; }
        if (endDate && startDate && endDate <= startDate) {
            addNotification(NotificationType.Error, 'تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
            return;
        }

        setGenerating(true);
        try {
            const { plan: newPlan } = await createMediaPlan(
                brandId,
                brief.trim(),
                budgetNum,
                cur || currency,
                startDate || null,
                endDate   || null,
            );
            setPlan(newPlan);
            setShowInput(false);
            addNotification(NotificationType.Success, `تم توليد الخطة: ${newPlan.name}`);
        } catch (e) {
            addNotification(NotificationType.Error, e instanceof Error ? e.message : 'فشل توليد الخطة');
        } finally {
            setGenerating(false);
        }
    };

    const handleApprove = async () => {
        if (!plan) return;
        setActionLoading('approve');
        try {
            const result = await approveMediaPlan(plan.id);
            if (!result.ok) { addNotification(NotificationType.Error, result.error ?? 'فشل الموافقة'); return; }
            addNotification(
                NotificationType.Success,
                `تمت الموافقة على الخطة${result.campaignsCreated ? ` — ${result.campaignsCreated} حملة مسودة جاهزة` : ''}`,
            );
            setPlan(null);
            setBrief('');
            setBudget('');
            setStartDate('');
            setEndDate('');
            setShowInput(true);
            await refreshHistory();
        } catch {
            addNotification(NotificationType.Error, 'فشل الموافقة على الخطة');
        } finally {
            setActionLoading(null);
        }
    };

    const handleReject = async () => {
        if (!plan) return;
        setActionLoading('reject');
        try {
            const result = await rejectMediaPlan(plan.id, 'رُفض من المستخدم');
            if (!result.ok) { addNotification(NotificationType.Error, result.error ?? 'فشل الرفض'); return; }
            addNotification(NotificationType.Info, 'تم رفض الخطة');
            setPlan(null);
            setShowInput(true);
            await refreshHistory();
        } catch {
            addNotification(NotificationType.Error, 'فشل رفض الخطة');
        } finally {
            setActionLoading(null);
        }
    };

    const handleNewPlan = () => {
        setPlan(null);
        setShowInput(true);
    };

    return (
        <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-hidden" dir="rtl">
            {/* Panel header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                        <i className="fa fa-map text-white text-sm" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white">مولّد الخطة الإعلانية</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {histLoading
                                ? 'جاري التحميل…'
                                : plan
                                    ? `خطة جاهزة للمراجعة: ${plan.name}`
                                    : 'أكتب brief واطلب من البيير التخطيط'}
                        </p>
                    </div>
                </div>
                {plan && (
                    <button
                        onClick={handleNewPlan}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
                    >
                        <i className="fa fa-plus" />
                        خطة جديدة
                    </button>
                )}
            </div>

            <div className="p-4 space-y-5">
                {/* ── Input Form ── */}
                {showInput && !plan && (
                    <div className="space-y-4">
                        {/* Brief */}
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                <i className="fa fa-pen-to-square ml-1" />
                                brief الحملة <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={brief}
                                onChange={e => setBrief(e.target.value)}
                                placeholder="مثال: نريد إطلاق حملة لتطبيقنا المالي في مصر، الهدف 500 تسجيل جديد خلال شهر، الجمهور شباب 25-40 سنة مهتمون بالاستثمار..."
                                rows={4}
                                dir="rtl"
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none leading-relaxed"
                            />
                        </div>

                        {/* Budget + currency */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                    <i className="fa fa-wallet ml-1" />
                                    الميزانية الإجمالية <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={e => setBudget(e.target.value)}
                                    placeholder="50000"
                                    min="100"
                                    dir="ltr"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                    <i className="fa fa-coins ml-1" />
                                    العملة
                                </label>
                                <select
                                    value={cur}
                                    onChange={e => setCur(e.target.value)}
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                                >
                                    <option value="EGP">EGP — جنيه مصري</option>
                                    <option value="SAR">SAR — ريال سعودي</option>
                                    <option value="AED">AED — درهم إماراتي</option>
                                    <option value="USD">USD — دولار أمريكي</option>
                                    <option value="KWD">KWD — دينار كويتي</option>
                                </select>
                            </div>
                        </div>

                        {/* Date range */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                    <i className="fa fa-calendar-days ml-1" />
                                    تاريخ البداية
                                    <span className="font-normal text-gray-400 mr-1">(اختياري)</span>
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    dir="ltr"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                    <i className="fa fa-calendar-check ml-1" />
                                    تاريخ النهاية
                                    <span className="font-normal text-gray-400 mr-1">(اختياري)</span>
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    dir="ltr"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleGenerate}
                            disabled={generating || !brief.trim() || !budget}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                        >
                            {generating ? (
                                <><i className="fa fa-spinner fa-spin" /> البيير يُخطّط…</>
                            ) : (
                                <><i className="fa fa-wand-magic-sparkles" /> خطّط الآن</>
                            )}
                        </button>
                    </div>
                )}

                {/* ── Generated Plan Display ── */}
                {plan && (
                    <div className="space-y-5">
                        {/* Strategy summary */}
                        {plan.strategySummary && (
                            <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-100 dark:border-violet-800">
                                <div className="flex items-start gap-2.5">
                                    <i className="fa fa-lightbulb text-violet-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 mb-1">الاستراتيجية</p>
                                        <p className="text-sm text-violet-800 dark:text-violet-200 leading-relaxed">{plan.strategySummary}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Meta row */}
                        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>
                                <i className="fa fa-wallet ml-1" />
                                الميزانية: <strong className="text-gray-800 dark:text-gray-200">
                                    {plan.totalBudget.toLocaleString('ar-EG')} {plan.currency}
                                </strong>
                            </span>
                            {plan.startDate && (
                                <span>
                                    <i className="fa fa-calendar ml-1" />
                                    من: <strong className="text-gray-800 dark:text-gray-200">{plan.startDate}</strong>
                                </span>
                            )}
                            {plan.endDate && (
                                <span>إلى: <strong className="text-gray-800 dark:text-gray-200">{plan.endDate}</strong></span>
                            )}
                            <span>
                                <i className="fa fa-tag ml-1" />
                                الهدف: <strong className="text-gray-800 dark:text-gray-200">{plan.objective}</strong>
                            </span>
                        </div>

                        {/* Overall KPIs */}
                        {(plan.kpis.overall_cpa_target || plan.kpis.roas_target || plan.kpis.reach_target) && (
                            <div className="flex flex-wrap gap-x-5 gap-y-1.5 p-3 bg-gray-100 dark:bg-gray-800/50 rounded-xl text-xs text-gray-600 dark:text-gray-300">
                                {plan.kpis.overall_cpa_target != null && (
                                    <span>
                                        <i className="fa fa-bullseye ml-1 text-gray-400" />
                                        CPA الإجمالي المستهدف: <strong>{plan.kpis.overall_cpa_target.toLocaleString('ar-EG')} {plan.currency}</strong>
                                    </span>
                                )}
                                {plan.kpis.reach_target != null && (
                                    <span>
                                        <i className="fa fa-eye ml-1 text-gray-400" />
                                        الوصول المستهدف: <strong>{plan.kpis.reach_target.toLocaleString('ar-EG')}</strong>
                                    </span>
                                )}
                                {plan.kpis.roas_target != null && (
                                    <span>
                                        <i className="fa fa-chart-line ml-1 text-gray-400" />
                                        ROAS المستهدف: <strong>{plan.kpis.roas_target}×</strong>
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Funnel layer cards */}
                        <div>
                            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                توزيع طبقات القمع
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {(['tofu', 'mofu', 'bofu'] as const).map(l => (
                                    <MediaPlanCard
                                        key={l}
                                        layer={l}
                                        data={plan.funnelLayers[l]}
                                        currency={plan.currency}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Creative briefs */}
                        {plan.creativeBriefs?.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                    <i className="fa fa-paintbrush ml-1" />
                                    بريفات الكريتيف
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {plan.creativeBriefs.map((cb, i) => (
                                        <div
                                            key={i}
                                            className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl"
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                                                    {cb.layer}
                                                </span>
                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                                                    {cb.format}
                                                </span>
                                            </div>
                                            <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1 leading-snug" dir="rtl">
                                                {cb.headline}
                                            </p>
                                            {cb.body && (
                                                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-2" dir="rtl">
                                                    {cb.body}
                                                </p>
                                            )}
                                            {cb.cta && (
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] text-gray-400">CTA:</span>
                                                    <span className="text-[11px] font-semibold text-violet-600 dark:text-violet-400">{cb.cta}</span>
                                                </div>
                                            )}
                                            {cb.notes && (
                                                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic" dir="rtl">
                                                    {cb.notes}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Audience plan */}
                        {plan.audiencePlan?.length > 0 && (
                            <div>
                                <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                    <i className="fa fa-users ml-1" />
                                    خطة الجمهور
                                </p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {plan.audiencePlan.map((a, i) => (
                                        <div
                                            key={i}
                                            className="p-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl"
                                        >
                                            <div className="flex items-center justify-between gap-2 mb-1">
                                                <span className="text-[10px] font-bold uppercase text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
                                                    {a.layer}
                                                </span>
                                                {a.estimated_size && (
                                                    <span className="text-[10px] text-gray-400 shrink-0">{a.estimated_size}</span>
                                                )}
                                            </div>
                                            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-0.5">{a.type}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed" dir="rtl">
                                                {a.description}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Approve / Reject */}
                        <div className="flex items-center gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
                            <button
                                onClick={handleReject}
                                disabled={actionLoading !== null}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                            >
                                {actionLoading === 'reject'
                                    ? <i className="fa fa-spinner fa-spin" />
                                    : <i className="fa fa-xmark" />
                                }
                                رفض الخطة
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={actionLoading !== null}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white transition-all disabled:opacity-50 shadow-sm"
                            >
                                {actionLoading === 'approve'
                                    ? <i className="fa fa-spinner fa-spin" />
                                    : <i className="fa fa-check" />
                                }
                                موافقة وإنشاء حملات
                            </button>
                        </div>
                    </div>
                )}

                {/* ── History ── */}
                {!histLoading && history.length > 0 && (
                    <MediaPlansHistory plans={history} />
                )}
            </div>
        </div>
    );
};

export default MediaPlannerPanel;
