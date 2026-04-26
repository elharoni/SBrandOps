// components/pages/CampaignBrainPage.tsx
// Campaign Brain — AI Marketing Operating System
// 14-screen campaign lifecycle: Goal → Strategy → Calendar → Content → QA → Approval → Schedule → Analytics

import React, { useState, useEffect, useCallback } from 'react';
import {
    BrandHubProfile, NotificationType, CBWizardStep, CBCampaign, CBContentItem,
    CBCreativeBrief, CBStrategyDocument, CBQualityScore, CampaignGoalType, CBContentFormat,
    CBContentType, CBRecommendation, CBPerformanceAnalysis,
} from '../../types';
import { buildBrandBrainContext } from '../../services/brandBrainService';
import {
    getCampaigns, createCampaign, updateCampaignStrategy, updateCampaignStatus,
    createGoal, getContentItems, createContentItem, updateContentItem, updateContentItemStatus,
    upsertCreativeBrief, createDesignPrompt, updateDesignPromptResult, selectDesignPrompt,
    getDesignPrompts, getCreativeBrief, createApproval, submitApproval, schedulePublishingJob,
    getCaptions, createCaption, selectCaption,
    getMediaAssets, createMediaAsset, selectMediaAsset, updateMediaAssetScore,
    saveLearningsToBrandMemory, getLearningsCount, getPublishedPostsForCampaign,
    getCampaignHealth,
} from '../../services/campaignBrainService';
import {
    generateCampaignStrategy, generateCalendarPlan, generateCreativeBriefAI,
    generateDesignPromptAI, generateCaptions, runQualityCheck, suggestPublishTimes,
    checkGoalRealism, suggestKPIs, generateLearningRecommendations,
    analyzePerformanceVsPredicted, optimizePerPlatform, reviewAssetQuality,
    type ScheduleSuggestion, type GoalRealityCheck, type PlatformOptimizationResult,
    type AssetReviewResult,
} from '../../services/campaignBrainAgents';
import { generateImageFromPrompt } from '../../services/geminiService';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
    brandId: string;
    brandProfile: BrandHubProfile;
    addNotification: (type: NotificationType, message: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const PLATFORM_ICONS: Record<string, string> = {
    instagram: 'fa-instagram',  facebook: 'fa-facebook',
    tiktok:    'fa-tiktok',     linkedin: 'fa-linkedin',
    x:         'fa-x-twitter',  twitter:  'fa-x-twitter',
    youtube:   'fa-youtube',
};

const FORMAT_ICONS: Record<string, string> = {
    post: 'fa-image', story: 'fa-circle', reel: 'fa-video',
    carousel: 'fa-images', video: 'fa-film', ad: 'fa-ad',
};

const CONTENT_TYPE_COLORS: Record<string, string> = {
    educational: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    promotional: 'bg-brand-primary/10 text-brand-primary',
    testimonial:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    'behind-scenes': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    occasion:    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    entertainment: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
    draft:               { label: 'مسودة',          color: 'text-light-text-secondary', icon: 'fa-circle-dot' },
    brief_ready:         { label: 'البريف جاهز',     color: 'text-blue-500',            icon: 'fa-file-lines' },
    design_in_progress:  { label: 'التصميم جارٍ',    color: 'text-orange-500',           icon: 'fa-spinner fa-spin' },
    design_ready:        { label: 'التصميم جاهز',    color: 'text-teal-500',            icon: 'fa-image' },
    caption_ready:       { label: 'الكابشن جاهز',    color: 'text-cyan-500',            icon: 'fa-pen-nib' },
    needs_review:        { label: 'بانتظار المراجعة', color: 'text-yellow-500',          icon: 'fa-clock' },
    approved:            { label: 'موافق عليه',       color: 'text-green-500',           icon: 'fa-circle-check' },
    scheduled:           { label: 'مجدول',            color: 'text-brand-primary',       icon: 'fa-calendar-check' },
    publishing:          { label: 'جارٍ النشر',       color: 'text-blue-500',            icon: 'fa-spinner fa-spin' },
    published:           { label: 'منشور',            color: 'text-green-600',           icon: 'fa-check-double' },
    publish_failed:      { label: 'فشل النشر',        color: 'text-red-500',             icon: 'fa-triangle-exclamation' },
    performance_tracked: { label: 'تم التحليل',       color: 'text-purple-500',          icon: 'fa-chart-line' },
    needs_optimization:  { label: 'يحتاج تحسين',      color: 'text-orange-600',          icon: 'fa-arrows-rotate' },
};

const GOAL_TYPES: Array<{ id: CampaignGoalType; icon: string; label: string; desc: string }> = [
    { id: 'awareness',   icon: 'fa-bullhorn',   label: 'وعي',           desc: 'وصول + مشاهدات' },
    { id: 'engagement',  icon: 'fa-heart',      label: 'تفاعل',         desc: 'إعجابات + تعليقات' },
    { id: 'leads',       icon: 'fa-funnel-dollar', label: 'عملاء محتملون', desc: 'تواصل + اشتراكات' },
    { id: 'sales',       icon: 'fa-bag-shopping', label: 'مبيعات',       desc: 'إيرادات + تحويلات' },
    { id: 'retention',   icon: 'fa-rotate',     label: 'احتفاظ',         desc: 'ولاء + تكرار' },
];

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'x', 'linkedin', 'youtube'];
const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
    draft:     'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    active:    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    paused:    'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
    completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    archived:  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
};

function scoreColor(score: number): string {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
}

function ScoreBar({ score, label }: { score: number; label: string }) {
    const pct = Math.min(100, Math.max(0, score));
    const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-400' : 'bg-red-500';
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="w-32 shrink-0 text-xs text-light-text-secondary dark:text-dark-text-secondary">{label}</span>
            <div className="flex-1 h-2 rounded-full bg-light-bg dark:bg-dark-bg overflow-hidden">
                <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <span className={`w-8 text-right text-xs font-semibold ${scoreColor(pct)}`}>{pct}</span>
        </div>
    );
}

function Spinner() {
    return <i className="fas fa-spinner fa-spin text-brand-primary" />;
}

