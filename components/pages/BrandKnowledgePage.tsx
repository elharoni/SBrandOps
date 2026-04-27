// components/pages/BrandKnowledgePage.tsx
// Brand Knowledge Base — قاعدة معرفة البراند (المنتجات / FAQ / سياسات / منافسين / سكريبتات)

import React, { useState, useEffect, useCallback } from 'react';
import { NotificationType, BrandKnowledgeEntry, BrandKnowledgeType, Brand } from '../../types';
import {
    getBrandKnowledge,
    addKnowledgeEntry,
    updateKnowledgeEntry,
    deleteKnowledgeEntry,
    getKnowledgeHistory,
    KnowledgeHistoryEntry,
} from '../../services/brandKnowledgeService';
import { getBrandHubProfile } from '../../services/brandHubService';
import { callAIProxy, AIQuotaError } from '../../services/aiProxy';
import { useLanguage } from '../../context/LanguageContext';

// ── AI Quick-Fill types ───────────────────────────────────────────────────────

type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'editing';

interface AISuggestion {
    id: number;
    title: string;
    content: string;
    status: SuggestionStatus;
    editTitle: string;
    editContent: string;
}

// ── AI prompt builder ─────────────────────────────────────────────────────────

function buildAIPrompt(type: BrandKnowledgeType, brandName: string, industry: string, description: string, audience: string, values: string): string {
    const context = `
اسم البراند: ${brandName}
الصناعة: ${industry || 'غير محدد'}
وصف البراند: ${description || 'غير متوفر'}
الجمهور المستهدف: ${audience || 'غير محدد'}
قيم البراند: ${values || 'غير محدد'}
`.trim();

    if (type === 'product') {
        return `أنت خبير تسويق ومحتوى. بناءً على معلومات البراند التالية، اقترح 6 إدخالات لقسم "المنتجات والخدمات" في قاعدة معرفة البراند.

${context}

المطلوب: أنشئ 6 إدخالات واقعية ومقنعة للمنتجات أو الخدمات التي قد يقدمها هذا البراند. كل إدخال يتضمن عنوان واضح ووصف يشمل الميزات الرئيسية والسعر التقريبي والجمهور المستهدف.

أعد النتيجة بتنسيق JSON فقط — مصفوفة من الكائنات، كل كائن له: "title" (عنوان قصير) و"content" (وصف 50-150 كلمة). بدون أي نص خارج JSON.`;
    }

    if (type === 'faq') {
        return `أنت خبير خدمة عملاء. بناءً على معلومات البراند التالية، اقترح 6 أسئلة شائعة مع إجاباتها لقاعدة المعرفة.

${context}

المطلوب: أنشئ 6 أسئلة يطرحها العملاء بشكل متكرر مع إجابات دقيقة وواضحة. ركز على الأسئلة المتعلقة بالسعر والشحن والضمان والدعم والخدمات.

أعد النتيجة بتنسيق JSON فقط — مصفوفة من الكائنات، كل كائن له: "title" (السؤال) و"content" (الإجابة الكاملة 40-120 كلمة). بدون أي نص خارج JSON.`;
    }

    return `أنت خبير مبيعات وتواصل. بناءً على معلومات البراند التالية، اقترح 6 سكريبتات محادثة للرد على العملاء في سيناريوهات مختلفة.

${context}

المطلوب: أنشئ 6 سكريبتات جاهزة لسيناريوهات: استفسار عن المنتج، طلب خصم، شكوى، رد على اعتراض سعري، إغلاق بيع، ومتابعة ما بعد الشراء. كل سكريبت بأسلوب احترافي يناسب صوت البراند.

أعد النتيجة بتنسيق JSON فقط — مصفوفة من الكائنات، كل كائن له: "title" (اسم السيناريو) و"content" (السكريبت الكامل 50-150 كلمة). بدون أي نص خارج JSON.`;
}

// ── AI Quick-Fill Modal ───────────────────────────────────────────────────────

