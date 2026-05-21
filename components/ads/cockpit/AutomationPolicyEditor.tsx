import React, { useState, useEffect } from 'react';
import { AutomationPolicy, saveAutomationPolicy } from '../../../services/cockpitService';
import { NotificationType } from '../../../types';

interface Props {
    brandId:         string;
    currency:        string;
    initial:         AutomationPolicy | null;
    onSaved:         (next: AutomationPolicy) => void;
    onClose:         () => void;
    addNotification: (type: NotificationType, msg: string) => void;
}

type Mode = 'manual' | 'tiered' | 'auto';

const MODE_OPTIONS: { mode: Mode; icon: string; label: string; sub: string; color: string; ring: string; bg: string }[] = [
    {
        mode:  'manual',
        icon:  'fa-hand',
        label: 'يدوي',
        sub:   'جميع القرارات تحتاج موافقتك',
        color: 'text-gray-700 dark:text-gray-300',
        ring:  'ring-gray-400',
        bg:    'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    },
    {
        mode:  'tiered',
        icon:  'fa-layer-group',
        label: 'شبه تلقائي',
        sub:   'القرارات تُولَّد تلقائياً لكن تحتاج موافقتك',
        color: 'text-indigo-700 dark:text-indigo-300',
        ring:  'ring-indigo-500',
        bg:    'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-700',
    },
    {
        mode:  'auto',
        icon:  'fa-robot',
        label: 'تلقائي كامل',
        sub:   'KILL و SCALE تُنفَّذ أوتوماتيكياً ضمن الحدود',
        color: 'text-green-700 dark:text-green-300',
        ring:  'ring-green-500',
        bg:    'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
    },
];

function buildPreview(mode: Mode, kill: number, window: number, scale: number, spend: number, currency: string): string {
    if (mode === 'manual') return 'جميع المقترحات ستُعرض للمراجعة قبل التنفيذ.';
    if (mode === 'tiered') return 'يولّد البيير مقترحات تلقائياً كل 4 ساعات — تحتاج لموافقتك قبل التنفيذ.';
    return `ستُوقَف الحملات تلقائياً إذا تجاوز CPA الهدف بـ ${kill}× لمدة ${window} ساعة. وسيُرفع الميزانية +${scale}% للحملات التي تؤدي بكفاءة، بحد أقصى ${spend.toLocaleString('ar-EG')} ${currency}/يوم.`;
}

const AutomationPolicyEditor: React.FC<Props> = ({
    brandId, currency, initial, onSaved, onClose, addNotification,
}) => {
    const [mode,    setMode]    = useState<Mode>(initial?.mode ?? 'manual');
    const [kill,    setKill]    = useState(String(initial?.killCpaMultiplier ?? 2.0));
    const [window_, setWindow_] = useState(String(initial?.killWindowHours ?? 48));
    const [scale,   setScale]   = useState(String(initial?.maxAutoScalePercent ?? 20));
    const [spend,   setSpend]   = useState(String(initial?.maxDailySpendPerCampaign ?? 2000));
    const [budget,  setBudget]  = useState(String(initial?.monthlyBudget ?? ''));
    const [saving,  setSaving]  = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSave = async () => {
        const killVal  = Number(kill);
        const winVal   = Number(window_);
        const scaleVal = Number(scale);
        const spendVal = Number(spend);

        if (killVal < 1.2 || killVal > 10)  { addNotification(NotificationType.Error, 'معامل KILL يجب أن يكون بين 1.2 و 10'); return; }
        if (winVal  < 6  || winVal > 168)   { addNotification(NotificationType.Error, 'نافذة KILL يجب أن تكون بين 6 و 168 ساعة'); return; }
        if (scaleVal < 5 || scaleVal > 100) { addNotification(NotificationType.Error, 'نسبة الزيادة يجب أن تكون بين 5% و 100%'); return; }
        if (spendVal < 0)                   { addNotification(NotificationType.Error, 'الحد اليومي لا يمكن أن يكون سالباً'); return; }

        setSaving(true);
        const result = await saveAutomationPolicy(brandId, {
            mode,
            killCpaMultiplier:        killVal,
            killWindowHours:          winVal,
            maxAutoScalePercent:      scaleVal,
            maxDailySpendPerCampaign: spendVal,
            monthlyBudget:            budget !== '' && Number(budget) > 0 ? Number(budget) : null,
        });
        setSaving(false);

        if (!result.ok) {
            addNotification(NotificationType.Error, result.error ?? 'فشل الحفظ');
            return;
        }

        const savedPolicy: AutomationPolicy = {
            mode,
            maxAutoLaunchAdsetBudget: initial?.maxAutoLaunchAdsetBudget ?? 500,
            maxAutoScalePercent:      scaleVal,
            killCpaMultiplier:        killVal,
            killWindowHours:          winVal,
            maxDailySpendPerCampaign: spendVal,
            tieredAutoLaunchLayers:   initial?.tieredAutoLaunchLayers ?? ['tofu'],
            monthlyBudget:            budget !== '' && Number(budget) > 0 ? Number(budget) : null,
        };

        addNotification(NotificationType.Success, 'تم حفظ إعدادات الأتمتة');
        onSaved(savedPolicy);
        onClose();
    };

    const showThresholds = mode !== 'manual';
    const preview = buildPreview(mode, Number(kill), Number(window_), Number(scale), Number(spend), currency);

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
                onClick={e => e.stopPropagation()}
                dir="rtl"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                            <i className="fa fa-robot text-indigo-600 dark:text-indigo-400 text-sm" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">إعدادات الأتمتة</p>
                            <p className="text-xs text-gray-400">حدّد مستوى تدخل البيير في قراراتك</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                    >
                        <i className="fa fa-times text-sm" />
                    </button>
                </div>

                {/* Scroll body */}
                <div className="overflow-y-auto max-h-[70vh]">
                    <div className="px-6 py-5 space-y-5">

                        {/* Mode selector */}
                        <div className="space-y-2">
                            {MODE_OPTIONS.map(opt => (
                                <button
                                    key={opt.mode}
                                    onClick={() => setMode(opt.mode)}
                                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-right transition-all ${
                                        mode === opt.mode
                                            ? `${opt.bg} border-current ${opt.ring} ring-2 ring-offset-1`
                                            : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mode === opt.mode ? opt.bg : 'bg-white dark:bg-gray-700'}`}>
                                        <i className={`fa ${opt.icon} text-sm ${mode === opt.mode ? opt.color : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className={`text-sm font-bold leading-tight ${mode === opt.mode ? opt.color : 'text-gray-700 dark:text-gray-300'}`}>
                                            {opt.label}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                                            {opt.sub}
                                        </p>
                                    </div>
                                    {mode === opt.mode && (
                                        <i className={`fa fa-circle-check text-base shrink-0 ${opt.color}`} />
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Thresholds (TIERED / AUTO) */}
                        {showThresholds && (
                            <div className="space-y-4 pt-1">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    حدود التنفيذ
                                </p>

                                {/* Kill multiplier */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-semibold text-red-600 dark:text-red-400">
                                            <i className="fa fa-circle-stop ml-1" />
                                            معامل KILL
                                        </label>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{Number(kill).toFixed(1)}×</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="1.2" max="5" step="0.1"
                                        value={kill}
                                        onChange={e => setKill(e.target.value)}
                                        className="w-full accent-red-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                        <span>1.2×</span>
                                        <span className="text-xs text-gray-500">يُوقف إذا CPA &gt; هدف × {Number(kill).toFixed(1)}</span>
                                        <span>5×</span>
                                    </div>
                                </div>

                                {/* Kill window */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                                            <i className="fa fa-clock ml-1" />
                                            نافذة المراقبة
                                        </label>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{window_} ساعة</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="12" max="72" step="12"
                                        value={window_}
                                        onChange={e => setWindow_(e.target.value)}
                                        className="w-full accent-orange-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                        <span>12h</span>
                                        <span>72h</span>
                                    </div>
                                </div>

                                {/* Max scale % */}
                                <div>
                                    <div className="flex items-center justify-between mb-1.5">
                                        <label className="text-xs font-semibold text-green-600 dark:text-green-400">
                                            <i className="fa fa-arrow-trend-up ml-1" />
                                            حد زيادة الميزانية
                                        </label>
                                        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">+{scale}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="5" max="50" step="5"
                                        value={scale}
                                        onChange={e => setScale(e.target.value)}
                                        className="w-full accent-green-500"
                                    />
                                    <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                        <span>5%</span>
                                        <span>50%</span>
                                    </div>
                                </div>

                                {/* Max daily spend */}
                                <div>
                                    <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                        <i className="fa fa-wallet ml-1" />
                                        الحد اليومي للحملة
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={spend}
                                            onChange={e => setSpend(e.target.value)}
                                            min="100"
                                            step="100"
                                            dir="ltr"
                                            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
                                        />
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                            {currency}/يوم
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Monthly budget */}
                        <div>
                            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 block mb-1.5">
                                <i className="fa fa-calendar ml-1" />
                                الميزانية الشهرية الإجمالية
                                <span className="font-normal text-gray-400 mr-1">(اختياري)</span>
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={budget}
                                    onChange={e => setBudget(e.target.value)}
                                    placeholder="—"
                                    min="0"
                                    step="100"
                                    dir="ltr"
                                    className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-16"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                    {currency}
                                </span>
                            </div>
                        </div>

                        {/* Live preview */}
                        <div className="p-3.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800">
                            <div className="flex items-start gap-2">
                                <i className="fa fa-circle-info text-indigo-500 text-xs mt-0.5 shrink-0" />
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">{preview}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-5 pt-4 border-t border-gray-100 dark:border-gray-800">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors font-medium"
                    >
                        إلغاء
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                    >
                        {saving ? (
                            <span className="flex items-center justify-center gap-1.5">
                                <i className="fa fa-circle-notch animate-spin text-xs" />
                                جاري الحفظ...
                            </span>
                        ) : 'حفظ الإعدادات'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AutomationPolicyEditor;
