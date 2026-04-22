// components/pages/BrandKnowledgePage.tsx
// Brand Knowledge Base — قاعدة معرفة البراند (المنتجات / FAQ / سياسات / منافسين / سكريبتات)

import React, { useState, useEffect, useCallback } from 'react';
import { NotificationType, BrandKnowledgeEntry, BrandKnowledgeType } from '../../types';
import {
    getBrandKnowledge,
    addKnowledgeEntry,
    updateKnowledgeEntry,
    deleteKnowledgeEntry,
} from '../../services/brandKnowledgeService';
import { useLanguage } from '../../context/LanguageContext';

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
    isDeleting: boolean;
}> = ({ entry, ar, onEdit, onDelete, isDeleting }) => (
    <div className="rounded-2xl border border-dark-border bg-dark-bg/50 p-4 transition-all hover:border-dark-border/80">
        <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
                <p className="font-semibold text-white text-sm">{entry.title}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-dark-text-secondary line-clamp-3">{entry.content}</p>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
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
            <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={4}
                placeholder={ar ? tab.placeholderContentAr : tab.placeholderContentEn}
                className="w-full resize-none rounded-xl border border-dark-border bg-dark-bg px-4 py-2.5 text-sm text-white outline-none transition focus:border-brand-primary/60 placeholder:text-dark-text-secondary/50"
            />
            <div className="flex justify-end gap-2">
                <button
                    onClick={onCancel}
                    className="rounded-xl border border-dark-border px-4 py-2 text-sm font-semibold text-dark-text-secondary transition-colors hover:text-white"
                >
                    {ar ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                    onClick={() => onSave(title.trim(), content.trim())}
                    disabled={!title.trim() || !content.trim() || isSaving}
                    className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                >
                    <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-check'} text-xs`} />
                    {ar ? 'حفظ' : 'Save'}
                </button>
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

interface BrandKnowledgePageProps {
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
}

export const BrandKnowledgePage: React.FC<BrandKnowledgePageProps> = ({
    brandId,
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

    const handleSave = async (title: string, content: string) => {
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
                <button
                    onClick={() => { setEditingEntry(null); setShowForm(true); }}
                    className="flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5"
                >
                    <i className="fas fa-plus text-xs" />
                    {ar ? 'إضافة إدخال' : 'Add Entry'}
                </button>
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
    );
};
