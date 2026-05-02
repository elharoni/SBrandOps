import React, { useState, useCallback } from 'react';
import { generateImageFromPrompt, AIImageProvider } from '../services/geminiService';
import { BrandHubProfile, Brand, MediaItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useModalClose } from '../hooks/useModalClose';
import { extractBrandColors, overlayLogoOnCanvas, buildBrandPromptContext } from '../services/brandDesignUtils';

interface AIImageGeneratorModalProps {
    onClose: () => void;
    onAddImage: (mediaItem: MediaItem) => void;
    /** If provided, selected images can be saved to the brand asset library */
    brandId?: string;
    /** Full brand object — used for logo overlay and name */
    brand?: Brand | null;
    /** If provided, brand context is used to improve image prompts */
    brandProfile?: BrandHubProfile | null;
    /** Pre-fill the prompt from an idea (e.g. from BrandIntelligenceModal) */
    initialPrompt?: string;
}

type GeneratedImage = {
    id: string;
    url: string;
    selected: boolean;
};

export const AIImageGeneratorModal: React.FC<AIImageGeneratorModalProps> = ({
    onClose,
    onAddImage,
    brandId,
    brand,
    brandProfile,
    initialPrompt,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    useModalClose(onClose);

    const [prompt, setPrompt] = useState(initialPrompt ?? '');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');

    const logoUrl = brand?.logoUrl || '';
    const brandColors = extractBrandColors(brandProfile?.styleGuidelines);
    const brandContext = buildBrandPromptContext(brand, brandProfile);

    // Style hint shown in prompt placeholder
    const brandStyleHint = brandProfile
        ? `— بأسلوب يعكس براند "${brandProfile.brandName || brand?.name}" ونبرة ${brandProfile.brandVoice.toneDescription.slice(0, 2).join(' و')}`
        : (brand?.name ? `— بأسلوب يعكس براند "${brand.name}"` : '');
    const [provider, setProvider] = useState<AIImageProvider>('openai');
    const [count, setCount] = useState<number>(1);
    const [images, setImages] = useState<GeneratedImage[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingToLibrary, setSavingToLibrary] = useState(false);

    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;
        setIsLoading(true);
        setError(null);
        setImages([]);
        try {
            // Enrich prompt with brand context automatically
            const enrichedPrompt = brandContext
                ? `${prompt.trim()}. ${brandContext}.`
                : prompt.trim();

            const urls = await generateImageFromPrompt(enrichedPrompt, aspectRatio, provider, count);

            // Overlay brand logo on each generated image if available
            const processedUrls = logoUrl
                ? await Promise.all(urls.map(u => overlayLogoOnCanvas(u, logoUrl)))
                : urls;

            setImages(processedUrls.map(url => ({ id: crypto.randomUUID(), url, selected: false })));
        } catch (err: any) {
            let errorMsg = ar
                ? 'فشل في توليد الصورة. يرجى المحاولة مرة أخرى.'
                : 'Image generation failed. Please try again.';
            if (err?.message?.includes('503') || err?.message?.includes('high demand') || err?.message?.includes('overloaded')) {
                errorMsg = ar
                    ? 'النموذج مشغول حالياً. جرّب "مجاني" أو أعد المحاولة.'
                    : 'Model is busy. Try the free model or retry.';
            } else if (err?.message?.includes('content_policy') || err?.message?.includes('safety')) {
                errorMsg = ar
                    ? 'المحتوى لا يتوافق مع سياسة OpenAI. عدّل الوصف وأعد المحاولة.'
                    : 'Content flagged by OpenAI policy. Adjust your prompt and retry.';
            } else if (err?.message?.includes('400') || err?.message?.includes('paid') || err?.message?.includes('billing') || err?.message?.includes('quota')) {
                errorMsg = ar
                    ? 'تجاوزت الحد اليومي أو رصيد OpenAI منتهٍ. جرّب "مجاني".'
                    : 'OpenAI quota exceeded or billing issue. Try the free model.';
            } else if (err?.message?.includes('API key') || err?.message?.includes('missing')) {
                errorMsg = ar
                    ? 'مفتاح OpenAI غير مُعدّ. تواصل مع الإدارة.'
                    : 'OpenAI API key not configured. Contact admin.';
            }
            setError(errorMsg);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, aspectRatio, provider, count, ar, brandContext, logoUrl]);

    const toggleSelect = useCallback((id: string) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, selected: !img.selected } : img));
    }, []);

    const handleDownload = useCallback(async (url: string, index: number) => {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = objectUrl;
            a.download = `ai-image-${index + 1}.jpg`;
            a.click();
            URL.revokeObjectURL(objectUrl);
        } catch {
            // If cross-origin fetch fails, open in new tab
            window.open(url, '_blank');
        }
    }, []);

    const handleAddSelected = useCallback(async () => {
        const selected = images.filter(img => img.selected);
        if (selected.length === 0) return;

        // Add first selected image to post (modal only supports single at a time via onAddImage)
        for (const img of selected) {
            try {
                const res = await fetch(img.url);
                const blob = await res.blob();
                const file = new File([blob], 'ai-generated-image.jpg', { type: 'image/jpeg' });
                const mediaItem: MediaItem = {
                    id: img.id,
                    type: 'image',
                    url: img.url,
                    file,
                };
                onAddImage(mediaItem);
            } catch {
                onAddImage({ id: img.id, type: 'image', url: img.url, file: new File([], 'ai-image.jpg') });
            }
        }
        onClose();
    }, [images, onAddImage, onClose]);

    const handleSaveToLibrary = useCallback(async () => {
        if (!brandId) return;
        const selected = images.filter(img => img.selected);
        if (selected.length === 0) return;

        setSavingToLibrary(true);
        try {
            const { createDesignAsset } = await import('../services/designAssetsService');
            await Promise.all(
                selected.map((img, i) =>
                    createDesignAsset(brandId, {
                        name: `${prompt.slice(0, 50)} #${i + 1}`,
                        url: img.url,
                        type: 'image',
                        source: 'ai-generated',
                        tags: ['ai-generated'],
                        aspectRatio,
                        prompt,
                    })
                )
            );
        } catch (e) {
            console.error('Save to library failed:', e);
        } finally {
            setSavingToLibrary(false);
        }
    }, [brandId, images, prompt, aspectRatio]);

    const selectedCount = images.filter(img => img.selected).length;

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in" onClick={onClose}>
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/50 backdrop-blur-2xl backdrop-saturate-150 w-full max-w-3xl flex flex-col max-h-[92vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-5 border-b border-white/10 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-primary/20 text-brand-secondary">
                                <i className="fas fa-wand-magic-sparkles text-sm" />
                            </span>
                            {ar ? 'مولّد الصور بالذكاء الاصطناعي' : 'AI Image Generator'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-dark-text-secondary hover:bg-dark-bg hover:text-white transition-colors"
                        >
                            <i className="fas fa-times" />
                        </button>
                    </div>

                    {/* Brand identity strip */}
                    {(brand || brandProfile) && (
                        <div className="mt-3 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-brand-primary/8 border border-brand-primary/20">
                            {logoUrl ? (
                                <img src={logoUrl} alt="logo" className="w-7 h-7 rounded-lg object-contain bg-white/10 p-0.5 flex-shrink-0" />
                            ) : (
                                <div className="w-7 h-7 rounded-lg bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
                                    <i className="fas fa-store text-brand-secondary text-xs" />
                                </div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-white truncate">
                                    {brandProfile?.brandName || brand?.name}
                                </p>
                                <p className="text-[10px] text-brand-secondary">
                                    {logoUrl
                                        ? (ar ? 'هوية البراند + اللوجو مُطبَّقان تلقائياً' : 'Brand identity + logo applied automatically')
                                        : (ar ? 'هوية البراند مُطبَّقة تلقائياً' : 'Brand identity applied automatically')}
                                </p>
                            </div>
                            {brandColors.length > 0 && (
                                <div className="flex gap-1 flex-shrink-0">
                                    {brandColors.filter(c => c.startsWith('#')).slice(0, 4).map((c, i) => (
                                        <div key={i} className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: c }} title={c} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-grow overflow-y-auto p-5 space-y-5">
                    {/* Controls */}
                    <div className="space-y-4">
                        {/* Prompt */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'وصف الصورة' : 'Image Prompt'}
                                </label>
                                {(brandProfile || brand) && (
                                    <span className="text-[10px] bg-brand-primary/15 text-brand-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                                        {logoUrl && <i className="fas fa-circle-check text-[8px]" />}
                                        {ar
                                            ? `سياق البراند: ${brandProfile?.brandName || brand?.name}`
                                            : `Brand: ${brandProfile?.brandName || brand?.name}`}
                                    </span>
                                )}
                            </div>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                                placeholder={
                                    brandProfile
                                        ? (ar ? `صف الصورة ${brandStyleHint}...` : `Describe the image ${brandStyleHint}...`)
                                        : (ar ? 'صف الصورة التي تريدها بدقة...' : 'Describe the image you want in detail...')
                                }
                                rows={3}
                                className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none resize-none placeholder:text-dark-text-secondary/50 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20"
                            />
                        </div>

                        {/* Model picker — visual cards */}
                        <div className="space-y-2">
                            <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                {ar ? 'النموذج' : 'Model'}
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {([
                                    { id: 'openai',        label: 'GPT Image 1',        sub: ar ? 'أعلى جودة' : 'Best quality',    icon: 'fas fa-robot',    badge: '✦',    badgeCls: 'bg-emerald-500/20 text-emerald-300' },
                                    { id: 'openai-dalle3', label: 'DALL·E 3',           sub: ar ? 'احترافي' : 'Professional',      icon: 'fas fa-paintbrush', badge: 'PRO', badgeCls: 'bg-blue-500/20 text-blue-300' },
                                    { id: 'gemini-native', label: 'Gemini 2.0',         sub: ar ? 'عربي نيتف' : 'Arabic native',   icon: 'fas fa-gem',      badge: 'AR',   badgeCls: 'bg-purple-500/20 text-purple-300' },
                                    { id: 'pollinations',  label: ar ? 'مجاني' : 'Free', sub: ar ? 'غير محدود' : 'Unlimited',     icon: 'fas fa-infinity', badge: 'FREE', badgeCls: 'bg-slate-500/20 text-slate-300' },
                                ] as const).map(m => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setProvider(m.id)}
                                        className={`relative flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-start ${
                                            provider === m.id
                                                ? 'border-brand-primary bg-brand-primary/15 shadow-sm shadow-brand-primary/20'
                                                : 'border-white/8 bg-black/20 hover:border-white/20'
                                        }`}
                                    >
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${provider === m.id ? 'bg-brand-primary/20' : 'bg-white/5'}`}>
                                            <i className={`${m.icon} text-sm ${provider === m.id ? 'text-brand-secondary' : 'text-dark-text-secondary'}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-xs font-bold leading-none mb-0.5 ${provider === m.id ? 'text-white' : 'text-dark-text-secondary'}`}>{m.label}</p>
                                            <p className="text-[10px] text-dark-text-secondary/60 leading-none">{m.sub}</p>
                                        </div>
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${m.badgeCls}`}>{m.badge}</span>
                                        {provider === m.id && (
                                            <div className="absolute top-2 end-2 w-4 h-4 rounded-full bg-brand-primary flex items-center justify-center">
                                                <i className="fas fa-check text-white" style={{ fontSize: '7px' }} />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Aspect ratio + Count */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Aspect ratio — visual tiles */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'النسبة والحجم' : 'Aspect Ratio'}
                                </label>
                                <div className="flex gap-1.5">
                                    {([
                                        { value: '1:1',  w: 22, h: 22, labelAr: 'مربع',  labelEn: '1:1'  },
                                        { value: '16:9', w: 32, h: 18, labelAr: 'أفقي',  labelEn: '16:9' },
                                        { value: '9:16', w: 18, h: 32, labelAr: 'رأسي',  labelEn: '9:16' },
                                        { value: '4:3',  w: 26, h: 20, labelAr: 'قياسي', labelEn: '4:3'  },
                                        { value: '3:4',  w: 20, h: 26, labelAr: 'صورة',  labelEn: '3:4'  },
                                    ] as const).map(r => (
                                        <button
                                            key={r.value}
                                            type="button"
                                            onClick={() => setAspectRatio(r.value)}
                                            className={`flex-1 flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all ${
                                                aspectRatio === r.value
                                                    ? 'border-brand-primary bg-brand-primary/15'
                                                    : 'border-white/8 bg-black/20 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="flex items-center justify-center" style={{ width: '34px', height: '34px' }}>
                                                <div
                                                    className={`rounded-sm transition-colors ${aspectRatio === r.value ? 'bg-brand-primary' : 'bg-white/20'}`}
                                                    style={{ width: `${r.w}px`, height: `${r.h}px` }}
                                                />
                                            </div>
                                            <span className={`text-[9px] font-bold leading-none ${aspectRatio === r.value ? 'text-brand-secondary' : 'text-dark-text-secondary/60'}`}>
                                                {ar ? r.labelAr : r.labelEn}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Count */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? 'عدد الصور' : 'Count'}
                                </label>
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            onClick={() => setCount(n)}
                                            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${count === n
                                                    ? 'bg-brand-primary text-white shadow-sm'
                                                    : 'border border-white/10 bg-black/20 text-dark-text-secondary hover:border-brand-primary/40 hover:text-white'
                                                }`}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Generate button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isLoading || !prompt.trim()}
                            className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-3 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <><i className="fas fa-spinner fa-spin" /><span>{ar ? 'جارٍ التوليد...' : 'Generating...'}</span></>
                            ) : (
                                <>
                                    <i className="fas fa-wand-magic-sparkles" />
                                    <span>{ar ? 'توليد الصور' : 'Generate Images'}</span>
                                    <span className="text-[10px] opacity-60 font-normal">
                                        {provider === 'openai' ? '• GPT Image 1' : provider === 'openai-dalle3' ? '• DALL·E 3' : provider === 'gemini-native' ? '• Gemini 2.0' : ar ? '• مجاني' : '• Free'}
                                    </span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-400">
                            <i className="fas fa-exclamation-circle me-2" />
                            {error}
                        </div>
                    )}

                    {/* Loading state */}
                    {isLoading && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-brand-primary/8 border border-brand-primary/20">
                                <div className="w-9 h-9 rounded-xl bg-brand-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse">
                                    <i className="fas fa-wand-magic-sparkles text-brand-secondary" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{ar ? 'جارٍ رسم خيالك...' : 'Painting your vision...'}</p>
                                    <p className="text-[11px] text-dark-text-secondary mt-0.5">
                                        {provider === 'openai' ? 'GPT Image 1' : provider === 'openai-dalle3' ? 'DALL·E 3' : provider === 'gemini-native' ? 'Gemini 2.0' : ar ? 'النموذج المجاني' : 'Free model'}
                                        {count > 1 && ` • ${count} ${ar ? 'صور' : 'images'}`}
                                    </p>
                                </div>
                                <div className="ms-auto flex gap-1">
                                    {[0, 0.2, 0.4].map((delay, i) => (
                                        <div
                                            key={i}
                                            className="w-2 h-2 rounded-full bg-brand-primary animate-bounce"
                                            style={{ animationDelay: `${delay}s` }}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div className={`grid gap-3 ${count === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                {Array.from({ length: count }).map((_, i) => (
                                    <div
                                        key={i}
                                        className="rounded-xl bg-white/5 animate-pulse overflow-hidden"
                                        style={{ aspectRatio: aspectRatio.replace(':', '/'), minHeight: count === 1 ? '260px' : '140px' }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Generated images grid */}
                    {!isLoading && images.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                    {ar ? `${images.length} صور مُولَّدة` : `${images.length} images generated`}
                                </p>
                                {images.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={() => setImages(prev => prev.map(img => ({ ...img, selected: !prev.every(i => i.selected) })))}
                                        className="text-xs font-semibold text-brand-secondary hover:underline"
                                    >
                                        {images.every(img => img.selected)
                                            ? (ar ? 'إلغاء تحديد الكل' : 'Deselect all')
                                            : (ar ? 'تحديد الكل' : 'Select all')
                                        }
                                    </button>
                                )}
                            </div>
                            <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-2'}`}>
                                {images.map((img, i) => (
                                    <div
                                        key={img.id}
                                        className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all ${img.selected
                                                ? 'border-brand-primary shadow-[0_0_0_3px_rgba(var(--color-brand-primary),0.2)]'
                                                : 'border-dark-border hover:border-dark-text-secondary/40'
                                            }`}
                                        onClick={() => toggleSelect(img.id)}
                                    >
                                        <img
                                            src={img.url}
                                            alt={`Generated ${i + 1}`}
                                            className="w-full object-cover"
                                            style={{ maxHeight: images.length === 1 ? '420px' : '220px', objectFit: 'cover' }}
                                        />

                                        {/* Selection overlay */}
                                        <div className={`absolute inset-0 transition-all ${img.selected ? 'bg-brand-primary/15' : 'bg-transparent group-hover:bg-black/20'}`} />

                                        {/* Checkmark */}
                                        <div className={`absolute top-2 start-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${img.selected
                                                ? 'border-brand-primary bg-brand-primary text-white'
                                                : 'border-white/60 bg-black/40 text-transparent group-hover:border-white'
                                            }`}>
                                            <i className="fas fa-check text-[10px]" />
                                        </div>

                                        {/* Action buttons */}
                                        <div className="absolute bottom-2 end-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                            <button
                                                type="button"
                                                title={ar ? 'تنزيل' : 'Download'}
                                                onClick={() => handleDownload(img.url, i)}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white backdrop-blur-sm hover:bg-black/90 transition-colors"
                                            >
                                                <i className="fas fa-download text-xs" />
                                            </button>
                                        </div>

                                        {/* Image number badge */}
                                        {images.length > 1 && (
                                            <div className="absolute top-2 end-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                                                {i + 1}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Selection hint */}
                            {images.length > 1 && selectedCount === 0 && (
                                <p className="text-center text-xs text-dark-text-secondary">
                                    {ar ? 'اضغط على الصور لتحديدها ثم أضفها للمنشور' : 'Click images to select them, then add to post'}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Empty state */}
                    {!isLoading && images.length === 0 && !error && (
                        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-white/10 bg-black/20">
                            <div className="text-center text-dark-text-secondary/50">
                                <i className="fas fa-images mb-2 block text-4xl" />
                                <p className="text-sm">{ar ? 'ستظهر الصور هنا' : 'Images will appear here'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-white/10 bg-black/20 p-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-colors hover:bg-white/5 hover:text-white"
                    >
                        {ar ? 'إلغاء' : 'Cancel'}
                    </button>

                    <div className="flex items-center gap-2">
                        {/* Save to library */}
                        {brandId && selectedCount > 0 && (
                            <button
                                type="button"
                                onClick={handleSaveToLibrary}
                                disabled={savingToLibrary}
                                className="flex items-center gap-2 rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-2.5 text-sm font-semibold text-brand-secondary transition-all hover:bg-brand-primary/20 disabled:opacity-50"
                            >
                                <i className={`fas ${savingToLibrary ? 'fa-spinner fa-spin' : 'fa-bookmark'} text-xs`} />
                                {ar ? 'حفظ في المكتبة' : 'Save to Library'}
                                {selectedCount > 0 && <span className="rounded-full bg-brand-primary/20 px-1.5 text-[10px] font-bold">{selectedCount}</span>}
                            </button>
                        )}

                        {/* Add to post */}
                        <button
                            type="button"
                            onClick={handleAddSelected}
                            disabled={selectedCount === 0}
                            className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <i className="fas fa-plus text-xs" />
                            {ar
                                ? selectedCount > 0 ? `إضافة ${selectedCount} للمنشور` : 'حدّد صورة أولاً'
                                : selectedCount > 0 ? `Add ${selectedCount} to Post` : 'Select an image first'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
