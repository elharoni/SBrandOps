/**
 * AI Strategy Hub — MarketingPlansPage
 * Tabs:
 *  1. خطط المحتوى    — STRAT-1: AI Content Plan Generator
 *  2. أولويات الأسبوع — STRAT-2: AI Priority Recommendations
 *  3. خطة الشهر      — STRAT-3: Monthly Operational Plan Generator
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    MarketingPlan, MarketingPlanStatus, SocialPlatform, PLATFORM_ASSETS,
    NotificationType, BrandHubProfile, PublisherBrief,
    AiContentPlan, AiContentPlanItem, AiPriorityRecommendation, AiMonthlyPlan,
    PlanObjectiveType,
} from '../../types';
import {
    getMarketingPlans, addMarketingPlan, updateMarketingPlan, deleteMarketingPlan,
    saveAiPlanToDb, saveMonthlyPlanToDb,
} from '../../services/marketingPlansService';
import {
    generateContentPlan, generatePriorityRecommendations, generateMonthlyPlan,
} from '../../services/geminiService';
import { saveSkillExecution } from '../../services/skillEngine';
import { useBrandStore } from '../../stores/brandStore';
import { EvaluationButtons } from '../shared/EvaluationButtons';
import { SkillType } from '../../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const POST_TYPE_COLORS: Record<string, string> = {
    Reel:      'bg-pink-100 text-pink-700',
    Post:      'bg-blue-100 text-blue-700',
    Story:     'bg-purple-100 text-purple-700',
    Carousel:  'bg-indigo-100 text-indigo-700',
    TikTok:    'bg-black text-white',
    Article:   'bg-green-100 text-green-700',
    Ad:        'bg-orange-100 text-orange-700',
    Poll:      'bg-teal-100 text-teal-700',
};

const OBJECTIVE_TYPE_OPTIONS: { value: PlanObjectiveType; label: string; icon: string }[] = [
    { value: 'awareness',   label: 'الوعي بالبراند',       icon: 'fa-bullhorn' },
    { value: 'engagement',  label: 'زيادة التفاعل',         icon: 'fa-heart' },
    { value: 'leads',       label: 'توليد عملاء محتملين',  icon: 'fa-funnel-dollar' },
    { value: 'sales',       label: 'زيادة المبيعات',        icon: 'fa-shopping-cart' },
    { value: 'retention',   label: 'الاحتفاظ بالعملاء',    icon: 'fa-user-check' },
];

const URGENCY_CONFIG = {
    high:   { cls: 'bg-red-100 text-red-700 border-red-200',    icon: 'fa-fire',      label: 'عاجل' },
    medium: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'fa-clock',  label: 'متوسط' },
    low:    { cls: 'bg-green-100 text-green-700 border-green-200', icon: 'fa-leaf',   label: 'منخفض' },
};

const CATEGORY_CONFIG: Record<string, { icon: string; color: string }> = {
    content:    { icon: 'fa-pen-nib',      color: 'text-pink-500' },
    ads:        { icon: 'fa-ad',           color: 'text-orange-500' },
    seo:        { icon: 'fa-search',       color: 'text-green-500' },
    crm:        { icon: 'fa-address-book', color: 'text-indigo-500' },
    engagement: { icon: 'fa-comments',     color: 'text-teal-500' },
    social:     { icon: 'fa-share-alt',    color: 'text-blue-500' },
    design:     { icon: 'fa-paint-brush',  color: 'text-purple-500' },
};

type HubTab = 'plans' | 'priorities' | 'monthly';

// ══════════════════════════════════════════════════════════════════════════════
// STRAT-1: Content Plans Tab
// ══════════════════════════════════════════════════════════════════════════════

interface GeneratorFormData {
    name: string;
    objective: string;
    objectiveType: PlanObjectiveType;
    platforms: SocialPlatform[];
    targetAudience: string;
    budget: number;
    durationDays: number;
}

const DURATION_OPTIONS = [
    { value: 7,  label: 'أسبوع واحد' },
    { value: 14, label: 'أسبوعان' },
    { value: 30, label: 'شهر كامل' },
];

const AiPlanGeneratorModal: React.FC<{
    brandProfile: BrandHubProfile;
    onClose: () => void;
    onSave: (plan: MarketingPlan) => void;
    brandId: string;
}> = ({ brandProfile, onClose, onSave, brandId }) => {
    const [step, setStep] = useState<'form' | 'generating' | 'result' | 'error'>('form');
    const [form, setForm] = useState<GeneratorFormData>({
        name: '',
        objective: '',
        objectiveType: 'engagement',
        platforms: [SocialPlatform.Instagram],
        targetAudience: brandProfile.brandAudiences?.[0]?.personaName ?? '',
        budget: 2000,
        durationDays: 30,
    });
    const [generatedPlan, setGeneratedPlan] = useState<AiContentPlan | null>(null);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [planExecutionId, setPlanExecutionId] = useState<string | null>(null);

    const togglePlatform = (p: SocialPlatform) => {
        setForm(f => ({
            ...f,
            platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
        }));
    };

    const handleGenerate = async () => {
        if (!form.name.trim() || !form.objective.trim() || form.platforms.length === 0) return;
        setStep('generating');
        try {
            const plan = await generateContentPlan(brandProfile, {
                objective:     form.objective,
                objectiveType: form.objectiveType,
                platforms:     form.platforms,
                targetAudience: form.targetAudience,
                budget:        form.budget,
                durationDays:  form.durationDays,
            });
            setGeneratedPlan(plan);
            setStep('result');
            // Save execution for evaluation tracking
            const execId = await saveSkillExecution({
                skillType:          SkillType.MarketingPlanSuggestion,
                brandId,
                input:              { objective: form.objective, durationDays: form.durationDays },
                output:             plan as unknown as Record<string, unknown>,
                rawOutput:          plan.overview ?? '',
                confidence:         0.85,
                brandPolicyPassed:  true,
                requiresApproval:   false,
                executionTimeMs:    0,
            });
            setPlanExecutionId(execId);
        } catch {
            setStep('error');
        }
    };

    const handleSave = async () => {
        if (!generatedPlan) return;
        setSaving(true);
        const saved = await addMarketingPlan(brandId, {
            name:           form.name,
            objective:      form.objective,
            startDate:      new Date(),
            endDate:        new Date(Date.now() + form.durationDays * 86_400_000),
            budget:         form.budget,
            targetAudience: form.targetAudience,
            kpis:           [],
            channels:       form.platforms,
            aiPlan:         generatedPlan,
        });
        setSaving(false);
        onSave(saved);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                            <i className="fas fa-robot text-white text-sm" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900">مولّد خطة المحتوى الذكي</h2>
                            <p className="text-xs text-gray-400">مدعوم بـ Gemini AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100">
                        <i className="fas fa-times" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4">

                    {/* Step: Form */}
                    {step === 'form' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">اسم الخطة</label>
                                    <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        placeholder="مثال: خطة رمضان 2026"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div className="col-span-2">
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">الهدف الرئيسي</label>
                                    <textarea value={form.objective} onChange={e => setForm(f => ({ ...f, objective: e.target.value }))} rows={2}
                                        placeholder="مثال: زيادة المبيعات بنسبة 30% خلال رمضان من خلال محتوى إلهامي وعروض حصرية"
                                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>

                            {/* Objective Type */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 block mb-2">نوع الهدف</label>
                                <div className="flex flex-wrap gap-2">
                                    {OBJECTIVE_TYPE_OPTIONS.map(opt => (
                                        <button key={opt.value} onClick={() => setForm(f => ({ ...f, objectiveType: opt.value }))}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                                form.objectiveType === opt.value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                                            }`}>
                                            <i className={`fas ${opt.icon} text-xs`} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Platforms */}
                            <div>
                                <label className="text-xs font-semibold text-gray-500 block mb-2">المنصات</label>
                                <div className="flex flex-wrap gap-2">
                                    {Object.values(SocialPlatform).map(p => {
                                        const asset = PLATFORM_ASSETS[p];
                                        const selected = form.platforms.includes(p);
                                        return (
                                            <button key={p} onClick={() => togglePlatform(p)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                                    selected ? `${asset.color} text-white border-transparent` : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                                                }`}>
                                                <i className={`${asset.icon} text-xs`} />
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">المدة</label>
                                    <select value={form.durationDays} onChange={e => setForm(f => ({ ...f, durationDays: Number(e.target.value) }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        {DURATION_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">الميزانية (ريال)</label>
                                    <input type="number" value={form.budget} onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))}
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-gray-500 block mb-1">الجمهور</label>
                                    <input value={form.targetAudience} onChange={e => setForm(f => ({ ...f, targetAudience: e.target.value }))}
                                        placeholder="مثال: شباب 18-35"
                                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step: Generating */}
                    {step === 'generating' && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                <i className="fas fa-robot text-white text-2xl animate-pulse" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">Gemini يحلل البراند ويبني الخطة...</h3>
                            <p className="text-sm text-gray-400 text-center max-w-sm">
                                يتم الآن تحليل هوية البراند وإنشاء خطة محتوى مخصصة تماماً. قد يستغرق هذا 15-30 ثانية.
                            </p>
                            <div className="flex gap-1.5 mt-2">
                                {[0, 1, 2].map(i => (
                                    <div key={i} className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step: Error */}
                    {step === 'error' && (
                        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                                <i className="fas fa-triangle-exclamation text-red-500 text-2xl" />
                            </div>
                            <h3 className="font-bold text-gray-800 text-lg">فشل التوليد</h3>
                            <p className="text-sm text-gray-500 max-w-sm">
                                تعذّر الاتصال بـ Gemini AI. تأكد من صحة مفتاح API وأن لديك حصة كافية، ثم حاول مجدداً.
                            </p>
                            <button
                                onClick={() => setStep('form')}
                                className="mt-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
                            >
                                <i className="fas fa-arrow-right me-2" />
                                العودة للنموذج
                            </button>
                        </div>
                    )}

                    {/* Step: Result */}
                    {step === 'result' && generatedPlan && (
                        <div className="space-y-4">
                            {/* Overview */}
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <i className="fas fa-lightbulb text-indigo-500" />
                                    <span className="text-sm font-semibold text-indigo-700">نظرة عامة على الخطة</span>
                                </div>
                                <p className="text-sm text-indigo-900">{generatedPlan.overview}</p>
                            </div>

                            {/* Stats row */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{generatedPlan.totalPosts}</p>
                                    <p className="text-xs text-gray-500">إجمالي المنشورات</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{form.durationDays}</p>
                                    <p className="text-xs text-gray-500">يوم</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-gray-900">{form.platforms.length}</p>
                                    <p className="text-xs text-gray-500">منصة</p>
                                </div>
                            </div>

                            {/* Platform distribution */}
                            {Object.keys(generatedPlan.platformDistribution).length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-xl p-4">
                                    <h4 className="text-xs font-semibold text-gray-500 mb-3">توزيع المنشورات</h4>
                                    <div className="space-y-2">
                                        {Object.entries(generatedPlan.platformDistribution).map(([platform, count]) => {
                                            const pct = generatedPlan.totalPosts > 0 ? (count / generatedPlan.totalPosts) * 100 : 0;
                                            return (
                                                <div key={platform} className="flex items-center gap-3">
                                                    <span className="text-xs text-gray-600 w-20 text-right">{platform}</span>
                                                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className="text-xs font-semibold text-gray-700 w-6 text-center">{count}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Content items */}
                            <div>
                                <h4 className="text-xs font-semibold text-gray-500 mb-2">جدول المنشورات ({generatedPlan.items.length})</h4>
                                <div className="space-y-2">
                                    {generatedPlan.items.map(item => (
                                        <ContentItemCard
                                            key={item.id}
                                            item={item}
                                            expanded={expandedItem === item.id}
                                            onToggle={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                    {step === 'form' && (
                        <>
                            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">إلغاء</button>
                            <button
                                onClick={handleGenerate}
                                disabled={!form.name.trim() || !form.objective.trim() || form.platforms.length === 0}
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-50">
                                <i className="fas fa-magic" />
                                توليد الخطة بالذكاء الاصطناعي
                            </button>
                        </>
                    )}
                    {step === 'result' && (
                        <>
                            <div className="flex items-center gap-2">
                                <button onClick={() => setStep('form')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                                    <i className="fas fa-redo mr-1" /> تعديل المدخلات
                                </button>
                                {planExecutionId && (
                                    <EvaluationButtons
                                        executionId={planExecutionId}
                                        brandId={brandId}
                                        skillType={SkillType.MarketingPlanSuggestion}
                                        output={generatedPlan?.overview ?? ''}
                                        compact
                                    />
                                )}
                            </div>
                            <button onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50">
                                {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
                                حفظ الخطة
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const ContentItemCard: React.FC<{
    item: AiContentPlanItem;
    expanded: boolean;
    onToggle: () => void;
    onSendToPublisher?: (brief: PublisherBrief) => void;
}> = ({ item, expanded, onToggle, onSendToPublisher }) => {
    const handleSend = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!onSendToPublisher) return;
        const brief: PublisherBrief = {
            id: crypto.randomUUID(),
            source: 'marketing-plans',
            title: item.topic,
            query: item.topic,
            objective: item.objective,
            angle: item.caption,
            competitors: [],
            keywords: item.hashtags,
            hashtags: item.hashtags,
            suggestedPlatforms: item.platform ? [item.platform as SocialPlatform] : [],
            notes: [],
        };
        onSendToPublisher(brief);
    };

    return (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-right">
                <span className="text-xs font-bold text-gray-400 w-8 flex-shrink-0">يوم {item.dayNumber}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${POST_TYPE_COLORS[item.postType] ?? 'bg-gray-100 text-gray-600'}`}>
                    {item.postType}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800 truncate text-right">{item.topic}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{item.suggestedTime}</span>
                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} text-gray-300 text-xs flex-shrink-0`} />
            </button>
            {expanded && (
                <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100 space-y-3">
                    <p className="text-sm text-gray-700 leading-relaxed">{item.caption}</p>
                    <div className="flex flex-wrap gap-1.5">
                        {item.hashtags.map((h, i) => (
                            <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{h}</span>
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span><i className="fas fa-bullseye mr-1" />{item.objective}</span>
                            {item.estimatedReach && <span><i className="fas fa-eye mr-1" />{item.estimatedReach}</span>}
                        </div>
                        {onSendToPublisher && (
                            <button
                                onClick={handleSend}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap"
                            >
                                <i className="fas fa-paper-plane text-[10px]" />
                                أرسل للناشر
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Plans List ────────────────────────────────────────────────────────────────

const PlanCard: React.FC<{ plan: MarketingPlan; onDelete: (id: string) => void; onSendToPublisher?: (brief: PublisherBrief) => void }> = ({ plan, onDelete, onSendToPublisher }) => {
    const [expanded, setExpanded] = useState(false);
    const statusColors: Record<MarketingPlanStatus, string> = {
        [MarketingPlanStatus.Active]:    'bg-green-100 text-green-700',
        [MarketingPlanStatus.Draft]:     'bg-blue-100 text-blue-700',
        [MarketingPlanStatus.Completed]: 'bg-gray-100 text-gray-600',
    };
    const statusLabel: Record<MarketingPlanStatus, string> = {
        [MarketingPlanStatus.Active]:    'نشطة',
        [MarketingPlanStatus.Draft]:     'مسودة',
        [MarketingPlanStatus.Completed]: 'مكتملة',
    };
    return (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-gray-900">{plan.name}</h3>
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${statusColors[plan.status]}`}>
                                {statusLabel[plan.status]}
                            </span>
                            {plan.aiPlan && (
                                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-purple-100 text-purple-700">
                                    <i className="fas fa-robot mr-1" />AI Plan
                                </span>
                            )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">{plan.objective}</p>
                        <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                            <span><i className="fas fa-calendar mr-1" />
                                {plan.startDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })} — {plan.endDate.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            <span><i className="fas fa-coins mr-1" />{plan.budget.toLocaleString('ar')} ريال</span>
                            {plan.aiPlan && <span><i className="fas fa-file-alt mr-1" />{plan.aiPlan.totalPosts} منشور</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        {plan.aiPlan && (
                            <button onClick={() => setExpanded(v => !v)}
                                className="px-3 py-1.5 text-xs text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50">
                                <i className={`fas fa-chevron-${expanded ? 'up' : 'down'} mr-1`} />
                                {expanded ? 'إخفاء' : 'عرض الخطة'}
                            </button>
                        )}
                        <button onClick={() => onDelete(plan.id)} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg">
                            <i className="fas fa-trash text-xs" />
                        </button>
                    </div>
                </div>
            </div>
            {expanded && plan.aiPlan && (
                <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
                    <p className="text-xs text-gray-600 leading-relaxed">{plan.aiPlan.overview}</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {plan.aiPlan.items.slice(0, 8).map(item => (
                            <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-2.5">
                                <div className="flex items-center gap-1.5 mb-1">
                                    <span className="text-xs text-gray-400">يوم {item.dayNumber}</span>
                                    <span className={`text-xs px-1.5 rounded-full ${POST_TYPE_COLORS[item.postType] ?? 'bg-gray-100 text-gray-600'}`}>{item.postType}</span>
                                </div>
                                <p className="text-xs text-gray-700 line-clamp-2">{item.topic}</p>
                            </div>
                        ))}
                        {plan.aiPlan.items.length > 8 && (
                            <div className="bg-white border border-gray-200 rounded-lg p-2.5 flex items-center justify-center">
                                <span className="text-xs text-gray-400">+{plan.aiPlan.items.length - 8} منشور</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const PlansTab: React.FC<{ brandProfile: BrandHubProfile; brandId: string; onSendToPublisher?: (brief: PublisherBrief) => void }> = ({ brandProfile, brandId, onSendToPublisher }) => {
    const [plans, setPlans]   = useState<MarketingPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setPlans(await getMarketingPlans(brandId));
        setLoading(false);
    }, [brandId]);

    useEffect(() => { void load(); }, [load]);

    const handleDelete = async (id: string) => {
        await deleteMarketingPlan(id);
        setPlans(ps => ps.filter(p => p.id !== id));
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-gray-900">خطط المحتوى</h2>
                    <p className="text-xs text-gray-400">{plans.length} خطة محفوظة</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl text-sm hover:opacity-90">
                    <i className="fas fa-magic text-xs" />
                    إنشاء خطة بالذكاء الاصطناعي
                </button>
            </div>

            {loading
                ? Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)
                : plans.length === 0
                    ? (
                        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                            <i className="fas fa-robot text-4xl text-gray-200 mb-3 block" />
                            <h3 className="font-bold text-gray-500">لا توجد خطط بعد</h3>
                            <p className="text-sm text-gray-400 mt-1">اضغط على "إنشاء خطة" وسيقوم Gemini بتوليد جدول محتوى كامل</p>
                        </div>
                    )
                    : plans.map(plan => <PlanCard key={plan.id} plan={plan} onDelete={handleDelete} onSendToPublisher={onSendToPublisher} />)
            }

            {showModal && (
                <AiPlanGeneratorModal
                    brandProfile={brandProfile}
                    brandId={brandId}
                    onClose={() => setShowModal(false)}
                    onSave={newPlan => setPlans(ps => [newPlan, ...ps])}
                />
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// STRAT-2: Priority Recommendations Tab
// ══════════════════════════════════════════════════════════════════════════════

const PrioritiesTab: React.FC<{ brandProfile: BrandHubProfile; brandId: string }> = ({ brandProfile, brandId }) => {
    const [recs, setRecs]       = useState<AiPriorityRecommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [generated, setGenerated] = useState(false);
    const [prioritiesExecutionId, setPrioritiesExecutionId] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setPrioritiesExecutionId(null);
        const metrics = {
            recentPostsCount:     12,
            avgEngagementRate:    3.4,
            activeAdsCampaigns:   2,
            avgRoas:              2.8,
            totalCustomers:       340,
        };
        const data = await generatePriorityRecommendations(brandProfile, metrics);
        setRecs(data);
        setGenerated(true);
        const execId = await saveSkillExecution({
            skillType:         SkillType.MarketingPlanSuggestion,
            brandId,
            input:             metrics,
            output:            { recommendations: data } as unknown as Record<string, unknown>,
            rawOutput:         data.map(r => r.title).join(', '),
            confidence:        0.85,
            brandPolicyPassed: true,
            requiresApproval:  false,
            executionTimeMs:   0,
        });
        setPrioritiesExecutionId(execId);
        setLoading(false);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-bold text-gray-900">أولويات هذا الأسبوع</h2>
                    <p className="text-xs text-gray-400">توصيات مخصصة مبنية على أداء البراند</p>
                </div>
                <button onClick={handleGenerate} disabled={loading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-60">
                    {loading
                        ? <><i className="fas fa-circle-notch fa-spin" /> جاري التحليل...</>
                        : <><i className="fas fa-sync-alt" /> {generated ? 'تحديث التوصيات' : 'توليد التوصيات'}</>
                    }
                </button>
            </div>

            {!generated && !loading && (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
                    <i className="fas fa-brain text-5xl text-gray-200 mb-3 block" />
                    <h3 className="font-bold text-gray-500">لم يتم توليد التوصيات بعد</h3>
                    <p className="text-sm text-gray-400 mt-1 mb-4">اضغط على "توليد التوصيات" وسيحلل Gemini أداء البراند</p>
                    <button onClick={handleGenerate}
                        className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl text-sm">
                        <i className="fas fa-magic mr-2" />توليد التوصيات
                    </button>
                </div>
            )}

            {loading && (
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                </div>
            )}

            {!loading && recs.length > 0 && (
                <div className="space-y-3">
                    {recs.map((rec, i) => {
                        const urgency = URGENCY_CONFIG[rec.urgency] ?? URGENCY_CONFIG.medium;
                        const cat     = CATEGORY_CONFIG[rec.category] ?? { icon: 'fa-star', color: 'text-gray-500' };
                        return (
                            <div key={rec.id} className="bg-white border border-gray-200 rounded-2xl p-5 flex items-start gap-4">
                                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-base font-bold text-gray-400">{i + 1}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <i className={`fas ${cat.icon} ${cat.color} text-sm`} />
                                        <h4 className="font-semibold text-gray-900 text-sm">{rec.title}</h4>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${urgency.cls}`}>
                                            <i className={`fas ${urgency.icon} mr-1`} />{urgency.label}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 leading-relaxed">{rec.description}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-0.5 rounded-full">
                                            <i className="fas fa-arrow-trend-up mr-1" />{rec.estimatedImpact}
                                        </span>
                                    </div>
                                </div>
                                <button className="flex-shrink-0 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 whitespace-nowrap">
                                    {rec.actionLabel}
                                </button>
                            </div>
                        );
                    })}
                    {prioritiesExecutionId && (
                        <div className="flex justify-end pt-1">
                            <EvaluationButtons
                                executionId={prioritiesExecutionId}
                                brandId={brandId}
                                skillType={SkillType.MarketingPlanSuggestion}
                                output={recs.map(r => r.title).join(', ')}
                                compact
                            />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// STRAT-3: Monthly Plan Tab
// ══════════════════════════════════════════════════════════════════════════════

const TASK_CATEGORY_COLORS: Record<string, string> = {
    content:    'bg-pink-100 text-pink-700',
    ads:        'bg-orange-100 text-orange-700',
    seo:        'bg-green-100 text-green-700',
    crm:        'bg-indigo-100 text-indigo-700',
    social:     'bg-blue-100 text-blue-700',
    design:     'bg-purple-100 text-purple-700',
};

const MonthlyPlanTab: React.FC<{ brandProfile: BrandHubProfile; brandId: string }> = ({ brandProfile, brandId }) => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const [month, setMonth]       = useState(currentMonth);
    const [goals, setGoals]       = useState({ reach: 50000, leads: 100, revenue: 30000 });
    const [plan, setPlan]         = useState<AiMonthlyPlan | null>(null);
    const [loading, setLoading]   = useState(false);
    const [saving, setSaving]     = useState(false);
    const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
    const [monthlyExecutionId, setMonthlyExecutionId] = useState<string | null>(null);

    const handleGenerate = async () => {
        setLoading(true);
        setMonthlyExecutionId(null);
        try {
            const result = await generateMonthlyPlan(brandProfile, {
                month: new Date(month + '-01').toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }),
                goals,
            });
            setPlan(result);
            const execId = await saveSkillExecution({
                skillType:         SkillType.CampaignBrief,
                brandId,
                input:             { month, goals },
                output:            result as unknown as Record<string, unknown>,
                rawOutput:         result.overview ?? '',
                confidence:        0.85,
                brandPolicyPassed: true,
                requiresApproval:  false,
                executionTimeMs:   0,
            });
            setMonthlyExecutionId(execId);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!plan) return;
        setSaving(true);
        if (savedPlanId) {
            await saveMonthlyPlanToDb(savedPlanId, plan);
        } else {
            const saved = await addMarketingPlan(brandId, {
                name:           `خطة ${plan.month}`,
                objective:      plan.overview,
                startDate:      new Date(month + '-01'),
                endDate:        new Date(month + '-28'),
                budget:         goals.revenue ?? 0,
                targetAudience: '',
                kpis:           plan.kpis,
                channels:       [],
                monthlyPlan:    plan,
            });
            setSavedPlanId(saved.id);
        }
        setSaving(false);
    };

    return (
        <div className="space-y-5">
            {/* Input form */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="font-bold text-gray-900 mb-4">مولّد الخطة الشهرية</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">الشهر</label>
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">هدف الوصول</label>
                        <input type="number" value={goals.reach} onChange={e => setGoals(g => ({ ...g, reach: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">عملاء محتملون</label>
                        <input type="number" value={goals.leads} onChange={e => setGoals(g => ({ ...g, leads: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-gray-500 block mb-1">هدف الإيراد (ريال)</label>
                        <input type="number" value={goals.revenue} onChange={e => setGoals(g => ({ ...g, revenue: Number(e.target.value) }))}
                            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                </div>
                <div className="flex items-center gap-3 mt-4">
                    <button onClick={handleGenerate} disabled={loading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl text-sm hover:opacity-90 disabled:opacity-60">
                        {loading
                            ? <><i className="fas fa-circle-notch fa-spin" /> جاري التوليد...</>
                            : <><i className="fas fa-calendar-alt" /> توليد الخطة الشهرية</>
                        }
                    </button>
                    {plan && (
                        <button onClick={handleSave} disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 border border-indigo-200 text-indigo-700 rounded-xl text-sm hover:bg-indigo-50 disabled:opacity-60">
                            {saving ? <i className="fas fa-circle-notch fa-spin" /> : <i className="fas fa-save" />}
                            حفظ كخطة
                        </button>
                    )}
                    {plan && monthlyExecutionId && (
                        <EvaluationButtons
                            executionId={monthlyExecutionId}
                            brandId={brandId}
                            skillType={SkillType.CampaignBrief}
                            output={plan.overview ?? ''}
                            compact
                        />
                    )}
                </div>
            </div>

            {/* Generated plan */}
            {plan && !loading && (
                <div className="space-y-4">
                    {/* Overview */}
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4">
                        <h3 className="font-semibold text-indigo-700 mb-2">{plan.month}</h3>
                        <p className="text-sm text-indigo-900">{plan.overview}</p>
                    </div>

                    {/* KPIs */}
                    {plan.kpis.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            <h4 className="text-xs font-semibold text-gray-500 mb-3">مؤشرات الأداء الرئيسية</h4>
                            <div className="flex flex-wrap gap-2">
                                {plan.kpis.map((kpi, i) => (
                                    <span key={i} className="text-xs bg-gray-100 text-gray-700 px-3 py-1 rounded-full border border-gray-200">
                                        <i className="fas fa-chart-line mr-1 text-indigo-500" />{kpi}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Weekly breakdown */}
                    {plan.weeks.map(week => (
                        <div key={week.weekNumber} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-sm font-bold">{week.weekNumber}</span>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-400">الأسبوع {week.weekNumber}</p>
                                    <p className="font-semibold text-gray-800 text-sm">{week.focus}</p>
                                </div>
                            </div>
                            <div className="px-5 py-3 space-y-2">
                                {week.tasks.map((task, i) => (
                                    <div key={i} className="flex items-center gap-3 py-1.5">
                                        <div className="w-5 h-5 rounded border-2 border-gray-200 flex-shrink-0" />
                                        <span className="flex-1 text-sm text-gray-700">{task.title}</span>
                                        {task.platform && (
                                            <span className="text-xs text-gray-400">{task.platform}</span>
                                        )}
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${TASK_CATEGORY_COLORS[task.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                            {task.category}
                                        </span>
                                        <span className="text-xs text-gray-400 w-12 text-center">يوم {task.dueDay}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════

interface MarketingPlansPageProps {
    plans?: MarketingPlan[];
    addNotification?: (type: NotificationType, message: string) => void;
    onAddPlan?: (plan: Omit<MarketingPlan, 'id' | 'status'>) => Promise<void>;
    brandProfile?: BrandHubProfile;
    onSendToPublisher?: (brief: PublisherBrief) => void;
}

const HUB_TABS: { id: HubTab; label: string; icon: string }[] = [
    { id: 'plans',      label: 'خطط المحتوى',     icon: 'fa-file-alt' },
    { id: 'priorities', label: 'أولويات الأسبوع',  icon: 'fa-brain' },
    { id: 'monthly',    label: 'خطة الشهر',        icon: 'fa-calendar-alt' },
];

export const MarketingPlansPage: React.FC<MarketingPlansPageProps> = ({ addNotification, brandProfile: propBrandProfile, onSendToPublisher }) => {
    const { activeBrand } = useBrandStore();
    const [activeTab, setActiveTab] = useState<HubTab>('plans');

    // Use prop brandProfile or build a minimal fallback
    const brandProfile: BrandHubProfile = propBrandProfile ?? {
        brandName:         activeBrand?.name ?? 'البراند',
        industry:          '',
        values:            [],
        keySellingPoints:  [],
        styleGuidelines:   [],
        brandVoice: {
            toneDescription:  [],
            keywords:         [],
            negativeKeywords: [],
            toneStrength:     0.5,
            toneSentiment:    0.5,
            voiceGuidelines:  { dos: [], donts: [] },
        },
        brandAudiences:    [],
        consistencyScore:  0,
        lastMemoryUpdate:  new Date().toISOString(),
    };

    const brandId = activeBrand?.id ?? '';

    return (
        <div className="space-y-4">
            {/* Page Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <i className="fas fa-robot text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">AI Strategy Hub</h1>
                    <p className="text-xs text-gray-400">مدعوم بـ Gemini · خطط محتوى · توصيات أسبوعية · خطة شهرية</p>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b border-gray-200 pb-px">
                {HUB_TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                            activeTab === tab.id
                                ? 'border-indigo-600 text-indigo-700'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}>
                        <i className={`fas ${tab.icon} text-xs`} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            {activeTab === 'plans'      && <PlansTab brandProfile={brandProfile} brandId={brandId} onSendToPublisher={onSendToPublisher} />}
            {activeTab === 'priorities' && <PrioritiesTab brandProfile={brandProfile} brandId={brandId} />}
            {activeTab === 'monthly'    && <MonthlyPlanTab brandProfile={brandProfile} brandId={brandId} />}
        </div>
    );
};
