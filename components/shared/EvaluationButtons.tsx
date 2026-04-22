/**
 * EvaluationButtons — أزرار التغذية الراجعة على مخرجات AI
 *
 * يُوضع هذا المكوّن تحت أي مخرج AI في التطبيق.
 * كل تفاعل يُغذّي ذاكرة البراند ويحسّن المخرجات مستقبلاً.
 *
 * الاستخدام:
 *   <EvaluationButtons
 *     executionId={response.executionId}
 *     brandId={brandId}
 *     skillType={response.skill}
 *     output={response.output.bestPick as string}
 *   />
 */

import React, { useState } from 'react';
import { SkillType, EvaluationSignalType } from '../../types';
import { recordEvaluationSignal } from '../../services/evaluationService';

interface EvaluationButtonsProps {
    executionId: string;
    brandId: string;
    skillType: SkillType;
    output: string;
    onUsed?: () => void;       // callback عند اختيار "استخدم"
    className?: string;
    compact?: boolean;         // نسخة مصغّرة للمناطق الضيقة
}

type ActionState = 'idle' | 'editing' | 'rating' | 'done';

export const EvaluationButtons: React.FC<EvaluationButtonsProps> = ({
    executionId,
    brandId,
    skillType,
    output,
    onUsed,
    className = '',
    compact = false,
}) => {
    const [actionState, setActionState] = useState<ActionState>('idle');
    const [editedText, setEditedText] = useState(output);
    const [rating, setRating] = useState(0);
    const [loading, setLoading] = useState(false);
    const [lastSignal, setLastSignal] = useState<EvaluationSignalType | null>(null);

    const send = async (signal: EvaluationSignalType, extras?: { editedOutput?: string; rating?: number }) => {
        if (loading) return;
        setLoading(true);
        try {
            await recordEvaluationSignal({
                executionId,
                brandId,
                skillType,
                signal,
                originalOutput: output,
                editedOutput: extras?.editedOutput,
                rating: extras?.rating,
            });
            setLastSignal(signal);
            setActionState('done');
            if (signal === 'used') onUsed?.();
        } catch (err) {
            console.warn('[EvaluationButtons] failed to record signal:', err);
        } finally {
            setLoading(false);
        }
    };

    // ── Done state ────────────────────────────────────────────────────────────
    if (actionState === 'done') {
        const labels: Record<EvaluationSignalType, string> = {
            used:            '✓ تم التسجيل — شكراً',
            edited:          '✓ تم حفظ التعديل',
            rejected:        '✓ تم التسجيل',
            converted:       '✓ تم تسجيل التحويل',
            human_escalated: '✓ تم التصعيد',
            rated:           '✓ تم التقييم — شكراً',
        };
        return (
            <div className={`flex items-center gap-1.5 text-xs text-gray-400 ${className}`}>
                <i className="fas fa-check-circle text-emerald-500" />
                <span>{lastSignal ? labels[lastSignal] : 'تم'}</span>
                <button
                    onClick={() => { setActionState('idle'); setLastSignal(null); }}
                    className="text-gray-500 hover:text-gray-300 transition-colors ml-1"
                    title="تغيير"
                >
                    <i className="fas fa-undo text-[10px]" />
                </button>
            </div>
        );
    }

    // ── Edit state ────────────────────────────────────────────────────────────
    if (actionState === 'editing') {
        return (
            <div className={`space-y-2 ${className}`}>
                <textarea
                    value={editedText}
                    onChange={e => setEditedText(e.target.value)}
                    className="w-full text-sm bg-gray-800 border border-gray-600 rounded-lg p-2.5 text-gray-100 resize-none focus:outline-none focus:border-blue-500"
                    rows={4}
                    dir="auto"
                />
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => send('edited', { editedOutput: editedText })}
                        disabled={loading || editedText === output}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                    >
                        {loading ? <i className="fas fa-spinner fa-spin" /> : <i className="fas fa-save" />}
                        حفظ التعديل
                    </button>
                    <button
                        onClick={() => setActionState('idle')}
                        className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
                    >
                        إلغاء
                    </button>
                </div>
            </div>
        );
    }

    // ── Rating state ──────────────────────────────────────────────────────────
    if (actionState === 'rating') {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <span className="text-xs text-gray-400">قيّم المخرج:</span>
                {[1, 2, 3, 4, 5].map(star => (
                    <button
                        key={star}
                        onClick={() => setRating(star)}
                        className={`text-lg transition-colors ${star <= rating ? 'text-yellow-400' : 'text-gray-600'} hover:text-yellow-300`}
                    >
                        ★
                    </button>
                ))}
                <button
                    onClick={() => send('rated', { rating })}
                    disabled={loading || rating === 0}
                    className="px-3 py-1 text-xs font-medium bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 text-white rounded-lg transition-colors"
                >
                    {loading ? <i className="fas fa-spinner fa-spin" /> : 'إرسال'}
                </button>
                <button
                    onClick={() => setActionState('idle')}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                    <i className="fas fa-times" />
                </button>
            </div>
        );
    }

    // ── Idle state (main buttons) ─────────────────────────────────────────────
    if (compact) {
        return (
            <div className={`flex items-center gap-1 ${className}`}>
                <ActionBtn
                    icon="fas fa-check"
                    title="استخدم كما هو"
                    color="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/30"
                    onClick={() => send('used')}
                    loading={loading}
                />
                <ActionBtn
                    icon="fas fa-pen"
                    title="عدّل"
                    color="text-blue-400 hover:text-blue-300 hover:bg-blue-900/30"
                    onClick={() => setActionState('editing')}
                    loading={false}
                />
                <ActionBtn
                    icon="fas fa-times"
                    title="رفض"
                    color="text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    onClick={() => send('rejected')}
                    loading={loading}
                />
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 flex-wrap ${className}`}>
            <span className="text-xs text-gray-500 ml-1">هل كان مفيداً؟</span>

            <EvalBtn
                icon="fas fa-check"
                label="استخدم"
                colorClass="border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/30 hover:border-emerald-500"
                onClick={() => send('used')}
                loading={loading}
            />
            <EvalBtn
                icon="fas fa-pen"
                label="عدّل"
                colorClass="border-blue-700/50 text-blue-400 hover:bg-blue-900/30 hover:border-blue-500"
                onClick={() => setActionState('editing')}
                loading={false}
            />
            <EvalBtn
                icon="fas fa-times"
                label="رفض"
                colorClass="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-500"
                onClick={() => send('rejected')}
                loading={loading}
            />
            <EvalBtn
                icon="fas fa-star"
                label="قيّم"
                colorClass="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30 hover:border-yellow-500"
                onClick={() => setActionState('rating')}
                loading={false}
            />
        </div>
    );
};

// ── Internal helpers ──────────────────────────────────────────────────────────

const EvalBtn: React.FC<{
    icon: string;
    label: string;
    colorClass: string;
    onClick: () => void;
    loading: boolean;
}> = ({ icon, label, colorClass, onClick, loading }) => (
    <button
        onClick={onClick}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-lg transition-all duration-150 disabled:opacity-40 ${colorClass}`}
    >
        <i className={loading ? 'fas fa-spinner fa-spin' : icon} />
        {label}
    </button>
);

const ActionBtn: React.FC<{
    icon: string;
    title: string;
    color: string;
    onClick: () => void;
    loading: boolean;
}> = ({ icon, title, color, onClick, loading }) => (
    <button
        onClick={onClick}
        disabled={loading}
        title={title}
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-all duration-150 disabled:opacity-40 ${color}`}
    >
        <i className={`text-xs ${loading ? 'fas fa-spinner fa-spin' : icon}`} />
    </button>
);

export default EvaluationButtons;
