import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Publisher } from '../Publisher';
import { ScheduledPost, NotificationType, BrandHubProfile, PublisherBrief } from '../../types';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import { useLanguage } from '../../context/LanguageContext';
import { getContentBriefs } from '../../services/competitiveIntelService';

interface PublisherPageProps {
    addNotification: (type: NotificationType, message: string) => void;
    onSavePost: (post: Omit<ScheduledPost, 'id'>) => void;
    onUpdatePost: (postId: string, updates: Partial<Omit<ScheduledPost, 'id'>>) => void;
    postToEdit?: ScheduledPost | null;
    onPostEdited?: () => void;
    brandProfile: BrandHubProfile;
    brandId?: string;
    publisherBrief?: PublisherBrief | null;
    onLoadBrief: (brief: PublisherBrief) => void;
    onGenerateFromBrief: (brief: PublisherBrief) => void;
}

export const PublisherPage: React.FC<PublisherPageProps> = (props) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [savedBriefs, setSavedBriefs] = useState<PublisherBrief[]>([]);
    const [isLoadingBriefs, setIsLoadingBriefs] = useState(false);

    const copy = {
        kicker: ar ? 'النشر والتوزيع' : 'Publishing & Distribution',
        title: ar ? 'مساحة النشر الذكية متعددة المنصات' : 'Smart multi-platform publishing workspace',
        description: ar
            ? 'اكتب الرسالة مرة واحدة، ثم حضّرها لكل منصة مع brief محفوظ، معاينة مباشرة، وقرارات نشر أسرع.'
            : 'Draft once, then prepare the post for each channel with saved briefs, live preview, and faster publishing decisions.',
        workflowTitle: ar ? 'كيف تتحرك داخل المساحة' : 'How this workspace flows',
        workflowDescription: ar
            ? 'ابدأ من brief محفوظ أو من مسودة جديدة، ثم حرّك المحتوى من الصياغة إلى المعاينة والنشر من نفس الصفحة.'
            : 'Start from a saved brief or a new draft, then move from composition to preview and publishing without leaving the page.',
        stepOneTitle: ar ? 'اختر brief أو ابدأ جديدًا' : 'Pick a brief or start fresh',
        stepOneDescription: ar
            ? 'استفد من brief محفوظ لتسريع كتابة المنشور أو افتح مساحة نظيفة لبدء فكرة جديدة.'
            : 'Reuse a saved brief to accelerate drafting, or open a clean workspace for a new idea.',
        stepTwoTitle: ar ? 'ركّب الرسالة والوسائط' : 'Shape the message and media',
        stepTwoDescription: ar
            ? 'راجع زاوية البراند، أضف الوسائط، ثم اضبط النص بما يناسب القنوات المستهدفة.'
            : 'Review the brand angle, add media, then tailor the message for the selected channels.',
        stepThreeTitle: ar ? 'عاين ثم انشر' : 'Preview then publish',
        stepThreeDescription: ar
            ? 'تحقق من الجاهزية والتوافق مع المنصات، ثم انشر فورًا أو جدوله من نفس المساحة.'
            : 'Check readiness and channel fit, then publish immediately or schedule from the same surface.',
        contextTitle: ar ? 'سياق البراند' : 'Brand context',
        contextDescription: ar
            ? 'هذه الإشارات يجب أن تبقى حاضرة في أي منشور يخرج من مساحة النشر.'
            : 'These are the signals every post should stay aligned with while inside the publishing workspace.',
        modeLabel: ar ? 'الوضع' : 'Mode',
        editMode: ar ? 'تعديل منشور' : 'Editing post',
        newPost: ar ? 'منشور جديد' : 'New post',
        brandLabel: ar ? 'البراند' : 'Brand',
        keywordsLabel: ar ? 'كلمات الصوت' : 'Voice keywords',
        briefLabel: ar ? 'الـ Brief الحالي' : 'Current brief',
        connectedBrief: ar ? 'مرتبط' : 'Attached',
        noBrief: ar ? 'بدون brief' : 'No brief',
        libraryTitle: ar ? 'Saved Briefs' : 'Saved briefs',
        libraryDescription: ar
            ? 'كل brief محفوظ يمكن فتحه كسياق داخل الناشر أو تحويله فورًا إلى مسودة جديدة.'
            : 'Every saved brief can be loaded as context or turned directly into a new draft.',
        refresh: ar ? 'تحديث القائمة' : 'Refresh library',
        loadBrief: ar ? 'فتح الـ brief' : 'Load brief',
        generateDraft: ar ? 'توليد مسودة' : 'Generate draft',
        activeBrief: ar ? 'الـ brief النشط' : 'Active brief',
        noBriefs: ar ? 'لا توجد briefs محفوظة بعد. احفظ brief من Social Search أو Content Ops لتظهر هنا.' : 'No saved briefs yet. Save one from Social Search or Content Ops and it will appear here.',
        loadingBriefs: ar ? 'جارٍ تحميل الـ briefs...' : 'Loading saved briefs...',
        sourceSocial: ar ? 'من Social Search' : 'From Social Search',
        sourceContent: ar ? 'من Content Ops' : 'From Content Ops',
        objective: ar ? 'الهدف' : 'Objective',
        angle: ar ? 'الزاوية' : 'Angle',
        keywords: ar ? 'الكلمات المفتاحية' : 'Keywords',
        suggestedChannels: ar ? 'القنوات المقترحة' : 'Suggested channels',
        voiceTitle: ar ? 'نبرة البراند' : 'Brand voice',
        voiceFallback: ar ? 'غير محددة بعد' : 'Not defined yet',
        audienceTitle: ar ? 'الجمهور الأساسي' : 'Primary audience',
        audienceFallback: ar ? 'غير محدد' : 'Not set',
        valuesTitle: ar ? 'عناصر التوجيه' : 'Guiding values',
        valuesFallback: ar ? 'أضف قيم البراند لتقوية التوجيه.' : 'Add brand values to strengthen guidance.',
    };

    const workflowSteps = [
        { title: copy.stepOneTitle, description: copy.stepOneDescription },
        { title: copy.stepTwoTitle, description: copy.stepTwoDescription },
        { title: copy.stepThreeTitle, description: copy.stepThreeDescription },
    ];

    const loadBriefs = useCallback(async () => {
        if (!props.brandId) {
            setSavedBriefs([]);
            return;
        }

        setIsLoadingBriefs(true);
        try {
            const briefs = await getContentBriefs(props.brandId);
            setSavedBriefs(briefs);
        } finally {
            setIsLoadingBriefs(false);
        }
    }, [props.brandId]);

    useEffect(() => {
        void loadBriefs();
    }, [loadBriefs]);

    const primaryAudience = props.brandProfile.brandAudiences[0]?.personaName || copy.audienceFallback;
    const toneSummary = props.brandProfile.brandVoice.toneDescription.slice(0, 2).join(' • ') || copy.voiceFallback;
    const guidingValues = props.brandProfile.values.slice(0, 3);

    const stats = useMemo(() => ([
        {
            label: copy.modeLabel,
            value: props.postToEdit ? copy.editMode : copy.newPost,
            tone: 'text-brand-primary',
        },
        {
            label: copy.brandLabel,
            value: props.brandProfile.brandName || '—',
        },
        {
            label: copy.keywordsLabel,
            value: `${props.brandProfile.brandVoice.keywords.length}`,
        },
        {
            label: copy.briefLabel,
            value: props.publisherBrief ? copy.connectedBrief : copy.noBrief,
            tone: props.publisherBrief ? 'text-emerald-400' : undefined,
        },
    ]), [copy.briefLabel, copy.brandLabel, copy.connectedBrief, copy.editMode, copy.keywordsLabel, copy.modeLabel, copy.newPost, copy.noBrief, props.brandProfile.brandName, props.brandProfile.brandVoice.keywords.length, props.postToEdit, props.publisherBrief]);

    return (
        <PageScaffold
            kicker={copy.kicker}
            title={copy.title}
            description={copy.description}
            stats={stats}
        >
            <PageSection title={copy.workflowTitle} description={copy.workflowDescription} className="overflow-hidden">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_360px]">
                    <div className="grid gap-3 md:grid-cols-3">
                        {workflowSteps.map((step, index) => (
                            <div key={step.title} className="surface-panel-soft rounded-[1.5rem] p-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary/12 text-sm font-bold text-brand-primary">
                                    {index + 1}
                                </div>
                                <h3 className="mt-4 text-sm font-semibold text-light-text dark:text-dark-text">{step.title}</h3>
                                <p className="mt-2 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">{step.description}</p>
                            </div>
                        ))}
                    </div>

                    <div className="surface-panel-soft rounded-[1.5rem] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">{copy.contextTitle}</p>
                        <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.contextDescription}</p>

                        <div className="mt-4 space-y-3">
                            <div className="rounded-[1.15rem] border border-light-border/80 bg-white/70 px-4 py-3 dark:border-dark-border dark:bg-dark-bg/40">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-light-text-secondary dark:text-dark-text-secondary">{copy.voiceTitle}</p>
                                <p className="mt-2 text-sm font-semibold text-light-text dark:text-dark-text">{toneSummary}</p>
                            </div>
                            <div className="rounded-[1.15rem] border border-light-border/80 bg-white/70 px-4 py-3 dark:border-dark-border dark:bg-dark-bg/40">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-light-text-secondary dark:text-dark-text-secondary">{copy.audienceTitle}</p>
                                <p className="mt-2 text-sm font-semibold text-light-text dark:text-dark-text">{primaryAudience}</p>
                            </div>
                            <div className="rounded-[1.15rem] border border-light-border/80 bg-white/70 px-4 py-3 dark:border-dark-border dark:bg-dark-bg/40">
                                <p className="text-[11px] uppercase tracking-[0.16em] text-light-text-secondary dark:text-dark-text-secondary">{copy.valuesTitle}</p>
                                {guidingValues.length > 0 ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {guidingValues.map((value) => (
                                            <span key={value} className="rounded-full bg-light-bg px-2.5 py-1 text-xs text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                                                {value}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.valuesFallback}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </PageSection>

            <PageSection
                title={copy.libraryTitle}
                description={copy.libraryDescription}
                actions={(
                    <button
                        type="button"
                        onClick={() => void loadBriefs()}
                        className="rounded-xl border border-light-border bg-white px-3 py-2 text-sm font-medium text-light-text transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:border-brand-primary"
                    >
                        <i className="fas fa-rotate-right me-2" />
                        {copy.refresh}
                    </button>
                )}
            >
                {isLoadingBriefs ? (
                    <div className="surface-panel-soft rounded-[1.5rem] p-5 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {copy.loadingBriefs}
                    </div>
                ) : savedBriefs.length === 0 ? (
                    <div className="surface-panel-soft rounded-[1.5rem] p-5 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                        {copy.noBriefs}
                    </div>
                ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                        {savedBriefs.map((brief) => {
                            const isActive = props.publisherBrief?.id === brief.id;
                            const sourceLabel = brief.source === 'social-search' ? copy.sourceSocial : copy.sourceContent;

                            return (
                                <div
                                    key={brief.id}
                                    className={`rounded-[1.6rem] border p-5 transition-all ${
                                        isActive
                                            ? 'border-brand-primary/40 bg-brand-primary/8 shadow-[0_24px_80px_-45px_rgba(87,92,255,0.55)]'
                                            : 'border-light-border bg-white/90 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.2)] dark:border-dark-border dark:bg-dark-card/85'
                                    }`}
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="rounded-full bg-light-bg px-2.5 py-1 text-[11px] font-semibold text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                                                    {sourceLabel}
                                                </span>
                                                {isActive && (
                                                    <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11px] font-semibold text-emerald-500">
                                                        {copy.activeBrief}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="mt-3 text-lg font-semibold text-light-text dark:text-dark-text">{brief.title}</h3>
                                            <p className="mt-2 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">{brief.angle}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                        <div className="rounded-[1rem] bg-light-bg/80 px-3 py-3 dark:bg-dark-bg/60">
                                            <p className="text-[11px] uppercase tracking-[0.16em] text-light-text-secondary dark:text-dark-text-secondary">{copy.objective}</p>
                                            <p className="mt-2 text-sm font-medium text-light-text dark:text-dark-text">{brief.objective}</p>
                                        </div>
                                        <div className="rounded-[1rem] bg-light-bg/80 px-3 py-3 dark:bg-dark-bg/60">
                                            <p className="text-[11px] uppercase tracking-[0.16em] text-light-text-secondary dark:text-dark-text-secondary">{copy.suggestedChannels}</p>
                                            <p className="mt-2 text-sm font-medium text-light-text dark:text-dark-text">{brief.suggestedPlatforms.join(' • ') || '—'}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {brief.keywords.slice(0, 5).map((keyword) => (
                                            <span key={keyword} className="rounded-full border border-light-border bg-white px-2.5 py-1 text-xs text-light-text-secondary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <button
                                            type="button"
                                            onClick={() => props.onLoadBrief(brief)}
                                            className="rounded-xl border border-light-border bg-white px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-dark-border dark:bg-dark-bg dark:text-dark-text dark:hover:border-brand-primary"
                                        >
                                            {copy.loadBrief}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => props.onGenerateFromBrief(brief)}
                                            className="rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-[0_18px_38px_-26px_rgba(87,92,255,0.95)] transition-colors hover:bg-brand-secondary"
                                        >
                                            {copy.generateDraft}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </PageSection>

            <Publisher {...props} publisherBrief={props.publisherBrief} />
        </PageScaffold>
    );
};
