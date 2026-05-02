import React, { useState, useEffect } from 'react';
import { CpaTarget, saveCpaTargets } from '../../../services/cockpitService';
import { NotificationType } from '../../../types';

interface Props {
    brandId:         string;
    currency:        string;
    initial:         { tofu: number | null; mofu: number | null; bofu: number | null };
    onSaved:         (next: { tofu: number | null; mofu: number | null; bofu: number | null }) => void;
    onClose:         () => void;
    addNotification: (type: NotificationType, msg: string) => void;
}

const LAYERS = [
    { key: 'tofu' as const, label: 'TOFU',  sub: 'توعية وجذب',   color: 'text-blue-600 dark:text-blue-400',   ring: 'focus:ring-blue-500' },
    { key: 'mofu' as const, label: 'MOFU',  sub: 'تفاعل واهتمام', color: 'text-purple-600 dark:text-purple-400', ring: 'focus:ring-purple-500' },
    { key: 'bofu' as const, label: 'BOFU',  sub: 'تحويل وشراء',  color: 'text-green-600 dark:text-green-400',  ring: 'focus:ring-green-500' },
] as const;

const CPATargetsEditor: React.FC<Props> = ({
    brandId, currency, initial, onSaved, onClose, addNotification,
}) => {
    const [values, setValues] = useState({
        tofu: initial.tofu?.toString() ?? '',
        mofu: initial.mofu?.toString() ?? '',
        bofu: initial.bofu?.toString() ?? '',
    });
    const [saving, setSaving] = useState(false);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    const handleSave = async () => {
        const targets: CpaTarget[] = LAYERS
            .filter(l => values[l.key] !== '' && Number.isFinite(Number(values[l.key])) && Number(values[l.key]) > 0)
            .map(l => ({ funnel_layer: l.key, target_cpa: Number(values[l.key]), currency }));

        if (targets.length === 0) {
            addNotification(NotificationType.Error, 'أدخل هدف CPA واحد على الأقل');
            return;
        }

        setSaving(true);
        const result = await saveCpaTargets(brandId, targets);
        setSaving(false);

        if (!result.ok) {
            addNotification(NotificationType.Error, result.error ?? 'فشل الحفظ');
            return;
        }

        addNotification(NotificationType.Success, 'تم حفظ أهداف CPA');
        onSaved({
            tofu: values.tofu !== '' && Number(values.tofu) > 0 ? Number(values.tofu) : null,
            mofu: values.mofu !== '' && Number(values.mofu) > 0 ? Number(values.mofu) : null,
            bofu: values.bofu !== '' && Number(values.bofu) > 0 ? Number(values.bofu) : null,
        });
        onClose();
    };

    return (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm"
                onClick={e => e.stopPropagation()}
            >
                {/* Modal header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                            <i className="fa fa-bullseye text-indigo-600 dark:text-indigo-400 text-sm" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">أهداف CPA</p>
                            <p className="text-xs text-gray-400 leading-tight">بالعملة: {currency}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors w-7 h-7 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
                    >
                        <i className="fa fa-times text-sm" />
                    </button>
                </div>

                {/* Inputs */}
                <div className="px-6 py-5 space-y-4">
                    {LAYERS.map(l => (
                        <div key={l.key}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className={`text-xs font-bold ${l.color}`}>{l.label}</label>
                                <span className="text-xs text-gray-400">{l.sub}</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    value={values[l.key]}
                                    onChange={e => setValues(prev => ({ ...prev, [l.key]: e.target.value }))}
                                    placeholder="—"
                                    min="1"
                                    step="any"
                                    dir="ltr"
                                    className={`w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 ${l.ring} pr-14`}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                                    {currency}
                                </span>
                            </div>
                        </div>
                    ))}

                    <p className="text-xs text-gray-400 pt-1">
                        اترك الحقل فارغًا إذا لم يكن هناك هدف لهذه المرحلة.
                    </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-5">
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
                        ) : 'حفظ الأهداف'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CPATargetsEditor;
