import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ScheduledPost,
    NotificationType,
    BrandHubProfile,
    SocialPlatform,
    MediaItem,
    PLATFORM_ASSETS,
    PostStatus,
    PlatformPostStatus,
    PlatformStatus,
    ScheduleSuggestion,
    PublisherBrief,
} from '../types';
import { PostPreview } from './PostPreview';
import { DateTimePicker } from './DateTimePicker';
import { ImageEditorModal } from './ImageEditorModal';
import { PlatformStatusDisplay } from './PlatformStatusDisplay';
import { SmartSchedulerModal } from './SmartSchedulerModal';
import { usePublisherState } from '../hooks/usePublisherState';
import { useLanguage } from '../context/LanguageContext';
import type { ContentVariation } from '../services/aiVariationsService';

const AIAssistant = lazy(() => import('./AIAssistant').then((m) => ({ default: m.AIAssistant })));
const CaptionAnalyzer = lazy(() => import('./CaptionAnalyzer').then((m) => ({ default: m.CaptionAnalyzer })));
const AIImageGeneratorModal = lazy(() => import('./AIImageGeneratorModal').then((m) => ({ default: m.AIImageGeneratorModal })));

const PLATFORM_CHAR_LIMITS: Partial<Record<SocialPlatform, number>> = {
    [SocialPlatform.X]: 280,
    [SocialPlatform.Instagram]: 2200,
    [SocialPlatform.LinkedIn]: 3000,
    [SocialPlatform.TikTok]: 2200,
    [SocialPlatform.Pinterest]: 500,
};

