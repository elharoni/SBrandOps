import React, { useState, useCallback } from 'react';
import { generateImageFromPrompt, AIImageProvider } from '../services/geminiService';
import { MediaItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface AIImageGeneratorModalProps {
    onClose: () => void;
    onAddImage: (mediaItem: MediaItem) => void;
    /** If provided, selected images can be saved to the brand asset library */
    brandId?: string;
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
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3' | '3:4'>('1:1');
    const [provider, setProvider] = useState<AIImageProvider>('pollinations');
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
            const urls = await generateImageFromPrompt(prompt, aspectRatio, provider, count);
            setImages(urls.map(url => ({ id: crypto.randomUUID(), url, selected: false })));
        } catch (err: any) {
            let errorMsg = ar
                ? 'فشل في توليد الصورة. يرجى المحاولة مرة أخرى.'
                : 'Image generation failed. Please try again.';
            if (err?.message?.includes('503') || err?.message?.includes('high demand')) {
                errorMsg = ar
                    ? 'نموذج جوجل يواجه ضغطاً عالياً. جرّب "المستقر (مجاني)".'
                    : 'Google model is under high demand. Try the free stable model.';
            } else if (err?.message?.includes('400') || err?.message?.includes('paid plans')) {
                errorMsg = ar
                    ? 'نموذج Imagen للحسابات المدفوعة فقط. اختر "المستقر (مجاني)".'
                    : 'Imagen is for paid accounts only. Choose the free stable model.';
            }
            setError(errorMsg);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, [prompt, aspectRatio, provider, count, ar]);

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
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-dark-card rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[92vh] border border-dark-border">
                {/* Header */}
                <div className="p-5 border-b border-dark-border flex justify-between items-center flex-shrink-0">
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

                <div className="flex-grow overflow-y-auto p-5 space-y-5">
                    {/* Controls grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Prompt */}
                        <div className="md:col-span-2 space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                {ar ? 'وصف الصورة' : 'Image Prompt'}
                            </label>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate(); }}
                                placeholder={ar ? 'صف الصورة التي تريدها بدقة...' : 'Describe the image you want in detail...'}
                                rows={3}
                                className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm text-white outline-none resize-none placeholder:text-dark-text-secondary/50 focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20"
                            />
                        </div>

                        {/* Model */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                {ar ? 'النموذج' : 'Model'}
                            </label>
                            <select
                                value={provider}
                                onChange={e => setProvider(e.target.value as AIImageProvider)}
                                className="w-full rounded-xl border border-dark-border bg-dark-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-primary/60"
                            >
                                <option value="pollinations">{ar ? 'المستقر (مجاني - غير محدود)' : 'Stable (Free & Unlimited)'}</option>
                                <option value="google">{ar ? 'Google Imagen (احترافي - مدفوع)' : 'Google Imagen (Pro - Paid)'}</option>
                            </select>
                        </div>

                        {/* Aspect ratio */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                {ar ? 'النسبة والحجم' : 'Aspect Ratio'}
                            </label>
                            <select
                                value={aspectRatio}
                                onChange={e => setAspectRatio(e.target.value as any)}
                                className="w-full rounded-xl border border-dark-border bg-dark-bg px-3 py-2.5 text-sm text-white outline-none focus:border-brand-primary/60"
                            >
                                <option value="1:1">{ar ? 'مربع (1:1)' : 'Square (1:1)'}</option>
                                <option value="16:9">{ar ? 'أفقي (16:9)' : 'Landscape (16:9)'}</option>
                                <option value="9:16">{ar ? 'رأسي (9:16)' : 'Portrait (9:16)'}</option>
                                <option value="4:3">{ar ? 'قياسي (4:3)' : 'Standard (4:3)'}</option>
                                <option value="3:4">{ar ? 'صورة شخصية (3:4)' : 'Portrait (3:4)'}</option>
                            </select>
                        </div>

                        {/* Count */}
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold uppercase tracking-widest text-dark-text-secondary">
                                {ar ? 'عدد الصور' : 'Number of Images'}
                            </label>
                            <div className="flex gap-2">
                                {[1, 2, 3, 4].map(n => (
                                    <button
                                        key={n}
                                        type="button"
                                        onClick={() => setCount(n)}
                                        className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all ${
                                            count === n
                                                ? 'bg-brand-primary text-white shadow-sm'
                                                : 'border border-dark-border bg-dark-bg text-dark-text-secondary hover:border-brand-primary/40 hover:text-white'
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate button */}
                        <div className="flex items-end">
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !prompt.trim()}
                                className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-brand-secondary py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {isLoading ? (
                                    <><i className="fas fa-spinner fa-spin me-2" />{ar ? 'جارٍ التوليد...' : 'Generating...'}</>
                                ) : (
                                    <><i className="fas fa-wand-magic-sparkles me-2" />{ar ? 'توليد الصور' : 'Generate Images'}</>
                                )}
                            </button>
                        </div>
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
                        <div className="flex min-h-[240px] items-center justify-center rounded-2xl border-2 border-dashed border-dark-border bg-dark-bg/60">
                            <div className="text-center">
                                <i className="fas fa-spinner fa-spin mb-3 block text-4xl text-brand-secondary" />
                                <p className="text-sm font-medium text-dark-text-secondary">
                                    {ar ? 'جارٍ رسم خيالك...' : 'Painting your vision...'}
                                </p>
                                {count > 1 && (
                                    <p className="mt-1 text-xs text-dark-text-secondary/60">
                                        {ar ? `جارٍ توليد ${count} صور` : `Generating ${count} images`}
                                    </p>
                                )}
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
                                        className={`group relative overflow-hidden rounded-xl border-2 cursor-pointer transition-all ${
                                            img.selected
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
                                        <div className={`absolute top-2 start-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-all ${
                                            img.selected
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
                        <div className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-dark-border bg-dark-bg/60">
                            <div className="text-center text-dark-text-secondary/50">
                                <i className="fas fa-images mb-2 block text-4xl" />
                                <p className="text-sm">{ar ? 'ستظهر الصور هنا' : 'Images will appear here'}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer actions */}
                <div className="flex-shrink-0 flex items-center justify-between gap-3 border-t border-dark-border bg-dark-bg/50 p-4">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-dark-border px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-colors hover:border-dark-text-secondary/40 hover:text-white"
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
