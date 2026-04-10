// components/DesignWorkflowRunner.tsx
import React, { useState, useCallback } from 'react';
import { DesignWorkflow, DesignWorkflowStep, DesignWorkflowFormat, DesignAsset, DesignJob, BrandHubProfile, NotificationType, DESIGN_FORMAT_MAP } from '../types';
import { createDesignJob, runDesignJob } from '../services/designJobsService';

interface DesignWorkflowRunnerProps {
    workflow: DesignWorkflow;
    brandId: string;
    brandProfile: BrandHubProfile | null;
    addNotification: (type: NotificationType, msg: string) => void;
    onClose: () => void;
    onJobCompleted: (job: DesignJob) => void;
    onJobCreated?: (job: DesignJob) => void;
}

type RunnerState = 'steps' | 'generating' | 'pick-variant' | 'done';

const TONE_COLORS: Record<string, string> = {
    'احترافي':     'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-300',
    'ودود':        'bg-green-100  text-green-800  dark:bg-green-900/30  dark:text-green-300',
    'عاجل':        'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-300',
    'ملهم':        'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    'تعليمي':      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    'بيع مباشر':   'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    'عرض حصري':    'bg-pink-100   text-pink-800   dark:bg-pink-900/30   dark:text-pink-300',
    'إطلاق جديد':  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
    'تذكير بالسلة':'bg-gray-100   text-gray-800   dark:bg-gray-900/30   dark:text-gray-300',
    'مرح':         'bg-teal-100   text-teal-800   dark:bg-teal-900/30   dark:text-teal-300',
    'فاخر':        'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-300',
};

