// components/media/AdaptationModal.tsx
// Adaptation Engine — توليد variants من Master piece

import React, { useState } from 'react';
import { useModalClose } from '../../hooks/useModalClose';
import { NotificationType, MediaProjectPiece } from '../../types';
import { createProjectPiece } from '../../services/mediaProjectService';
import { useLanguage } from '../../context/LanguageContext';

// ── Variant presets ───────────────────────────────────────────────────────────

interface VariantPreset {
    id: string;
    labelAr: string;
    labelEn: string;
    icon: string;
    category: 'resize' | 'format' | 'localize' | 'platform';
    variantLabel: string;
    formatHint?: string;
}

const VARIANT_PRESETS: VariantPreset[] = [
    // Resize
    { id: 'square',    labelAr: 'مربع 1:1',      labelEn: 'Square 1:1',       icon: 'fa-square',              category: 'resize',   variantLabel: '1:1' },
    { id: 'portrait',  labelAr: 'رأسي 9:16',      labelEn: 'Portrait 9:16',    icon: 'fa-mobile-screen',       category: 'resize',   variantLabel: '9:16' },
    { id: 'landscape', labelAr: 'أفقي 16:9',      labelEn: 'Landscape 16:9',   icon: 'fa-tv',                  category: 'resize',   variantLabel: '16:9' },
    { id: 'story',     labelAr: 'ستوري',          labelEn: 'Story Cut',        icon: 'fa-circle-notch',        category: 'resize',   variantLabel: 'Story', formatHint: 'Story' },
    // Format
    { id: 'static',    labelAr: 'تصميم ثابت',     labelEn: 'Static',           icon: 'fa-image',               category: 'format',   variantLabel: 'Static', formatHint: 'Static' },
    { id: 'carousel',  labelAr: 'كاروسيل',        labelEn: 'Carousel',         icon: 'fa-images',              category: 'format',   variantLabel: 'Carousel', formatHint: 'Carousel' },
    { id: 'short-cut', labelAr: 'نسخة 15 ثانية',  labelEn: '15s Cut',          icon: 'fa-stopwatch',           category: 'format',   variantLabel: '15s' },
    { id: 'no-audio',  labelAr: 'بدون صوت',       labelEn: 'No Audio',         icon: 'fa-volume-xmark',        category: 'format',   variantLabel: 'No-audio' },
    // Localize
    { id: 'arabic',    labelAr: 'نسخة عربية',     labelEn: 'Arabic Version',   icon: 'fa-language',            category: 'localize', variantLabel: 'Arabic' },
    { id: 'english',   labelAr: 'نسخة إنجليزية',  labelEn: 'English Version',  icon: 'fa-flag',                category: 'localize', variantLabel: 'English' },
    // Platform-specific
    { id: 'tiktok',    labelAr: 'نسخة TikTok',    labelEn: 'TikTok Version',   icon: 'fab fa-tiktok',          category: 'platform', variantLabel: 'TikTok', formatHint: 'Reel' },
    { id: 'linkedin',  labelAr: 'نسخة LinkedIn',  labelEn: 'LinkedIn Version', icon: 'fab fa-linkedin',        category: 'platform', variantLabel: 'LinkedIn' },
    { id: 'ad-square', labelAr: 'إعلان مربع',     labelEn: 'Ad Square',        icon: 'fa-rectangle-ad',        category: 'platform', variantLabel: 'Ad 1:1', formatHint: 'Ad' },
    { id: 'ad-story',  labelAr: 'إعلان ستوري',    labelEn: 'Ad Story',         icon: 'fa-rectangle-vertical',  category: 'platform', variantLabel: 'Ad Story', formatHint: 'Ad' },
];

