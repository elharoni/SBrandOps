/**
 * ContentStudioPage — Unified AI Content Creation Workspace
 *
 * Layout: two-column on xl screens
 *   Left  → title / type / platform chips / rich textarea / AI toolbar / brand hints
 *   Right → tabbed panel: live preview · brand voice quality · hashtags · variants
 * Bottom  → save-to-pipeline / send-to-publisher action bar
 */
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
    BrandHubProfile,
    NotificationType,
    SocialPlatform,
    PLATFORM_ASSETS,
    ContentStatus,
    PublisherBrief,
    AIQualityCheckResult,
    HashtagSuggestion,
} from '../../types';
import { useLanguage } from '../../context/LanguageContext';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CONTENT_TYPES = ['Social', 'Blog', 'Video', 'Task'] as const;
type ContentType = (typeof CONTENT_TYPES)[number];

const CHAR_LIMITS: Partial<Record<SocialPlatform, number>> = {
    [SocialPlatform.X]: 280,
    [SocialPlatform.Instagram]: 2200,
    [SocialPlatform.LinkedIn]: 3000,
    [SocialPlatform.TikTok]: 2200,
    [SocialPlatform.Pinterest]: 500,
};

type RightTab = 'preview' | 'voice' | 'hashtags' | 'variations';

// ─────────────────────────────────────────────────────────────────────────────
// Small sub-components
// ─────────────────────────────────────────────────────────────────────────────

const ScoreBar: React.FC<{ label: string; score: number; feedback: string }> = ({
    label,
    score,
    feedback,
}) => {
    const barColor =
        score >= 75 ? 'bg-emerald-400' : score >= 50 ? 'bg-amber-400' : 'bg-rose-400';
    const textColor =
        score >= 75 ? 'text-emerald-300' : score >= 50 ? 'text-amber-300' : 'text-rose-300';
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-dark-text-secondary">{label}</span>
                <span className={`text-xs font-bold tabular-nums ${textColor}`}>{score}/100</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-dark-card">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                    style={{ width: `${score}%` }}
                />
            </div>
            {feedback && (
                <p className="text-[11px] leading-4 text-dark-text-secondary">{feedback}</p>
            )}
        </div>
    );
};