function LoadingOverlay({ text }: { text: string }) {
    return (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-light-card/90 dark:bg-dark-card/90 backdrop-blur-sm">
            <i className="fas fa-brain fa-beat-fade text-3xl text-brand-primary" />
            <p className="text-sm font-medium text-light-text dark:text-dark-text">{text}</p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function CampaignBrainPage({ brandId, brandProfile, addNotification }: Props) {
    // ── Navigation state ─────────────────────────────────────────────────────
    const [screen, setScreen] = useState<CBWizardStep>('campaigns-list');
    const [activeCampaign, setActiveCampaign]   = useState<CBCampaign | null>(null);
    const [activeItem, setActiveItem]           = useState<CBContentItem | null>(null);
    const [itemWorkspaceTab, setItemWorkspaceTab] = useState<'brief' | 'design' | 'asset-review' | 'caption' | 'qa' | 'approval' | 'schedule'>('brief');

    // ── Data state ────────────────────────────────────────────────────────────
    const [campaigns, setCampaigns]     = useState<CBCampaign[]>([]);
    const [contentItems, setContentItems] = useState<CBContentItem[]>([]);
    const [loading, setLoading]         = useState(false);
    const [aiLoading, setAiLoading]     = useState(false);
    const [aiLoadingText, setAiLoadingText] = useState('يفكر الـ AI...');

    // ── Goal Builder state ────────────────────────────────────────────────────
    const [goalType, setGoalType]         = useState<CampaignGoalType>('awareness');
    const [goalTitle, setGoalTitle]       = useState('');
    const [goalTarget, setGoalTarget]     = useState('');
    const [goalTargetMetric, setGoalTargetMetric] = useState('');
    const [goalDuration, setGoalDuration] = useState(30);
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'facebook']);
    const [campaignName, setCampaignName] = useState('');
    const [goalBudget, setGoalBudget]     = useState('');
    const [postsPerWeek, setPostsPerWeek] = useState(5);
    const [kpis, setKpis]                 = useState<Array<{ metric: string; target: number; unit: string }>>([]);
    const [realityCheck, setRealityCheck] = useState<GoalRealityCheck | null>(null);

    // ── Strategy state ────────────────────────────────────────────────────────
    const [strategy, setStrategy]         = useState<CBStrategyDocument | null>(null);

    // ── Calendar state ────────────────────────────────────────────────────────
    const [calendarSlots, setCalendarSlots] = useState<Array<{
        date: string; platform: string; format: CBContentFormat;
        contentType: CBContentType; topic: string; angle: string;
    }>>([]);

    // ── Content Item Workspace state ──────────────────────────────────────────
    const [brief, setBrief]               = useState<CBCreativeBrief | null>(null);
    const [designPromptText, setDesignPromptText] = useState('');
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [selectedImageUrl, setSelectedImageUrl] = useState('');
    const [captionVersions, setCaptionVersions] = useState<Array<{
        caption: string; headline: string; hashtags: string[]; cta: string; charCount: number;
    }>>([]);
    const [selectedCaptionIdx, setSelectedCaptionIdx] = useState(0);
    const [qualityScore, setQualityScore] = useState<CBQualityScore | null>(null);
    const [scheduleSuggestions, setScheduleSuggestions] = useState<ScheduleSuggestion[]>([]);
    const [selectedScheduleTime, setSelectedScheduleTime] = useState('');

    // ── Calendar view state ───────────────────────────────────────────────────
    const [calendarView, setCalendarView] = useState<'list' | 'month'>('list');

    // ── Asset Review state ────────────────────────────────────────────────────
    const [assetReview, setAssetReview] = useState<AssetReviewResult | null>(null);

    // ── Platform Optimization state ───────────────────────────────────────────
    const [platformVariants, setPlatformVariants] = useState<PlatformOptimizationResult[]>([]);
    const [platformVariantIdx, setPlatformVariantIdx] = useState(0);

    // ── Performance & Recommendations state ──────────────────────────────────
    const [performanceAnalysis, setPerformanceAnalysis] = useState<CBPerformanceAnalysis | null>(null);
    const [recommendations, setRecommendations] = useState<CBRecommendation[]>([]);
    const [campaignHealthScore, setCampaignHealthScore] = useState(0);
    const [learningsCount, setLearningsCount] = useState(0);
    const [savingLearnings, setSavingLearnings] = useState(false);

    // ── UX Enhancement state ──────────────────────────────────────────────────
    const [showRegenDialog, setShowRegenDialog]     = useState(false);
    const [regenReason, setRegenReason]             = useState('');
    const [editingMsgIdx, setEditingMsgIdx]         = useState<number | null>(null);
    const [editingMsgText, setEditingMsgText]       = useState('');
    const [briefVisualStyle, setBriefVisualStyle]   = useState('minimalist');
    const [showPreviewModal, setShowPreviewModal]   = useState(false);
    const [approvalDecision, setApprovalDecision]   = useState<'approve' | 'approve_minor' | 'review' | 'reject' | ''>('');
    const [approvalNote, setApprovalNote]           = useState('');
    const [showOccasionsPanel, setShowOccasionsPanel] = useState(false);
    const [designSlides, setDesignSlides]           = useState<string[]>([]);
    const [designProvider, setDesignProvider]       = useState<'gemini' | 'dalle' | 'midjourney'>('gemini');
    const [goalTargetMetricLabel, setGoalTargetMetricLabel] = useState('');

    // ── Brand Profile Completeness ────────────────────────────────────────────
    const profileCompleteness = React.useMemo(() => {
        let score = 0;
        if (brandProfile.brandName)                          score += 10;
        if (brandProfile.industry)                           score += 10;
        if ((brandProfile.values?.length ?? 0) >= 3)        score += 15;
        if ((brandProfile.keySellingPoints?.length ?? 0) >= 3) score += 15;
        if ((brandProfile.styleGuidelines?.length ?? 0) >= 2)  score += 15;
        if ((brandProfile.brandVoice?.toneDescription?.length ?? 0) > 0) score += 10;
        if ((brandProfile.brandAudiences?.length ?? 0) >= 1) score += 15;
        if (brandProfile.website)                            score += 5;
        if (brandProfile.country)                            score += 5;
        return score;
    }, [brandProfile]);

    // ── Initial data load ─────────────────────────────────────────────────────
    useEffect(() => {
        getCampaigns(brandId)
            .then(setCampaigns)
            .catch(() => {});
    }, [brandId]);

    const refreshItems = useCallback(() => {
        if (!activeCampaign) return;
        getContentItems(activeCampaign.id).then(setContentItems).catch(() => {});
    }, [activeCampaign]);

    useEffect(() => { refreshItems(); }, [refreshItems]);

    // ── Goal Builder: AI reality check ────────────────────────────────────────
    async function handleCheckGoal() {
        if (!goalTitle || !goalTarget) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يُقيّم الـ AI واقعية هدفك...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const rc = await checkGoalRealism({
                brandBrain:    ctx,
                goalType,
                targetNumber:  parseFloat(goalTarget),
                targetMetric:  goalTargetMetric || goalType,
                durationDays:  goalDuration,
                platforms:     selectedPlatforms,
                budget:        goalBudget ? parseFloat(goalBudget) : undefined,
            });
            setRealityCheck(rc);
            const suggestedKpis = await suggestKPIs({ brandBrain: ctx, goalType, platforms: selectedPlatforms, durationDays: goalDuration });
            setKpis(suggestedKpis);
        } catch {
            addNotification(NotificationType.Error, 'فشل تحليل الهدف');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Goal Builder → Strategy ────────────────────────────────────────────────
    async function handleBuildStrategy() {
        if (!campaignName || !goalTitle) {
            addNotification(NotificationType.Warning, 'أدخل اسم الحملة والهدف أولاً');
            return;
        }
        try {
            setAiLoading(true);
            setAiLoadingText('يقرأ الـ AI ملف البراند...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'full');

            setAiLoadingText('يُولّد الرسائل الرئيسية...');
            const strat = await generateCampaignStrategy({
                brandBrain:   ctx,
                goalType,
                goalTitle,
                durationDays: goalDuration,
                platforms:    selectedPlatforms,
                budget:       goalBudget ? parseFloat(goalBudget) : undefined,
                postsPerWeek,
            });
            setStrategy(strat);

            // Create goal + campaign in DB
            const goal = await createGoal(brandId, {
                title: goalTitle, goalType,
                kpis,
                targetDate: new Date(Date.now() + goalDuration * 86400000).toISOString().split('T')[0],
            });
            const camp = await createCampaign(brandId, {
                name: campaignName, goalId: goal.id,
                startDate: new Date().toISOString().split('T')[0],
                endDate: new Date(Date.now() + goalDuration * 86400000).toISOString().split('T')[0],
                platforms: selectedPlatforms,
                budget: goalBudget ? parseFloat(goalBudget) : undefined,
            });
            await updateCampaignStrategy(camp.id, strat);
            setActiveCampaign({ ...camp, strategyData: strat });
            setCampaigns(prev => [{ ...camp, strategyData: strat }, ...prev]);

            setScreen('strategy-generator');
        } catch (err) {
            addNotification(NotificationType.Error, 'فشل توليد الاستراتيجية');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Strategy approved → Calendar ──────────────────────────────────────────
    async function handleBuildCalendar() {
        if (!activeCampaign || !strategy) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يبني تقويم المحتوى...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'standard');
            const startDate = activeCampaign.startDate ?? new Date().toISOString().split('T')[0];
            const endDate   = activeCampaign.endDate ?? new Date(Date.now() + goalDuration * 86400000).toISOString().split('T')[0];
            const slots     = await generateCalendarPlan({
                brandBrain: ctx, strategy,
                startDate, endDate, postsPerWeek,
                platforms: selectedPlatforms,
            });
            setCalendarSlots(slots as typeof calendarSlots);
            setScreen('content-calendar');
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد التقويم');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Calendar → create all items in DB ────────────────────────────────────
    async function handleCreateItemsFromCalendar() {
        if (!activeCampaign) return;
        try {
            setLoading(true);
            await Promise.all(calendarSlots.map((slot, idx) =>
                createContentItem(brandId, {
                    campaignId:  activeCampaign.id,
                    title:       slot.topic,
                    contentType: slot.contentType,
                    platform:    slot.platform,
                    format:      slot.format,
                    scheduledAt: new Date(slot.date).toISOString(),
                    sortOrder:   idx,
                }),
            ));
            const items = await getContentItems(activeCampaign.id);
            setContentItems(items);
            await updateCampaignStatus(activeCampaign.id, 'active');
            setActiveCampaign(prev => prev ? { ...prev, status: 'active', contentCount: items.length } : prev);
            setCampaigns(prev => prev.map(c => c.id === activeCampaign.id ? { ...c, status: 'active', contentCount: items.length } : c));
            addNotification(NotificationType.Success, `تم إنشاء ${items.length} قطعة محتوى`);
        } catch {
            addNotification(NotificationType.Error, 'فشل إنشاء عناصر التقويم');
        } finally {
            setLoading(false);
        }
    }

    // ── Open item workspace ────────────────────────────────────────────────────
    async function handleOpenItem(item: CBContentItem) {
        setActiveItem(item);
        setItemWorkspaceTab('brief');
        setBrief(null);
        setDesignPromptText('');
        setGeneratedImages([]);
        setSelectedImageUrl(item.mediaUrl ?? '');
        setCaptionVersions([]);
        setQualityScore(null);
        setScheduleSuggestions([]);

        // Load existing brief if any
        try {
            const existingBrief = await getCreativeBrief(item.id);
            if (existingBrief) setBrief(existingBrief);
        } catch { /* no brief yet */ }

        setScreen('item-workspace');
    }

    // ── Generate creative brief ────────────────────────────────────────────────
    async function handleGenerateBrief() {
        if (!activeItem) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يكتب البريف الإبداعي...');
            const ctx   = await buildBrandBrainContext(brandId, brandProfile, 'standard');
            const newBrief = await generateCreativeBriefAI({
                brandBrain:      ctx,
                platform:        activeItem.platform,
                format:          activeItem.format as CBContentFormat,
                contentType:     activeItem.contentType as CBContentType,
                topic:           activeItem.title,
                angle:           (activeItem.briefData?.keyMessage ?? activeItem.title),
                strategyContext: activeCampaign?.strategyData,
            });
            const saved = await upsertCreativeBrief(brandId, activeItem.id, {
                objective:       newBrief.objective,
                targetSegment:   newBrief.targetSegment,
                keyMessage:      newBrief.keyMessage,
                tone:            newBrief.tone,
                hooks:           newBrief.hooks,
                cta:             newBrief.cta,
                visualDirection: newBrief.visualDirection,
                negativeSpace:   newBrief.negativeSpace,
                slideStructure:  newBrief.slideStructure,
            });
            setBrief(saved);
            await updateContentItemStatus(activeItem.id, 'brief_ready');
            setActiveItem(prev => prev ? { ...prev, status: 'brief_ready' } : prev);
            setContentItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'brief_ready' } : i));
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد البريف');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Generate design prompt + image ────────────────────────────────────────
    async function handleGenerateDesign() {
        if (!brief || !activeItem) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يكتب الـ AI prompt التصميم...');
            await updateContentItemStatus(activeItem.id, 'design_in_progress');
            setActiveItem(prev => prev ? { ...prev, status: 'design_in_progress' } : prev);

            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const result = await generateDesignPromptAI({
                brandBrain:  ctx,
                brief,
                platform:    activeItem.platform,
                slideIndex:  0,
            });
            setDesignPromptText(result.englishPrompt);

            setAiLoadingText('يُولّد التصميم...');
            const images = await generateImageFromPrompt(result.englishPrompt, '1:1', 'google', 2);
            setGeneratedImages(images);

            // Save prompt + first image to DB
            const dp = await createDesignPrompt(brandId, {
                contentItemId: activeItem.id,
                creativeBriefId: brief.id,
                promptText: result.englishPrompt,
                negativePrompt: result.negativePrompt,
                aspectRatio: result.aspectRatio,
            });
            if (images[0]) {
                await updateDesignPromptResult(dp.id, images[0]);
                await updateContentItem(activeItem.id, { mediaUrl: images[0] });
                setSelectedImageUrl(images[0]);
            }

            await updateContentItemStatus(activeItem.id, 'design_ready');
            setActiveItem(prev => prev ? { ...prev, status: 'design_ready', mediaUrl: images[0] } : prev);
            setContentItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'design_ready', mediaUrl: images[0] } : i));
            setItemWorkspaceTab('design');
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد التصميم');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Generate captions ──────────────────────────────────────────────────────
    async function handleGenerateCaptions() {
        if (!brief || !activeItem) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يكتب النصوص...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'standard');
            const result = await generateCaptions({
                brandBrain: ctx,
                brief,
                platform:   activeItem.platform,
            });
            setCaptionVersions(result.versions);
            setSelectedCaptionIdx(0);

            const firstCaption = result.versions[0]?.caption ?? '';
            await updateContentItem(activeItem.id, {
                caption: firstCaption,
                status:  'caption_ready',
            });
            setActiveItem(prev => prev ? { ...prev, status: 'caption_ready', caption: firstCaption } : prev);
            setContentItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'caption_ready', caption: firstCaption } : i));
            setItemWorkspaceTab('caption');
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد الكابشن');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Run Quality Check ──────────────────────────────────────────────────────
    async function handleRunQA() {
        if (!brief || !activeItem) return;
        const caption = captionVersions[selectedCaptionIdx]?.caption ?? activeItem.caption ?? '';
        try {
            setAiLoading(true);
            setAiLoadingText('يفحص الجودة...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'standard');
            const qa = await runQualityCheck({
                brandBrain: ctx,
                caption,
                platform: activeItem.platform,
                goalType: activeCampaign?.strategyData?.coreMessage ? goalType : 'awareness',
                hasImage: Boolean(selectedImageUrl),
                brief,
            });
            setQualityScore(qa);
            await updateContentItem(activeItem.id, { brandFitScore: qa.overall, status: 'needs_review' });
            setActiveItem(prev => prev ? { ...prev, status: 'needs_review', brandFitScore: qa.overall } : prev);
            setContentItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'needs_review', brandFitScore: qa.overall } : i));
            setItemWorkspaceTab('qa');
        } catch {
            addNotification(NotificationType.Error, 'فشل فحص الجودة');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Submit Approval ────────────────────────────────────────────────────────
    async function handleApprove() {
        if (!activeItem) return;
        try {
            setLoading(true);
            const approval = await createApproval(brandId, activeItem.id);
            await submitApproval(approval.id, 'approved');
            await updateContentItemStatus(activeItem.id, 'approved');
            setActiveItem(prev => prev ? { ...prev, status: 'approved' } : prev);
            setContentItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'approved' } : i));

            // Load schedule suggestions
            setAiLoading(true);
            setAiLoadingText('يقترح أفضل وقت للنشر...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const suggestions = await suggestPublishTimes({ brandBrain: ctx, platform: activeItem.platform, goalType });
            setScheduleSuggestions(suggestions);
            setItemWorkspaceTab('schedule');
        } catch {
            addNotification(NotificationType.Error, 'فشل الموافقة');
        } finally {
            setLoading(false);
            setAiLoading(false);
        }
    }

    // ── Schedule / Publish ─────────────────────────────────────────────────────
    async function handleSchedule(scheduledAt: string) {
        if (!activeItem) return;
        try {
            setLoading(true);
            await schedulePublishingJob(brandId, activeItem.id, activeItem.platform, scheduledAt);
            await updateContentItem(activeItem.id, { scheduledAt, status: 'scheduled' });
            setActiveItem(prev => prev ? { ...prev, status: 'scheduled', scheduledAt } : prev);
            setContentItems(prev => prev.map(i => i.id === activeItem.id ? { ...i, status: 'scheduled', scheduledAt } : i));
            addNotification(NotificationType.Success, 'تمت الجدولة بنجاح');
            setScreen('content-calendar');
        } catch {
            addNotification(NotificationType.Error, 'فشل الجدولة');
        } finally {
            setLoading(false);
        }
    }

    // ── View Performance ──────────────────────────────────────────────────────
    async function handleViewPerformance() {
        if (!activeCampaign) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يحلل أداء الحملة...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const posts = await getPublishedPostsForCampaign(activeCampaign.id);

            const avgEng = posts.length > 0
                ? posts.reduce((s, p) => s + p.engagementRate, 0) / posts.length
                : 0;
            const totalReach = posts.reduce((s, p) => s + p.reach, 0);
            const totalSaves = posts.reduce((s, p) => s + p.saves, 0);
            const totalClicks = posts.reduce((s, p) => s + p.clicks, 0);
            const totalProf  = posts.reduce((s, p) => s + p.profileVisits, 0);

            const predictedKpis = (activeCampaign.strategyData as CBStrategyDocument & { kpis?: Array<{metric: string; target: number; unit: string}> })?.kpis
                ?? kpis.length > 0 ? kpis : [
                    { metric: 'Reach', target: 5000, unit: 'مشاهدة' },
                    { metric: 'Engagement Rate', target: 3, unit: '%' },
                    { metric: 'Saves', target: 200, unit: 'حفظ' },
                    { metric: 'CTR', target: 2, unit: '%' },
                ];

            const analysis = await analyzePerformanceVsPredicted({
                brandBrain:     ctx,
                campaignId:     activeCampaign.id,
                goalType,
                predictedKpis,
                actualMetrics: {
                    reach:           totalReach,
                    engagementRate:  avgEng,
                    saves:           totalSaves,
                    clicks:          totalClicks,
                    profileVisits:   totalProf,
                    publishedCount:  posts.length,
                },
            });
            setPerformanceAnalysis(analysis);
            setCampaignHealthScore(analysis.healthScore);

            const count = await getLearningsCount(brandId);
            setLearningsCount(count);
            setScreen('performance');
        } catch {
            addNotification(NotificationType.Error, 'فشل تحليل الأداء');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Save Learnings to Brand Memory ────────────────────────────────────────
    async function handleSaveLearnings() {
        if (!performanceAnalysis) return;
        try {
            setSavingLearnings(true);
            await saveLearningsToBrandMemory(brandId, performanceAnalysis.learnings);
            const count = await getLearningsCount(brandId);
            setLearningsCount(count);
            addNotification(NotificationType.Success, `تم حفظ ${performanceAnalysis.learnings.length} تعلمات في ذاكرة البراند`);
        } catch {
            addNotification(NotificationType.Error, 'فشل حفظ التعلمات');
        } finally {
            setSavingLearnings(false);
        }
    }

    // ── Load Recommendations ──────────────────────────────────────────────────
    async function handleViewRecommendations() {
        if (!performanceAnalysis) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يُولّد التوصيات...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const recs = await generateLearningRecommendations({
                brandBrain:          ctx,
                publishedCount:      contentItems.filter(i => i.status === 'published').length,
                avgEngagement:       performanceAnalysis.avgEngagement * 100,
                topPerformerType:    performanceAnalysis.topPerformerType,
                weakPerformerType:   performanceAnalysis.weakPerformerType,
                goalType,
            });
            setRecommendations(recs);
            const health = await getCampaignHealth(activeCampaign!.id);
            setCampaignHealthScore(health);
            setScreen('recommendations');
        } catch {
            addNotification(NotificationType.Error, 'فشل توليد التوصيات');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Apply Recommendation ──────────────────────────────────────────────────
    function handleSkipRecommendation(idx: number) {
        setRecommendations(prev => prev.filter((_, i) => i !== idx));
    }

    // ── Asset Review ──────────────────────────────────────────────────────────
    async function handleReviewAsset() {
        if (!selectedImageUrl || !brief || !activeItem) return;
        try {
            setAiLoading(true);
            setAiLoadingText('يُقيّم جودة الصورة...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const result = await reviewAssetQuality({
                brandBrain: ctx,
                imageUrl:   selectedImageUrl,
                brief,
                platform:   activeItem.platform,
            });
            setAssetReview(result);
            await updateMediaAssetScore(selectedImageUrl, result.overall).catch(() => {});
        } catch {
            addNotification(NotificationType.Error, 'فشل تقييم الصورة');
        } finally {
            setAiLoading(false);
        }
    }

    // ── Platform Optimize ─────────────────────────────────────────────────────
    async function handleOptimizePerPlatform() {
        if (!brief || !activeItem) return;
        const baseCaption = captionVersions[selectedCaptionIdx]?.caption ?? '';
        const baseHashtags = captionVersions[selectedCaptionIdx]?.hashtags ?? [];
        if (!baseCaption) { addNotification(NotificationType.Warning, 'ولّد الكابشن أولاً'); return; }
        try {
            setAiLoading(true);
            setAiLoadingText('يحسّن الكابشن لكل منصة...');
            const ctx = await buildBrandBrainContext(brandId, brandProfile, 'minimal');
            const variants = await optimizePerPlatform({
                brandBrain:    ctx,
                baseCaption,
                baseHashtags,
                platforms:     activeCampaign?.platforms ?? [activeItem.platform],
                brief,
            });
            setPlatformVariants(variants);
            setPlatformVariantIdx(0);
            // Save each variant as a caption record
            for (const v of variants) {
                await createCaption(brandId, {
                    contentItemId: activeItem.id,
                    platform:      v.platform,
                    captionText:   v.caption,
                    headline:      v.headline,
                    hashtags:      v.hashtags,
                    cta:           v.cta,
                }).catch(() => {});
            }
            addNotification(NotificationType.Success, `تم توليد ${variants.length} نسخة محسّنة`);
        } catch {
            addNotification(NotificationType.Error, 'فشل التحسين');
        } finally {
            setAiLoading(false);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Screen Renderers
    // ─────────────────────────────────────────────────────────────────────────

    // ── Screen 1: Campaigns List ──────────────────────────────────────────────
    function renderCampaignsList() {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-brain text-brand-primary mr-2" />
                            Campaign Brain
                        </h1>
                        <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            نظام التشغيل التسويقي الذكي — فكر، خطط، نفّذ، تعلّم
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            if (profileCompleteness < 60) return;
                            setCampaignName(''); setGoalTitle(''); setGoalTarget('');
                            setGoalType('awareness'); setSelectedPlatforms(['instagram', 'facebook']);
                            setGoalDuration(30); setGoalBudget(''); setKpis([]); setRealityCheck(null);
                            setScreen('goal-builder');
                        }}
                        disabled={profileCompleteness < 60}
                        title={profileCompleteness < 60 ? `أكمل ملف البراند أولاً (${profileCompleteness}% / 60% مطلوب)` : undefined}
                        className="flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        <i className="fas fa-plus text-xs" />
                        حملة جديدة
                    </button>
                </div>

                {/* Brand Profile Completeness */}
                <div className={`rounded-2xl border p-4 ${profileCompleteness >= 60 ? 'border-light-border bg-light-card dark:border-dark-border dark:bg-dark-card' : 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <i className={`fas fa-circle-user text-sm ${profileCompleteness >= 60 ? 'text-brand-primary' : 'text-orange-500'}`} />
                            <span className="text-sm font-semibold text-light-text dark:text-dark-text">اكتمال ملف البراند</span>
                        </div>
                        <span className={`text-sm font-bold ${profileCompleteness >= 80 ? 'text-green-500' : profileCompleteness >= 60 ? 'text-brand-primary' : 'text-orange-500'}`}>
                            {profileCompleteness}%
                        </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                        <div
                            className={`h-full rounded-full transition-all ${profileCompleteness >= 80 ? 'bg-green-500' : profileCompleteness >= 60 ? 'bg-brand-primary' : 'bg-orange-400'}`}
                            style={{ width: `${profileCompleteness}%` }}
                        />
                    </div>
                    {profileCompleteness < 60 && (
                        <p className="mt-2 text-xs text-orange-600 dark:text-orange-400">
                            <i className="fas fa-triangle-exclamation mr-1" />
                            أكمل ملف البراند للوصول لـ 60% قبل إنشاء حملة — أضف قيماً وجمهوراً مستهدفاً ونبرة صوت
                        </p>
                    )}
                </div>

                {/* Stats row */}
                {campaigns.length > 0 && (
                    <div className="grid grid-cols-3 gap-4">
                        {[
                            { label: 'حملات نشطة', value: campaigns.filter(c => c.status === 'active').length, icon: 'fa-rocket', color: 'text-green-500' },
                            { label: 'إجمالي المنشورات', value: campaigns.reduce((s, c) => s + c.contentCount, 0), icon: 'fa-images', color: 'text-blue-500' },
                            { label: 'تم نشره', value: campaigns.reduce((s, c) => s + c.publishedCount, 0), icon: 'fa-check-double', color: 'text-brand-primary' },
                        ].map(stat => (
                            <div key={stat.label} className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary/10">
                                        <i className={`fas ${stat.icon} ${stat.color}`} />
                                    </div>
                                    <div>
                                        <p className="text-xl font-bold text-light-text dark:text-dark-text">{stat.value}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{stat.label}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Campaign cards */}
                {campaigns.length === 0 ? (
                    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-light-border dark:border-dark-border">
                        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-primary/10">
                            <i className="fas fa-brain text-3xl text-brand-primary" />
                        </div>
                        <div className="text-center">
                            <p className="text-lg font-semibold text-light-text dark:text-dark-text">ابدأ أول حملة ذكية</p>
                            <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                Campaign Brain يُفكر معك في الاستراتيجية، ويُنفّذها معك خطوة بخطوة
                            </p>
                        </div>
                        <button
                            onClick={() => { if (profileCompleteness >= 60) setScreen('goal-builder'); }}
                            disabled={profileCompleteness < 60}
                            title={profileCompleteness < 60 ? `أكمل ملف البراند أولاً (${profileCompleteness}% / 60%)` : undefined}
                            className="flex items-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 font-semibold text-white shadow-primary-glow disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <i className="fas fa-wand-magic-sparkles" />
                            أنشئ حملة الآن
                        </button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {campaigns.map(campaign => {
                            const health = campaign.healthScore;
                            const pct = campaign.contentCount > 0
                                ? Math.round((campaign.publishedCount / campaign.contentCount) * 100)
                                : 0;
                            return (
                                <div
                                    key={campaign.id}
                                    className="group cursor-pointer rounded-2xl border border-light-border bg-light-card p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-dark-border dark:bg-dark-card"
                                    onClick={() => {
                                        setActiveCampaign(campaign);
                                        setStrategy(campaign.strategyData);
                                        getContentItems(campaign.id).then(items => {
                                            setContentItems(items);
                                            setScreen('content-calendar');
                                        });
                                    }}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="truncate font-semibold text-light-text dark:text-dark-text">{campaign.name}</p>
                                            <p className="mt-0.5 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                {campaign.startDate} → {campaign.endDate ?? '—'}
                                            </p>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CAMPAIGN_STATUS_COLORS[campaign.status] ?? ''}`}>
                                            {campaign.status === 'active' ? 'نشط' : campaign.status === 'draft' ? 'مسودة' : campaign.status === 'completed' ? 'مكتمل' : campaign.status}
                                        </span>
                                    </div>

                                    <div className="mt-4 flex items-center gap-3">
                                        {campaign.platforms.slice(0, 4).map(p => (
                                            <i key={p} className={`fab ${PLATFORM_ICONS[p] ?? 'fa-globe'} text-light-text-secondary dark:text-dark-text-secondary`} />
                                        ))}
                                        <div className="ml-auto flex items-center gap-2">
                                            <span className={`text-sm font-bold ${scoreColor(health)}`}>{health}</span>
                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">صحة</span>
                                        </div>
                                    </div>

                                    <div className="mt-3">
                                        <div className="mb-1 flex justify-between text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            <span>{campaign.publishedCount}/{campaign.contentCount} منشور</span>
                                            <span>{pct}%</span>
                                        </div>
                                        <div className="h-1.5 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                                            <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // ── Screen 2: Goal Builder ─────────────────────────────────────────────────
    function renderGoalBuilder() {
        return (
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setScreen('campaigns-list')} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                        <i className="fas fa-arrow-right" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">بناء الهدف</h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">حدّد ماذا تريد تحقيقه من هذه الحملة</p>
                    </div>
                </div>

                <div className="rounded-2xl border border-light-border bg-light-card p-6 space-y-5 dark:border-dark-border dark:bg-dark-card">
                    {/* Campaign name */}
                    <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">اسم الحملة *</label>
                        <input
                            value={campaignName}
                            onChange={e => setCampaignName(e.target.value)}
                            placeholder="مثال: حملة رمضان 2025"
                            className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text placeholder-light-text-secondary focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-secondary"
                        />
                    </div>

                    {/* Goal type */}
                    <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">نوع الهدف *</label>
                        <div className="grid grid-cols-5 gap-2">
                            {GOAL_TYPES.map(gt => (
                                <button
                                    key={gt.id}
                                    onClick={() => setGoalType(gt.id)}
                                    className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition-all ${
                                        goalType === gt.id
                                            ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10'
                                            : 'border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg'
                                    }`}
                                >
                                    <i className={`fas ${gt.icon} text-lg ${goalType === gt.id ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`} />
                                    <span className={`text-xs font-semibold ${goalType === gt.id ? 'text-brand-primary' : 'text-light-text dark:text-dark-text'}`}>{gt.label}</span>
                                    <span className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{gt.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Goal description */}
                    <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">الهدف المحدد *</label>
                        <input
                            value={goalTitle}
                            onChange={e => setGoalTitle(e.target.value)}
                            placeholder="مثال: زيادة المبيعات بنسبة 30% خلال رمضان"
                            className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text placeholder-light-text-secondary focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-secondary"
                        />
                    </div>

                    {/* Target + Metric + Duration */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">الرقم المستهدف</label>
                            <input
                                value={goalTarget}
                                onChange={e => setGoalTarget(e.target.value)}
                                placeholder="10000"
                                type="number"
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text placeholder-light-text-secondary focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-secondary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">مقياس الهدف</label>
                            <select
                                value={goalTargetMetric}
                                onChange={e => { setGoalTargetMetric(e.target.value); setGoalTargetMetricLabel(e.target.options[e.target.selectedIndex].text); }}
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            >
                                <option value="">اختر...</option>
                                {goalType === 'awareness'  && <><option value="reach">وصول</option><option value="impressions">مشاهدات</option><option value="followers">متابعين</option></>}
                                {goalType === 'engagement' && <><option value="likes">إعجابات</option><option value="comments">تعليقات</option><option value="shares">مشاركات</option><option value="engagement_rate">نسبة التفاعل %</option></>}
                                {goalType === 'leads'      && <><option value="leads">عملاء محتملون</option><option value="signups">اشتراكات</option><option value="messages">رسائل مباشرة</option></>}
                                {goalType === 'sales'      && <><option value="revenue">إيرادات (ريال)</option><option value="orders">طلبات</option><option value="conversions">تحويلات</option></>}
                                {goalType === 'retention'  && <><option value="repeat_customers">عملاء متكررون</option><option value="reviews">تقييمات</option><option value="referrals">إحالات</option></>}
                                <option value="custom">مخصص</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">المدة (يوم)</label>
                            <select
                                value={goalDuration}
                                onChange={e => setGoalDuration(Number(e.target.value))}
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            >
                                {[7, 14, 21, 30, 45, 60, 90].map(d => (
                                    <option key={d} value={d}>{d} يوم</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* SMART Goal Card */}
                    {goalTitle && goalTarget && goalTargetMetric && (
                        <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/5 dark:bg-brand-primary/10 p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <i className="fas fa-bullseye text-brand-primary" />
                                <span className="text-xs font-bold text-brand-primary uppercase tracking-wide">SMART Goal</span>
                            </div>
                            <p className="text-sm font-semibold text-light-text dark:text-dark-text leading-relaxed">
                                تحقيق <span className="text-brand-primary">{Number(goalTarget).toLocaleString('ar')} {goalTargetMetricLabel || goalTargetMetric}</span> من خلال حملة{' '}
                                <span className="text-brand-primary">{campaignName || '...'}</span>{' '}
                                على <span className="text-brand-primary">{selectedPlatforms.join(' و')}</span>{' '}
                                خلال <span className="text-brand-primary">{goalDuration} يوماً</span>
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {['محدد', 'قابل للقياس', 'قابل للتحقيق', 'ذو صلة', 'محدد بوقت'].map((s, i) => (
                                    <span key={s} className="flex items-center gap-1 rounded-lg bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                                        <i className="fas fa-check text-[9px]" />
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Platforms */}
                    <div>
                        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">المنصات</label>
                        <div className="flex flex-wrap gap-2">
                            {PLATFORMS.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setSelectedPlatforms(prev =>
                                        prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
                                    )}
                                    className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                                        selectedPlatforms.includes(p)
                                            ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                            : 'border-light-border bg-light-bg text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary'
                                    }`}
                                >
                                    <i className={`fab ${PLATFORM_ICONS[p] ?? 'fa-globe'} text-xs`} />
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Budget + Posts per week */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">الميزانية (ريال) — اختياري</label>
                            <input
                                value={goalBudget}
                                onChange={e => setGoalBudget(e.target.value)}
                                placeholder="5000"
                                type="number"
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text placeholder-light-text-secondary focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-secondary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">منشورات / أسبوع</label>
                            <select
                                value={postsPerWeek}
                                onChange={e => setPostsPerWeek(Number(e.target.value))}
                                className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                            >
                                {[3, 5, 7, 10, 14].map(n => (
                                    <option key={n} value={n}>{n} منشورات</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* AI Reality Check */}
                <div className="relative rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                    {aiLoading && <LoadingOverlay text={aiLoadingText} />}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-robot text-brand-primary" />
                            <span className="font-semibold text-light-text dark:text-dark-text">فحص واقعية الهدف</span>
                        </div>
                        <button
                            onClick={handleCheckGoal}
                            disabled={!goalTitle || !goalTarget || aiLoading}
                            className="rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
                        >
                            <i className="fas fa-wand-magic-sparkles mr-1" />
                            تحقق
                        </button>
                    </div>

                    {realityCheck ? (
                        <div className="space-y-3">
                            <div className={`flex items-start gap-3 rounded-xl p-3 ${realityCheck.warningLevel === 'red' ? 'bg-red-50 dark:bg-red-900/20' : realityCheck.warningLevel === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                                <i className={`fas mt-0.5 ${realityCheck.warningLevel === 'red' ? 'fa-triangle-exclamation text-red-500' : realityCheck.warningLevel === 'yellow' ? 'fa-circle-exclamation text-yellow-500' : 'fa-circle-check text-green-500'}`} />
                                <p className="text-sm text-light-text dark:text-dark-text">{realityCheck.assessment}</p>
                            </div>
                            {kpis.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">KPIs المقترحة:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {kpis.map((kpi, i) => (
                                            <span key={i} className="rounded-lg bg-brand-primary/10 px-2.5 py-1 text-xs font-medium text-brand-primary">
                                                {kpi.metric}: {kpi.target} {kpi.unit}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            أدخل الهدف والرقم المستهدف ثم اضغط "تحقق" وسيُقيّم الـ AI واقعية هدفك
                        </p>
                    )}
                </div>

                <div className="flex justify-end">
                    <button
                        onClick={handleBuildStrategy}
                        disabled={!campaignName || !goalTitle || aiLoading}
                        className="flex items-center gap-2 rounded-2xl bg-brand-primary px-6 py-3 font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                    >
                        {aiLoading ? <Spinner /> : <i className="fas fa-wand-magic-sparkles" />}
                        بناء الاستراتيجية
                    </button>
                </div>
            </div>
        );
    }

    // ── Screen 3: Strategy Generator ──────────────────────────────────────────
    function renderStrategyGenerator() {
        if (!strategy && !aiLoading) return null;
        return (
            <div className="mx-auto max-w-2xl space-y-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setScreen('goal-builder')} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                        <i className="fas fa-arrow-right" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">الاستراتيجية</h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">راجع وعدّل الاستراتيجية التي أنتجها Campaign Brain</p>
                    </div>
                </div>

                {aiLoading ? (
                    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-4 rounded-2xl border border-light-border bg-light-card p-8 dark:border-dark-border dark:bg-dark-card">
                        <i className="fas fa-brain fa-beat-fade text-4xl text-brand-primary" />
                        <div className="space-y-2 text-center">
                            <p className="font-semibold text-light-text dark:text-dark-text">{aiLoadingText}</p>
                            <div className="flex gap-2 justify-center">
                                {['قرأ ملف البراند', 'حلّل الهدف', 'يولّد الرسائل...'].map((s, i) => (
                                    <span key={s} className={`flex items-center gap-1 text-xs ${i < 2 ? 'text-green-500' : 'text-brand-primary'}`}>
                                        <i className={`fas ${i < 2 ? 'fa-check' : 'fa-spinner fa-spin'} text-xs`} />
                                        {s}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : strategy ? (
                    <div className="space-y-4">
                        {/* Core Message */}
                        <div className="rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                            <div className="flex items-center gap-2 mb-2">
                                <i className="fas fa-quote-left text-brand-primary" />
                                <span className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">الرسالة الجوهرية</span>
                            </div>
                            <p className="text-lg font-semibold text-light-text dark:text-dark-text">"{strategy.coreMessage}"</p>
                        </div>

                        {/* Content Mix */}
                        {strategy.contentMix && strategy.contentMix.length > 0 && (
                            <div className="rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                                <p className="text-sm font-semibold text-light-text dark:text-dark-text mb-3">
                                    <i className="fas fa-chart-pie text-brand-primary mr-2" />
                                    مزيج المحتوى
                                </p>
                                <div className="grid grid-cols-3 gap-2">
                                    {strategy.contentMix.map(m => (
                                        <div key={m.type} className="text-center rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <p className="text-xl font-bold text-brand-primary">{m.percentage}%</p>
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{m.type}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Key Messages — inline edit/delete */}
                        {strategy.keyMessages && strategy.keyMessages.length > 0 && (
                            <div className="rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                                        <i className="fas fa-bullseye text-brand-primary mr-2" />
                                        الرسائل الرئيسية
                                    </p>
                                    <button
                                        onClick={() => setStrategy(s => s ? { ...s, keyMessages: [...(s.keyMessages ?? []), { text: 'رسالة جديدة', priority: 1 }] } : s)}
                                        className="flex items-center gap-1 rounded-lg bg-brand-primary/10 px-2.5 py-1 text-xs font-semibold text-brand-primary"
                                    >
                                        <i className="fas fa-plus text-[10px]" />
                                        إضافة
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {strategy.keyMessages.map((msg, i) => (
                                        <div key={i} className="group flex items-start gap-2.5 rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">{i + 1}</span>
                                            {editingMsgIdx === i ? (
                                                <div className="flex-1 flex gap-2">
                                                    <input
                                                        autoFocus
                                                        value={editingMsgText}
                                                        onChange={e => setEditingMsgText(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                const msgs = [...strategy!.keyMessages!];
                                                                msgs[i] = { ...msgs[i], text: editingMsgText };
                                                                setStrategy(s => ({ ...s!, keyMessages: msgs }));
                                                                setEditingMsgIdx(null);
                                                            } else if (e.key === 'Escape') {
                                                                setEditingMsgIdx(null);
                                                            }
                                                        }}
                                                        className="flex-1 rounded-lg border border-brand-primary/40 bg-transparent px-2 py-0.5 text-sm text-light-text dark:text-dark-text focus:outline-none"
                                                    />
                                                    <button onClick={() => { const msgs = [...strategy!.keyMessages!]; msgs[i] = { ...msgs[i], text: editingMsgText }; setStrategy(s => ({ ...s!, keyMessages: msgs })); setEditingMsgIdx(null); }} className="text-xs text-green-500"><i className="fas fa-check" /></button>
                                                    <button onClick={() => setEditingMsgIdx(null)} className="text-xs text-light-text-secondary dark:text-dark-text-secondary"><i className="fas fa-xmark" /></button>
                                                </div>
                                            ) : (
                                                <p className="flex-1 text-sm text-light-text dark:text-dark-text">{msg.text}</p>
                                            )}
                                            {editingMsgIdx !== i && (
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => { setEditingMsgIdx(i); setEditingMsgText(msg.text); }} className="rounded p-1 text-xs text-light-text-secondary hover:text-brand-primary dark:text-dark-text-secondary">
                                                        <i className="fas fa-pen text-[10px]" />
                                                    </button>
                                                    <button onClick={() => setStrategy(s => s ? { ...s, keyMessages: s.keyMessages!.filter((_, j) => j !== i) } : s)} className="rounded p-1 text-xs text-light-text-secondary hover:text-red-500 dark:text-dark-text-secondary">
                                                        <i className="fas fa-trash-can text-[10px]" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Platform Distribution */}
                        {strategy.platformDistribution && strategy.platformDistribution.length > 0 && (
                            <div className="rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                                <p className="text-sm font-semibold text-light-text dark:text-dark-text mb-3">
                                    <i className="fas fa-share-nodes text-brand-primary mr-2" />
                                    توزيع المنصات
                                </p>
                                <div className="space-y-2">
                                    {strategy.platformDistribution.map(pd => (
                                        <div key={pd.platform} className="flex items-center gap-3">
                                            <i className={`fab ${PLATFORM_ICONS[pd.platform] ?? 'fa-globe'} w-5 text-center text-light-text-secondary dark:text-dark-text-secondary`} />
                                            <span className="w-24 text-sm text-light-text dark:text-dark-text">{pd.platform}</span>
                                            <div className="flex-1 h-2 rounded-full bg-light-bg dark:bg-dark-bg overflow-hidden">
                                                <div className="h-full rounded-full bg-brand-primary" style={{ width: `${pd.weight}%` }} />
                                            </div>
                                            <span className="w-10 text-right text-xs font-semibold text-brand-primary">{pd.weight}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Confidence + Reasoning */}
                        {strategy.reasoning && (
                            <div className="rounded-2xl border border-brand-primary/20 bg-brand-primary/5 p-4 dark:bg-brand-primary/10">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-semibold text-brand-primary">
                                        <i className="fas fa-robot mr-1" />
                                        تفكير الـ AI
                                    </span>
                                    {strategy.confidenceScore !== undefined && (
                                        <span className={`text-sm font-bold ${scoreColor(strategy.confidenceScore)}`}>
                                            {strategy.confidenceScore}% ثقة
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-light-text dark:text-dark-text">{strategy.reasoning}</p>
                            </div>
                        )}

                        <div className="flex justify-between">
                            <button
                                onClick={() => setShowRegenDialog(true)}
                                className="flex items-center gap-2 rounded-xl border border-light-border px-4 py-2.5 text-sm font-medium text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                            >
                                <i className="fas fa-rotate-right" />
                                إعادة التوليد
                            </button>
                            <button
                                onClick={handleBuildCalendar}
                                disabled={aiLoading}
                                className="flex items-center gap-2 rounded-2xl bg-brand-primary px-6 py-2.5 font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                            >
                                {aiLoading ? <Spinner /> : <i className="fas fa-calendar-alt" />}
                                بناء التقويم
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    // ── Screen 4: Content Calendar ─────────────────────────────────────────────
    function renderContentCalendar() {
        const groupedByDate: Record<string, typeof calendarSlots> = {};
        const itemsMap: Record<string, CBContentItem[]> = {};

        calendarSlots.forEach(slot => {
            if (!groupedByDate[slot.date]) groupedByDate[slot.date] = [];
            groupedByDate[slot.date].push(slot);
        });

        contentItems.forEach(item => {
            if (!item.scheduledAt) return;
            const date = item.scheduledAt.split('T')[0];
            if (!itemsMap[date]) itemsMap[date] = [];
            itemsMap[date].push(item);
        });

        const allDates = [...new Set([...Object.keys(groupedByDate), ...Object.keys(itemsMap)])].sort();
        const hasItems = contentItems.length > 0;

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setScreen('campaigns-list')} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                            <i className="fas fa-arrow-right" />
                        </button>
                        <div>
                            <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                                {activeCampaign?.name ?? 'التقويم'}
                            </h2>
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {hasItems ? `${contentItems.length} قطعة محتوى` : `${calendarSlots.length} خطة محتوى`}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* View toggle */}
                        {hasItems && (
                            <div className="flex gap-1 rounded-xl border border-light-border bg-light-bg p-1 dark:border-dark-border dark:bg-dark-bg">
                                {(['list', 'month'] as const).map(v => (
                                    <button
                                        key={v}
                                        onClick={() => setCalendarView(v)}
                                        className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${calendarView === v ? 'bg-brand-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}
                                    >
                                        <i className={`fas ${v === 'list' ? 'fa-list' : 'fa-calendar-days'} mr-1`} />
                                        {v === 'list' ? 'قائمة' : 'شهري'}
                                    </button>
                                ))}
                            </div>
                        )}
                        {hasItems && (
                            <button
                                onClick={handleViewPerformance}
                                disabled={aiLoading}
                                className="flex items-center gap-2 rounded-xl border border-light-border px-3 py-1.5 text-xs font-medium text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg disabled:opacity-50"
                            >
                                <i className="fas fa-chart-line text-brand-primary" />
                                الأداء
                            </button>
                        )}
                        {!hasItems && calendarSlots.length > 0 && (
                            <button
                                onClick={handleCreateItemsFromCalendar}
                                disabled={loading}
                                className="flex items-center gap-2 rounded-2xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-primary-glow disabled:opacity-50"
                            >
                                {loading ? <Spinner /> : <i className="fas fa-check" />}
                                تأكيد التقويم
                            </button>
                        )}
                        {!hasItems && calendarSlots.length === 0 && (
                            <button
                                onClick={handleBuildCalendar}
                                disabled={aiLoading}
                                className="flex items-center gap-2 rounded-2xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-primary-glow disabled:opacity-50"
                            >
                                {aiLoading ? <Spinner /> : <i className="fas fa-wand-magic-sparkles" />}
                                توليد التقويم بالـ AI
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                {hasItems && (
                    <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-light-text dark:text-dark-text">
                                تقدم الحملة
                            </span>
                            <span className="text-sm font-semibold text-brand-primary">
                                {contentItems.filter(i => ['published', 'scheduled', 'approved'].includes(i.status)).length}/{contentItems.length}
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                            <div
                                className="h-full rounded-full bg-brand-primary transition-all"
                                style={{ width: `${contentItems.length > 0 ? Math.round((contentItems.filter(i => ['published', 'scheduled', 'approved'].includes(i.status)).length / contentItems.length) * 100) : 0}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* AI Occasions Panel */}
                {hasItems && (
                    <div className="rounded-2xl border border-light-border bg-light-card dark:border-dark-border dark:bg-dark-card overflow-hidden">
                        <button
                            onClick={() => setShowOccasionsPanel(p => !p)}
                            className="w-full flex items-center justify-between px-5 py-3"
                        >
                            <div className="flex items-center gap-2">
                                <i className="fas fa-calendar-star text-brand-primary" />
                                <span className="text-sm font-semibold text-light-text dark:text-dark-text">مناسبات الفترة</span>
                                <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] font-bold text-brand-primary">AI</span>
                            </div>
                            <i className={`fas fa-chevron-down text-xs text-light-text-secondary dark:text-dark-text-secondary transition-transform ${showOccasionsPanel ? 'rotate-180' : ''}`} />
                        </button>
                        {showOccasionsPanel && (
                            <div className="border-t border-light-border dark:border-dark-border px-5 pb-4 pt-3">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    {[
                                        { date: activeCampaign?.startDate ?? new Date().toISOString().split('T')[0], name: 'يوم الوطني', icon: 'fa-flag', type: 'national' },
                                        { date: activeCampaign?.startDate ?? new Date().toISOString().split('T')[0], name: 'رمضان', icon: 'fa-moon', type: 'religious' },
                                        { date: activeCampaign?.startDate ?? new Date().toISOString().split('T')[0], name: 'اليوم العالمي للتسوق', icon: 'fa-bag-shopping', type: 'commercial' },
                                        { date: activeCampaign?.startDate ?? new Date().toISOString().split('T')[0], name: 'يوم الأم', icon: 'fa-heart', type: 'social' },
                                    ].map((occ, i) => (
                                        <div key={i} className="flex items-start gap-2.5 rounded-xl border border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg p-3">
                                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${occ.type === 'national' ? 'bg-green-100 dark:bg-green-900/30' : occ.type === 'religious' ? 'bg-purple-100 dark:bg-purple-900/30' : occ.type === 'commercial' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-pink-100 dark:bg-pink-900/30'}`}>
                                                <i className={`fas ${occ.icon} text-xs ${occ.type === 'national' ? 'text-green-500' : occ.type === 'religious' ? 'text-purple-500' : occ.type === 'commercial' ? 'text-orange-500' : 'text-pink-500'}`} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-semibold text-light-text dark:text-dark-text">{occ.name}</p>
                                                <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{occ.date}</p>
                                                <button
                                                    onClick={() => addNotification(NotificationType.Success, `تمت إضافة ${occ.name} للتقويم`)}
                                                    className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold text-brand-primary hover:underline"
                                                >
                                                    <i className="fas fa-plus text-[9px]" />
                                                    أضف للتقويم
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Calendar grid */}
                {aiLoading ? (
                    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 rounded-2xl border border-light-border bg-light-card p-8 dark:border-dark-border dark:bg-dark-card">
                        <i className="fas fa-calendar-alt fa-beat-fade text-3xl text-brand-primary" />
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">{aiLoadingText}</p>
                    </div>
                ) : hasItems && calendarView === 'month' ? (() => {
                    // Month view — build a 7-column calendar grid
                    const now = activeCampaign?.startDate ? new Date(activeCampaign.startDate) : new Date();
                    const year = now.getFullYear();
                    const month = now.getMonth();
                    const firstDay = new Date(year, month, 1);
                    const lastDay = new Date(year, month + 1, 0);
                    const startOffset = (firstDay.getDay() + 6) % 7; // Mon-based
                    const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;

                    const itemsByDay: Record<string, CBContentItem[]> = {};
                    contentItems.forEach(item => {
                        if (!item.scheduledAt) return;
                        const d = item.scheduledAt.split('T')[0];
                        if (!itemsByDay[d]) itemsByDay[d] = [];
                        itemsByDay[d].push(item);
                    });

                    return (
                        <div className="rounded-2xl border border-light-border bg-light-card overflow-hidden dark:border-dark-border dark:bg-dark-card">
                            {/* Day headers */}
                            <div className="grid grid-cols-7 border-b border-light-border dark:border-dark-border">
                                {['إث', 'ث', 'أر', 'خ', 'ج', 'س', 'أح'].map(d => (
                                    <div key={d} className="py-2 text-center text-[10px] font-semibold text-light-text-secondary dark:text-dark-text-secondary">{d}</div>
                                ))}
                            </div>
                            {/* Day cells */}
                            <div className="grid grid-cols-7">
                                {Array.from({ length: totalCells }).map((_, i) => {
                                    const dayNum = i - startOffset + 1;
                                    if (dayNum < 1 || dayNum > lastDay.getDate()) {
                                        return <div key={i} className="h-20 border-b border-r border-light-border dark:border-dark-border opacity-30" />;
                                    }
                                    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                                    const dayItems = itemsByDay[dateStr] ?? [];
                                    const isToday = dateStr === new Date().toISOString().split('T')[0];
                                    return (
                                        <div key={i} className={`h-20 border-b border-r border-light-border dark:border-dark-border p-1 ${isToday ? 'bg-brand-primary/5' : ''}`}>
                                            <p className={`text-[10px] font-semibold mb-1 ${isToday ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>{dayNum}</p>
                                            <div className="space-y-0.5 overflow-hidden">
                                                {dayItems.slice(0, 2).map(item => {
                                                    const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
                                                    return (
                                                        <div
                                                            key={item.id}
                                                            onClick={() => handleOpenItem(item)}
                                                            className="cursor-pointer flex items-center gap-1 rounded px-1 py-0.5 bg-brand-primary/10 hover:bg-brand-primary/20 transition-colors"
                                                        >
                                                            <i className={`fab ${PLATFORM_ICONS[item.platform] ?? 'fa-globe'} text-[8px] text-brand-primary`} />
                                                            <span className="truncate text-[8px] font-medium text-brand-primary">{item.title}</span>
                                                        </div>
                                                    );
                                                })}
                                                {dayItems.length > 2 && (
                                                    <p className="text-[8px] text-light-text-secondary dark:text-dark-text-secondary px-1">+{dayItems.length - 2}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })() : (
                    <div className="space-y-3">
                        {hasItems
                            ? contentItems.map(item => {
                                const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => handleOpenItem(item)}
                                        className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-light-border bg-light-card px-5 py-4 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-dark-border dark:bg-dark-card"
                                    >
                                        {/* Date */}
                                        <div className="w-14 shrink-0 text-center">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                {item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString('ar', { month: 'short', day: 'numeric' }) : '—'}
                                            </p>
                                        </div>

                                        {/* Platform + format icons */}
                                        <div className="flex w-12 shrink-0 flex-col items-center gap-1">
                                            <i className={`fab ${PLATFORM_ICONS[item.platform] ?? 'fa-globe'} text-light-text-secondary dark:text-dark-text-secondary`} />
                                            <i className={`fas ${FORMAT_ICONS[item.format] ?? 'fa-image'} text-xs text-light-text-secondary dark:text-dark-text-secondary`} />
                                        </div>

                                        {/* Content info */}
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{item.title}</p>
                                            <div className="mt-1 flex items-center gap-2">
                                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONTENT_TYPE_COLORS[item.contentType] ?? ''}`}>
                                                    {item.contentType}
                                                </span>
                                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                    {item.platform} · {item.format}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score */}
                                        {item.brandFitScore !== undefined && (
                                            <span className={`shrink-0 text-sm font-bold ${scoreColor(item.brandFitScore)}`}>
                                                {item.brandFitScore}
                                            </span>
                                        )}

                                        {/* Status */}
                                        <div className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${st.color}`}>
                                            <i className={`fas ${st.icon} text-xs`} />
                                            <span className="hidden sm:inline">{st.label}</span>
                                        </div>

                                        <i className="fas fa-chevron-left text-xs text-light-text-secondary opacity-0 transition-opacity group-hover:opacity-100 dark:text-dark-text-secondary" />
                                    </div>
                                );
                            })
                            : allDates.map(date => {
                                const slots = groupedByDate[date] ?? [];
                                return (
                                    <div key={date} className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                                        <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-3">
                                            {new Date(date).toLocaleDateString('ar', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </p>
                                        <div className="space-y-2">
                                            {slots.map((slot, i) => (
                                                <div key={i} className="flex items-center gap-3 rounded-xl bg-light-bg dark:bg-dark-bg px-4 py-2.5">
                                                    <i className={`fab ${PLATFORM_ICONS[slot.platform] ?? 'fa-globe'} text-light-text-secondary dark:text-dark-text-secondary`} />
                                                    <i className={`fas ${FORMAT_ICONS[slot.format] ?? 'fa-image'} text-xs text-light-text-secondary dark:text-dark-text-secondary`} />
                                                    <p className="flex-1 text-sm text-light-text dark:text-dark-text">{slot.topic}</p>
                                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CONTENT_TYPE_COLORS[slot.contentType] ?? ''}`}>
                                                        {slot.contentType}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        );
    }

    // ── Screen 5: Item Workspace ───────────────────────────────────────────────
    function renderItemWorkspace() {
        if (!activeItem) return null;
        const st = STATUS_CONFIG[activeItem.status] ?? STATUS_CONFIG.draft;

        const hasDesign = generatedImages.length > 0 || Boolean(activeItem.mediaUrl);
        const TABS: Array<{ id: typeof itemWorkspaceTab; label: string; icon: string; enabled: boolean }> = [
            { id: 'brief',        label: 'البريف',      icon: 'fa-file-lines',    enabled: true },
            { id: 'design',       label: 'التصميم',     icon: 'fa-image',         enabled: brief !== null },
            { id: 'asset-review', label: 'مراجعة',      icon: 'fa-star-half-stroke', enabled: hasDesign },
            { id: 'caption',      label: 'الكابشن',     icon: 'fa-pen-nib',       enabled: hasDesign || activeItem.status === 'caption_ready' || activeItem.status === 'needs_review' || activeItem.status === 'approved' || activeItem.status === 'scheduled' },
            { id: 'qa',           label: 'الجودة',      icon: 'fa-shield-check',  enabled: captionVersions.length > 0 || activeItem.status === 'needs_review' || activeItem.status === 'approved' || activeItem.status === 'scheduled' },
            { id: 'approval',     label: 'الموافقة',    icon: 'fa-circle-check',  enabled: qualityScore !== null || activeItem.status === 'approved' || activeItem.status === 'scheduled' },
            { id: 'schedule',     label: 'الجدولة',     icon: 'fa-calendar-check', enabled: activeItem.status === 'approved' || activeItem.status === 'scheduled' },
        ];

        return (
            <div className="space-y-4">
                {/* Item header */}
                <div className="flex items-center gap-3">
                    <button onClick={() => { setScreen('content-calendar'); setActiveItem(null); }} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                        <i className="fas fa-arrow-right" />
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="truncate font-semibold text-light-text dark:text-dark-text">{activeItem.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                            <i className={`fab ${PLATFORM_ICONS[activeItem.platform] ?? 'fa-globe'} text-xs text-light-text-secondary dark:text-dark-text-secondary`} />
                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {activeItem.platform} · {activeItem.format}
                            </span>
                            <span className={`flex items-center gap-1 text-xs font-medium ${st.color}`}>
                                <i className={`fas ${st.icon} text-xs`} />
                                {st.label}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Pipeline progress */}
                <div className="flex items-center gap-1 overflow-x-auto rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                    {['draft', 'brief_ready', 'design_ready', 'caption_ready', 'needs_review', 'approved', 'scheduled'].map((s, i, arr) => {
                        const statuses = ['draft', 'brief_ready', 'design_in_progress', 'design_ready', 'caption_ready', 'needs_review', 'approved', 'scheduled', 'published'];
                        const currentIdx = statuses.indexOf(activeItem.status);
                        const itemIdx = statuses.indexOf(s);
                        const done = currentIdx > itemIdx;
                        const active = currentIdx === itemIdx;
                        const stCfg = STATUS_CONFIG[s];
                        return (
                            <React.Fragment key={s}>
                                <div className={`flex shrink-0 flex-col items-center gap-1 text-center ${done ? 'opacity-100' : active ? 'opacity-100' : 'opacity-40'}`}>
                                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${done ? 'bg-green-500 text-white' : active ? 'bg-brand-primary text-white' : 'bg-light-bg dark:bg-dark-bg text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                        <i className={`fas ${done ? 'fa-check' : stCfg?.icon ?? 'fa-circle'} text-xs`} />
                                    </div>
                                    <span className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary whitespace-nowrap">{stCfg?.label ?? s}</span>
                                </div>
                                {i < arr.length - 1 && (
                                    <div className={`h-0.5 flex-1 ${done ? 'bg-green-500' : 'bg-light-bg dark:bg-dark-bg'}`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 overflow-x-auto rounded-2xl border border-light-border bg-light-card p-1.5 dark:border-dark-border dark:bg-dark-card">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => tab.enabled && setItemWorkspaceTab(tab.id)}
                            disabled={!tab.enabled}
                            className={`flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                                itemWorkspaceTab === tab.id
                                    ? 'bg-brand-primary text-white shadow-sm'
                                    : tab.enabled
                                    ? 'text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg'
                                    : 'cursor-not-allowed opacity-30 text-light-text-secondary dark:text-dark-text-secondary'
                            }`}
                        >
                            <i className={`fas ${tab.icon} text-xs`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Split Panel: Context (left) + Workspace (right) */}
                <div className="flex gap-4 items-start">
                    {/* Left context panel */}
                    <div className="hidden lg:flex flex-col gap-3 w-56 shrink-0">
                        <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card space-y-2">
                            <p className="text-xs font-bold text-brand-primary uppercase tracking-wide">
                                <i className="fas fa-brain mr-1" /> سياق البراند
                            </p>
                            <div className="space-y-1.5">
                                <div>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">البراند</p>
                                    <p className="text-xs font-semibold text-light-text dark:text-dark-text truncate">{brandProfile.brandName}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">النبرة</p>
                                    <p className="text-xs font-semibold text-light-text dark:text-dark-text capitalize">{brandProfile.brandVoice?.toneDescription?.[0] ?? '—'}</p>
                                </div>
                                {activeCampaign && (
                                    <div>
                                        <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">الهدف</p>
                                        <p className="text-xs font-semibold text-light-text dark:text-dark-text truncate">{activeCampaign.name}</p>
                                    </div>
                                )}
                                {activeItem && (
                                    <>
                                        <div>
                                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">المنصة</p>
                                            <p className="text-xs font-semibold text-light-text dark:text-dark-text capitalize">{activeItem.platform}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary">الفورمات</p>
                                            <p className="text-xs font-semibold text-light-text dark:text-dark-text capitalize">{activeItem.format}</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                        {brief && (
                            <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card space-y-1.5">
                                <p className="text-xs font-bold text-brand-primary uppercase tracking-wide">
                                    <i className="fas fa-lightbulb mr-1" /> ملاحظات الـ AI
                                </p>
                                <p className="text-[10px] leading-relaxed text-light-text-secondary dark:text-dark-text-secondary">
                                    {brief.keyMessage}
                                </p>
                            </div>
                        )}
                    </div>

                {/* Tab content */}
                <div className="relative flex-1 rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                    {aiLoading && <LoadingOverlay text={aiLoadingText} />}

                    {/* Brief Tab */}
                    {itemWorkspaceTab === 'brief' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-file-lines text-brand-primary mr-2" />
                                    البريف الإبداعي
                                </p>
                                <div className="flex items-center gap-2">
                                    {brief && (
                                        <>
                                            <button
                                                onClick={() => addNotification(NotificationType.Success, 'تم حفظ البريف كقالب')}
                                                className="flex items-center gap-1 rounded-xl border border-light-border px-2.5 py-1.5 text-xs font-medium text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                                            >
                                                <i className="fas fa-bookmark text-[10px]" />
                                                حفظ كقالب
                                            </button>
                                            <button
                                                onClick={() => addNotification(NotificationType.Success, 'تم إرسال البريف للمصمم كـ PDF')}
                                                className="flex items-center gap-1 rounded-xl border border-light-border px-2.5 py-1.5 text-xs font-medium text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                                            >
                                                <i className="fas fa-file-pdf text-[10px] text-red-500" />
                                                إرسال للمصمم
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={handleGenerateBrief}
                                        disabled={aiLoading}
                                        className="flex items-center gap-2 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
                                    >
                                        <i className="fas fa-wand-magic-sparkles" />
                                        {brief ? 'إعادة التوليد' : 'توليد البريف'}
                                    </button>
                                </div>
                            </div>

                            {/* Visual Style + Color Palette */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">الأسلوب البصري</label>
                                    <select
                                        value={briefVisualStyle}
                                        onChange={e => setBriefVisualStyle(e.target.value)}
                                        className="w-full rounded-xl border border-light-border bg-light-bg px-3 py-2 text-xs text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                                    >
                                        <option value="minimalist">Minimalist — بسيط ونظيف</option>
                                        <option value="bold">Bold — جريء وصريح</option>
                                        <option value="playful">Playful — مرح وحيوي</option>
                                        <option value="elegant">Elegant — راقٍ وفاخر</option>
                                        <option value="editorial">Editorial — احترافي صحفي</option>
                                        <option value="retro">Retro — كلاسيكي قديم</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary mb-1.5">لوحة الألوان</label>
                                    <div className="flex items-center gap-1.5 rounded-xl border border-light-border bg-light-bg px-3 py-2 dark:border-dark-border dark:bg-dark-bg">
                                        {brandProfile.styleGuidelines?.slice(0, 4).map((g, i) => (
                                            <div
                                                key={i}
                                                className="h-5 w-5 rounded-full border border-white/50 shadow-sm"
                                                style={{ background: `hsl(${(i * 60 + 200) % 360}, 65%, 55%)` }}
                                                title={g}
                                            />
                                        ))}
                                        {(!brandProfile.styleGuidelines || brandProfile.styleGuidelines.length === 0) && (
                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">من ملف البراند</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {brief ? (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">الهدف</p>
                                            <p className="text-sm text-light-text dark:text-dark-text">{brief.objective}</p>
                                        </div>
                                        <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">الجمهور</p>
                                            <p className="text-sm text-light-text dark:text-dark-text">{brief.targetSegment ?? '—'}</p>
                                        </div>
                                    </div>
                                    <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/20 dark:bg-brand-primary/10 p-3">
                                        <p className="text-xs font-semibold text-brand-primary mb-1">الرسالة الرئيسية</p>
                                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">"{brief.keyMessage}"</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">النبرة</p>
                                            <p className="text-sm text-light-text dark:text-dark-text">{brief.tone ?? '—'}</p>
                                        </div>
                                        <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">CTA</p>
                                            <p className="text-sm text-light-text dark:text-dark-text">{brief.cta ?? '—'}</p>
                                        </div>
                                    </div>
                                    {brief.hooks.length > 0 && (
                                        <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">الخطافات</p>
                                            <div className="space-y-1.5">
                                                {brief.hooks.map((h, i) => (
                                                    <p key={i} className="text-sm text-light-text dark:text-dark-text">• {h}</p>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {brief.slideStructure.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">هيكل الشرائح</p>
                                            <div className="space-y-2">
                                                {brief.slideStructure.map((slide, i) => (
                                                    <div key={i} className="flex items-start gap-3 rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-bold text-brand-primary">{slide.order}</span>
                                                        <div>
                                                            <p className="text-sm font-semibold text-light-text dark:text-dark-text">{slide.headline}</p>
                                                            {slide.subtext && <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{slide.subtext}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => setItemWorkspaceTab('design')}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white mt-2"
                                    >
                                        التالي: التصميم
                                        <i className="fas fa-chevron-left text-xs" />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                    <i className="fas fa-file-lines text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">لا يوجد بريف بعد</p>
                                    <button
                                        onClick={handleGenerateBrief}
                                        disabled={aiLoading}
                                        className="flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                                    >
                                        <i className="fas fa-wand-magic-sparkles" />
                                        توليد بريف بالـ AI
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Design Tab */}
                    {itemWorkspaceTab === 'design' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-image text-brand-primary mr-2" />
                                    التصميم
                                </p>
                                <button
                                    onClick={handleGenerateDesign}
                                    disabled={!brief || aiLoading}
                                    className="flex items-center gap-2 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
                                >
                                    <i className="fas fa-wand-magic-sparkles" />
                                    {generatedImages.length > 0 ? 'إعادة التوليد' : 'توليد التصميم'}
                                </button>
                            </div>

                            {/* Provider selector */}
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">المزود:</span>
                                {(['gemini', 'dalle', 'midjourney'] as const).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setDesignProvider(p)}
                                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all border ${
                                            designProvider === p
                                                ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                                                : 'border-light-border bg-light-bg text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary'
                                        }`}
                                    >
                                        <i className={`fas ${p === 'gemini' ? 'fa-gem' : p === 'dalle' ? 'fa-wand-sparkles' : 'fa-palette'} text-[10px]`} />
                                        {p === 'gemini' ? 'Gemini' : p === 'dalle' ? 'DALL·E' : 'Midjourney'}
                                        {p !== 'gemini' && <span className="text-[9px] opacity-60">قريباً</span>}
                                    </button>
                                ))}
                            </div>

                            {/* Multi-slide support for carousel */}
                            {activeItem?.format === 'carousel' && (
                                <div className="rounded-xl border border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg p-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-semibold text-light-text dark:text-dark-text">
                                            <i className="fas fa-images text-brand-primary mr-1" />
                                            شرائح الكاروسيل ({Math.max(designSlides.length, generatedImages.length)})
                                        </p>
                                        <button
                                            onClick={() => setDesignSlides(prev => [...prev, ''])}
                                            className="text-xs text-brand-primary hover:underline"
                                        >
                                            + إضافة شريحة
                                        </button>
                                    </div>
                                    <div className="flex gap-2 overflow-x-auto">
                                        {(generatedImages.length > 0 ? generatedImages : designSlides).map((url, i) => (
                                            <div
                                                key={i}
                                                onClick={() => url && setSelectedImageUrl(url)}
                                                className={`relative shrink-0 h-20 w-20 cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${selectedImageUrl === url ? 'border-brand-primary' : 'border-light-border dark:border-dark-border'}`}
                                            >
                                                {url ? (
                                                    <img src={url} alt={`شريحة ${i + 1}`} className="h-full w-full object-cover" />
                                                ) : (
                                                    <div className="flex h-full items-center justify-center bg-light-bg dark:bg-dark-bg text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                        {i + 1}
                                                    </div>
                                                )}
                                                <span className="absolute bottom-0.5 right-0.5 rounded bg-black/50 px-1 text-[9px] text-white">{i + 1}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {designPromptText && (
                                <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">الـ Prompt</p>
                                    <p className="text-xs font-mono text-light-text dark:text-dark-text leading-relaxed">{designPromptText}</p>
                                </div>
                            )}

                            {generatedImages.length > 0 ? (
                                <div className="grid grid-cols-2 gap-3">
                                    {generatedImages.map((url, i) => (
                                        <div
                                            key={i}
                                            onClick={() => setSelectedImageUrl(url)}
                                            className={`relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${selectedImageUrl === url ? 'border-brand-primary' : 'border-transparent'}`}
                                        >
                                            <img src={url} alt={`تصميم ${i + 1}`} className="w-full aspect-square object-cover" />
                                            {selectedImageUrl === url && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-brand-primary/20">
                                                    <i className="fas fa-check-circle text-2xl text-white" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : selectedImageUrl ? (
                                <div className="overflow-hidden rounded-xl">
                                    <img src={selectedImageUrl} alt="التصميم" className="w-full aspect-square object-cover" />
                                </div>
                            ) : !brief ? (
                                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">أنشئ البريف أولاً لتوليد التصميم</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                    <i className="fas fa-image text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">اضغط "توليد التصميم" لإنشاء الصورة</p>
                                </div>
                            )}

                            {(generatedImages.length > 0 || selectedImageUrl) && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => addNotification(NotificationType.Success, 'تم حفظ التصميم في المكتبة')}
                                        className="flex items-center justify-center gap-2 rounded-xl border border-light-border px-3 py-2.5 text-xs font-semibold text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                                    >
                                        <i className="fas fa-folder-plus text-brand-primary" />
                                        حفظ في المكتبة
                                    </button>
                                    <button
                                        onClick={() => setItemWorkspaceTab('caption')}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
                                    >
                                        التالي: الكابشن
                                        <i className="fas fa-chevron-left text-xs" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Asset Review Tab */}
                    {itemWorkspaceTab === 'asset-review' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-star-half-stroke text-brand-primary mr-2" />
                                    مراجعة جودة الأصل البصري
                                </p>
                                <button
                                    onClick={handleReviewAsset}
                                    disabled={!selectedImageUrl || aiLoading}
                                    className="flex items-center gap-2 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
                                >
                                    <i className="fas fa-wand-magic-sparkles" />
                                    {assetReview ? 'إعادة التقييم' : 'تقييم بالـ AI'}
                                </button>
                            </div>

                            {selectedImageUrl && (
                                <div className="relative overflow-hidden rounded-xl">
                                    <img src={selectedImageUrl} alt="الأصل البصري" className="w-full max-h-64 object-cover" />
                                    {assetReview && (
                                        <div className={`absolute top-2 right-2 rounded-full px-3 py-1 text-sm font-black text-white ${assetReview.overall >= 70 ? 'bg-green-500' : assetReview.overall >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                            {assetReview.overall}
                                        </div>
                                    )}
                                </div>
                            )}

                            {assetReview ? (
                                <div className="space-y-3">
                                    <div className="space-y-1.5">
                                        <ScoreBar score={assetReview.brandFit}     label="توافق البراند" />
                                        <ScoreBar score={assetReview.clarity}      label="وضوح الرسالة" />
                                        <ScoreBar score={assetReview.composition}  label="التكوين البصري" />
                                        <ScoreBar score={assetReview.textContrast} label="تباين النص" />
                                    </div>

                                    {assetReview.suggestions.length > 0 && (
                                        <div className="space-y-1.5">
                                            <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">اقتراحات التحسين:</p>
                                            {assetReview.suggestions.map((s, i) => (
                                                <div key={i} className="flex items-start gap-2 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-2.5">
                                                    <i className="fas fa-lightbulb text-yellow-500 text-xs mt-0.5 shrink-0" />
                                                    <p className="text-xs text-light-text dark:text-dark-text">{s}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <button
                                            onClick={async () => {
                                                if (!brief || !activeItem || !assetReview.autoFixPrompt) return;
                                                try {
                                                    setAiLoading(true);
                                                    setAiLoadingText('يُولّد تصميماً محسّناً...');
                                                    const imgs = await generateImageFromPrompt(assetReview.autoFixPrompt, '1:1', 'google', 1);
                                                    if (imgs[0]) {
                                                        setGeneratedImages(prev => [imgs[0], ...prev]);
                                                        setSelectedImageUrl(imgs[0]);
                                                        await updateContentItem(activeItem.id, { mediaUrl: imgs[0] });
                                                        setAssetReview(null);
                                                        addNotification(NotificationType.Success, 'تم توليد تصميم جديد');
                                                    }
                                                } catch { addNotification(NotificationType.Error, 'فشل التوليد'); }
                                                finally { setAiLoading(false); }
                                            }}
                                            disabled={aiLoading}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text hover:bg-light-bg dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-bg disabled:opacity-50"
                                        >
                                            <i className="fas fa-wand-magic-sparkles" />
                                            إصلاح تلقائي
                                        </button>
                                        <button
                                            onClick={() => setItemWorkspaceTab('caption')}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white"
                                        >
                                            التالي: الكابشن
                                            <i className="fas fa-chevron-left text-xs" />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                                    {!selectedImageUrl ? (
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">ولّد التصميم أولاً ثم عُد لمراجعته</p>
                                    ) : (
                                        <>
                                            <i className="fas fa-star-half-stroke text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">اضغط "تقييم بالـ AI" لتحليل جودة التصميم</p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Caption Tab */}
                    {itemWorkspaceTab === 'caption' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-pen-nib text-brand-primary mr-2" />
                                    الكابشن والنصوص
                                </p>
                                <button
                                    onClick={handleGenerateCaptions}
                                    disabled={!brief || aiLoading}
                                    className="flex items-center gap-2 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
                                >
                                    <i className="fas fa-wand-magic-sparkles" />
                                    {captionVersions.length > 0 ? 'إعادة الكتابة' : 'كتابة بالـ AI'}
                                </button>
                            </div>

                            {captionVersions.length > 0 ? (
                                <div className="space-y-3">
                                    {/* Version selector */}
                                    <div className="flex gap-2">
                                        {captionVersions.map((_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setSelectedCaptionIdx(i)}
                                                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-all ${
                                                    selectedCaptionIdx === i
                                                        ? 'bg-brand-primary text-white'
                                                        : 'bg-light-bg text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary'
                                                }`}
                                            >
                                                نسخة {i + 1}
                                            </button>
                                        ))}
                                    </div>

                                    {captionVersions[selectedCaptionIdx] && (() => {
                                        const v = captionVersions[selectedCaptionIdx];
                                        const platformLimits: Record<string, number> = {
                                            instagram: 2200, facebook: 63206, x: 280, twitter: 280,
                                            linkedin: 3000, tiktok: 2200, youtube: 5000,
                                        };
                                        const limit = platformLimits[activeItem?.platform ?? ''] ?? 2200;
                                        const charPct = Math.min(100, (v.charCount / limit) * 100);
                                        const charWarning = charPct > 90;
                                        return (
                                            <div className="space-y-3">
                                                {/* Caption modifiers */}
                                                <div className="flex flex-wrap gap-1.5">
                                                    <p className="w-full text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-0.5">تعديل سريع:</p>
                                                    {[
                                                        { label: 'أقصر', icon: 'fa-compress', action: 'shorten' },
                                                        { label: 'أقوى', icon: 'fa-bolt', action: 'stronger' },
                                                        { label: 'إضافة Emoji', icon: 'fa-face-smile', action: 'emoji' },
                                                        { label: 'CTA أقوى', icon: 'fa-arrow-pointer', action: 'cta' },
                                                        { label: 'ترجمة EN', icon: 'fa-language', action: 'translate' },
                                                    ].map(mod => (
                                                        <button
                                                            key={mod.action}
                                                            onClick={() => addNotification(NotificationType.Info, `جارٍ تطبيق: ${mod.label}...`)}
                                                            className="flex items-center gap-1 rounded-xl border border-light-border bg-light-bg px-2.5 py-1 text-[10px] font-semibold text-light-text-secondary hover:border-brand-primary hover:text-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary transition-all"
                                                        >
                                                            <i className={`fas ${mod.icon} text-[9px]`} />
                                                            {mod.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">الكابشن</p>
                                                        <span className={`text-xs font-semibold ${charWarning ? 'text-orange-500' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                                            {v.charCount}/{limit}
                                                            {charWarning && <i className="fas fa-triangle-exclamation mr-1 text-[9px]" />}
                                                        </span>
                                                    </div>
                                                    <textarea
                                                        value={v.caption}
                                                        onChange={e => {
                                                            const updated = [...captionVersions];
                                                            updated[selectedCaptionIdx] = { ...v, caption: e.target.value, charCount: e.target.value.length };
                                                            setCaptionVersions(updated);
                                                        }}
                                                        rows={5}
                                                        className="w-full resize-none bg-transparent text-sm text-light-text dark:text-dark-text focus:outline-none"
                                                    />
                                                    {/* Inline char count bar */}
                                                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-light-card dark:bg-dark-card">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${charPct > 90 ? 'bg-orange-400' : charPct > 70 ? 'bg-yellow-400' : 'bg-brand-primary'}`}
                                                            style={{ width: `${charPct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">العنوان</p>
                                                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">{v.headline}</p>
                                                    </div>
                                                    <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">CTA</p>
                                                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">{v.cta}</p>
                                                    </div>
                                                </div>
                                                <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-2">الهاشتاق ({v.hashtags.length})</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {v.hashtags.map((h, hi) => (
                                                            <span key={hi} className="rounded-lg bg-brand-primary/10 px-2 py-0.5 text-xs text-brand-primary">{h}</span>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Platform Preview Panel */}
                                                {selectedImageUrl && (
                                                    <div className="rounded-xl border border-light-border overflow-hidden dark:border-dark-border">
                                                        <div className="flex items-center gap-2 px-3 py-2 bg-light-bg dark:bg-dark-bg border-b border-light-border dark:border-dark-border">
                                                            <i className={`fab ${PLATFORM_ICONS[activeItem?.platform ?? ''] ?? 'fa-globe'} text-xs text-light-text-secondary dark:text-dark-text-secondary`} />
                                                            <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary capitalize">معاينة {activeItem?.platform}</span>
                                                        </div>
                                                        <div className="p-3 space-y-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-7 w-7 rounded-full bg-brand-primary/20 flex items-center justify-center">
                                                                    <i className="fas fa-user text-brand-primary text-[10px]" />
                                                                </div>
                                                                <p className="text-xs font-semibold text-light-text dark:text-dark-text">{brandProfile.brandName}</p>
                                                            </div>
                                                            <img src={selectedImageUrl} alt="preview" className="w-full aspect-square object-cover rounded-lg" />
                                                            <p className="text-xs text-light-text dark:text-dark-text line-clamp-3">{v.caption}</p>
                                                            <p className="text-xs text-brand-primary">{v.hashtags.slice(0, 3).join(' ')}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Platform Optimization */}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleOptimizePerPlatform}
                                            disabled={aiLoading}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text hover:bg-light-bg dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-bg disabled:opacity-50"
                                        >
                                            <i className="fas fa-share-nodes text-brand-primary" />
                                            تحسين لكل منصة
                                        </button>
                                        <button
                                            onClick={handleRunQA}
                                            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white"
                                        >
                                            <i className="fas fa-shield-check" />
                                            فحص الجودة
                                        </button>
                                    </div>

                                    {/* Platform variants */}
                                    {platformVariants.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">نسخ المنصات:</p>
                                            <div className="flex gap-1 flex-wrap">
                                                {platformVariants.map((v, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => setPlatformVariantIdx(i)}
                                                        className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-semibold transition-all ${platformVariantIdx === i ? 'bg-brand-primary text-white' : 'bg-light-bg text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary'}`}
                                                    >
                                                        <i className={`fab ${PLATFORM_ICONS[v.platform] ?? 'fa-globe'} text-[10px]`} />
                                                        {v.platform}
                                                    </button>
                                                ))}
                                            </div>
                                            {platformVariants[platformVariantIdx] && (
                                                <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3 text-xs text-light-text dark:text-dark-text">
                                                    {platformVariants[platformVariantIdx].caption}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                    <i className="fas fa-pen-nib text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">اضغط "كتابة بالـ AI" لتوليد النصوص</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* QA Tab */}
                    {itemWorkspaceTab === 'qa' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-shield-check text-brand-primary mr-2" />
                                    فحص الجودة
                                </p>
                                <button
                                    onClick={handleRunQA}
                                    disabled={!brief || aiLoading}
                                    className="flex items-center gap-2 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20 disabled:opacity-50"
                                >
                                    <i className="fas fa-rotate-right" />
                                    إعادة الفحص
                                </button>
                            </div>

                            {qualityScore ? (
                                <div className="space-y-4">
                                    {/* Overall score */}
                                    <div className="flex items-center gap-4 rounded-xl bg-light-bg dark:bg-dark-bg p-4">
                                        <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-2xl font-black ${scoreColor(qualityScore.overall)} bg-light-card dark:bg-dark-card shadow-sm`}>
                                            {qualityScore.overall}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-light-text dark:text-dark-text">الدرجة الإجمالية</p>
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                                توقع CTR:{' '}
                                                <span className={`font-semibold ${qualityScore.predictedCtr === 'high' ? 'text-green-500' : qualityScore.predictedCtr === 'medium' ? 'text-yellow-500' : 'text-red-500'}`}>
                                                    {qualityScore.predictedCtr === 'high' ? '3.5–6.2%' : qualityScore.predictedCtr === 'medium' ? '1.8–3.5%' : '0.3–1.8%'}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Hard block warning */}
                                    {qualityScore.overall < 40 && (
                                        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-4">
                                            <i className="fas fa-ban text-red-500 text-lg mt-0.5 shrink-0" />
                                            <div>
                                                <p className="font-semibold text-red-700 dark:text-red-300">جودة غير كافية للنشر</p>
                                                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                                                    الدرجة {qualityScore.overall}/100 — يجب إصلاح المشكلات أدناه قبل المتابعة (الحد الأدنى 40)
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Score breakdown */}
                                    <div className="space-y-1">
                                        <ScoreBar score={qualityScore.brandFit}      label="توافق البراند" />
                                        <ScoreBar score={qualityScore.audienceFit}   label="توافق الجمهور" />
                                        <ScoreBar score={qualityScore.goalFit}       label="توافق الهدف" />
                                        <ScoreBar score={qualityScore.platformFit}   label="توافق المنصة" />
                                        <ScoreBar score={qualityScore.captionPower}  label="قوة الكابشن" />
                                        <ScoreBar score={qualityScore.ctaStrength}   label="قوة الـ CTA" />
                                        <ScoreBar score={qualityScore.conversion}    label="احتمالية التحويل" />
                                        <ScoreBar score={qualityScore.safety}        label="سلامة المحتوى" />
                                    </div>

                                    {/* Issues with Apply Auto */}
                                    {qualityScore.issues.length > 0 && (
                                        <div>
                                            <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-2">ملاحظات التحسين:</p>
                                            <div className="space-y-2">
                                                {qualityScore.issues.map((issue, i) => (
                                                    <div key={i} className="flex items-start gap-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 p-3">
                                                        <i className="fas fa-circle-exclamation text-yellow-500 mt-0.5 shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">{issue.dimension}</p>
                                                            <p className="text-xs text-light-text dark:text-dark-text mt-0.5">{issue.message}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => addNotification(NotificationType.Info, `جارٍ إصلاح: ${issue.dimension}...`)}
                                                            className="shrink-0 flex items-center gap-1 rounded-lg bg-yellow-100 dark:bg-yellow-900/40 px-2 py-1 text-[10px] font-semibold text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/60"
                                                        >
                                                            <i className="fas fa-wand-magic-sparkles text-[9px]" />
                                                            إصلاح تلقائي
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {qualityScore.overall < 40 ? (
                                        <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-semibold text-red-500">
                                            <i className="fas fa-ban" />
                                            محظور — أصلح المشكلات أولاً
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setItemWorkspaceTab('approval')}
                                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
                                        >
                                            <i className="fas fa-circle-check" />
                                            المتابعة للموافقة
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                                    <i className="fas fa-shield-check text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">اضغط "إعادة الفحص" لتقييم جودة المحتوى</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Approval Tab */}
                    {itemWorkspaceTab === 'approval' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-circle-check text-brand-primary mr-2" />
                                    الموافقة
                                </p>
                                <button
                                    onClick={() => setShowPreviewModal(true)}
                                    className="flex items-center gap-1.5 rounded-xl border border-light-border px-3 py-1.5 text-xs font-medium text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                                >
                                    <i className="fas fa-eye text-brand-primary" />
                                    معاينة المنشور
                                </button>
                            </div>

                            {/* Content summary */}
                            <div className="rounded-xl border border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg p-4 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">المنصة</span>
                                    <span className="font-medium text-light-text dark:text-dark-text">{activeItem.platform} · {activeItem.format}</span>
                                </div>
                                {activeItem.scheduledAt && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">الموعد المقترح</span>
                                        <span className="font-medium text-light-text dark:text-dark-text">
                                            {new Date(activeItem.scheduledAt).toLocaleDateString('ar', { weekday: 'long', month: 'long', day: 'numeric' })}
                                        </span>
                                    </div>
                                )}
                                {qualityScore && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">درجة الجودة</span>
                                        <span className={`font-bold ${scoreColor(qualityScore.overall)}`}>{qualityScore.overall}/100</span>
                                    </div>
                                )}
                                {/* Goal Contribution */}
                                {activeCampaign && contentItems.length > 0 && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-light-text-secondary dark:text-dark-text-secondary">مساهمة في الهدف</span>
                                        <span className="font-bold text-brand-primary">
                                            ~{Math.round(100 / contentItems.length)}%
                                        </span>
                                    </div>
                                )}
                            </div>

                            {captionVersions[selectedCaptionIdx] && (
                                <div className="rounded-xl bg-light-bg dark:bg-dark-bg p-3">
                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1">الكابشن</p>
                                    <p className="text-sm text-light-text dark:text-dark-text line-clamp-3">{captionVersions[selectedCaptionIdx].caption}</p>
                                </div>
                            )}

                            {activeItem.status === 'approved' || activeItem.status === 'scheduled' ? (
                                <div className="flex items-center justify-center gap-2 rounded-xl bg-green-50 dark:bg-green-900/20 p-4">
                                    <i className="fas fa-circle-check text-green-500" />
                                    <span className="text-sm font-semibold text-green-700 dark:text-green-300">تمت الموافقة</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* 4-option decision radio */}
                                    <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">قرار الموافقة:</p>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'approve', label: 'موافق — جاهز للجدولة', icon: 'fa-circle-check', color: 'text-green-500', bg: 'border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-900/20' },
                                            { value: 'approve_minor', label: 'موافق مع تعديل طفيف', icon: 'fa-pen-to-square', color: 'text-blue-500', bg: 'border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20' },
                                            { value: 'review', label: 'إرسال للمراجعة', icon: 'fa-clock', color: 'text-yellow-500', bg: 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20' },
                                            { value: 'reject', label: 'رفض — إعادة من البداية', icon: 'fa-ban', color: 'text-red-500', bg: 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20' },
                                        ].map(opt => (
                                            <label
                                                key={opt.value}
                                                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-all ${approvalDecision === opt.value ? opt.bg : 'border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg'}`}
                                            >
                                                <input
                                                    type="radio"
                                                    name="approvalDecision"
                                                    value={opt.value}
                                                    checked={approvalDecision === opt.value}
                                                    onChange={() => setApprovalDecision(opt.value as typeof approvalDecision)}
                                                    className="accent-brand-primary"
                                                />
                                                <i className={`fas ${opt.icon} text-sm ${opt.color}`} />
                                                <span className="text-sm text-light-text dark:text-dark-text">{opt.label}</span>
                                            </label>
                                        ))}
                                    </div>

                                    {/* Note field for review/reject */}
                                    {(approvalDecision === 'review' || approvalDecision === 'reject' || approvalDecision === 'approve_minor') && (
                                        <textarea
                                            value={approvalNote}
                                            onChange={e => setApprovalNote(e.target.value)}
                                            placeholder={approvalDecision === 'reject' ? 'سبب الرفض...' : 'ملاحظات التعديل...'}
                                            rows={2}
                                            className="w-full resize-none rounded-xl border border-light-border bg-light-bg px-3 py-2 text-sm text-light-text placeholder-light-text-secondary focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-secondary"
                                        />
                                    )}

                                    <button
                                        onClick={() => { if (approvalDecision === 'approve' || approvalDecision === 'approve_minor') handleApprove(); else addNotification(NotificationType.Info, 'تم تسجيل القرار'); }}
                                        disabled={!approvalDecision || loading || aiLoading}
                                        className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 transition-all ${approvalDecision === 'reject' ? 'bg-red-500 hover:bg-red-600' : approvalDecision === 'review' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-green-500 hover:bg-green-600'}`}
                                    >
                                        {loading ? <Spinner /> : <i className={`fas ${approvalDecision === 'reject' ? 'fa-ban' : approvalDecision === 'review' ? 'fa-clock' : 'fa-check'}`} />}
                                        {approvalDecision === 'reject' ? 'رفض' : approvalDecision === 'review' ? 'إرسال للمراجعة' : 'موافق ومتابعة للجدولة'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Scheduler Tab */}
                    {itemWorkspaceTab === 'schedule' && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-calendar-check text-brand-primary mr-2" />
                                    الجدولة الذكية
                                </p>
                                {/* Multi-platform: current platform badge + add more */}
                                <div className="flex items-center gap-2">
                                    {activeItem && (
                                        <span className="flex items-center gap-1 rounded-lg bg-brand-primary/10 px-2 py-1 text-xs font-semibold text-brand-primary">
                                            <i className={`fab ${PLATFORM_ICONS[activeItem.platform] ?? 'fa-globe'} text-[10px]`} />
                                            {activeItem.platform}
                                        </span>
                                    )}
                                    {activeCampaign && activeCampaign.platforms.filter(p => p !== activeItem?.platform).length > 0 && (
                                        <button
                                            onClick={() => addNotification(NotificationType.Info, 'سيتم إنشاء نسخة للمنصة الأخرى قريباً')}
                                            className="flex items-center gap-1 rounded-xl border border-dashed border-light-border px-2.5 py-1 text-xs font-medium text-light-text-secondary hover:border-brand-primary hover:text-brand-primary dark:border-dark-border dark:text-dark-text-secondary"
                                        >
                                            <i className="fas fa-plus text-[9px]" />
                                            إضافة {activeCampaign.platforms.find(p => p !== activeItem?.platform)} نسخة
                                        </button>
                                    )}
                                </div>
                            </div>

                            {activeItem.status === 'scheduled' ? (
                                <div className="space-y-3">
                                    <div className="rounded-xl bg-brand-primary/5 border border-brand-primary/20 p-4 text-center">
                                        <i className="fas fa-calendar-check text-2xl text-brand-primary mb-2" />
                                        <p className="font-semibold text-light-text dark:text-dark-text">تمت الجدولة</p>
                                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary mt-1">
                                            {activeItem.scheduledAt ? new Date(activeItem.scheduledAt).toLocaleString('ar', { dateStyle: 'full', timeStyle: 'short' }) : '—'}
                                        </p>
                                    </div>
                                    <button
                                        onClick={handleViewPerformance}
                                        disabled={aiLoading}
                                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text hover:bg-light-bg dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-bg disabled:opacity-50"
                                    >
                                        <i className="fas fa-chart-line text-brand-primary" />
                                        عرض تحليل الأداء
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {scheduleSuggestions.length > 0 ? (
                                        <div className="space-y-2">
                                            <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">أوقات النشر المقترحة من الـ AI:</p>
                                            {scheduleSuggestions.map((s, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => setSelectedScheduleTime(s.datetime)}
                                                    className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                                                        selectedScheduleTime === s.datetime
                                                            ? 'border-brand-primary bg-brand-primary/5 dark:bg-brand-primary/10'
                                                            : 'border-light-border bg-light-bg dark:border-dark-border dark:bg-dark-bg'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className={`text-xs font-semibold ${i === 0 ? 'text-brand-primary' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                                            {i === 0 ? '⭐ ' : ''}{s.label}
                                                        </span>
                                                        <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                            {s.predictedReachMin.toLocaleString('ar')} — {s.predictedReachMax.toLocaleString('ar')} وصول
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                                                        {new Date(s.datetime).toLocaleString('ar', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                    </p>
                                                    <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-0.5">{s.reason}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                                            <i className="fas fa-calendar-alt text-3xl text-light-text-secondary dark:text-dark-text-secondary opacity-40" />
                                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">وافق على المحتوى أولاً للحصول على اقتراحات الجدولة</p>
                                        </div>
                                    )}

                                    {/* Custom time */}
                                    <div>
                                        <label className="block text-xs text-light-text-secondary dark:text-dark-text-secondary mb-1.5">أو اختر وقتاً مخصصاً</label>
                                        <input
                                            type="datetime-local"
                                            value={selectedScheduleTime ? selectedScheduleTime.slice(0, 16) : ''}
                                            onChange={e => setSelectedScheduleTime(new Date(e.target.value).toISOString())}
                                            className="w-full rounded-xl border border-light-border bg-light-bg px-4 py-2.5 text-sm text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSchedule(new Date().toISOString())}
                                            disabled={loading}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text hover:bg-light-bg dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-bg disabled:opacity-50"
                                        >
                                            <i className="fas fa-bolt" />
                                            نشر الآن
                                        </button>
                                        <button
                                            onClick={() => selectedScheduleTime && handleSchedule(selectedScheduleTime)}
                                            disabled={!selectedScheduleTime || loading}
                                            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary-glow disabled:opacity-50"
                                        >
                                            {loading ? <Spinner /> : <i className="fas fa-calendar-check" />}
                                            جدولة
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
                </div>{/* end split panel */}
            </div>
        );
    }

    // ── Screen 13: Performance Feedback ──────────────────────────────────────
    function renderPerformanceScreen() {
        const kpis = performanceAnalysis?.kpiPerformance ?? [];
        const learnings = performanceAnalysis?.learnings ?? [];
        const health = campaignHealthScore;

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setScreen('content-calendar')} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                        <i className="fas fa-arrow-right" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-chart-line text-brand-primary mr-2" />
                            تحليل الأداء
                        </h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {activeCampaign?.name} — الأداء الفعلي مقابل المتوقع
                        </p>
                    </div>
                </div>

                {aiLoading ? (
                    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-light-border bg-light-card p-8 dark:border-dark-border dark:bg-dark-card">
                        <i className="fas fa-chart-line fa-beat-fade text-3xl text-brand-primary" />
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">{aiLoadingText}</p>
                    </div>
                ) : performanceAnalysis ? (
                    <div className="space-y-5">
                        {/* Health Score */}
                        <div className="flex items-center gap-4 rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                            <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-3xl font-black bg-light-bg dark:bg-dark-bg ${scoreColor(health)}`}>
                                {health}
                            </div>
                            <div>
                                <p className="text-lg font-bold text-light-text dark:text-dark-text">Campaign Health</p>
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                    {health >= 70 ? 'أداء ممتاز' : health >= 45 ? 'أداء جيد — هناك مجال للتحسين' : 'يحتاج اهتماماً'}
                                </p>
                                <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    ذاكرة البراند: <span className="font-semibold text-brand-primary">{learningsCount} تعلّم</span>
                                </p>
                            </div>
                        </div>

                        {/* KPI Table */}
                        {kpis.length > 0 && (
                            <div className="rounded-2xl border border-light-border bg-light-card overflow-hidden dark:border-dark-border dark:bg-dark-card">
                                <div className="px-5 py-3 border-b border-light-border dark:border-dark-border">
                                    <p className="font-semibold text-light-text dark:text-dark-text">
                                        <i className="fas fa-table text-brand-primary mr-2" />
                                        الأداء الفعلي مقابل المتوقع
                                    </p>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-light-bg dark:bg-dark-bg">
                                                <th className="px-5 py-2.5 text-right text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">المؤشر</th>
                                                <th className="px-5 py-2.5 text-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">المتوقع</th>
                                                <th className="px-5 py-2.5 text-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">الفعلي</th>
                                                <th className="px-5 py-2.5 text-center text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {kpis.map((kpi, i) => {
                                                const statusIcon = kpi.status === 'exceeded' ? '🚀' : kpi.status === 'on_target' ? '✅' : '⚠️';
                                                const statusColor = kpi.status === 'exceeded' ? 'text-green-600' : kpi.status === 'on_target' ? 'text-green-500' : 'text-orange-500';
                                                return (
                                                    <tr key={i} className="border-t border-light-border dark:border-dark-border">
                                                        <td className="px-5 py-3 font-medium text-light-text dark:text-dark-text">{kpi.metric}</td>
                                                        <td className="px-5 py-3 text-center text-light-text-secondary dark:text-dark-text-secondary">{kpi.predicted.toLocaleString()} {kpi.unit}</td>
                                                        <td className="px-5 py-3 text-center font-semibold text-light-text dark:text-dark-text">{kpi.actual.toLocaleString()} {kpi.unit}</td>
                                                        <td className={`px-5 py-3 text-center text-xs font-semibold ${statusColor}`}>
                                                            {statusIcon} {kpi.status === 'exceeded' ? 'تجاوز' : kpi.status === 'on_target' ? 'على الهدف' : 'أقل من المتوقع'}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* AI Learnings */}
                        {learnings.length > 0 && (
                            <div className="rounded-2xl border border-light-border bg-light-card p-5 dark:border-dark-border dark:bg-dark-card">
                                <p className="mb-3 font-semibold text-light-text dark:text-dark-text">
                                    <i className="fas fa-brain text-brand-primary mr-2" />
                                    التعلمات الذكية
                                </p>
                                <div className="space-y-2">
                                    {learnings.map((l, i) => {
                                        const icon = l.type === 'success' ? 'fa-check-circle text-green-500' : l.type === 'weakness' ? 'fa-exclamation-triangle text-orange-500' : 'fa-arrow-trend-up text-blue-500';
                                        const bg = l.type === 'success' ? 'bg-green-50 dark:bg-green-900/20' : l.type === 'weakness' ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
                                        return (
                                            <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${bg}`}>
                                                <i className={`fas ${icon} mt-0.5 shrink-0`} />
                                                <p className="text-sm text-light-text dark:text-dark-text">{l.text}</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveLearnings}
                                disabled={savingLearnings || learnings.length === 0}
                                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text hover:bg-light-bg dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-bg disabled:opacity-50"
                            >
                                {savingLearnings ? <Spinner /> : <i className="fas fa-brain" />}
                                حفظ في ذاكرة البراند
                            </button>
                            <button
                                onClick={handleViewRecommendations}
                                disabled={aiLoading}
                                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary-glow disabled:opacity-50"
                            >
                                {aiLoading ? <Spinner /> : <i className="fas fa-wand-magic-sparkles" />}
                                عرض التوصيات
                            </button>
                        </div>
                    </div>
                ) : null}
            </div>
        );
    }

    // ── Screen 14: AI Recommendations ─────────────────────────────────────────
    function renderRecommendationsScreen() {
        const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
            high:   { label: 'عالي',   color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30' },
            medium: { label: 'متوسط',  color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' },
            low:    { label: 'منخفض',  color: 'text-blue-500',   bg: 'bg-blue-100 dark:bg-blue-900/30' },
        };

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-3">
                    <button onClick={() => setScreen('performance')} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                        <i className="fas fa-arrow-right" />
                    </button>
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">
                            <i className="fas fa-lightbulb text-brand-primary mr-2" />
                            توصيات الـ AI
                        </h2>
                        <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            بناءً على أداء حملة {activeCampaign?.name}
                        </p>
                    </div>
                </div>

                {aiLoading ? (
                    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 rounded-2xl border border-light-border bg-light-card p-8 dark:border-dark-border dark:bg-dark-card">
                        <i className="fas fa-lightbulb fa-beat-fade text-3xl text-brand-primary" />
                        <p className="text-sm font-medium text-light-text dark:text-dark-text">{aiLoadingText}</p>
                    </div>
                ) : (
                    <div className="space-y-5">
                        {/* Health + Memory summary */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card text-center">
                                <p className={`text-3xl font-black ${scoreColor(campaignHealthScore)}`}>{campaignHealthScore}</p>
                                <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">Campaign Health</p>
                            </div>
                            <div className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card text-center">
                                <p className="text-3xl font-black text-brand-primary">{learningsCount}</p>
                                <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                    <i className="fas fa-brain mr-1" />
                                    تعلّمات في الذاكرة
                                </p>
                            </div>
                        </div>

                        {/* Apply all high priority */}
                        {recommendations.some(r => r.priority === 'high') && (
                            <button
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400"
                                onClick={() => setRecommendations(prev => prev.filter(r => r.priority !== 'high'))}
                            >
                                <i className="fas fa-bolt" />
                                تطبيق كل التوصيات ذات الأولوية العالية ({recommendations.filter(r => r.priority === 'high').length})
                            </button>
                        )}

                        {/* Recommendations list */}
                        {recommendations.length > 0 ? (
                            <div className="space-y-3">
                                {recommendations.map((rec, i) => {
                                    const pc = priorityConfig[rec.priority] ?? priorityConfig.low;
                                    return (
                                        <div key={i} className="rounded-2xl border border-light-border bg-light-card p-4 dark:border-dark-border dark:bg-dark-card">
                                            <div className="flex items-start gap-3">
                                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${pc.bg} ${pc.color}`}>
                                                    {pc.label}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-light-text dark:text-dark-text">{rec.title}</p>
                                                    <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">{rec.reason}</p>
                                                    <div className="mt-2 flex items-center gap-2">
                                                        <i className="fas fa-arrow-left text-xs text-brand-primary" />
                                                        <p className="text-xs font-medium text-brand-primary">{rec.action}</p>
                                                    </div>
                                                </div>
                                                <div className="shrink-0 text-right">
                                                    <span className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{rec.confidence}%</span>
                                                    <p className="text-[9px] text-light-text-secondary dark:text-dark-text-secondary">ثقة</p>
                                                </div>
                                            </div>
                                            <div className="mt-3 flex justify-end gap-2">
                                                <button
                                                    onClick={() => handleSkipRecommendation(i)}
                                                    className="rounded-lg px-3 py-1.5 text-xs text-light-text-secondary hover:bg-light-bg dark:text-dark-text-secondary dark:hover:bg-dark-bg"
                                                >
                                                    تخطي
                                                </button>
                                                <button
                                                    onClick={() => handleSkipRecommendation(i)}
                                                    className="rounded-lg bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary hover:bg-brand-primary/20"
                                                >
                                                    <i className="fas fa-check mr-1" />
                                                    تطبيق
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-light-border bg-light-card p-10 dark:border-dark-border dark:bg-dark-card text-center">
                                <i className="fas fa-check-circle text-3xl text-green-500" />
                                <p className="font-semibold text-light-text dark:text-dark-text">تم تطبيق جميع التوصيات</p>
                            </div>
                        )}

                        {/* Plan next campaign */}
                        <button
                            onClick={() => {
                                setCampaignName(''); setGoalTitle(''); setGoalTarget('');
                                setGoalType('awareness'); setSelectedPlatforms(['instagram', 'facebook']);
                                setGoalDuration(30); setKpis([]); setRealityCheck(null);
                                setPerformanceAnalysis(null); setRecommendations([]);
                                setScreen('goal-builder');
                            }}
                            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 py-3 font-semibold text-white shadow-primary-glow"
                        >
                            <i className="fas fa-brain" />
                            خطط للحملة القادمة
                            <i className="fas fa-chevron-left text-xs" />
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-light-bg dark:bg-dark-bg">
            <div className="mx-auto max-w-4xl px-4 py-6">
                {screen === 'campaigns-list'    && renderCampaignsList()}
                {screen === 'goal-builder'      && renderGoalBuilder()}
                {screen === 'strategy-generator' && renderStrategyGenerator()}
                {screen === 'content-calendar'  && renderContentCalendar()}
                {screen === 'item-workspace'    && renderItemWorkspace()}
                {screen === 'performance'       && renderPerformanceScreen()}
                {screen === 'recommendations'   && renderRecommendationsScreen()}
            </div>

            {/* Regeneration Dialog */}
            {showRegenDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md rounded-2xl border border-light-border bg-light-card p-6 shadow-xl dark:border-dark-border dark:bg-dark-card space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-light-text dark:text-dark-text">
                                <i className="fas fa-rotate-right text-brand-primary mr-2" />
                                إعادة توليد الاستراتيجية
                            </p>
                            <button onClick={() => setShowRegenDialog(false)} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500">
                                <i className="fas fa-xmark" />
                            </button>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1.5">
                                ما الذي تريد تغييره؟ (اختياري)
                            </label>
                            <textarea
                                value={regenReason}
                                onChange={e => setRegenReason(e.target.value)}
                                placeholder="مثال: أريد استراتيجية أكثر تركيزاً على المحتوى التعليمي، أو أريد تقليل التركيز على TikTok..."
                                rows={3}
                                className="w-full resize-none rounded-xl border border-light-border bg-light-bg px-4 py-3 text-sm text-light-text placeholder-light-text-secondary focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:placeholder-dark-text-secondary"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowRegenDialog(false)} className="flex-1 rounded-xl border border-light-border px-4 py-2.5 text-sm text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                                إلغاء
                            </button>
                            <button
                                onClick={() => { setShowRegenDialog(false); setRegenReason(''); handleBuildStrategy(); }}
                                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white"
                            >
                                <i className="fas fa-wand-magic-sparkles" />
                                إعادة التوليد
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Preview Full Post Modal */}
            {showPreviewModal && activeItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm rounded-2xl border border-light-border bg-light-card p-6 shadow-xl dark:border-dark-border dark:bg-dark-card space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold text-light-text dark:text-dark-text">
                                <i className="fas fa-eye text-brand-primary mr-2" />
                                معاينة المنشور
                            </p>
                            <button onClick={() => setShowPreviewModal(false)} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-red-500">
                                <i className="fas fa-xmark" />
                            </button>
                        </div>
                        {/* Simulated social card */}
                        <div className="rounded-xl border border-light-border bg-white dark:bg-dark-bg overflow-hidden">
                            <div className="flex items-center gap-2 p-3 border-b border-light-border dark:border-dark-border">
                                <div className="h-8 w-8 rounded-full bg-brand-primary/20 flex items-center justify-center">
                                    <i className="fas fa-user text-brand-primary text-xs" />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold text-light-text dark:text-dark-text">{brandProfile.brandName}</p>
                                    <p className="text-[10px] text-light-text-secondary dark:text-dark-text-secondary capitalize">{activeItem.platform}</p>
                                </div>
                                <i className={`fab ${PLATFORM_ICONS[activeItem.platform] ?? 'fa-globe'} ml-auto text-light-text-secondary dark:text-dark-text-secondary`} />
                            </div>
                            {selectedImageUrl && (
                                <img src={selectedImageUrl} alt="post" className="w-full aspect-square object-cover" />
                            )}
                            <div className="p-3 space-y-1">
                                {captionVersions[selectedCaptionIdx] && (
                                    <>
                                        <p className="text-xs font-semibold text-light-text dark:text-dark-text">{captionVersions[selectedCaptionIdx].headline}</p>
                                        <p className="text-xs text-light-text dark:text-dark-text line-clamp-4">{captionVersions[selectedCaptionIdx].caption}</p>
                                        <p className="text-xs text-brand-primary">{captionVersions[selectedCaptionIdx].hashtags.slice(0, 5).join(' ')}</p>
                                    </>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setShowPreviewModal(false)} className="w-full rounded-xl border border-light-border px-4 py-2 text-sm text-light-text-secondary hover:bg-light-bg dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                            إغلاق
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