export const DesignWorkflowRunner: React.FC<DesignWorkflowRunnerProps> = ({
    workflow, brandId, brandProfile, addNotification, onClose, onJobCompleted, onJobCreated,
}) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [inputs, setInputs]                     = useState<Record<string, string>>({});
    const [selectedFormat, setSelectedFormat]     = useState<DesignWorkflowFormat>(workflow.formats[0]);
    const [runnerState, setRunnerState]           = useState<RunnerState>('steps');
    const [progressMsg, setProgressMsg]           = useState('');
    const [completedJob, setCompletedJob]         = useState<DesignJob | null>(null);
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

    // فلترة الـ steps الفعلية (استبعاد apply-brand-colors من UI لأنه تلقائي)
    const visibleSteps = workflow.steps.filter(s => s.type !== 'apply-brand-colors');
    const currentStep  = visibleSteps[currentStepIndex];
    const isLastStep   = currentStepIndex === visibleSteps.length - 1;
    const progressPct  = Math.round(((currentStepIndex) / visibleSteps.length) * 100);

    const setInput = (key: string, val: string) =>
        setInputs(prev => ({ ...prev, [key]: val }));

    const canProceed = (): boolean => {
        if (!currentStep) return true;
        if (currentStep.type === 'input-topic')     return (inputs['input-topic']     || '').trim().length > 2;
        if (currentStep.type === 'input-tone')      return (inputs['input-tone']      || '').length > 0;
        if (currentStep.type === 'select-format')   return !!selectedFormat;
        if (currentStep.type === 'input-text-overlay') return true; // اختياري
        if (currentStep.type === 'review')          return true;
        return true;
    };

    const handleNext = () => {
        if (!isLastStep) {
            setCurrentStepIndex(i => i + 1);
        } else {
            handleGenerate();
        }
    };

    const handleGenerate = useCallback(async () => {
        setRunnerState('generating');
        try {
            // إنشاء job في Supabase
            const job = await createDesignJob(brandId, {
                workflowId:   workflow.id,
                workflowName: workflow.name,
                inputs,
                format:       selectedFormat,
                prompt:       '',
            });
            onJobCreated?.(job);

            // تشغيل الـ job
            const doneJob = await runDesignJob(
                job, workflow, brandProfile, brandId,
                (msg) => setProgressMsg(msg)
            );
            setCompletedJob(doneJob);
            onJobCompleted(doneJob);

            if (doneJob.status === 'done' && doneJob.assets.length > 0) {
                setSelectedVariantId(doneJob.assets[0].id);
                setRunnerState('pick-variant');
            } else {
                addNotification(NotificationType.Error, doneJob.error || 'فشل توليد التصميم');
                setRunnerState('steps');
            }
        } catch (err: any) {
            addNotification(NotificationType.Error, err.message || 'خطأ غير متوقع');
            setRunnerState('steps');
        }
    }, [brandId, brandProfile, inputs, selectedFormat, workflow, onJobCompleted, onJobCreated, addNotification]);

    const handleSaveSelected = () => {
        if (!completedJob || !selectedVariantId) return;
        addNotification(NotificationType.Success, 'تم حفظ التصميم في مكتبة الأصول');
        onClose();
    };

    // ── Render Step UI ────────────────────────────────────────────────────────

    const renderStepContent = (step: DesignWorkflowStep) => {
        switch (step.type) {
            case 'input-topic':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {step.labelAr}
                        </label>
                        <textarea
                            value={inputs['input-topic'] || ''}
                            onChange={e => setInput('input-topic', e.target.value)}
                            placeholder={workflow.category === 'custom'
                                ? 'اكتب وصف التصميم الذي تريده...'
                                : 'مثال: خصم 30% على كل منتجاتنا هذا الأسبوع'}
                            rows={3}
                            className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text resize-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition"
                        />
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            <i className="fas fa-sparkles me-1 text-brand-primary"></i>
                            سيتم تحسين النص تلقائياً بـ Gemini Flash قبل الإرسال لـ Imagen 4.0
                        </p>
                    </div>
                );

            case 'input-tone':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {step.labelAr}
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(step.config?.options || ['احترافي', 'ودود', 'ملهم']).map((opt: string) => (
                                <button
                                    key={opt}
                                    onClick={() => setInput('input-tone', opt)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all ${
                                        inputs['input-tone'] === opt
                                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                            : 'border-light-border dark:border-dark-border text-light-text dark:text-dark-text hover:border-brand-primary/50'
                                    }`}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'input-text-overlay':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {step.labelAr}
                            <span className="ms-2 text-xs font-normal text-light-text-secondary dark:text-dark-text-secondary">(اختياري)</span>
                        </label>
                        <input
                            type="text"
                            value={inputs['input-text-overlay'] || ''}
                            onChange={e => setInput('input-text-overlay', e.target.value)}
                            placeholder="مثال: اشتري الآن • احجز مجاناً • عرض لفترة محدودة"
                            className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-xl text-light-text dark:text-dark-text focus:ring-2 focus:ring-brand-primary focus:border-transparent transition"
                        />
                    </div>
                );

            case 'select-format':
                return (
                    <div className="space-y-3">
                        <label className="block text-sm font-bold text-light-text dark:text-dark-text">
                            {step.labelAr}
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {Object.values(DESIGN_FORMAT_MAP).filter(f => f.format !== 'custom').map(fmt => (
                                <button
                                    key={fmt.format}
                                    onClick={() => setSelectedFormat(fmt)}
                                    className={`p-3 rounded-xl border-2 text-start transition-all ${
                                        selectedFormat.format === fmt.format
                                            ? 'border-brand-primary bg-brand-primary/10'
                                            : 'border-light-border dark:border-dark-border hover:border-brand-primary/40'
                                    }`}
                                >
                                    <div className="flex items-center gap-2 mb-1">
                                        <div
                                            className="bg-light-border dark:bg-dark-border rounded flex-shrink-0"
                                            style={{
                                                width:  fmt.aspectRatio === '9:16' ? 14 : fmt.aspectRatio === '1:1' ? 20 : 28,
                                                height: fmt.aspectRatio === '9:16' ? 24 : fmt.aspectRatio === '1:1' ? 20 : 16,
                                            }}
                                        />
                                        <span className="text-xs font-bold text-light-text dark:text-dark-text truncate">{fmt.labelAr}</span>
                                    </div>
                                    <div className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">
                                        {fmt.width}×{fmt.height}px
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                );

            case 'review':
                return (
                    <div className="space-y-4">
                        <p className="text-sm font-bold text-light-text dark:text-dark-text">مراجعة الإعدادات</p>
                        <div className="bg-light-bg dark:bg-dark-bg rounded-xl p-4 space-y-3 border border-light-border dark:border-dark-border">
                            {inputs['input-topic'] && (
                                <div className="flex gap-3">
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">الموضوع</span>
                                    <span className="text-sm text-light-text dark:text-dark-text font-medium">{inputs['input-topic']}</span>
                                </div>
                            )}
                            {inputs['input-tone'] && (
                                <div className="flex gap-3 items-center">
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">الأسلوب</span>
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${TONE_COLORS[inputs['input-tone']] || 'bg-gray-100 text-gray-800'}`}>
                                        {inputs['input-tone']}
                                    </span>
                                </div>
                            )}
                            {inputs['input-text-overlay'] && (
                                <div className="flex gap-3">
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">نص الـ CTA</span>
                                    <span className="text-sm text-light-text dark:text-dark-text font-medium">{inputs['input-text-overlay']}</span>
                                </div>
                            )}
                            <div className="flex gap-3 items-center">
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">المقاس</span>
                                <span className="text-sm text-brand-primary font-bold">{selectedFormat.labelAr} ({selectedFormat.width}×{selectedFormat.height})</span>
                            </div>
                            {workflow.useBrandColors && brandProfile && (
                                <div className="flex gap-3 items-center">
                                    <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">ألوان البراند</span>
                                    <span className="text-xs text-green-600 dark:text-green-400 font-bold">
                                        <i className="fas fa-check me-1"></i>مُفعّلة تلقائياً
                                    </span>
                                </div>
                            )}
                            <div className="flex gap-3 items-center">
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary w-20 flex-shrink-0">عدد الـ variants</span>
                                <span className="text-sm font-bold text-light-text dark:text-dark-text">{workflow.variantsCount} تصاميم</span>
                            </div>
                        </div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            <i className="fas fa-info-circle me-1"></i>
                            Gemini Flash سيحسّن الـ prompt ثم Imagen 4.0 سيولّد التصاميم
                        </p>
                    </div>
                );

            default:
                return null;
        }
    };

    // ── Generating State ──────────────────────────────────────────────────────

    if (runnerState === 'generating') {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-light-card dark:bg-dark-card rounded-2xl p-10 max-w-sm w-full text-center shadow-2xl border border-light-border dark:border-dark-border">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-primary to-brand-purple flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <i className="fas fa-palette text-white text-3xl"></i>
                    </div>
                    <h3 className="text-lg font-bold text-light-text dark:text-dark-text mb-2">جاري الإبداع...</h3>
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mb-6">{progressMsg || 'جاري تهيئة الـ AI...'}</p>
                    <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-2">
                        <div className="bg-gradient-to-r from-brand-primary to-brand-purple h-2 rounded-full animate-pulse" style={{ width: '75%' }} />
                    </div>
                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-3">
                        يستغرق التوليد 15-30 ثانية
                    </p>
                </div>
            </div>
        );
    }

    // ── Pick Variant State ────────────────────────────────────────────────────

    if (runnerState === 'pick-variant' && completedJob) {
        return (
            <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-light-border dark:border-dark-border">
                    {/* Header */}
                    <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                        <div>
                            <h2 className="text-lg font-bold text-light-text dark:text-dark-text">اختر التصميم المناسب</h2>
                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">
                                تم توليد {completedJob.assets.length} تصاميم — اختر المفضّل لديك
                            </p>
                        </div>
                        <button onClick={onClose} className="text-light-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition">×</button>
                    </div>

                    {/* Variants Grid */}
                    <div className="p-5 overflow-y-auto flex-1">
                        <div className={`grid gap-4 ${completedJob.assets.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' : completedJob.assets.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                            {completedJob.assets.map((asset, idx) => (
                                <button
                                    key={asset.id}
                                    onClick={() => setSelectedVariantId(asset.id)}
                                    className={`relative rounded-xl overflow-hidden border-4 transition-all group ${
                                        selectedVariantId === asset.id
                                            ? 'border-brand-primary shadow-lg shadow-brand-primary/20'
                                            : 'border-light-border dark:border-dark-border hover:border-brand-primary/50'
                                    }`}
                                >
                                    <img
                                        src={asset.url}
                                        alt={`Variant ${idx + 1}`}
                                        className="w-full h-48 object-cover"
                                    />
                                    <div className={`absolute inset-0 bg-brand-primary/10 flex items-center justify-center opacity-0 transition-opacity ${selectedVariantId === asset.id ? 'opacity-100' : 'group-hover:opacity-100'}`}>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${selectedVariantId === asset.id ? 'bg-brand-primary' : 'bg-white/80'}`}>
                                            <i className={`fas fa-check text-sm ${selectedVariantId === asset.id ? 'text-white' : 'text-brand-primary'}`}></i>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-2 start-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                                        Variant {idx + 1}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-5 border-t border-light-border dark:border-dark-border flex justify-between items-center gap-3">
                        <button
                            onClick={() => { setRunnerState('steps'); setCurrentStepIndex(visibleSteps.length - 1); }}
                            className="px-4 py-2 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition"
                        >
                            <i className="fas fa-redo me-2"></i>إعادة التوليد
                        </button>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveSelected}
                                disabled={!selectedVariantId}
                                className="px-5 py-2 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border text-sm font-bold text-light-text dark:text-dark-text hover:bg-light-card dark:hover:bg-dark-card transition disabled:opacity-50"
                            >
                                <i className="fas fa-save me-2"></i>حفظ في المكتبة
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Steps State ───────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-light-card dark:bg-dark-card rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-light-border dark:border-dark-border">
                {/* Header */}
                <div className="p-5 border-b border-light-border dark:border-dark-border">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-primary to-brand-purple flex items-center justify-center">
                                <i className={`fas ${workflow.icon} text-white`}></i>
                            </div>
                            <div>
                                <h2 className="text-base font-bold text-light-text dark:text-dark-text">{workflow.name}</h2>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    خطوة {currentStepIndex + 1} من {visibleSteps.length}
                                </p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-light-text-secondary hover:text-light-text dark:hover:text-dark-text text-xl w-8 h-8 flex items-center justify-center rounded-lg hover:bg-light-bg dark:hover:bg-dark-bg transition">×</button>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-light-bg dark:bg-dark-bg rounded-full h-1.5">
                        <div
                            className="bg-gradient-to-r from-brand-primary to-brand-purple h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-1">
                        {visibleSteps.map((s, i) => (
                            <div
                                key={s.id}
                                className={`text-[10px] ${i <= currentStepIndex ? 'text-brand-primary font-bold' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}
                            >
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="p-6 flex-1 min-h-[220px]">
                    {currentStep && renderStepContent(currentStep)}
                </div>

                {/* Footer */}
                <div className="p-5 border-t border-light-border dark:border-dark-border flex justify-between items-center">
                    <button
                        onClick={() => setCurrentStepIndex(i => Math.max(0, i - 1))}
                        disabled={currentStepIndex === 0}
                        className="px-4 py-2 rounded-xl border border-light-border dark:border-dark-border text-sm font-bold text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <i className="fas fa-arrow-right me-2"></i>السابق
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={!canProceed()}
                        className="px-6 py-2 rounded-xl bg-gradient-to-r from-brand-primary to-brand-purple text-white text-sm font-bold shadow-lg hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isLastStep ? (
                            <><i className="fas fa-magic me-2"></i>توليد التصاميم</>
                        ) : (
                            <><span>التالي</span><i className="fas fa-arrow-left ms-2"></i></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