const AIQuickFillModal: React.FC<{
    ar: boolean;
    tabLabelAr: string;
    tabLabelEn: string;
    isGenerating: boolean;
    suggestions: AISuggestion[];
    isSaving: boolean;
    onToggleStatus: (id: number, status: SuggestionStatus) => void;
    onEditField: (id: number, field: 'editTitle' | 'editContent', value: string) => void;
    onSave: () => void;
    onClose: () => void;
}> = ({ ar, tabLabelAr, tabLabelEn, isGenerating, suggestions, isSaving, onToggleStatus, onEditField, onSave, onClose }) => {
    const approvedCount = suggestions.filter(s => s.status === 'approved').length;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-3xl border border-dark-border bg-dark-card shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-dark-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-primary/15">
                            <i className="fas fa-wand-magic-sparkles text-brand-secondary text-sm" />
                        </div>
                        <div>
                            <p className="font-bold text-white text-sm">
                                {ar ? 'توليد تلقائي بالذكاء الاصطناعي' : 'AI Quick-Fill'}
                            </p>
                            <p className="text-xs text-dark-text-secondary">
                                {ar ? `تبويب: ${tabLabelAr}` : `Tab: ${tabLabelEn}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary hover:text-white transition-colors">
                        <i className="fas fa-xmark text-sm" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
                    {isGenerating ? (
                        <div className="py-20 text-center">
                            <i className="fas fa-wand-magic-sparkles fa-spin text-3xl text-brand-secondary mb-4 block" />
                            <p className="font-bold text-white">{ar ? 'AI يحلل ملف براندك...' : 'AI is analyzing your brand...'}</p>
                            <p className="text-xs text-dark-text-secondary mt-1">{ar ? 'يستغرق 5-10 ثوانٍ' : 'Takes 5-10 seconds'}</p>
                        </div>
                    ) : suggestions.length === 0 ? (
                        <div className="py-16 text-center text-dark-text-secondary">
                            <i className="fas fa-circle-exclamation text-2xl mb-3 block" />
                            <p className="text-sm">{ar ? 'لم يتم توليد اقتراحات.' : 'No suggestions generated.'}</p>
                        </div>
                    ) : (
                        <>
                            <p className="text-xs text-dark-text-secondary pb-1">
                                {ar
                                    ? `راجع الاقتراحات — وافق ✓ أو عدّل ✎ أو ارفض ✗ كل إدخال قبل الحفظ`
                                    : `Review suggestions — approve ✓, edit ✎, or reject ✗ each entry before saving`}
                            </p>
                            {suggestions.map(s => (
                                <div
                                    key={s.id}
                                    className={`rounded-2xl border p-4 transition-all ${
                                        s.status === 'approved'  ? 'border-emerald-500/40 bg-emerald-500/5' :
                                        s.status === 'rejected'  ? 'border-dark-border/30 bg-dark-bg/30 opacity-50' :
                                        s.status === 'editing'   ? 'border-brand-primary/40 bg-brand-primary/5' :
                                        'border-dark-border bg-dark-bg/40'
                                    }`}
                                >
                                    {s.status === 'editing' ? (
                                        <div className="space-y-2">
                                            <input
                                                value={s.editTitle}
                                                onChange={e => onEditField(s.id, 'editTitle', e.target.value)}
                                                className="w-full rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-primary/60"
                                            />
                                            <textarea
                                                value={s.editContent}
                                                onChange={e => onEditField(s.id, 'editContent', e.target.value.slice(0, 3000))}
                                                rows={3}
                                                className="w-full resize-none rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-sm text-white outline-none focus:border-brand-primary/60"
                                            />
                                            <button
                                                onClick={() => onToggleStatus(s.id, 'approved')}
                                                className="text-xs font-bold text-emerald-400 hover:text-emerald-300"
                                            >
                                                <i className="fas fa-check me-1" />
                                                {ar ? 'حفظ التعديل' : 'Save Edit'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-start gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-white text-sm">{s.title}</p>
                                                <p className="mt-1 text-xs text-dark-text-secondary leading-relaxed line-clamp-3">{s.content}</p>
                                            </div>
                                            <div className="flex flex-shrink-0 items-center gap-1">
                                                <button
                                                    onClick={() => onToggleStatus(s.id, s.status === 'approved' ? 'pending' : 'approved')}
                                                    title={ar ? 'وافق' : 'Approve'}
                                                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition-colors ${
                                                        s.status === 'approved'
                                                            ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-400'
                                                            : 'border-dark-border text-dark-text-secondary hover:border-emerald-500/40 hover:text-emerald-400'
                                                    }`}
                                                >
                                                    <i className="fas fa-check" />
                                                </button>
                                                <button
                                                    onClick={() => onToggleStatus(s.id, 'editing')}
                                                    title={ar ? 'عدّل' : 'Edit'}
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-dark-border text-xs text-dark-text-secondary transition-colors hover:border-brand-primary/40 hover:text-brand-secondary"
                                                >
                                                    <i className="fas fa-pen" />
                                                </button>
                                                <button
                                                    onClick={() => onToggleStatus(s.id, s.status === 'rejected' ? 'pending' : 'rejected')}
                                                    title={ar ? 'ارفض' : 'Reject'}
                                                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs transition-colors ${
                                                        s.status === 'rejected'
                                                            ? 'border-rose-500/60 bg-rose-500/20 text-rose-400'
                                                            : 'border-dark-border text-dark-text-secondary hover:border-rose-400/40 hover:text-rose-400'
                                                    }`}
                                                >
                                                    <i className="fas fa-xmark" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </>
                    )}
                </div>

                {/* Footer */}
                {!isGenerating && suggestions.length > 0 && (
                    <div className="flex items-center justify-between border-t border-dark-border px-6 py-4">
                        <p className="text-xs text-dark-text-secondary">
                            {ar
                                ? `${approvedCount} من ${suggestions.length} موافق عليه`
                                : `${approvedCount} of ${suggestions.length} approved`}
                        </p>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-text-secondary hover:text-white transition-colors">
                                {ar ? 'إلغاء' : 'Cancel'}
                            </button>
                            <button
                                onClick={onSave}
                                disabled={approvedCount === 0 || isSaving}
                                className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                            >
                                <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'} text-xs`} />
                                {ar ? `حفظ الموافق عليها (${approvedCount})` : `Save Approved (${approvedCount})`}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ── Tab config ────────────────────────────────────────────────────────────────