const WorkspacePill: React.FC<{
    label: string;
    tone?: 'default' | 'success' | 'accent';
}> = ({ label, tone = 'default' }) => {
    const toneClass = tone === 'success'
        ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
        : tone === 'accent'
            ? 'border-brand-primary/25 bg-brand-primary/10 text-brand-secondary'
            : 'border-dark-border bg-dark-bg text-dark-text-secondary';

    return (
        <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold ${toneClass}`}>
            {label}
        </span>
    );
};

const RailCard: React.FC<{
    title: string;
    description?: string;
    children: React.ReactNode;
}> = ({ title, description, children }) => (
    <section className="surface-panel rounded-2xl p-5 shadow-[var(--shadow-ambient)]">
        <div className="mb-4">
            <p className="text-[11px] font-black uppercase tracking-widest text-brand-secondary">{title}</p>
            {description && <p className="mt-1 text-xs font-medium leading-5 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>}
        </div>
        {children}
    </section>
);

const PlatformChipSelector: React.FC<{
    selected: SocialPlatform[];
    colors: Record<string, string>;
    onToggle: (platform: SocialPlatform) => void;
    onColorChange: (platform: SocialPlatform, color: string) => void;
}> = ({ selected, colors, onToggle, onColorChange }) => (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Object.values(SocialPlatform).map((platform) => {
            const asset = PLATFORM_ASSETS[platform];
            const isSelected = selected.includes(platform);
            const accentColor = colors[platform] || asset.hexColor;

            return (
                <button
                    key={platform}
                    type="button"
                    onClick={() => onToggle(platform)}
                    className={`group relative overflow-hidden rounded-2xl px-4 py-3 text-left transition-all active:scale-95 ${
                        isSelected
                            ? 'surface-panel shadow-[var(--shadow-primary)]'
                            : 'surface-panel-soft opacity-70 hover:opacity-100 hover:-translate-y-0.5 hover:shadow-[var(--shadow-ambient)]'
                    }`}
                >
                    <div className="flex items-center justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-2xl text-base shadow-sm backdrop-blur-md" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                <i className={asset.icon} />
                            </span>
                            <div>
                                <p className={`text-sm font-bold ${isSelected ? 'text-brand-primary dark:text-white' : 'text-light-text dark:text-dark-text'}`}>{platform}</p>
                                <p className="text-[11px] font-medium text-light-text-secondary dark:text-dark-text-secondary">{isSelected ? 'تم الاختيار' : 'اضغط للاختيار'}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {isSelected && (
                                <label className="relative block h-6 w-6 cursor-pointer overflow-hidden rounded-full border-2 border-white/20 shadow-sm" title="Channel accent">
                                    <input type="color" value={accentColor} onChange={(event) => onColorChange(platform, event.target.value)} onClick={(event) => event.stopPropagation()} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                                    <span className="block h-full w-full" style={{ backgroundColor: accentColor }} />
                                </label>
                            )}
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] shadow-sm transition-colors ${isSelected ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                <i className={`fas ${isSelected ? 'fa-check' : 'fa-plus'}`} />
                            </span>
                        </div>
                    </div>
                </button>
            );
        })}
    </div>
);

interface PublisherProps {
    addNotification: (type: NotificationType, message: string) => void;
    onSavePost: (post: Omit<ScheduledPost, 'id'>) => Promise<void> | void;
    onUpdatePost: (postId: string, updates: Partial<Omit<ScheduledPost, 'id'>>) => Promise<void> | void;
    postToEdit?: ScheduledPost | null;
    onPostEdited?: () => void;
    brandProfile: BrandHubProfile;
    brandId?: string;
    publisherBrief?: PublisherBrief | null;
    onNavigateToIntegrations?: () => void;
}
export const Publisher: React.FC<PublisherProps> = ({
    addNotification,
    onSavePost,
    onUpdatePost,
    postToEdit,
    onPostEdited,
    brandProfile,
    brandId,
    publisherBrief,
    onNavigateToIntegrations,
}) => {
    const [state, dispatch] = usePublisherState();
    const { post, postToEditId, activePreviewTab, hashtagSuggestions, isSuggestingHashtags } = state;
    const { t, language } = useLanguage();
    const ar = language === 'ar';

    const copy = {
        composerTitle: ar ? 'مساحة التحرير' : 'Composer',
        composerHint: ar ? 'ابدأ بالرسالة الأساسية، ثم حسّنها بصريًا ومنصاتيًا من نفس السطح.' : 'Start from the core message, then refine it visually and per channel from the same surface.',
        draftMode: ar ? 'وضع المسودة' : 'Draft mode',
        editMode: ar ? 'وضع التعديل' : 'Editing mode',
        briefAttached: ar ? 'Brief مرتبط' : 'Brief attached',
        aiReady: ar ? 'الذكاء جاهز' : 'AI assist ready',
        briefBannerTitle: ar ? 'زاوية مقترحة من تحليل المنافسين' : 'Suggested angle from competitor analysis',
        briefBannerHint: ar ? 'استخدم هذه الزاوية كنقطة انطلاق، ثم عدّلها حسب القناة والجمهور.' : 'Use this angle as a starting point, then adapt it for the channel and audience.',
        primaryMessage: ar ? 'الرسالة الأساسية' : 'Primary message',
        primaryMessageHint: ar ? 'اكتب جوهر المنشور هنا. المعاينة والتكييف سيأخذان هذا النص كأساس.' : 'Write the core post message here. Preview and channel adaptation will build from this text.',
        mediaStage: ar ? 'مرحلة الوسائط' : 'Media stage',
        mediaHint: ar ? 'اسحب الصور والفيديو هنا، أو أضف أصلًا جديدًا لتقوية المنشور بصريًا.' : 'Drag images and video here, or add a new asset to strengthen the post visually.',
        mediaEmpty: ar ? 'أفلت الملفات هنا أو استخدم الأزرار السريعة للإضافة.' : 'Drop files here or use the quick actions to add assets.',
        uploadAssets: ar ? 'رفع وسائط' : 'Upload assets',
        aiImage: ar ? 'توليد صورة AI' : 'Generate AI image',
        channelTargets: ar ? 'القنوات المستهدفة' : 'Target channels',
        channelTargetsHint: ar ? 'اختر القنوات أولًا حتى نكيّف النص والمعاينة وحدود الأحرف لكل منصة.' : 'Choose the channels first so we can adapt copy, preview, and character limits per platform.',
        channelSettings: ar ? 'إعدادات خاصة بالقنوات' : 'Channel-specific settings',
        channelSettingsHint: ar ? 'أضف فقط الإعدادات التي تحتاجها المنصات المختارة.' : 'Add only the settings required by the selected channels.',
        previewTitle: ar ? 'المعاينة والتوافق' : 'Preview and channel fit',
        previewHint: ar ? 'راجع شكل المنشور لكل منصة قبل اتخاذ قرار النشر.' : 'Review how the post looks on each channel before making the publishing decision.',
        readinessTitle: ar ? 'جاهزية النشر' : 'Publishing readiness',
        readinessDesc: ar ? 'قراءة سريعة لما تم تجهيزه وما يحتاج خطوة إضافية.' : 'A quick read on what is ready and what still needs action.',
        brandContext: ar ? 'سياق البراند' : 'Brand context',
        brandContextDesc: ar ? 'هذا هو الإطار الذي يجب أن يبقى المحتوى داخله أثناء الصياغة.' : 'This is the frame the content should remain inside while drafting.',
        variantsTitle: ar ? 'نسخ مبنية على الـ brief' : 'Brief-based variants',
        variantsDesc: ar ? 'ولّد 3 نسخ مختلفة لتختبر زوايا أقوى قبل النشر.' : 'Generate 3 variations to test stronger angles before publishing.',
        actionsTitle: ar ? 'قرارات النشر' : 'Publishing actions',
        actionsDesc: ar ? 'احفظ المسودة، اختر وقتًا مناسبًا، أو انشر فورًا من نفس العمود.' : 'Save the draft, pick a better time, or publish immediately from the same rail.',
        livePreview: ar ? 'معاينة مباشرة' : 'Live preview',
        ready: ar ? 'جاهز' : 'Ready',
        needsAction: ar ? 'يحتاج إجراء' : 'Needs action',
        coreMessage: ar ? 'النص الأساسي' : 'Core message',
        coreMessageHint: ar ? 'اكتب النص أو أضف وسائط على الأقل.' : 'Write the message or attach at least one asset.',
        platformsReady: ar ? 'اختيار المنصات' : 'Platform selection',
        platformsReadyHint: ar ? 'اختر القنوات المستهدفة قبل النشر أو الجدولة.' : 'Choose the target channels before publishing or scheduling.',
        mediaReady: ar ? 'الوسائط' : 'Media',
        mediaReadyHint: ar ? 'إضافة أصل بصري ترفع جاهزية المنشور.' : 'Adding a visual asset improves the post readiness.',
        scheduleReady: ar ? 'حالة الجدولة' : 'Schedule state',
        scheduleDraft: ar ? 'نشر الآن أو حفظ كمسودة' : 'Publish now or save as draft',
        voiceKeywords: ar ? 'الكلمات المحورية' : 'Voice keywords',
        prohibitedWords: ar ? 'كلمات يجب تجنبها' : 'Avoided words',
        audience: ar ? 'الجمهور' : 'Audience',
        briefApplied: ar ? 'تم تطبيق brief تنافسي' : 'Competitive brief applied',
        generateVariants: ar ? 'توليد 3 نسخ' : 'Generate 3 variants',
        generatingVariants: ar ? 'جارٍ توليد النسخ...' : 'Generating variants...',
        applyVariant: ar ? 'تطبيق النسخة' : 'Apply variant',
        variantApplied: ar ? 'تم تطبيق النسخة داخل مساحة النشر.' : 'Variant applied to the publisher workspace.',
        variantFailed: ar ? 'تعذر توليد نسخ من الـ brief الحالي.' : 'Could not generate variants from the current brief.',
        partialPublish: ar ? 'تم النشر جزئيًا. راجع المنصات التي فشلت ثم أعد المحاولة.' : 'Publishing completed partially. Review failed platforms and retry.',
        publishFailed: ar ? 'فشل النشر. حاول مرة أخرى.' : 'Publishing failed. Try again.',
        persistFailed: ar ? 'فشل حفظ المنشور. حاول مرة أخرى.' : 'Failed to save the post. Try again.',
        saveDraft: ar ? 'حفظ كمسودة' : 'Save draft',
        schedulePost: ar ? 'جدولة المنشور' : 'Schedule post',
        publishNow: ar ? 'نشر الآن' : 'Publish now',
        smartTime: ar ? 'أفضل وقت للنشر' : 'Best time to publish',
        publishing: ar ? 'جارٍ النشر...' : 'Publishing...',
        attachFirstComment: ar ? 'التعليق الأول' : 'First comment',
        locationTag: ar ? 'الموقع' : 'Location',
    };

    const [showAIAssistant, setShowAIAssistant] = useState(false);
    const [showCaptionAnalyzer, setShowCaptionAnalyzer] = useState(false);
    const [showScheduler, setShowScheduler] = useState(false);
    const [showSmartScheduler, setShowSmartScheduler] = useState(false);
    const [mediaToEdit, setMediaToEdit] = useState<MediaItem | null>(null);
    const [showPublishStatus, setShowPublishStatus] = useState(false);
    const [publishStatuses, setPublishStatuses] = useState<Map<SocialPlatform, PlatformStatus>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [showImageGenerator, setShowImageGenerator] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [briefVariants, setBriefVariants] = useState<ContentVariation[]>([]);
    const [isGeneratingBriefVariants, setIsGeneratingBriefVariants] = useState(false);
    const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const dragItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);

    const brandTone = useMemo(() => brandProfile.brandVoice.toneDescription.slice(0, 2).join(ar ? ' • ' : ' • ') || '—', [ar, brandProfile.brandVoice.toneDescription]);
    const primaryAudience = brandProfile.brandAudiences[0]?.personaName || '—';
    const voiceKeywords = useMemo(() => brandProfile.brandVoice.keywords.slice(0, 5).join(ar ? '، ' : ', ') || '—', [ar, brandProfile.brandVoice.keywords]);
    const avoidedWords = useMemo(() => brandProfile.brandVoice.negativeKeywords.slice(0, 4).join(ar ? '، ' : ', ') || '—', [ar, brandProfile.brandVoice.negativeKeywords]);
    const characterLimit = useMemo(() => {
        if (post.platforms.length === 0) return null;
        const limits = post.platforms.map((platform) => PLATFORM_CHAR_LIMITS[platform]).filter((limit): limit is number => limit !== undefined);
        return limits.length > 0 ? Math.min(...limits) : null;
    }, [post.platforms]);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (post.content.trim().length < 20 || post.platforms.length === 0) {
                dispatch({ type: 'SET_HASHTAG_SUGGESTIONS', payload: [] });
                return;
            }

            void (async () => {
                dispatch({ type: 'SET_HASHTAGS_LOADING', payload: true });
                try {
                    const { suggestHashtags } = await import('../services/geminiService');
                    const suggestions = await suggestHashtags(post.content, post.platforms);
                    dispatch({ type: 'SET_HASHTAG_SUGGESTIONS', payload: suggestions });
                } catch (error) {
                    console.error('Failed to suggest hashtags:', error);
                    dispatch({ type: 'SET_HASHTAG_SUGGESTIONS', payload: [] });
                } finally {
                    dispatch({ type: 'SET_HASHTAGS_LOADING', payload: false });
                }
            })();
        }, 1200);

        return () => clearTimeout(timer);
    }, [dispatch, post.content, post.platforms]);

    useEffect(() => {
        if (postToEdit) {
            dispatch({ type: 'SET_POST_FOR_EDITING', payload: postToEdit });
        }
    }, [dispatch, postToEdit]);

    useEffect(() => {
        setBriefVariants([]);
    }, [publisherBrief?.id]);
    const resetState = useCallback(() => {
        dispatch({ type: 'RESET_STATE' });
        if (onPostEdited) onPostEdited();
    }, [dispatch, onPostEdited]);

    const handleGenerateBriefVariants = useCallback(async () => {
        if (!publisherBrief) return;
        try {
            setIsGeneratingBriefVariants(true);
            const { generateVariantsFromBrief } = await import('../services/aiVariationsService');
            const variants = await generateVariantsFromBrief(publisherBrief, brandProfile);
            setBriefVariants(variants.slice(0, 3));
        } catch (error) {
            console.error(error);
            addNotification(NotificationType.Error, copy.variantFailed);
        } finally {
            setIsGeneratingBriefVariants(false);
        }
    }, [addNotification, brandProfile, copy.variantFailed, publisherBrief]);

    const handleApplyBriefVariant = useCallback((variant: ContentVariation) => {
        const nextPlatforms = Array.from(new Set([variant.platform, ...(publisherBrief?.suggestedPlatforms ?? [])]));
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'content', value: variant.content } });
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'platforms', value: nextPlatforms } });
        dispatch({ type: 'SET_ACTIVE_PREVIEW_TAB', payload: variant.platform });
        addNotification(NotificationType.Success, copy.variantApplied);
    }, [addNotification, copy.variantApplied, dispatch, publisherBrief?.suggestedPlatforms]);

    const handleMediaUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []) as File[];
        if (files.length === 0) return;
        const newMediaItems: MediaItem[] = files.map((file) => ({
            id: crypto.randomUUID(),
            type: file.type.startsWith('video') ? 'video' : 'image',
            url: URL.createObjectURL(file),
            file,
        }));
        dispatch({ type: 'ADD_MEDIA', payload: newMediaItems });
        if (event.target) event.target.value = '';
    }, [dispatch]);

    const handleSaveImage = useCallback((updatedMedia: MediaItem) => {
        dispatch({ type: 'UPDATE_MEDIA_ITEM', payload: updatedMedia });
        setMediaToEdit(null);
        addNotification(NotificationType.Success, t.publisher.imageUpdated);
    }, [addNotification, dispatch, t.publisher.imageUpdated]);

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(false);
        setDragOverIndex(null);

        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            const files = Array.from(event.dataTransfer.files) as File[];
            const validFiles = files.filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'));
            if (validFiles.length > 0) {
                const newMediaItems: MediaItem[] = validFiles.map((file) => ({
                    id: crypto.randomUUID(),
                    type: file.type.startsWith('video') ? 'video' : 'image',
                    url: URL.createObjectURL(file),
                    file,
                }));
                dispatch({ type: 'ADD_MEDIA', payload: newMediaItems });
                addNotification(NotificationType.Success, t.publisher.filesUploaded.replace('{count}', validFiles.length.toString()));
            } else {
                addNotification(NotificationType.Warning, t.publisher.onlyImagesVideos);
            }
            return;
        }

        if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return;
        const nextMedia = [...post.media];
        const draggedItem = nextMedia.splice(dragItem.current, 1)[0];
        nextMedia.splice(dragOverItem.current, 0, draggedItem);
        dispatch({ type: 'REORDER_MEDIA', payload: nextMedia });
        dragItem.current = null;
        dragOverItem.current = null;
    }, [addNotification, dispatch, post.media, t.publisher.filesUploaded, t.publisher.onlyImagesVideos]);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer.types.includes('Files')) setIsDraggingOver(true);
    }, []);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDraggingOver(false);
    }, []);

    const handleDragEnd = useCallback(() => {
        dragItem.current = null;
        dragOverItem.current = null;
        setDragOverIndex(null);
    }, []);

    const addHashtagToContent = useCallback((tag: string) => {
        const separator = post.content && !post.content.endsWith(' ') ? ' ' : '';
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'content', value: `${post.content}${separator}${tag}` } });
    }, [dispatch, post.content]);

    const validatePost = useCallback(() => {
        if (post.platforms.length === 0) {
            addNotification(NotificationType.Warning, t.publisher.selectAtLeastOnePlatform);
            return false;
        }
        if (!post.content.trim() && post.media.length === 0) {
            addNotification(NotificationType.Warning, t.publisher.postCannotBeEmpty);
            return false;
        }
        return true;
    }, [addNotification, post.content, post.media.length, post.platforms.length, t.publisher.postCannotBeEmpty, t.publisher.selectAtLeastOnePlatform]);

    const processMediaUploads = useCallback(async (): Promise<MediaItem[] | null> => {
        const { uploadFile } = await import('../services/storageService');
        const finalMedia = [...post.media];
        
        for (let i = 0; i < finalMedia.length; i++) {
            const item = finalMedia[i];
            if (item.file && item.url.startsWith('blob:')) {
                const res = await uploadFile(item.file, 'media', `posts/${brandId || 'general'}`);
                if (res.success && res.url) {
                    finalMedia[i] = { ...item, url: res.url, file: undefined };
                } else {
                    addNotification(NotificationType.Error, ar ? 'فشل في رفع إحدى الوسائط.' : 'Failed to upload one of the media assets.');
                    return null;
                }
            }
        }
        
        // Update local state so user doesn't have to re-upload if they fail to publish right after
        if (JSON.stringify(finalMedia) !== JSON.stringify(post.media)) {
             dispatch({ type: 'REORDER_MEDIA', payload: finalMedia });
        }
        
        return finalMedia;
    }, [addNotification, ar, brandId, dispatch, post.media]);

    const persistPost = useCallback(async (finalPost: Omit<ScheduledPost, 'id'>, successMessage: string, manageLoadingState = true) => {
        if (manageLoadingState) setIsSaving(true);
        try {
            if (postToEditId) {
                await onUpdatePost(postToEditId, finalPost);
            } else {
                await onSavePost(finalPost);
            }
            addNotification(NotificationType.Success, successMessage);
            resetState();
            onPostEdited?.();
            return true;
        } catch (error) {
            console.error(error);
            addNotification(NotificationType.Error, copy.persistFailed);
            return false;
        } finally {
            if (manageLoadingState) setIsSaving(false);
        }
    }, [addNotification, copy.persistFailed, onPostEdited, onSavePost, onUpdatePost, postToEditId, resetState]);
    const handleSaveDraft = useCallback(async () => {
        if (!validatePost()) return;
        setIsSaving(true);
        const uploadedMedia = await processMediaUploads();
        if (!uploadedMedia) {
            setIsSaving(false);
            return;
        }
        await persistPost(
            { ...post, media: uploadedMedia, status: PostStatus.Draft, scheduledAt: null },
            postToEditId ? (ar ? 'تم تحديث المسودة.' : 'Draft updated.') : (ar ? 'تم حفظ المسودة.' : 'Draft saved.'),
        );
    }, [ar, persistPost, post, postToEditId, validatePost, processMediaUploads]);

    const handleScheduleConfirm = useCallback(async () => {
        if (!validatePost()) return;
        setIsSaving(true);
        const uploadedMedia = await processMediaUploads();
        if (!uploadedMedia) {
            setIsSaving(false);
            return;
        }
        await persistPost(
            { ...post, media: uploadedMedia, status: PostStatus.Scheduled, scheduledAt: post.scheduledAt },
            postToEditId ? (ar ? 'تم تحديث الجدولة.' : 'Schedule updated.') : (ar ? 'تمت جدولة المنشور.' : 'Post scheduled.'),
        );
        setShowScheduler(false);
    }, [ar, persistPost, post, postToEditId, validatePost, processMediaUploads]);

    const handlePublish = useCallback(async () => {
        if (!validatePost()) return;
        if (!brandId) {
            addNotification(NotificationType.Error, ar ? 'تعذر النشر لأن معرّف البراند غير متاح.' : 'Cannot publish because the brand id is missing.');
            return;
        }

        setIsSaving(true);
        
        const uploadedMedia = await processMediaUploads();
        if (!uploadedMedia) {
            setIsSaving(false);
            return;
        }

        const initialStatuses = new Map(post.platforms.map((platform) => [platform, { status: PlatformPostStatus.Publishing }]));
        setPublishStatuses(initialStatuses);
        setShowPublishStatus(true);

        const postToPublish = { ...post, media: uploadedMedia, id: crypto.randomUUID() };

        try {
            const { publishPost } = await import('../services/socialPublishingService');
            const results = await publishPost(brandId, postToPublish);

            results.forEach((result) => {
                const nextStatus: PlatformStatus = result.success
                    ? { status: PlatformPostStatus.Published, postId: result.postId }
                    : { status: PlatformPostStatus.Failed, error: result.error };
                setPublishStatuses((current) => new Map(current).set(result.platform, nextStatus));
            });

            const allSucceeded = results.every((result) => result.success);
            if (allSucceeded) {
                await persistPost(
                    { ...postToPublish, status: PostStatus.Published, scheduledAt: new Date() },
                    postToEditId ? (ar ? 'تم تحديث المنشور المنشور.' : 'Published post updated.') : (ar ? 'تم نشر المنشور بنجاح.' : 'Post published successfully.'),
                    false,
                );
            } else {
                addNotification(NotificationType.Warning, copy.partialPublish);
            }
        } catch (error) {
            console.error(error);
            addNotification(NotificationType.Error, copy.publishFailed);
        } finally {
            setIsSaving(false);
        }
    }, [addNotification, ar, brandId, copy.partialPublish, copy.publishFailed, persistPost, post, postToEditId, validatePost]);

    const showLocationInput = useMemo(() => post.platforms.some((platform) => platform === SocialPlatform.Instagram || platform === SocialPlatform.LinkedIn), [post.platforms]);
    const currentLocationValue = useMemo(() => {
        if (!post.locations) return '';
        return post.platforms.map((platform) => post.locations?.[platform]).find(Boolean) || '';
    }, [post.locations, post.platforms]);

    const readinessItems = useMemo(() => ([
        { label: copy.coreMessage, done: Boolean(post.content.trim() || post.media.length > 0), hint: copy.coreMessageHint },
        { label: copy.platformsReady, done: post.platforms.length > 0, hint: copy.platformsReadyHint },
        { label: copy.mediaReady, done: post.media.length > 0, hint: copy.mediaReadyHint },
        { label: copy.scheduleReady, done: true, hint: post.scheduledAt ? new Date(post.scheduledAt).toLocaleString(ar ? 'ar-EG' : 'en-US') : copy.scheduleDraft },
    ]), [ar, copy.coreMessage, copy.coreMessageHint, copy.mediaReady, copy.mediaReadyHint, copy.platformsReady, copy.platformsReadyHint, copy.scheduleDraft, copy.scheduleReady, post.content, post.media.length, post.platforms.length, post.scheduledAt]);

    const readinessScore = Math.round((readinessItems.filter((item) => item.done).length / readinessItems.length) * 100);
    const readinessTone = readinessScore >= 100 ? 'text-emerald-300' : readinessScore >= 50 ? 'text-amber-300' : 'text-rose-300';
    const editorPills = [postToEditId ? copy.editMode : copy.draftMode, `${post.platforms.length} ${ar ? 'قنوات' : 'channels'}`, publisherBrief ? copy.briefAttached : copy.aiReady];

    const handleLocationChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const location = event.target.value;
        const nextLocations: Partial<Record<SocialPlatform, string>> = { ...post.locations };
        if (post.platforms.includes(SocialPlatform.Instagram)) nextLocations[SocialPlatform.Instagram] = location;
        if (post.platforms.includes(SocialPlatform.LinkedIn)) nextLocations[SocialPlatform.LinkedIn] = location;
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'locations', value: nextLocations } });
    };

    const handleSuggestionSelect = useCallback((suggestion: ScheduleSuggestion) => {
        const scheduledAt = new Date(`${suggestion.date}T${suggestion.time}`);
        dispatch({ type: 'UPDATE_FIELD', payload: { field: 'scheduledAt', value: scheduledAt } });
        setShowSmartScheduler(false);
        setShowScheduler(true);
    }, [dispatch]);

    const handleRetryPlatform = useCallback(async (platform: SocialPlatform) => {
        if (!brandId) {
            addNotification(NotificationType.Error, ar ? 'تعذر إعادة المحاولة لأن معرّف البراند غير متاح.' : 'Cannot retry because the brand id is missing.');
            return;
        }

        setPublishStatuses((current) => new Map(current).set(platform, { status: PlatformPostStatus.Publishing }));

        try {
            const { publishPost } = await import('../services/socialPublishingService');
            const [result] = await publishPost(brandId, { ...post, id: crypto.randomUUID(), platforms: [platform] });

            if (!result) {
                throw new Error('No publishing result returned.');
            }

            setPublishStatuses((current) => new Map(current).set(platform, result.success
                ? { status: PlatformPostStatus.Published, postId: result.postId }
                : { status: PlatformPostStatus.Failed, error: result.error }));

            if (result.success) {
                addNotification(NotificationType.Success, ar ? `تمت إعادة النشر على ${platform} بنجاح.` : `${platform} published successfully on retry.`);
            } else {
                addNotification(NotificationType.Warning, result.error || (ar ? 'فشلت إعادة المحاولة.' : 'Retry failed.'));
            }
        } catch (error) {
            console.error(error);
            setPublishStatuses((current) => new Map(current).set(platform, { status: PlatformPostStatus.Failed, error: ar ? 'فشلت إعادة المحاولة.' : 'Retry failed.' }));
            addNotification(NotificationType.Error, ar ? 'فشلت إعادة المحاولة.' : 'Retry failed.');
        }
    }, [addNotification, ar, brandId, post]);

    const handlePublishFailureNotice = useCallback((platform: SocialPlatform, error?: string | null) => {
        addNotification(NotificationType.Error, error || (ar ? `فشل النشر على ${platform}.` : `${platform} publishing failed.`));
    }, [addNotification, ar]);

    const handleCreateNewPost = useCallback(() => {
        setShowPublishStatus(false);
        resetState();
    }, [resetState]);

    const handleEditCurrentPost = useCallback(() => {
        setShowPublishStatus(false);
    }, []);

    const previewFit = useMemo(() => post.platforms.map((platform) => {
        const limit = PLATFORM_CHAR_LIMITS[platform];
        const delta = limit ? limit - post.content.length : null;
        const tone = delta === null ? 'text-sky-300' : delta >= 0 ? 'text-emerald-300' : 'text-rose-300';
        const label = delta === null
            ? (ar ? 'لا يوجد حد ثابت' : 'No hard limit')
            : delta >= 0
                ? (ar ? `متبقي ${delta} حرف` : `${delta} characters left`)
                : (ar ? `تجاوز ${Math.abs(delta)} حرف` : `${Math.abs(delta)} characters over`);

        return { platform, label, tone, limit };
    }), [ar, post.content.length, post.platforms]);

    return (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_370px]">
            <div className="space-y-6">
                <section className="surface-panel overflow-hidden rounded-3xl shadow-[var(--shadow-ambient)]">
                    <div className="border-b border-light-border/50 dark:border-dark-border/50 px-8 py-6">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                                <div className="flex flex-wrap gap-2">
                                    {editorPills.map((pill, index) => (
                                        <WorkspacePill key={`${pill}-${index}`} label={pill} tone={index === 2 && publisherBrief ? 'accent' : 'default'} />
                                    ))}
                                </div>
                                <h2 className="mt-4 text-2xl font-black tracking-tight text-light-text dark:text-dark-text">{copy.composerTitle}</h2>
                                <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-light-text-secondary dark:text-dark-text-secondary">{copy.composerHint}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button type="button" onClick={() => setShowAIAssistant(true)} className="btn rounded-2xl bg-light-card dark:bg-dark-card px-5 py-2.5 text-sm font-bold text-light-text dark:text-dark-text shadow-sm transition-all hover:-translate-y-0.5 active:scale-95">
                                    <i className="fas fa-wand-magic-sparkles me-2 text-brand-secondary" />
                                    {t.publisher.aiAssistant}
                                </button>
                                <button type="button" onClick={() => setShowCaptionAnalyzer(true)} disabled={!post.content.trim()} className="btn rounded-2xl bg-light-card dark:bg-dark-card px-5 py-2.5 text-sm font-bold text-light-text dark:text-dark-text shadow-sm transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-50">
                                    <i className="fas fa-chart-line me-2 text-brand-secondary" />
                                    {t.publisher.analyzeCaption}
                                </button>
                            </div>
                        </div>

                        {publisherBrief && (
                            <div className="surface-panel-soft mt-5 rounded-2xl bg-gradient-to-r from-brand-primary/10 via-transparent to-transparent p-5 shadow-inner">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div className="max-w-3xl">
                                        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-secondary">{copy.briefBannerTitle}</p>
                                        <h3 className="mt-2 text-base font-bold text-light-text dark:text-dark-text">{publisherBrief.title}</h3>
                                        <p className="mt-2 text-sm font-medium leading-6 text-light-text-secondary dark:text-dark-text-secondary">{publisherBrief.angle}</p>
                                    </div>
                                    <WorkspacePill label={copy.briefAttached} tone="accent" />
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {publisherBrief.keywords.slice(0, 4).map((keyword) => (
                                        <span key={keyword} className="rounded-full border border-white/5 bg-dark-bg px-3 py-1 text-xs text-dark-text-secondary">{keyword}</span>
                                    ))}
                                    {publisherBrief.cta && <span className="rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-medium text-brand-secondary">{publisherBrief.cta}</span>}
                                </div>
                                <p className="mt-3 text-xs text-dark-text-secondary">{copy.briefBannerHint}</p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-8 px-8 py-8">
                        <section className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-brand-secondary">{copy.primaryMessage}</p>
                                    <p className="mt-1 text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{copy.primaryMessageHint}</p>
                                </div>
                                {characterLimit !== null && <div className="rounded-full bg-light-bg px-3 py-1 text-xs font-bold text-light-text-secondary shadow-inner dark:bg-dark-bg dark:text-dark-text-secondary">{post.content.length} / {characterLimit}</div>}
                            </div>
                            <textarea
                                value={post.content}
                                onChange={(event) => dispatch({ type: 'UPDATE_FIELD', payload: { field: 'content', value: event.target.value } })}
                                placeholder={t.publisher.writePostPlaceholder}
                                className="min-h-[240px] w-full rounded-2xl border-0 bg-light-bg px-6 py-5 text-base leading-relaxed text-light-text shadow-inner outline-none transition-colors placeholder:text-light-text-secondary/60 focus:ring-2 focus:ring-brand-primary/30 dark:bg-dark-bg dark:text-dark-text dark:placeholder:text-dark-text-secondary/60"
                            />
                            <div className="flex flex-wrap items-center gap-2">
                                {isSuggestingHashtags && <span className="text-sm font-medium text-light-text-secondary dark:text-dark-text-secondary">{t.publisher.suggestingHashtags}</span>}
                                {!isSuggestingHashtags && hashtagSuggestions.flatMap((group) => group.hashtags).slice(0, 8).map((tag) => (
                                    <button key={tag} type="button" onClick={() => addHashtagToContent(tag)} className="btn rounded-full bg-light-card px-3 py-1.5 text-xs font-bold text-light-text-secondary shadow-sm hover:text-brand-primary dark:bg-dark-card dark:text-dark-text-secondary dark:hover:text-brand-primary active:scale-95">{tag}</button>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-2xl border border-dark-border bg-dark-bg p-4">
                            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">{copy.mediaStage}</p>
                                    <p className="mt-1 text-sm text-dark-text-secondary">{copy.mediaHint}</p>
                                </div>
                                {post.media.length > 0 && <button type="button" onClick={() => dispatch({ type: 'CLEAR_ALL_MEDIA' })} className="text-xs font-semibold text-rose-300 transition-colors hover:text-rose-200">{t.publisher.clearAll}</button>}
                            </div>

                            <div className={`rounded-2xl border-2 border-dashed p-4 transition-all ${isDraggingOver ? 'border-brand-primary bg-brand-primary/8 shadow-[0_0_0_6px_rgba(87,92,255,0.08)]' : 'border-dark-border bg-dark-bg/70'}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
                                {post.media.length === 0 ? (
                                    <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                                        <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-primary/12 text-brand-primary"><i className="fas fa-cloud-arrow-up text-2xl" /></div>
                                        <p className="mt-4 text-lg font-semibold text-white">{copy.mediaEmpty}</p>
                                        <p className="mt-2 max-w-md text-sm leading-6 text-dark-text-secondary">{copy.mediaHint}</p>
                                        <div className="mt-5 flex flex-wrap justify-center gap-3">
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-[0_18px_40px_-22px_rgba(87,92,255,0.95)] transition-colors hover:bg-brand-secondary"><i className="fas fa-plus me-2" />{copy.uploadAssets}</button>
                                            <button type="button" onClick={() => setShowImageGenerator(true)} className="rounded-2xl border border-dark-border bg-dark-card px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:border-brand-primary"><i className="fas fa-sparkles me-2 text-brand-secondary" />{copy.aiImage}</button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                                            {post.media.map((item, index) => (
                                                <div key={item.id} className={`group relative aspect-square overflow-hidden rounded-xl border border-dark-border bg-black transition-all ${dragOverIndex === index ? 'ring-2 ring-brand-primary' : ''}`} draggable onDragStart={() => { dragItem.current = index; }} onDragEnter={() => { if (dragItem.current !== null) { dragOverItem.current = index; setDragOverIndex(index); } }} onDragEnd={handleDragEnd}>
                                                    {item.type === 'video' ? <video src={item.url} className="h-full w-full object-cover" /> : <img src={item.url} alt="Media item" className="h-full w-full object-cover" />}
                                                    <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); setMediaToEdit(item); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"><i className="fas fa-pen text-xs" /></button>
                                                        <button type="button" onClick={(event) => { event.stopPropagation(); dispatch({ type: 'REMOVE_MEDIA', payload: item.id }); }} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"><i className="fas fa-trash text-xs" /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid gap-3">
                                            <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-[96px] flex-col items-center justify-center rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:border-brand-primary"><i className="fas fa-folder-plus mb-2 text-lg text-brand-secondary" />{copy.uploadAssets}</button>
                                            <button type="button" onClick={() => setShowImageGenerator(true)} className="flex min-h-[96px] flex-col items-center justify-center rounded-xl border border-dark-border bg-dark-card px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:border-brand-primary"><i className="fas fa-sparkles mb-2 text-lg text-brand-secondary" />{copy.aiImage}</button>
                                        </div>
                                    </div>
                                )}
                                <input type="file" ref={fileInputRef} onChange={handleMediaUpload} multiple accept="image/*,video/*" className="hidden" />
                            </div>
                        </section>
                        <section className="space-y-4">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">{copy.channelTargets}</p>
                                <p className="mt-1 text-sm text-dark-text-secondary">{copy.channelTargetsHint}</p>
                            </div>
                            <PlatformChipSelector
                                selected={post.platforms}
                                colors={post.platformColors || {}}
                                onToggle={(platform) => dispatch({ type: 'TOGGLE_PLATFORM', payload: platform })}
                                onColorChange={(platform, color) => dispatch({
                                    type: 'UPDATE_FIELD',
                                    payload: {
                                        field: 'platformColors',
                                        value: { ...(post.platformColors || {}), [platform]: color },
                                    },
                                })}
                            />
                        </section>

                        {(post.platforms.includes(SocialPlatform.Instagram) || showLocationInput) && (
                            <section className="rounded-2xl border border-dark-border bg-dark-bg/60 p-4">
                                <div className="mb-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">{copy.channelSettings}</p>
                                    <p className="mt-1 text-sm text-dark-text-secondary">{copy.channelSettingsHint}</p>
                                </div>
                                <div className="grid gap-4 md:grid-cols-2">
                                    {post.platforms.includes(SocialPlatform.Instagram) && (
                                        <label className="space-y-2">
                                            <span className="text-sm font-medium text-white">{copy.attachFirstComment}</span>
                                            <textarea
                                                value={post.instagramFirstComment || ''}
                                                onChange={(event) => dispatch({ type: 'UPDATE_FIELD', payload: { field: 'instagramFirstComment', value: event.target.value } })}
                                                rows={4}
                                                className="w-full rounded-2xl border border-dark-border bg-[#0b0a16] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-dark-text-secondary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                                                placeholder={ar ? 'أضف الهاشتاغات أو الدعوة إلى الإجراء في التعليق الأول.' : 'Use the first comment for hashtags or the CTA.'}
                                            />
                                        </label>
                                    )}
                                    {showLocationInput && (
                                        <label className="space-y-2">
                                            <span className="text-sm font-medium text-white">{copy.locationTag}</span>
                                            <input
                                                type="text"
                                                value={currentLocationValue}
                                                onChange={handleLocationChange}
                                                className="w-full rounded-2xl border border-dark-border bg-[#0b0a16] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-dark-text-secondary focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
                                                placeholder={ar ? 'مثال: الرياض، السعودية' : 'Example: Riyadh, Saudi Arabia'}
                                            />
                                        </label>
                                    )}
                                </div>
                            </section>
                        )}
                    </div>
                </section>

                <section className="surface-panel rounded-3xl p-5 shadow-[var(--shadow-ambient)]">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-secondary">{copy.previewTitle}</p>
                            <p className="mt-1 text-sm text-dark-text-secondary">{copy.previewHint}</p>
                        </div>
                        <WorkspacePill label={copy.livePreview} tone="accent" />
                    </div>

                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
                        <div className="overflow-hidden rounded-2xl border border-dark-border bg-dark-bg p-3">
                            <PostPreview
                                content={post.content}
                                platforms={post.platforms}
                                media={post.media}
                                activeTab={activePreviewTab}
                                onTabChange={(platform) => dispatch({ type: 'SET_ACTIVE_PREVIEW_TAB', payload: platform })}
                                instagramFirstComment={post.instagramFirstComment}
                                locations={post.locations}
                                brandName={brandProfile.brandName}
                            />
                        </div>
                        <div className="space-y-3">
                            {previewFit.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-dark-border bg-dark-bg/60 p-4 text-sm leading-6 text-dark-text-secondary">
                                    {ar ? 'اختر منصة واحدة على الأقل لقياس التوافق والمعاينة.' : 'Select at least one channel to evaluate fit and preview.'}
                                </div>
                            ) : (
                                previewFit.map((item) => {
                                    const asset = PLATFORM_ASSETS[item.platform];
                                    return (
                                        <div key={item.platform} className="rounded-2xl border border-dark-border bg-dark-bg/60 p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/5" style={{ backgroundColor: `${asset.hexColor}18`, color: asset.hexColor }}>
                                                        <i className={asset.icon} />
                                                    </span>
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">{item.platform}</p>
                                                        <p className={`text-xs ${item.tone}`}>{item.label}</p>
                                                    </div>
                                                </div>
                                                {item.limit && <span className="text-xs text-dark-text-secondary">{item.limit} {ar ? 'حرف' : 'chars'}</span>}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <aside className="space-y-5 xl:sticky xl:top-24 xl:self-start">
                <RailCard title={copy.actionsTitle} description={copy.actionsDesc}>
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handlePublish}
                            disabled={isSaving || post.platforms.length === 0}
                            className="btn flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 py-3.5 text-sm font-bold text-white shadow-[var(--shadow-primary)] transition-transform hover:-translate-y-1 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                        >
                            <i className={`fas ${isSaving ? 'fa-spinner fa-spin' : 'fa-rocket'} text-base`} />
                            {isSaving ? copy.publishing : copy.publishNow}
                        </button>
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                            <button type="button" onClick={() => setShowScheduler((current) => !current)} className="btn rounded-xl bg-light-bg px-4 py-3 text-sm font-bold shadow-sm transition-all hover:bg-light-bg/80 active:scale-95 dark:bg-dark-bg text-light-text dark:text-dark-text">
                                <i className="fas fa-clock me-2 text-brand-primary" />
                                {copy.schedulePost}
                            </button>
                            <button type="button" onClick={handleSaveDraft} disabled={isSaving} className="btn rounded-xl bg-light-bg px-4 py-3 text-sm font-bold shadow-sm transition-all hover:bg-light-bg/80 active:scale-95 disabled:opacity-50 dark:bg-dark-bg text-light-text dark:text-dark-text">
                                <i className="fas fa-floppy-disk me-2 text-light-text-secondary dark:text-dark-text-secondary" />
                                {copy.saveDraft}
                            </button>
                        </div>
                        <button type="button" onClick={() => setShowSmartScheduler(true)} className="btn mt-2 w-full rounded-xl bg-brand-primary/10 px-4 py-3 text-sm font-bold text-brand-primary transition-all hover:bg-brand-primary hover:text-white active:scale-95">
                            <i className="fas fa-brain me-2" />
                            {copy.smartTime}
                        </button>
                        {showScheduler && (
                            <div className="surface-panel-soft mt-3 rounded-2xl p-5 shadow-inner">
                                <DateTimePicker
                                    selectedDate={post.scheduledAt}
                                    onChange={(date) => dispatch({ type: 'UPDATE_FIELD', payload: { field: 'scheduledAt', value: date } })}
                                    onConfirm={handleScheduleConfirm}
                                    onCancel={() => setShowScheduler(false)}
                                />
                            </div>
                        )}
                    </div>
                </RailCard>

                <RailCard title={copy.readinessTitle} description={copy.readinessDesc}>
                    <div className="space-y-4">
                        <div className="rounded-xl border border-dark-border bg-dark-bg/70 p-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <p className="text-2xl font-bold text-white">{readinessScore}%</p>
                                <span className={`text-sm font-semibold ${readinessTone}`}>{readinessScore >= 100 ? copy.ready : copy.needsAction}</span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-dark-card">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${readinessScore >= 100 ? 'bg-emerald-400' : readinessScore >= 50 ? 'bg-amber-400' : 'bg-rose-400'}`}
                                    style={{ width: `${readinessScore}%` }}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            {readinessItems.map((item) => (
                                <div key={item.label} className="rounded-xl border border-dark-border bg-dark-bg/60 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.label}</p>
                                            <p className="mt-1 text-xs leading-5 text-dark-text-secondary">{item.hint}</p>
                                        </div>
                                        <span className={`flex h-7 w-7 items-center justify-center rounded-full ${item.done ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
                                            <i className={`fas ${item.done ? 'fa-check' : 'fa-exclamation'}`} />
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </RailCard>

                <RailCard title={copy.brandContext} description={copy.brandContextDesc}>
                    <div className="overflow-hidden rounded-xl border border-dark-border bg-dark-bg/60 text-sm divide-y divide-dark-border">
                        <div className="px-4 py-3">
                            <p className="text-[11px] uppercase tracking-widest text-dark-text-secondary">{ar ? 'النبرة' : 'Tone'}</p>
                            <p className="mt-1 font-semibold text-white">{brandTone}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] uppercase tracking-widest text-dark-text-secondary">{copy.audience}</p>
                            <p className="mt-1 font-semibold text-white">{primaryAudience}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] uppercase tracking-widest text-dark-text-secondary">{copy.voiceKeywords}</p>
                            <p className="mt-1 leading-6 text-white">{voiceKeywords}</p>
                        </div>
                        <div className="px-4 py-3">
                            <p className="text-[11px] uppercase tracking-widest text-dark-text-secondary">{copy.prohibitedWords}</p>
                            <p className="mt-1 leading-6 text-white">{avoidedWords}</p>
                        </div>
                    </div>
                </RailCard>

                <RailCard title={copy.variantsTitle} description={copy.variantsDesc}>
                    <div className="space-y-3">
                        <button
                            type="button"
                            onClick={handleGenerateBriefVariants}
                            disabled={!publisherBrief || isGeneratingBriefVariants}
                            className="w-full rounded-xl border border-dark-border bg-dark-bg px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-brand-primary hover:bg-dark-card disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <i className={`fas ${isGeneratingBriefVariants ? 'fa-spinner fa-spin' : 'fa-sparkles'} me-2 text-brand-secondary`} />
                            {isGeneratingBriefVariants ? copy.generatingVariants : copy.generateVariants}
                        </button>

                        {!publisherBrief && (
                            <div className="rounded-xl border border-dashed border-dark-border bg-dark-bg/50 p-4 text-sm leading-6 text-dark-text-secondary">
                                {ar ? 'أرسل brief من تحليل المنافسين أو من Content Ops حتى تولد نسخًا مبنية على السياق.' : 'Send a brief from competitor analysis or Content Ops to generate context-aware variants.'}
                            </div>
                        )}

                        {briefVariants.map((variant, index) => (
                            <div key={`${variant.platform}-${index}`} className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{variant.platform}</p>
                                        <p className="mt-1 text-xs text-dark-text-secondary">{variant.tone}</p>
                                    </div>
                                    <WorkspacePill label={`${variant.score}/100`} tone={variant.score >= 80 ? 'success' : 'accent'} />
                                </div>
                                <p className="mt-3 line-clamp-3 text-sm leading-6 text-dark-text-secondary">{variant.content}</p>
                                <button type="button" onClick={() => handleApplyBriefVariant(variant)} className="mt-4 w-full rounded-xl border border-brand-primary/25 bg-brand-primary/10 px-3 py-2 text-sm font-semibold text-brand-secondary transition-colors hover:bg-brand-primary/15">{copy.applyVariant}</button>
                            </div>
                        ))}
                    </div>
                </RailCard>
            </aside>

            {showAIAssistant && (
                <Suspense fallback={null}>
                    <AIAssistant
                        onClose={() => setShowAIAssistant(false)}
                        onApply={(caption) => dispatch({ type: 'UPDATE_FIELD', payload: { field: 'content', value: caption } })}
                        brandProfile={brandProfile}
                        brandId={brandId}
                    />
                </Suspense>
            )}

            {showCaptionAnalyzer && (
                <Suspense fallback={null}>
                    <CaptionAnalyzer
                        caption={post.content}
                        platforms={post.platforms}
                        onClose={() => setShowCaptionAnalyzer(false)}
                        onApplyCaption={(newCaption) => {
                            dispatch({ type: 'UPDATE_FIELD', payload: { field: 'content', value: newCaption } });
                            setShowCaptionAnalyzer(false);
                        }}
                        brandProfile={brandProfile}
                    />
                </Suspense>
            )}

            {mediaToEdit && (
                <ImageEditorModal
                    mediaItem={mediaToEdit}
                    onClose={() => setMediaToEdit(null)}
                    onSave={handleSaveImage}
                />
            )}

            {showSmartScheduler && (
                <SmartSchedulerModal
                    onClose={() => setShowSmartScheduler(false)}
                    onSelectTime={handleSuggestionSelect}
                    platforms={post.platforms}
                    postTopic={post.content}
                />
            )}

            {showPublishStatus && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
                    onClick={() => setShowPublishStatus(false)}
                >
                    <div
                        className="w-full max-w-3xl rounded-3xl border border-dark-border bg-dark-bg p-5 shadow-[0_40px_120px_-60px_rgba(0,0,0,1)] relative"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setShowPublishStatus(false)}
                            className="absolute top-4 left-4 text-dark-text-secondary hover:text-white transition-colors"
                            aria-label="إغلاق"
                        >
                            <i className="fas fa-times text-lg"></i>
                        </button>
                        <PlatformStatusDisplay
                            statuses={publishStatuses}
                            onRetry={handleRetryPlatform}
                            onCreateNewPost={handleCreateNewPost}
                            onEditPost={handleEditCurrentPost}
                            onNotifyFailure={handlePublishFailureNotice}
                            onConnectAccount={onNavigateToIntegrations ? () => { setShowPublishStatus(false); onNavigateToIntegrations(); } : undefined}
                            onClose={() => setShowPublishStatus(false)}
                        />
                    </div>
                </div>
            )}

            {showImageGenerator && (
                <Suspense fallback={null}>
                    <AIImageGeneratorModal
                        onClose={() => setShowImageGenerator(false)}
                        onAddImage={(mediaItem) => dispatch({ type: 'ADD_MEDIA', payload: [mediaItem] })}
                        brandId={brandId}
                    />
                </Suspense>
            )}
        </div>
    );
};