// ── Inline platform preview cards ────────────────────────────────────────────
const PlatformPreview: React.FC<{
    platform: SocialPlatform;
    content: string;
    brandName: string;
    allHashtags: string[];
}> = ({ platform, content, brandName, allHashtags }) => {
    const asset = PLATFORM_ASSETS[platform];
    const initial = brandName.charAt(0).toUpperCase();
    const previewText = content || '...';

    if (platform === SocialPlatform.Instagram) {
        return (
            <div className="overflow-hidden rounded-2xl border border-dark-border bg-white text-black text-left" dir="ltr">
                <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-xs font-bold text-white">
                        {initial}
                    </div>
                    <span className="flex-1 text-xs font-semibold">{brandName}</span>
                    <span className="text-lg text-gray-300">•••</span>
                </div>
                <div className="flex aspect-square items-center justify-center bg-gray-100">
                    <i className="fas fa-image text-4xl text-gray-300" />
                </div>
                <div className="space-y-1.5 p-3">
                    <div className="mb-2 flex gap-4 text-xl text-gray-700">
                        <i className="far fa-heart" />
                        <i className="far fa-comment" />
                        <i className="far fa-paper-plane" />
                        <i className="far fa-bookmark ms-auto" />
                    </div>
                    <p className="text-xs leading-5">
                        <span className="font-semibold">{brandName}</span>{' '}
                        <span className="line-clamp-3">{previewText}</span>
                    </p>
                    {allHashtags.length > 0 && (
                        <p className="text-xs text-blue-500 line-clamp-1">
                            {allHashtags.slice(0, 5).join(' ')}
                        </p>
                    )}
                    <p className="text-[10px] text-gray-400">Just now</p>
                </div>
            </div>
        );
    }

    if (platform === SocialPlatform.X) {
        const limit = 280;
        const remaining = limit - content.length;
        return (
            <div className="overflow-hidden rounded-2xl border border-dark-border bg-black text-white" dir="ltr">
                <div className="space-y-3 p-4">
                    <div className="flex gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-700 text-sm font-bold">
                            {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-sm font-bold">{brandName}</span>
                                <i className="fas fa-circle-check text-xs text-blue-400" />
                            </div>
                            <p className="text-xs text-gray-500">@{brandName.toLowerCase().replace(/\s+/g, '_')}</p>
                        </div>
                    </div>
                    <p className="text-sm leading-6">{previewText.slice(0, 280)}</p>
                    {content.length > 0 && (
                        <div
                            className={`text-xs ${remaining < 20 ? 'text-rose-400' : 'text-gray-500'}`}
                        >
                            {remaining} characters remaining
                        </div>
                    )}
                    <div className="flex gap-5 text-gray-500">
                        <i className="far fa-comment text-sm" />
                        <i className="fas fa-retweet text-sm" />
                        <i className="far fa-heart text-sm" />
                        <i className="fas fa-chart-bar text-sm" />
                    </div>
                </div>
            </div>
        );
    }

    if (platform === SocialPlatform.LinkedIn) {
        return (
            <div className="overflow-hidden rounded-2xl border border-dark-border bg-white text-black" dir="ltr">
                <div className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                        {initial}
                    </div>
                    <div>
                        <p className="text-xs font-semibold">{brandName}</p>
                        <p className="text-[11px] text-gray-400">Brand Page · Just now · 🌐</p>
                    </div>
                </div>
                <div className="px-4 pb-3">
                    <p className="line-clamp-5 text-xs leading-5">{previewText}</p>
                </div>
                <div className="flex items-center gap-1 border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
                    <span>👍</span>
                    <span>❤️</span>
                    <span className="ms-1.5">Like</span>
                    <span className="mx-3 h-4 w-px bg-gray-200" />
                    <span>💬 Comment</span>
                    <span className="mx-3 h-4 w-px bg-gray-200" />
                    <span>🔁 Repost</span>
                </div>
            </div>
        );
    }

    // Generic fallback
    return (
        <div className="surface-panel rounded-2xl p-4">
            <div className="mb-3 flex items-center gap-3">
                <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                    style={{ backgroundColor: `${asset.hexColor}18`, color: asset.hexColor }}
                >
                    <i className={asset.icon} />
                </span>
                <div>
                    <p className="text-sm font-bold text-white">{brandName}</p>
                    <p className="text-xs text-dark-text-secondary">{platform}</p>
                </div>
            </div>
            <p className="text-sm leading-6 text-dark-text-secondary">{previewText}</p>
            {allHashtags.length > 0 && (
                <p className="mt-2 text-xs text-brand-secondary line-clamp-1">
                    {allHashtags.slice(0, 5).join(' ')}
                </p>
            )}
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface ContentStudioPageProps {
    brandProfile: BrandHubProfile;
    brandId: string;
    addNotification: (type: NotificationType, message: string) => void;
    onSendToPublisher?: (brief: PublisherBrief) => void;
    onNavigate?: (page: string) => void;
    initialBrief?: PublisherBrief | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export const ContentStudioPage: React.FC<ContentStudioPageProps> = ({
    brandProfile,
    brandId,
    addNotification,
    onSendToPublisher,
    onNavigate,
    initialBrief,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    // ── Content state ────────────────────────────────────────────────────────
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [contentType, setContentType] = useState<ContentType>('Social');
    const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
    const [briefContext, setBriefContext] = useState<PublisherBrief | null>(initialBrief ?? null);

    // ── UI state ─────────────────────────────────────────────────────────────
    const [rightTab, setRightTab] = useState<RightTab>('preview');
    const [activePreview, setActivePreview] = useState<SocialPlatform>(SocialPlatform.Instagram);

    // ── AI state ─────────────────────────────────────────────────────────────
    const [quality, setQuality] = useState<AIQualityCheckResult | null>(null);
    const [hashtagGroups, setHashtagGroups] = useState<HashtagSuggestion[]>([]);
    const [variations, setVariations] = useState<string[]>([]);
    const [isImproving, setIsImproving] = useState(false);
    const [isShortening, setIsShortening] = useState(false);
    const [isCheckingQuality, setIsCheckingQuality] = useState(false);
    const [isSuggestingHashtags, setIsSuggestingHashtags] = useState(false);
    const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
    const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync initial brief into editor
    useEffect(() => {
        if (!initialBrief) return;
        setBriefContext(initialBrief);
        if (initialBrief.angle && !content) setContent(initialBrief.angle);
        if (initialBrief.title && !title) setTitle(initialBrief.title);
        if (initialBrief.suggestedPlatforms?.length) setPlatforms(initialBrief.suggestedPlatforms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialBrief]);

    // When platforms change, keep activePreview in sync
    useEffect(() => {
        if (platforms.length > 0 && !platforms.includes(activePreview)) {
            setActivePreview(platforms[0]);
        }
    }, [platforms, activePreview]);

    const togglePlatform = useCallback((p: SocialPlatform) => {
        setPlatforms(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p],
        );
    }, []);

    const characterLimit = useMemo(() => {
        if (platforms.length === 0) return null;
        const limits = platforms
            .map(p => CHAR_LIMITS[p])
            .filter((l): l is number => l !== undefined);
        return limits.length > 0 ? Math.min(...limits) : null;
    }, [platforms]);

    const overLimit = characterLimit !== null && content.length > characterLimit;
    const allHashtags = useMemo(
        () => hashtagGroups.flatMap(g => g.hashtags),
        [hashtagGroups],
    );

    // ── AI actions ────────────────────────────────────────────────────────────

    const handleGenerateCaption = useCallback(async () => {
        if (!title.trim()) return;
        setIsGeneratingCaption(true);
        try {
            const { generatePostCaption } = await import('../../services/geminiService');
            const results = await generatePostCaption(title, 'Professional', brandProfile);
            if (results[0]) {
                setContent(results[0]);
                addNotification(
                    NotificationType.Success,
                    ar ? 'تم توليد الكابشن.' : 'Caption generated.',
                );
            }
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل التوليد.' : 'Generation failed.',
            );
        } finally {
            setIsGeneratingCaption(false);
        }
    }, [title, brandProfile, addNotification, ar]);

    const handleImprove = useCallback(async () => {
        if (!content.trim()) return;
        setIsImproving(true);
        try {
            const { improveContentWithAI } = await import('../../services/geminiService');
            const improved = await improveContentWithAI(content, brandProfile);
            setContent(improved);
            addNotification(
                NotificationType.Success,
                ar ? 'تم تحسين المحتوى.' : 'Content improved.',
            );
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل التحسين.' : 'Improvement failed.',
            );
        } finally {
            setIsImproving(false);
        }
    }, [content, brandProfile, addNotification, ar]);

    const handleShorten = useCallback(async () => {
        if (!content.trim()) return;
        setIsShortening(true);
        try {
            const { modifyContent } = await import('../../services/geminiService');
            const shortened = await modifyContent(
                'Make it shorter and more concise',
                content,
                brandProfile,
            );
            setContent(shortened);
            addNotification(
                NotificationType.Success,
                ar ? 'تم اختصار المحتوى.' : 'Content shortened.',
            );
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل الاختصار.' : 'Shortening failed.',
            );
        } finally {
            setIsShortening(false);
        }
    }, [content, brandProfile, addNotification, ar]);

    const handleCheckQuality = useCallback(async () => {
        if (!content.trim()) return;
        setIsCheckingQuality(true);
        setRightTab('voice');
        try {
            const { performAIQualityCheck } = await import('../../services/geminiService');
            const result = await performAIQualityCheck(content, brandProfile);
            setQuality(result);
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل فحص الجودة.' : 'Quality check failed.',
            );
        } finally {
            setIsCheckingQuality(false);
        }
    }, [content, brandProfile, addNotification, ar]);

    const handleSuggestHashtags = useCallback(async () => {
        if (!content.trim() || platforms.length === 0) return;
        setIsSuggestingHashtags(true);
        setRightTab('hashtags');
        try {
            const { suggestHashtags } = await import('../../services/geminiService');
            const result = await suggestHashtags(content, platforms);
            setHashtagGroups(result);
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل اقتراح الهاشتاغات.' : 'Hashtag suggestion failed.',
            );
        } finally {
            setIsSuggestingHashtags(false);
        }
    }, [content, platforms, addNotification, ar]);

    const handleGenerateVariations = useCallback(async () => {
        if (!content.trim()) return;
        setIsGeneratingVariations(true);
        setRightTab('variations');
        try {
            const { generateContentVariations } = await import('../../services/geminiService');
            const result = await generateContentVariations(content, brandProfile);
            setVariations(result);
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل توليد النسخ.' : 'Variations failed.',
            );
        } finally {
            setIsGeneratingVariations(false);
        }
    }, [content, brandProfile, addNotification, ar]);

    const addHashtag = useCallback((tag: string) => {
        setContent(prev => prev + (prev.endsWith(' ') || prev === '' ? '' : ' ') + tag);
    }, []);

    // ── Save / Publish actions ────────────────────────────────────────────────

    const handleSaveToPipeline = useCallback(async () => {
        if (!content.trim() && !title.trim()) {
            addNotification(
                NotificationType.Warning,
                ar ? 'أضف عنوانًا أو محتوى أولاً.' : 'Add a title or content first.',
            );
            return;
        }
        setIsSaving(true);
        try {
            const { addContentPiece } = await import('../../services/contentOpsService');
            await addContentPiece(brandId, {
                title: title.trim() || content.slice(0, 60),
                generatedContent: content,
                type: contentType,
                status: ContentStatus.Ideas,
                platforms,
            });
            addNotification(
                NotificationType.Success,
                ar ? 'تم حفظ المحتوى في لوحة المحتوى.' : 'Content saved to pipeline.',
            );
        } catch {
            addNotification(
                NotificationType.Error,
                ar ? 'فشل الحفظ.' : 'Save failed.',
            );
        } finally {
            setIsSaving(false);
        }
    }, [content, title, contentType, platforms, brandId, addNotification, ar]);

    const handleSendToPublisher = useCallback(() => {
        if (!onSendToPublisher) return;
        if (!content.trim()) {
            addNotification(
                NotificationType.Warning,
                ar ? 'أضف محتوى أولاً.' : 'Add content first.',
            );
            return;
        }
        const brief: PublisherBrief = {
            id: crypto.randomUUID(),
            source: 'content-ops',
            title: title.trim() || content.slice(0, 60),
            objective: briefContext?.objective ?? '',
            angle: content,
            competitors: briefContext?.competitors ?? [],
            keywords: briefContext?.keywords ?? allHashtags.slice(0, 6),
            hashtags: allHashtags.slice(0, 10),
            suggestedPlatforms: platforms,
            cta: briefContext?.cta,
            notes: [],
        };
        onSendToPublisher(brief);
        addNotification(
            NotificationType.Info,
            ar ? 'تم إرسال المحتوى للناشر.' : 'Content sent to Publisher.',
        );
    }, [
        onSendToPublisher,
        content,
        title,
        briefContext,
        allHashtags,
        platforms,
        addNotification,
        ar,
    ]);

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    const typeLabels: Record<ContentType, string> = ar
        ? { Social: 'سوشيال', Blog: 'مقال', Video: 'فيديو', Task: 'مهمة' }
        : { Social: 'Social', Blog: 'Blog', Video: 'Video', Task: 'Task' };

    const rightTabs: { id: RightTab; icon: string; labelAr: string; labelEn: string }[] = [
        { id: 'preview', icon: 'fa-eye', labelAr: 'معاينة', labelEn: 'Preview' },
        { id: 'voice', icon: 'fa-chart-bar', labelAr: 'الجودة', labelEn: 'Quality' },
        { id: 'hashtags', icon: 'fa-hashtag', labelAr: 'هاشتاغ', labelEn: 'Hashtags' },
        { id: 'variations', icon: 'fa-layer-group', labelAr: 'نسخ', labelEn: 'Variants' },
    ];

    return (
        <div className="flex flex-col gap-6">
            {/* ── Page header ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                        {ar ? 'استوديو AI' : 'AI Studio'}
                    </p>
                    <h1 className="mt-1.5 text-2xl font-black tracking-tight text-light-text dark:text-dark-text">
                        {ar ? 'استوديو المحتوى' : 'Content Studio'}
                    </h1>
                    <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar
                            ? 'أنشئ محتوى متسقًا مع صوت البراند لكل المنصات من مكان واحد.'
                            : 'Create brand-consistent content for every platform in one place.'}
                    </p>
                </div>
                {onNavigate && (
                    <button
                        onClick={() => onNavigate('content-ops')}
                        className="btn rounded-xl bg-dark-card px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-all hover:text-white"
                    >
                        <i className="fas fa-columns me-2" />
                        {ar ? 'لوحة المحتوى' : 'Pipeline Board'}
                    </button>
                )}
            </div>

            {/* ── Brief context banner ─────────────────────────────────────── */}
            {briefContext && (
                <div className="surface-panel rounded-2xl bg-gradient-to-r from-brand-primary/10 via-transparent to-transparent p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0">
                            <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-brand-primary/15 text-brand-secondary">
                                <i className="fas fa-bolt text-sm" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">
                                    {ar ? 'سياق نشط من البريف' : 'Brief context active'}
                                </p>
                                <p className="mt-0.5 truncate text-sm font-semibold text-white">
                                    {briefContext.title}
                                </p>
                                {briefContext.angle && (
                                    <p className="mt-1 line-clamp-1 text-xs text-dark-text-secondary">
                                        {briefContext.angle}
                                    </p>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={() => setBriefContext(null)}
                            className="flex-shrink-0 text-dark-text-secondary transition-colors hover:text-white"
                        >
                            <i className="fas fa-times text-sm" />
                        </button>
                    </div>
                    {briefContext.keywords.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                            {briefContext.keywords.slice(0, 7).map(k => (
                                <span
                                    key={k}
                                    className="rounded-full border border-white/5 bg-dark-bg px-2.5 py-0.5 text-[11px] text-dark-text-secondary"
                                >
                                    {k}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Main workspace ───────────────────────────────────────────── */}
            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
                {/* LEFT: Editor column */}
                <div className="space-y-4">
                    {/* Title / type / platforms card */}
                    <div className="surface-panel rounded-2xl p-5 space-y-4">
                        {/* Title row */}
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={ar ? 'عنوان المحتوى...' : 'Content title...'}
                                className="flex-1 rounded-xl border border-dark-border bg-dark-bg px-4 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/20 placeholder:text-dark-text-secondary"
                            />
                            {/* Type selector */}
                            <div className="flex overflow-hidden rounded-xl border border-dark-border">
                                {CONTENT_TYPES.map(type => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => setContentType(type)}
                                        className={`px-3 py-2.5 text-xs font-semibold transition-colors ${
                                            contentType === type
                                                ? 'bg-brand-primary text-white'
                                                : 'bg-dark-bg text-dark-text-secondary hover:text-white'
                                        }`}
                                    >
                                        {typeLabels[type]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Platform chips */}
                        <div className="space-y-2">
                            <p className="text-[11px] font-semibold uppercase tracking-widest text-dark-text-secondary">
                                {ar ? 'المنصات المستهدفة' : 'Target Platforms'}
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {Object.values(SocialPlatform).map(p => {
                                    const asset = PLATFORM_ASSETS[p];
                                    const selected = platforms.includes(p);
                                    return (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => togglePlatform(p)}
                                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                                                selected
                                                    ? 'bg-brand-primary text-white shadow-sm'
                                                    : 'border border-dark-border bg-dark-bg text-dark-text-secondary hover:border-brand-primary/40 hover:text-white'
                                            }`}
                                        >
                                            <i className={`fas ${asset.icon} text-[10px]`} />
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Editor card */}
                    <div className="surface-panel overflow-hidden rounded-2xl">
                        {/* AI toolbar */}
                        <div className="flex flex-wrap items-center gap-1.5 border-b border-dark-border bg-dark-bg/40 px-4 py-3">
                            {/* Generate from title */}
                            <button
                                type="button"
                                onClick={handleGenerateCaption}
                                disabled={!title.trim() || isGeneratingCaption}
                                className="flex items-center gap-1.5 rounded-lg bg-brand-primary/15 px-3 py-1.5 text-xs font-semibold text-brand-secondary transition-all hover:bg-brand-primary hover:text-white disabled:opacity-40"
                            >
                                <i
                                    className={`fas ${isGeneratingCaption ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'} text-[10px]`}
                                />
                                {ar ? 'توليد من العنوان' : 'Generate from title'}
                            </button>

                            <span className="h-4 w-px bg-dark-border" />

                            {/* Improve */}
                            <button
                                type="button"
                                onClick={handleImprove}
                                disabled={!content.trim() || isImproving}
                                title={ar ? 'تحسين المحتوى' : 'Improve content'}
                                className="flex items-center gap-1.5 rounded-lg bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-40"
                            >
                                <i
                                    className={`fas ${isImproving ? 'fa-spinner fa-spin' : 'fa-sparkles'} text-[10px]`}
                                />
                                {ar ? 'تحسين' : 'Improve'}
                            </button>

                            {/* Shorten */}
                            <button
                                type="button"
                                onClick={handleShorten}
                                disabled={!content.trim() || isShortening}
                                title={ar ? 'اختصار المحتوى' : 'Shorten content'}
                                className="flex items-center gap-1.5 rounded-lg bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-40"
                            >
                                <i
                                    className={`fas ${isShortening ? 'fa-spinner fa-spin' : 'fa-compress-alt'} text-[10px]`}
                                />
                                {ar ? 'اختصار' : 'Shorten'}
                            </button>

                            {/* Quality check */}
                            <button
                                type="button"
                                onClick={handleCheckQuality}
                                disabled={!content.trim() || isCheckingQuality}
                                title={ar ? 'فحص الجودة' : 'Quality check'}
                                className="flex items-center gap-1.5 rounded-lg bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-40"
                            >
                                <i
                                    className={`fas ${isCheckingQuality ? 'fa-spinner fa-spin' : 'fa-chart-line'} text-[10px]`}
                                />
                                {ar ? 'فحص الجودة' : 'Quality'}
                            </button>

                            {/* Hashtags */}
                            <button
                                type="button"
                                onClick={handleSuggestHashtags}
                                disabled={!content.trim() || platforms.length === 0 || isSuggestingHashtags}
                                title={ar ? 'اقتراح هاشتاغات' : 'Suggest hashtags'}
                                className="flex items-center gap-1.5 rounded-lg bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-40"
                            >
                                <i
                                    className={`fas ${isSuggestingHashtags ? 'fa-spinner fa-spin' : 'fa-hashtag'} text-[10px]`}
                                />
                                {ar ? 'هاشتاغات' : 'Hashtags'}
                            </button>

                            {/* Variations */}
                            <button
                                type="button"
                                onClick={handleGenerateVariations}
                                disabled={!content.trim() || isGeneratingVariations}
                                title={ar ? 'توليد نسخ بديلة' : 'Generate variants'}
                                className="flex items-center gap-1.5 rounded-lg bg-dark-card px-3 py-1.5 text-xs font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-40"
                            >
                                <i
                                    className={`fas ${isGeneratingVariations ? 'fa-spinner fa-spin' : 'fa-layer-group'} text-[10px]`}
                                />
                                {ar ? 'نسخ بديلة' : 'Variants'}
                            </button>

                            {/* Character count */}
                            {characterLimit !== null && (
                                <span
                                    className={`ms-auto text-xs font-bold tabular-nums ${overLimit ? 'text-rose-400' : 'text-dark-text-secondary'}`}
                                >
                                    {content.length} / {characterLimit}
                                </span>
                            )}
                        </div>

                        {/* Textarea */}
                        <textarea
                            value={content}
                            onChange={e => setContent(e.target.value)}
                            placeholder={
                                briefContext?.angle
                                    ? (ar
                                        ? `زاوية مقترحة: ${briefContext.angle}`
                                        : `Suggested angle: ${briefContext.angle}`)
                                    : (ar
                                        ? 'اكتب محتواك هنا، أو استخدم "توليد من العنوان" للبدء بالذكاء الاصطناعي...'
                                        : 'Write your content here, or use "Generate from title" to start with AI...')
                            }
                            className={`min-h-[280px] w-full resize-none border-0 bg-transparent px-5 py-5 text-sm leading-7 text-white outline-none placeholder:text-dark-text-secondary/50 ${overLimit ? 'ring-1 ring-inset ring-rose-500/40' : ''}`}
                        />

                        {/* Brand keyword hints */}
                        {(brandProfile.brandVoice.keywords.length > 0 ||
                            brandProfile.brandVoice.negativeKeywords.length > 0) && (
                            <div className="flex flex-wrap items-center gap-2 border-t border-dark-border px-5 py-3">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-dark-text-secondary me-1">
                                    {ar ? 'صوت البراند' : 'Brand voice'}
                                </span>
                                {brandProfile.brandVoice.keywords.slice(0, 4).map(k => (
                                    <span
                                        key={k}
                                        className="rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[11px] text-emerald-400"
                                    >
                                        <i className="fas fa-check text-[9px] me-1" />
                                        {k}
                                    </span>
                                ))}
                                {brandProfile.brandVoice.negativeKeywords.slice(0, 3).map(k => (
                                    <span
                                        key={k}
                                        className="rounded-full bg-rose-400/10 px-2.5 py-0.5 text-[11px] text-rose-400"
                                    >
                                        <i className="fas fa-xmark text-[9px] me-1" />
                                        {k}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Tools panel */}
                <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
                    {/* Tab panel */}
                    <div className="surface-panel overflow-hidden rounded-2xl">
                        {/* Tab bar */}
                        <div className="flex border-b border-dark-border">
                            {rightTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setRightTab(tab.id)}
                                    className={`flex flex-1 flex-col items-center gap-1 py-3 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                                        rightTab === tab.id
                                            ? 'border-b-2 border-brand-primary text-white'
                                            : 'text-dark-text-secondary hover:text-white'
                                    }`}
                                >
                                    <i className={`fas ${tab.icon} text-xs`} />
                                    {ar ? tab.labelAr : tab.labelEn}
                                </button>
                            ))}
                        </div>

                        <div className="p-4">
                            {/* ── Preview tab ─────────────────────────────── */}
                            {rightTab === 'preview' && (
                                <div className="space-y-3">
                                    {platforms.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <i className="fas fa-eye-slash mb-3 block text-3xl text-dark-text-secondary" />
                                            <p className="text-sm text-dark-text-secondary">
                                                {ar
                                                    ? 'اختر منصة لرؤية المعاينة.'
                                                    : 'Select a platform to preview.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Platform picker */}
                                            <div className="flex flex-wrap gap-1.5">
                                                {platforms.map(p => {
                                                    const asset = PLATFORM_ASSETS[p];
                                                    return (
                                                        <button
                                                            key={p}
                                                            type="button"
                                                            onClick={() => setActivePreview(p)}
                                                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                                                                activePreview === p
                                                                    ? 'bg-brand-primary text-white'
                                                                    : 'border border-dark-border text-dark-text-secondary hover:text-white'
                                                            }`}
                                                        >
                                                            <i className={`fas ${asset.icon} text-[10px]`} />
                                                            {p}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <PlatformPreview
                                                platform={activePreview}
                                                content={content}
                                                brandName={brandProfile.brandName}
                                                allHashtags={allHashtags}
                                            />
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Voice / Quality tab ───────────────────── */}
                            {rightTab === 'voice' && (
                                <div className="space-y-4">
                                    {/* Brand voice summary */}
                                    <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-3 space-y-2">
                                        <p className="text-[11px] font-bold uppercase tracking-widest text-dark-text-secondary">
                                            {ar ? 'صوت البراند' : 'Brand Voice'}
                                        </p>
                                        <p className="text-sm font-semibold text-white">
                                            {brandProfile.brandVoice.toneDescription.slice(0, 2).join(' · ') || '—'}
                                        </p>
                                        {brandProfile.brandAudiences[0] && (
                                            <p className="text-xs text-dark-text-secondary">
                                                {ar ? 'الجمهور: ' : 'Audience: '}
                                                {brandProfile.brandAudiences[0].personaName}
                                            </p>
                                        )}
                                    </div>

                                    {isCheckingQuality ? (
                                        <div className="py-8 text-center">
                                            <i className="fas fa-spinner fa-spin mb-2 block text-2xl text-brand-secondary" />
                                            <p className="text-xs text-dark-text-secondary">
                                                {ar ? 'جارٍ الفحص...' : 'Checking...'}
                                            </p>
                                        </div>
                                    ) : quality ? (
                                        <div className="space-y-4">
                                            <ScoreBar
                                                label={ar ? 'اللغة والقواعد' : 'Grammar'}
                                                score={quality.grammar.score}
                                                feedback={quality.grammar.feedback}
                                            />
                                            <ScoreBar
                                                label={ar ? 'نبرة الصوت' : 'Tone of Voice'}
                                                score={quality.toneOfVoice.score}
                                                feedback={quality.toneOfVoice.feedback}
                                            />
                                            <ScoreBar
                                                label={ar ? 'توافق البراند' : 'Brand Fit'}
                                                score={quality.brandFit.score}
                                                feedback={quality.brandFit.feedback}
                                            />
                                            <ScoreBar
                                                label={ar ? 'قوة الدعوة للإجراء' : 'CTA Strength'}
                                                score={quality.cta.score}
                                                feedback={quality.cta.feedback}
                                            />
                                            <button
                                                type="button"
                                                onClick={handleCheckQuality}
                                                disabled={isCheckingQuality}
                                                className="w-full rounded-xl border border-dark-border py-2 text-xs font-semibold text-dark-text-secondary transition-colors hover:border-brand-primary/40 hover:text-white"
                                            >
                                                <i className="fas fa-sync-alt me-1.5 text-[10px]" />
                                                {ar ? 'إعادة الفحص' : 'Re-check'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center">
                                            <i className="fas fa-chart-bar mb-3 block text-3xl text-dark-text-secondary" />
                                            <p className="mb-4 text-sm text-dark-text-secondary">
                                                {ar
                                                    ? 'افحص المحتوى لقياس توافقه مع صوت البراند.'
                                                    : 'Check content to measure brand voice alignment.'}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleCheckQuality}
                                                disabled={!content.trim()}
                                                className="btn rounded-xl bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-secondary transition-all hover:bg-brand-primary hover:text-white disabled:opacity-50"
                                            >
                                                <i className="fas fa-chart-line me-2" />
                                                {ar ? 'فحص الجودة' : 'Run Quality Check'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Hashtags tab ─────────────────────────── */}
                            {rightTab === 'hashtags' && (
                                <div className="space-y-4">
                                    {isSuggestingHashtags ? (
                                        <div className="py-8 text-center">
                                            <i className="fas fa-spinner fa-spin mb-2 block text-2xl text-brand-secondary" />
                                            <p className="text-xs text-dark-text-secondary">
                                                {ar ? 'جارٍ الاقتراح...' : 'Suggesting...'}
                                            </p>
                                        </div>
                                    ) : hashtagGroups.length > 0 ? (
                                        hashtagGroups.map(group => (
                                            <div key={group.category} className="space-y-2">
                                                <p className="text-[11px] font-bold uppercase tracking-widest text-dark-text-secondary">
                                                    {group.category}
                                                </p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {group.hashtags.map(tag => (
                                                        <button
                                                            key={tag}
                                                            type="button"
                                                            onClick={() => addHashtag(tag)}
                                                            className="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-secondary transition-colors hover:bg-brand-primary hover:text-white"
                                                        >
                                                            {tag}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center">
                                            <i className="fas fa-hashtag mb-3 block text-3xl text-dark-text-secondary" />
                                            <p className="mb-1 text-sm text-dark-text-secondary">
                                                {ar
                                                    ? 'اختر منصة واكتب محتوى أولاً.'
                                                    : 'Select a platform and write content first.'}
                                            </p>
                                            <p className="mb-4 text-xs text-dark-text-secondary/60">
                                                {ar
                                                    ? 'الهاشتاغات مُصنَّفة حسب الأولوية والمنصة.'
                                                    : 'Hashtags are ranked by priority per platform.'}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleSuggestHashtags}
                                                disabled={!content.trim() || platforms.length === 0}
                                                className="btn rounded-xl bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-secondary transition-all hover:bg-brand-primary hover:text-white disabled:opacity-50"
                                            >
                                                <i className="fas fa-hashtag me-2" />
                                                {ar ? 'اقتراح هاشتاغات' : 'Suggest Hashtags'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ── Variants tab ─────────────────────────── */}
                            {rightTab === 'variations' && (
                                <div className="space-y-3">
                                    {isGeneratingVariations ? (
                                        <div className="py-8 text-center">
                                            <i className="fas fa-spinner fa-spin mb-2 block text-2xl text-brand-secondary" />
                                            <p className="text-xs text-dark-text-secondary">
                                                {ar ? 'جارٍ توليد النسخ...' : 'Generating variants...'}
                                            </p>
                                        </div>
                                    ) : variations.length > 0 ? (
                                        <>
                                            {variations.map((v, i) => (
                                                <div
                                                    key={i}
                                                    className="space-y-2 rounded-xl border border-dark-border bg-dark-bg/60 p-3"
                                                >
                                                    <p className="text-[11px] font-bold uppercase tracking-widest text-brand-secondary">
                                                        {ar ? `نسخة ${i + 1}` : `Variant ${i + 1}`}
                                                    </p>
                                                    <p className="line-clamp-4 text-xs leading-5 text-dark-text-secondary">
                                                        {v}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setContent(v);
                                                            addNotification(
                                                                NotificationType.Success,
                                                                ar ? 'تم تطبيق النسخة.' : 'Variant applied.',
                                                            );
                                                        }}
                                                        className="w-full rounded-lg border border-brand-primary/20 bg-brand-primary/10 py-1.5 text-xs font-semibold text-brand-secondary transition-colors hover:bg-brand-primary/20"
                                                    >
                                                        {ar ? 'تطبيق هذه النسخة' : 'Apply this variant'}
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={handleGenerateVariations}
                                                disabled={isGeneratingVariations}
                                                className="w-full rounded-xl border border-dark-border py-2 text-xs font-semibold text-dark-text-secondary transition-colors hover:border-brand-primary/40 hover:text-white"
                                            >
                                                <i className="fas fa-sync-alt me-1.5 text-[10px]" />
                                                {ar ? 'توليد نسخ جديدة' : 'Regenerate'}
                                            </button>
                                        </>
                                    ) : (
                                        <div className="py-8 text-center">
                                            <i className="fas fa-layer-group mb-3 block text-3xl text-dark-text-secondary" />
                                            <p className="mb-1 text-sm text-dark-text-secondary">
                                                {ar
                                                    ? 'ولّد نسخًا مختلفة لاختبار أقوى زاوية.'
                                                    : 'Generate variants to test the strongest angle.'}
                                            </p>
                                            <p className="mb-4 text-xs text-dark-text-secondary/60">
                                                {ar
                                                    ? 'كل نسخة تحافظ على هوية البراند مع تغيير الأسلوب.'
                                                    : 'Each variant keeps brand identity while shifting style.'}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleGenerateVariations}
                                                disabled={!content.trim()}
                                                className="btn rounded-xl bg-brand-primary/10 px-4 py-2 text-sm font-semibold text-brand-secondary transition-all hover:bg-brand-primary hover:text-white disabled:opacity-50"
                                            >
                                                <i className="fas fa-layer-group me-2" />
                                                {ar ? 'توليد نسخ بديلة' : 'Generate Variants'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Brand context quick card */}
                    <div className="surface-panel rounded-2xl p-4">
                        <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-dark-text-secondary">
                            {ar ? 'سياق البراند' : 'Brand Context'}
                        </p>
                        <div className="overflow-hidden rounded-xl border border-dark-border divide-y divide-dark-border text-xs">
                            <div className="px-3 py-2.5">
                                <span className="text-dark-text-secondary">
                                    {ar ? 'البراند' : 'Brand'}:{' '}
                                </span>
                                <span className="font-semibold text-white">{brandProfile.brandName}</span>
                            </div>
                            {brandProfile.industry && (
                                <div className="px-3 py-2.5">
                                    <span className="text-dark-text-secondary">
                                        {ar ? 'القطاع' : 'Industry'}:{' '}
                                    </span>
                                    <span className="font-semibold text-white">{brandProfile.industry}</span>
                                </div>
                            )}
                            {brandProfile.brandVoice.toneDescription.length > 0 && (
                                <div className="px-3 py-2.5">
                                    <span className="text-dark-text-secondary">
                                        {ar ? 'النبرة' : 'Tone'}:{' '}
                                    </span>
                                    <span className="font-semibold text-white">
                                        {brandProfile.brandVoice.toneDescription.slice(0, 2).join(', ')}
                                    </span>
                                </div>
                            )}
                            {brandProfile.brandAudiences[0] && (
                                <div className="px-3 py-2.5">
                                    <span className="text-dark-text-secondary">
                                        {ar ? 'الجمهور' : 'Audience'}:{' '}
                                    </span>
                                    <span className="font-semibold text-white">
                                        {brandProfile.brandAudiences[0].personaName}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>

            {/* ── Action bar ───────────────────────────────────────────────── */}
            <div className="surface-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSaveToPipeline}
                        disabled={isSaving}
                        className="btn flex items-center gap-2 rounded-xl bg-dark-card px-4 py-2.5 text-sm font-semibold text-dark-text-secondary transition-all hover:text-white disabled:opacity-50"
                    >
                        <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`} />
                        {ar ? 'حفظ في لوحة المحتوى' : 'Save to Pipeline'}
                    </button>

                    {onSendToPublisher && (
                        <button
                            type="button"
                            onClick={handleSendToPublisher}
                            disabled={!content.trim()}
                            className="btn flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            <i className="fas fa-paper-plane" />
                            {ar ? 'إرسال للناشر' : 'Send to Publisher'}
                        </button>
                    )}
                </div>

                <p className="text-xs text-dark-text-secondary">
                    {content.length > 0
                        ? `${content.length} ${ar ? 'حرف' : 'chars'}`
                        : ar
                            ? 'اكتب أو استخدم AI للبدء'
                            : 'Write or use AI to start'}
                </p>
            </div>
        </div>
    );
};