const KNOWLEDGE_TABS: {
    type: BrandKnowledgeType;
    labelAr: string;
    labelEn: string;
    icon: string;
    hintAr: string;
    hintEn: string;
    placeholderTitleAr: string;
    placeholderTitleEn: string;
    placeholderContentAr: string;
    placeholderContentEn: string;
}[] = [
    {
        type: 'product',
        labelAr: 'المنتجات والخدمات',
        labelEn: 'Products & Services',
        icon: 'fa-box-open',
        hintAr: 'أضف كل منتج أو خدمة تقدمها مع تفاصيل السعر والميزات. سيستخدمها AI لاقتراح المحتوى والرد على العملاء.',
        hintEn: 'Add each product or service with pricing and feature details. AI uses this for content suggestions and customer replies.',
        placeholderTitleAr: 'مثال: باقة التواصل الاجتماعي الشهرية',
        placeholderTitleEn: 'e.g. Monthly Social Media Package',
        placeholderContentAr: 'صف المنتج: المميزات، السعر، للمن هو، ما الذي يحصل عليه العميل...',
        placeholderContentEn: 'Describe the product: features, price, who it\'s for, what the customer gets...',
    },
    {
        type: 'faq',
        labelAr: 'الأسئلة الشائعة',
        labelEn: 'FAQ',
        icon: 'fa-circle-question',
        hintAr: 'أضف الأسئلة التي يكررها العملاء مع الإجابة الصحيحة. سيستخدمها AI في الرد على الرسائل تلقائياً.',
        hintEn: 'Add frequently asked questions with accurate answers. AI will use these to auto-reply to messages.',
        placeholderTitleAr: 'مثال: هل تقدمون خدمة الشحن للمناطق البعيدة؟',
        placeholderTitleEn: 'e.g. Do you offer delivery to remote areas?',
        placeholderContentAr: 'الإجابة الكاملة والدقيقة على هذا السؤال...',
        placeholderContentEn: 'The full and accurate answer to this question...',
    },
    {
        type: 'policy',
        labelAr: 'السياسات والشروط',
        labelEn: 'Policies',
        icon: 'fa-shield-halved',
        hintAr: 'سياسات الشحن والدفع والإرجاع والضمان. تظهر في الردود التلقائية عند استفسار العملاء.',
        hintEn: 'Shipping, payment, return, and warranty policies. Used in auto-replies when customers ask.',
        placeholderTitleAr: 'مثال: سياسة الإرجاع والاستبدال',
        placeholderTitleEn: 'e.g. Return & Exchange Policy',
        placeholderContentAr: 'تفاصيل السياسة بشكل واضح ودقيق...',
        placeholderContentEn: 'Policy details in clear and precise terms...',
    },
    {
        type: 'competitor',
        labelAr: 'المنافسون',
        labelEn: 'Competitors',
        icon: 'fa-chess',
        hintAr: 'أضف معلومات عن منافسيك. يستخدمها AI لكتابة محتوى يبرز مزاياك التنافسية.',
        hintEn: 'Add info about your competitors. AI uses this to write content highlighting your competitive edge.',
        placeholderTitleAr: 'مثال: اسم المنافس الرئيسي',
        placeholderTitleEn: 'e.g. Main Competitor Name',
        placeholderContentAr: 'نقاط قوتهم وضعفهم مقارنة ببراندك...',
        placeholderContentEn: 'Their strengths and weaknesses compared to your brand...',
    },
    {
        type: 'scenario_script',
        labelAr: 'سكريبتات المحادثة',
        labelEn: 'Conversation Scripts',
        icon: 'fa-comments',
        hintAr: 'سكريبتات جاهزة لسيناريوهات محددة: استفسار، شكوى، طلب خصم، إغلاق البيع. تُحسّن جودة الردود التلقائية.',
        hintEn: 'Ready scripts for specific scenarios: inquiry, complaint, discount request, closing a sale.',
        placeholderTitleAr: 'مثال: رد على شكوى تأخير الشحن',
        placeholderTitleEn: 'e.g. Reply to shipping delay complaint',
        placeholderContentAr: 'السكريبت الكامل مع السياق المناسب...',
        placeholderContentEn: 'Full script with appropriate context...',
    },
];