const CATEGORIES: { id: VariantPreset['category']; ar: string; en: string }[] = [
    { id: 'resize',   ar: 'تغيير الحجم',    en: 'Resize' },
    { id: 'format',   ar: 'تغيير الفورمات', en: 'Format' },
    { id: 'localize', ar: 'اللغة والسوق',   en: 'Localize' },
    { id: 'platform', ar: 'منصة محددة',     en: 'Platform' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface AdaptationModalProps {
    masterPiece: MediaProjectPiece;
    projectId: string;
    brandId: string;
    onClose: () => void;
    onCreated: (pieces: MediaProjectPiece[]) => void;
    addNotification: (type: NotificationType, message: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AdaptationModal: React.FC<AdaptationModalProps> = ({
    masterPiece,
    projectId,
    brandId,
    onClose,
    onCreated,
    addNotification,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    useModalClose(onClose);

    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [isCreating, setIsCreating] = useState(false);
    const [activeCategory, setActiveCategory] = useState<VariantPreset['category']>('resize');

    const toggle = (id: string) =>
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const handleCreate = async () => {
        if (selected.size === 0) return;
        setIsCreating(true);
        try {
            const presets = VARIANT_PRESETS.filter(p => selected.has(p.id));
            const created: MediaProjectPiece[] = [];

            for (const preset of presets) {
                const piece = await createProjectPiece({
                    projectId,
                    brandId,
                    title: `${masterPiece.title} — ${preset.variantLabel}`,
                    isMaster: false,
                    variantOf: masterPiece.id,
                    track: masterPiece.track,
                    format: preset.formatHint ?? masterPiece.format,
                    angle: masterPiece.angle,
                    hook: masterPiece.hook,
                    platform: undefined,
                    variantLabel: preset.variantLabel,
                    content: masterPiece.content,
                    notes: ar
                        ? `Adaptation من: ${masterPiece.title}`
                        : `Adapted from: ${masterPiece.title}`,
                });
                created.push(piece);
            }

            onCreated(created);
            addNotification(
                NotificationType.Success,
                ar
                    ? `تم إنشاء ${created.length} نسخة من المشروع.`
                    : `${created.length} variant(s) created.`,
            );
            onClose();
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل إنشاء النسخ.' : 'Failed to create variants.',
            );
        } finally {
            setIsCreating(false);
        }
    };

    const filtered = VARIANT_PRESETS.filter(p => p.category === activeCategory);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="relative flex w-full max-w-lg flex-col rounded-3xl border border-dark-border bg-dark-card shadow-2xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-dark-border px-6 py-5 flex-shrink-0">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                            {ar ? 'محرك التكيف' : 'Adaptation Engine'}
                        </p>
                        <h2 className="mt-0.5 text-lg font-black text-white">
                            {ar ? 'توليد نسخ من الأصل' : 'Generate Variants from Master'}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-dark-text-secondary line-clamp-1">
                            {masterPiece.title}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-dark-border text-dark-text-secondary transition-colors hover:text-white"
                    >
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>

                {/* Category tabs */}
                <div className="flex border-b border-dark-border flex-shrink-0">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveCategory(cat.id)}
                            className={`flex-1 py-3 text-[11px] font-semibold transition-colors ${
                                activeCategory === cat.id
                                    ? 'border-b-2 border-brand-primary text-white'
                                    : 'text-dark-text-secondary hover:text-white'
                            }`}
                        >
                            {ar ? cat.ar : cat.en}
                        </button>
                    ))}
                </div>

                {/* Presets grid */}
                <div className="flex-1 overflow-y-auto p-5">
                    <div className="grid grid-cols-2 gap-2">
                        {filtered.map(preset => {
                            const isSelected = selected.has(preset.id);
                            return (
                                <button
                                    key={preset.id}
                                    onClick={() => toggle(preset.id)}
                                    className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                                        isSelected
                                            ? 'border-brand-primary bg-brand-primary/10'
                                            : 'border-dark-border bg-dark-bg hover:border-dark-text-secondary/30'
                                    }`}
                                >
                                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                                        isSelected ? 'bg-brand-primary/20 text-brand-secondary' : 'bg-dark-card text-dark-text-secondary'
                                    }`}>
                                        <i className={`fas ${preset.icon} text-sm`} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs font-semibold ${isSelected ? 'text-white' : 'text-dark-text-secondary'}`}>
                                            {ar ? preset.labelAr : preset.labelEn}
                                        </p>
                                        <p className="text-[10px] text-dark-text-secondary/60">{preset.variantLabel}</p>
                                    </div>
                                    {isSelected && (
                                        <i className="fas fa-check ms-auto text-brand-secondary text-xs flex-shrink-0" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-dark-border px-6 py-4 flex-shrink-0">
                    <span className="text-xs text-dark-text-secondary">
                        {selected.size > 0
                            ? (ar ? `${selected.size} نسخة محددة` : `${selected.size} variant(s) selected`)
                            : (ar ? 'اختر النسخ التي تريدها' : 'Select variants to create')}
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={onClose}
                            className="rounded-xl border border-dark-border px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-colors hover:text-white"
                        >
                            {ar ? 'إلغاء' : 'Cancel'}
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={selected.size === 0 || isCreating}
                            className="flex items-center gap-2 rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            <i className={`fas ${isCreating ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-xs`} />
                            {ar ? 'إنشاء النسخ' : 'Create Variants'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