// ── Entry card ────────────────────────────────────────────────────────────────

const EntryCard: React.FC<{
    entry: BrandKnowledgeEntry;
    ar: boolean;
    onEdit: (entry: BrandKnowledgeEntry) => void;
    onDelete: (id: string) => void;
    onHistory: (entry: BrandKnowledgeEntry) => void;
    isDeleting: boolean;
}> = ({ entry, ar, onEdit, onDelete, onHistory, isDeleting }) => (
    <div className="rounded-2xl border border-dark-border bg-dark-bg/50 p-4 transition-all hover:border-dark-border/80">
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-white text-sm">{entry.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-dark-text-secondary line-clamp-3">{entry.content}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
                <button
                    onClick={() => onHistory(entry)}
                    title={ar ? 'سجل الإصدارات' : 'Version history'}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary transition-colors hover:border-violet-400/40 hover:text-violet-400"
                >
                    <i className="fas fa-clock-rotate-left text-xs" />
                </button>
                <button
                    onClick={() => onEdit(entry)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary transition-colors hover:border-brand-primary/40 hover:text-brand-secondary"
                >
                    <i className="fas fa-pen text-xs" />
                </button>
                <button
                    onClick={() => onDelete(entry.id)}
                    disabled={isDeleting}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary transition-colors hover:border-rose-400/40 hover:text-rose-400 disabled:opacity-40"
                >
                    <i className="fas fa-trash text-xs" />
                </button>
            </div>
        </div>
    </div>
);

// ── Entry form ────────────────────────────────────────────────────────────────

const EntryForm: React.FC<{
    tab: typeof KNOWLEDGE_TABS[number];
    initial?: BrandKnowledgeEntry;
    ar: boolean;
    onSave: (title: string, content: string) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
}> = ({ tab, initial, ar, onSave, onCancel, isSaving }) => {
    const [title, setTitle]     = useState(initial?.title ?? '');
    const [content, setContent] = useState(initial?.content ?? '');

    return (
        <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-5 space-y-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                {initial ? (ar ? 'تعديل الإدخال' : 'Edit Entry') : (ar ? 'إضافة جديد' : 'Add New')}
            </p>
            <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={ar ? tab.placeholderTitleAr : tab.placeholderTitleEn}
                className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
            />
            <div className="relative">
                <textarea
                    value={content}
                    onChange={e => setContent(e.target.value.slice(0, 3000))}
                    rows={4}
                    placeholder={ar ? tab.placeholderContentAr : tab.placeholderContentEn}
                    className={`w-full resize-none rounded-xl border bg-dark-bg px-4 py-2.5 text-sm text-white outline-none transition placeholder:text-dark-text-secondary/50 ${
                        content.length > 2700
                            ? 'border-red-500/60 focus:border-red-500'
                            : 'border-dark-border focus:border-brand-primary/60'
                    }`}
                />
                <span className={`absolute bottom-2 end-3 text-[10px] font-mono ${
                    content.length > 2700 ? 'text-red-400' : 'text-dark-text-secondary/50'
                }`}>
                    {content.length}/3000
                </span>
            </div>
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-text-secondary transition-colors hover:text-white"
                >
                    {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                    onClick={() => onSave(title.trim(), content.trim())}
                    disabled={!title.trim() || !content.trim() || isSaving || content.length > 3000}
                    className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                    <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-check'} text-xs`} />
                    {ar ? 'حفظ' : 'Save'}
                </button>
            </div>
        </div>
    );
};

// ── AI-enabled tab types ──────────────────────────────────────────────────────

const AI_SUPPORTED_TYPES: BrandKnowledgeType[] = ['product', 'faq', 'scenario_script'];

// ── Main Page ─────────────────────────────────────────────────────────────────

interface BrandKnowledgePageProps {
    brandId: string;
    brand?: Brand;
    addNotification: (type: NotificationType, message: string) => void;
}

export const BrandKnowledgePage: React.FC<BrandKnowledgePageProps> = ({
    brandId,
    brand,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [activeType, setActiveType]           = useState<BrandKnowledgeType>('product');
    const [entries, setEntries]                 = useState<BrandKnowledgeEntry[]>([]);
    const [isLoading, setIsLoading]             = useState(true);
    const [showForm, setShowForm]               = useState(false);
    const [editingEntry, setEditingEntry]       = useState<BrandKnowledgeEntry | null>(null);
    const [isSaving, setIsSaving]               = useState(false);
    const [deletingId, setDeletingId]           = useState<string | null>(null);
    const [search, setSearch]                   = useState('');

    // AI Quick-Fill state
    const [showAIModal, setShowAIModal]         = useState(false);
    const [isGenerating, setIsGenerating]       = useState(false);
    const [aiSuggestions, setAISuggestions]     = useState<AISuggestion[]>([]);
    const [isSavingAI, setIsSavingAI]           = useState(false);

    // Version history state
    const [historyEntry, setHistoryEntry]       = useState<BrandKnowledgeEntry | null>(null);
    const [historyItems, setHistoryItems]       = useState<KnowledgeHistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading]   = useState(false);

    const tab = KNOWLEDGE_TABS.find(t => t.type === activeType)!;

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await getBrandKnowledge(brandId);
            setEntries(data);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل تحميل قاعدة المعرفة.' : 'Failed to load knowledge base.');
        } finally {
            setIsLoading(false);
        }
    }, [brandId, addNotification, ar]);

    useEffect(() => { load(); }, [load]);

    const titleSimilarity = (a: string, b: string): number => {
        const wordsOf = (s: string) => s.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        const aw = new Set(wordsOf(a));
        const bw = wordsOf(b);
        if (!aw.size || !bw.length) return 0;
        const matches = bw.filter(w => aw.has(w)).length;
        return matches / Math.max(aw.size, bw.length);
    };

    const handleSave = async (title: string, content: string) => {
        // Duplicate detection on new entries only
        if (!editingEntry) {
            const similar = entries
                .filter(e => e.type === activeType)
                .find(e => titleSimilarity(e.title, title) > 0.6);
            if (similar) {
                const proceed = window.confirm(
                    ar
                        ? `عنصر مشابه موجود: "${similar.title}"\nهل تريد الإضافة على أي حال؟`
                        : `Similar entry exists: "${similar.title}"\nAdd anyway?`,
                );
                if (!proceed) return;
            }
        }

        setIsSaving(true);
        try {
            if (editingEntry) {
                await updateKnowledgeEntry(brandId, editingEntry.id, { title, content });
                setEntries(prev => prev.map(e => e.id === editingEntry.id ? { ...e, title, content } : e));
                addNotification(NotificationType.Success, ar ? 'تم التحديث.' : 'Updated.');
            } else {
                const entry = await addKnowledgeEntry(brandId, {
                    type: activeType,
                    title,
                    content,
                    metadata: {},
                    sortOrder: entries.filter(e => e.type === activeType).length,
                });
                setEntries(prev => [...prev, entry]);
                addNotification(NotificationType.Success, ar ? 'تمت الإضافة.' : 'Added.');
            }
            setShowForm(false);
            setEditingEntry(null);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل الحفظ.' : 'Save failed.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm(ar ? 'هل تريد حذف هذا الإدخال؟' : 'Delete this entry?')) return;
        setDeletingId(id);
        try {
            await deleteKnowledgeEntry(brandId, id);
            setEntries(prev => prev.filter(e => e.id !== id));
            addNotification(NotificationType.Success, ar ? 'تم الحذف.' : 'Deleted.');
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل الحذف.' : 'Delete failed.');
        } finally {
            setDeletingId(null);
        }
    };

    const handleEdit = (entry: BrandKnowledgeEntry) => {
        setEditingEntry(entry);
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setEditingEntry(null);
    };

    const handleOpenHistory = async (entry: BrandKnowledgeEntry) => {
        setHistoryEntry(entry);
        setHistoryLoading(true);
        setHistoryItems([]);
        const items = await getKnowledgeHistory(entry.id);
        setHistoryItems(items);
        setHistoryLoading(false);
    };

    const handleRestoreVersion = async (version: KnowledgeHistoryEntry) => {
        if (!historyEntry) return;
        if (!window.confirm(ar ? `استرجاع الإصدار ${version.versionNumber}؟` : `Restore version ${version.versionNumber}?`)) return;
        try {
            await updateKnowledgeEntry(brandId, historyEntry.id, {
                title: version.title,
                content: version.content,
            });
            setEntries(prev => prev.map(e => e.id === historyEntry.id
                ? { ...e, title: version.title, content: version.content }
                : e,
            ));
            addNotification(NotificationType.Success, ar ? 'تم استرجاع الإصدار.' : 'Version restored.');
            setHistoryEntry(null);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل الاسترجاع.' : 'Restore failed.');
        }
    };

    // ── AI Quick-Fill handlers ─────────────────────────────────────────────────

    const handleOpenAI = async () => {
        setShowAIModal(true);
        setIsGenerating(true);
        setAISuggestions([]);
        try {
            const brandName = brand?.name ?? 'براند';
            const profile = await getBrandHubProfile(brandId, brandName);
            const industry   = profile.industry ?? brand?.industry ?? '';
            const description = (profile as any).description ?? '';
            const audience   = profile.brandAudiences?.map((a: any) => a.name ?? a).join('، ') ?? '';
            const values     = profile.values?.join('، ') ?? '';

            const prompt = buildAIPrompt(activeType, brandName, industry, description, audience, values);
            const result = await callAIProxy({ model: 'gemini-2.0-flash', prompt, feature: 'knowledge_quickfill', brand_id: brandId });

            // Parse JSON — strip markdown code fences if present
            const raw = result.text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
            const parsed: { title: string; content: string }[] = JSON.parse(raw);

            setAISuggestions(
                parsed.slice(0, 8).map((item, i) => ({
                    id: i,
                    title: item.title ?? '',
                    content: (item.content ?? '').slice(0, 3000),
                    status: 'pending',
                    editTitle: item.title ?? '',
                    editContent: (item.content ?? '').slice(0, 3000),
                }))
            );
        } catch (err) {
            setShowAIModal(false);
            if (err instanceof AIQuotaError) {
                addNotification(NotificationType.Error, ar ? 'تجاوزت حد الاستخدام اليومي للذكاء الاصطناعي.' : 'AI daily quota exceeded.');
            } else {
                addNotification(NotificationType.Error, ar ? 'فشل التوليد التلقائي. حاول مرة أخرى.' : 'AI generation failed. Try again.');
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleToggleSuggestionStatus = (id: number, status: SuggestionStatus) => {
        setAISuggestions(prev => prev.map(s => {
            if (s.id !== id) return s;
            if (status === 'approved' && s.status === 'editing') {
                return { ...s, status: 'approved', title: s.editTitle, content: s.editContent };
            }
            return { ...s, status };
        }));
    };

    const handleEditSuggestionField = (id: number, field: 'editTitle' | 'editContent', value: string) => {
        setAISuggestions(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const handleSaveAISuggestions = async () => {
        const approved = aiSuggestions.filter(s => s.status === 'approved');
        if (!approved.length) return;
        setIsSavingAI(true);
        try {
            const baseOrder = entries.filter(e => e.type === activeType).length;
            for (let i = 0; i < approved.length; i++) {
                const s = approved[i];
                const entry = await addKnowledgeEntry(brandId, {
                    type: activeType,
                    title: s.title,
                    content: s.content,
                    metadata: { source: 'ai_quickfill' },
                    sortOrder: baseOrder + i,
                });
                setEntries(prev => [...prev, entry]);
            }
            addNotification(NotificationType.Success, ar ? `تم حفظ ${approved.length} إدخال بنجاح.` : `${approved.length} entries saved.`);
            setShowAIModal(false);
            setAISuggestions([]);
        } catch {
            addNotification(NotificationType.Error, ar ? 'فشل حفظ الاقتراحات.' : 'Failed to save suggestions.');
        } finally {
            setIsSavingAI(false);
        }
    };

    // Filtered entries for active tab + search
    const visibleEntries = entries
        .filter(e => e.type === activeType)
        .filter(e => {
            if (!search) return true;
            const q = search.toLowerCase();
            return e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q);
        });

    // Count per type for tab badges
    const countByType = (t: BrandKnowledgeType) => entries.filter(e => e.type === t).length;

    return (
        <>
        <div className="flex flex-col gap-6">
            {/* Page header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                        {ar ? 'عقل البراند' : 'Brand Brain'}
                    </p>
                    <h1 className="mt-1.5 text-2xl font-black tracking-tight text-light-text dark:text-dark-text">
                        {ar ? 'قاعدة معرفة البراند' : 'Brand Knowledge Base'}
                    </h1>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary max-w-lg">
                        {ar
                            ? 'كل ما تضيفه هنا يغذّي الـ AI في كل أدوات المنصة — الردود، المحتوى، الإعلانات، والبريف الإبداعي.'
                            : 'Everything you add here feeds AI across all platform tools — replies, content, ads, and creative briefs.'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {AI_SUPPORTED_TYPES.includes(activeType) && (
                        <button
                            onClick={handleOpenAI}
                            className="flex items-center gap-2 rounded-2xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-sm font-bold text-brand-secondary transition-all hover:bg-brand-primary/20 hover:-translate-y-0.5"
                        >
                            <i className="fas fa-wand-magic-sparkles text-xs" />
                            {ar ? 'توليد بالذكاء الاصطناعي' : 'AI Quick-Fill'}
                        </button>
                    )}
                    <button
                        onClick={() => { setEditingEntry(null); setShowForm(true); }}
                        className="flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5"
                    >
                        <i className="fas fa-plus text-xs" />
                        {ar ? 'إضافة إدخال' : 'Add Entry'}
                    </button>
                </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-5 gap-2">
                {KNOWLEDGE_TABS.map(t => {
                    const cnt = countByType(t.type);
                    const active = t.type === activeType;
                    return (
                        <button
                            key={t.type}
                            onClick={() => { setActiveType(t.type); setShowForm(false); setEditingEntry(null); setSearch(''); }}
                            className={`flex flex-col items-center gap-1.5 rounded-2xl border py-3 px-2 transition-all ${
                                active
                                    ? 'border-brand-primary/40 bg-brand-primary/10'
                                    : 'border-dark-border bg-dark-card hover:border-dark-border/60'
                            }`}
                        >
                            <i className={`fas ${t.icon} text-sm ${active ? 'text-brand-secondary' : 'text-dark-text-secondary'}`} />
                            <span className={`text-[11px] font-bold leading-tight text-center ${active ? 'text-white' : 'text-dark-text-secondary'}`}>
                                {ar ? t.labelAr.split(' ')[0] : t.labelEn.split(' ')[0]}
                            </span>
                            {cnt > 0 && (
                                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
                                    active ? 'bg-brand-primary/30 text-brand-secondary' : 'bg-dark-bg text-dark-text-secondary'
                                }`}>
                                    {cnt}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Active tab content */}
            <div className="surface-panel rounded-2xl p-6 space-y-5">
                {/* Tab header + search */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
                            <i className={`fas ${tab.icon} text-brand-secondary`} />
                        </div>
                        <div>
                            <h2 className="font-bold text-white">{ar ? tab.labelAr : tab.labelEn}</h2>
                            <p className="text-xs text-dark-text-secondary">{visibleEntries.length} {ar ? 'إدخال' : 'entries'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {AI_SUPPORTED_TYPES.includes(activeType) && (
                            <button
                                onClick={handleOpenAI}
                                disabled={isGenerating}
                                className="flex items-center gap-1.5 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-3 py-2 text-xs font-bold text-brand-secondary transition-colors hover:bg-brand-primary/20 disabled:opacity-50"
                            >
                                <i className={`fas ${isGenerating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[10px]`} />
                                {ar ? 'توليد AI' : 'AI Fill'}
                            </button>
                        )}
                        <div className="relative">
                            <i className="fas fa-search absolute start-3 top-1/2 -translate-y-1/2 text-xs text-dark-text-secondary/50" />
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={ar ? 'بحث...' : 'Search...'}
                                className="rounded-xl border border-dark-border bg-dark-bg ps-8 pe-3 py-2 text-xs text-white outline-none transition w-44 focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
                            />
                        </div>
                    </div>
                </div>

                {/* Hint banner */}
                <div className="flex items-start gap-3 rounded-xl border border-dark-border bg-dark-bg/40 p-3.5">
                    <i className="fas fa-circle-info text-brand-secondary mt-0.5 flex-shrink-0" />
                    <p className="text-xs leading-relaxed text-dark-text-secondary">
                        {ar ? tab.hintAr : tab.hintEn}
                    </p>
                </div>

                {/* Add/Edit form */}
                {showForm && (
                    <EntryForm
                        tab={tab}
                        initial={editingEntry ?? undefined}
                        ar={ar}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        isSaving={isSaving}
                    />
                )}

                {/* Entries list */}
                {isLoading ? (
                    <div className="py-12 text-center">
                        <i className="fas fa-spinner fa-spin text-2xl text-brand-secondary" />
                    </div>
                ) : visibleEntries.length > 0 ? (
                    <div className="space-y-3">
                        {visibleEntries.map(entry => (
                            <EntryCard
                                key={entry.id}
                                entry={entry}
                                ar={ar}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onHistory={handleOpenHistory}
                                isDeleting={deletingId === entry.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="py-14 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-dark-bg">
                            <i className={`fas ${tab.icon} text-2xl text-dark-text-secondary/40`} />
                        </div>
                        <p className="font-bold text-white mb-1">
                            {ar ? 'لا توجد إدخالات بعد' : 'No entries yet'}
                        </p>
                        <p className="text-xs text-dark-text-secondary mb-5 max-w-xs mx-auto">
                            {ar
                                ? 'أضف أول إدخال وابدأ في تعليم AI كل شيء عن براندك.'
                                : 'Add your first entry and start teaching AI everything about your brand.'}
                        </p>
                        {!showForm && (
                            <button
                                onClick={() => { setEditingEntry(null); setShowForm(true); }}
                                className="inline-flex items-center gap-2 rounded-xl bg-brand-primary/10 px-5 py-2.5 text-sm font-bold text-brand-secondary transition-colors hover:bg-brand-primary/20"
                            >
                                <i className="fas fa-plus text-xs" />
                                {ar ? `إضافة ${tab.labelAr.split(' ')[0]}` : `Add ${tab.labelEn.split(' ')[0]}`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>

        {/* AI Quick-Fill Modal */}
        {showAIModal && (
            <AIQuickFillModal
                ar={ar}
                tabLabelAr={tab.labelAr}
                tabLabelEn={tab.labelEn}
                isGenerating={isGenerating}
                suggestions={aiSuggestions}
                isSaving={isSavingAI}
                onToggleStatus={handleToggleSuggestionStatus}
                onEditField={handleEditSuggestionField}
                onSave={handleSaveAISuggestions}
                onClose={() => { setShowAIModal(false); setAISuggestions([]); }}
            />
        )}

        {/* Version History Modal */}
        {historyEntry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryEntry(null)} />
                <div className="relative z-10 w-full max-w-lg rounded-2xl border border-dark-border bg-dark-card shadow-2xl flex flex-col max-h-[80vh]">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-dark-border flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
                                <i className="fas fa-clock-rotate-left text-violet-400 text-sm" />
                            </div>
                            <div>
                                <p className="font-bold text-white text-sm">{ar ? 'سجل الإصدارات' : 'Version History'}</p>
                                <p className="text-xs text-dark-text-secondary truncate max-w-[200px]">{historyEntry.title}</p>
                            </div>
                        </div>
                        <button onClick={() => setHistoryEntry(null)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary hover:text-white transition-colors">
                            <i className="fas fa-xmark text-sm" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                        {historyLoading ? (
                            <div className="py-12 text-center">
                                <i className="fas fa-spinner fa-spin text-2xl text-violet-400" />
                            </div>
                        ) : historyItems.length === 0 ? (
                            <div className="py-12 text-center space-y-3">
                                <i className="fas fa-clock-rotate-left text-3xl text-dark-text-secondary/30" />
                                <p className="text-sm font-semibold text-dark-text-secondary">{ar ? 'لا توجد إصدارات سابقة' : 'No previous versions'}</p>
                                <p className="text-xs text-dark-text-secondary/60">{ar ? 'تظهر الإصدارات عند تعديل العنوان أو المحتوى' : 'Versions appear when title or content is edited'}</p>
                            </div>
                        ) : (
                            historyItems.map(v => (
                                <div key={v.id} className="rounded-2xl border border-dark-border bg-dark-bg/50 p-4 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-black text-violet-400">v{v.versionNumber}</span>
                                            <span className="text-xs text-dark-text-secondary">
                                                {new Date(v.changedAt).toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleRestoreVersion(v)}
                                            className="flex items-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-1.5 text-xs font-bold text-violet-400 transition-colors hover:bg-violet-500/20"
                                        >
                                            <i className="fas fa-rotate-left text-[9px]" />
                                            {ar ? 'استرجاع' : 'Restore'}
                                        </button>
                                    </div>
                                    <p className="text-sm font-semibold text-white">{v.title}</p>
                                    <p className="text-xs text-dark-text-secondary line-clamp-3 leading-relaxed">{v.content}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
};
