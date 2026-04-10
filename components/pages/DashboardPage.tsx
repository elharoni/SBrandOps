import React, { useMemo, useState } from 'react';
import { ContextualAIChip } from '../shared/ContextualAIChip';
import {
    AnalyticsData,
    ErrorSeverity,
    InboxConversation,
    OperationalError,
    PLATFORM_ASSETS,
    PostStatus,
    ScheduledPost,
} from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { LightweightLineChart } from '../shared/LightweightCharts';

interface DashboardPageProps {
    analyticsData: AnalyticsData;
    scheduledPosts: ScheduledPost[];
    conversations: InboxConversation[];
    errors: OperationalError[];
    onEditPost: (post: ScheduledPost) => void;
    onDeletePost?: (id: string) => void;
    userName?: string;
    onNavigate: (page: string) => void;
    hasConnectedAccount: boolean;
    hasBrandProfile: boolean;
    hasLinkedAds: boolean;
}

const Panel: React.FC<{ title?: string; subtitle?: string; actions?: React.ReactNode; className?: string; children: React.ReactNode }> = ({
    title,
    subtitle,
    actions,
    className = '',
    children,
}) => (
    <section className={`surface-panel rounded-[1.75rem] p-5 md:p-6 ${className}`}>
        {(title || actions) && (
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    {title && <h2 className="text-lg font-semibold text-light-text dark:text-dark-text">{title}</h2>}
                    {subtitle && <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">{subtitle}</p>}
                </div>
                {actions}
            </div>
        )}
        {children}
    </section>
);

const MetricTile: React.FC<{ title: string; value: string; icon: string; trend?: string; positive?: boolean; comparedText?: string }> = ({
    title,
    value,
    icon,
    trend,
    positive,
    comparedText,
}) => (
    <div className="surface-panel-soft rounded-[1.5rem] p-5 text-start transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-ambient)]">
        <div className="flex items-start justify-between gap-3">
            <div>
                <p className="text-sm font-semibold text-light-text-secondary dark:text-dark-text-secondary">{title}</p>
                <p className="metric-emphasis mt-2 text-3xl font-black tracking-tight text-light-text dark:text-dark-text">{value}</p>
            </div>
            <div className="flex flex-col items-center gap-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                    <i className={`fas ${icon} text-base`} />
                </div>
            </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
            {trend && (
                <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${positive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'}`}>
                    <i className={`fas ${positive ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down'}`} />
                    <span>{trend}</span>
                    {comparedText && <span className="font-medium text-light-text-secondary dark:text-dark-text-secondary">{comparedText}</span>}
                </div>
            )}
            {icon === 'fa-users' && <ContextualAIChip message={positive ? 'نمو ممتاز في المتابعين. الحملة الأخيرة مؤثرة.' : 'تباطؤ ملحوظ. يجب نشر المزيد من الريلز.'} type={positive ? 'insight' : 'warning'} position="bottom" />}
            {icon === 'fa-eye' && <ContextualAIChip message={positive ? 'زيادة قوية في الوصول.' : 'تراجع الوصول العضوي. استخدم إعلانات ممولة للتعويض.'} type={positive ? 'insight' : 'warning'} position="bottom" />}
        </div>
    </div>
);

const ActionTile: React.FC<{ title: string; description: string; icon: string; tone: string; onClick: () => void }> = ({
    title,
    description,
    icon,
    tone,
    onClick,
}) => (
    <button
        onClick={onClick}
        className="surface-panel-soft flex w-full items-start gap-4 rounded-[1.4rem] p-4 text-start transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-primary)] active:scale-[0.98]"
    >
        <div className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white ${tone}`}>
            <i className={`fas ${icon}`} />
        </div>
        <div className="min-w-0">
            <h3 className="text-sm font-bold text-light-text dark:text-dark-text">{title}</h3>
            <p className="mt-1 whitespace-normal text-xs font-medium leading-5 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
        </div>
    </button>
);

const ScheduledPostItem: React.FC<{ post: ScheduledPost; onEdit: () => void; onDelete?: () => void; locale: string; emptyTitleText: string }> = ({
    post,
    onEdit,
    onDelete,
    locale,
    emptyTitleText,
}) => (
    <div className="surface-panel-soft flex items-center justify-between gap-3 rounded-[1.25rem] p-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-light-bg dark:bg-dark-bg">
                {post.media.length > 0 ? (
                    <img src={post.media[0].url} className="h-full w-full object-cover" alt="post media" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-light-text-secondary dark:text-dark-text-secondary">
                        <i className="fas fa-align-left" />
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{post.content || emptyTitleText}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                    {post.platforms.map((platform) => (
                        <span key={platform} className="inline-flex items-center gap-1 rounded-full bg-light-bg px-2 py-1 dark:bg-dark-bg">
                            <i className={`${PLATFORM_ASSETS[platform].icon} ${PLATFORM_ASSETS[platform].textColor}`} />
                            <span>{platform}</span>
                        </span>
                    ))}
                    {post.scheduledAt && (
                        <span>{new Date(post.scheduledAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                </div>
            </div>
        </div>

        <div className="flex items-center gap-1">
            <button
                onClick={onEdit}
                aria-label={locale === 'ar-EG' ? 'تعديل المنشور' : 'Edit post'}
                className="flex h-10 w-10 items-center justify-center rounded-2xl text-light-text-secondary transition-colors hover:bg-light-bg hover:text-brand-primary dark:text-dark-text-secondary dark:hover:bg-dark-bg"
            >
                <i className="fas fa-pen text-xs" />
            </button>
            {onDelete && (
                <button
                    onClick={onDelete}
                    aria-label={locale === 'ar-EG' ? 'حذف المنشور' : 'Delete post'}
                    className="flex h-10 w-10 items-center justify-center rounded-2xl text-light-text-secondary transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:text-dark-text-secondary"
                >
                    <i className="fas fa-trash text-xs" />
                </button>
            )}
        </div>
    </div>
);

const ConversationItem: React.FC<{ conversation: InboxConversation; locale: string }> = ({ conversation, locale }) => (
    <div className="surface-panel-soft flex items-start gap-3 rounded-[1.25rem] p-3">
        <div className="relative shrink-0">
            <img src={conversation.user.avatarUrl} alt={conversation.user.name} className="h-11 w-11 rounded-2xl object-cover" />
            <div className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-light-card text-[9px] text-white dark:border-dark-card ${PLATFORM_ASSETS[conversation.platform].color}`}>
                <i className={PLATFORM_ASSETS[conversation.platform].icon} />
            </div>
        </div>
        <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
                <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">{conversation.user.name}</p>
                <span className="shrink-0 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                    {new Date(conversation.lastMessageTimestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
            <p className={`mt-1 truncate text-xs ${conversation.isRead ? 'text-light-text-secondary dark:text-dark-text-secondary' : 'font-semibold text-light-text dark:text-dark-text'}`}>
                {conversation.messages[conversation.messages.length - 1]?.text}
            </p>
        </div>
    </div>
);

const ErrorItem: React.FC<{ error: OperationalError }> = ({ error }) => {
    const isCritical = error.severity === ErrorSeverity.Critical;
    return (
        <div className={`rounded-[1.25rem] border px-4 py-3 ${isCritical ? 'border-rose-500/30 bg-rose-500/10' : 'border-amber-500/30 bg-amber-500/10'}`}>
            <div className="flex items-start gap-3">
                <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl ${isCritical ? 'bg-rose-500/15 text-rose-500' : 'bg-amber-500/15 text-amber-500'}`}>
                    <i className={`fas ${isCritical ? 'fa-circle-exclamation' : 'fa-triangle-exclamation'}`} />
                </div>
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">{error.title}</p>
                    <p className="mt-1 text-xs leading-5 text-light-text-secondary dark:text-dark-text-secondary">{error.description}</p>
                </div>
            </div>
        </div>
    );
};

export const DashboardPage: React.FC<DashboardPageProps> = ({
    analyticsData,
    scheduledPosts,
    conversations,
    errors,
    onEditPost,
    onDeletePost,
    userName,
    onNavigate,
    hasConnectedAccount,
    hasBrandProfile,
    hasLinkedAds,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const locale = ar ? 'ar-EG' : 'en-US';
    const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');

    const copy = {
        controlRoom: ar ? 'لوحة التشغيل اليومية' : 'Daily control room',
        heroDescription: ar
            ? 'راقب المحتوى والقنوات والتنبيهات من مكان واحد، واتخذ الخطوة التالية بسرعة بدل التنقل بين أدوات متفرقة.'
            : 'Track content, channels, alerts, and next actions from one place instead of bouncing between disconnected tools.',
        greetingMorning: ar ? 'صباح الخير' : 'Good morning',
        greetingAfternoon: ar ? 'مساء الخير' : 'Good afternoon',
        greetingEvening: ar ? 'مساء الخير' : 'Good evening',
        fallbackName: ar ? 'أنت' : 'there',
        newPost: ar ? 'منشور جديد' : 'New post',
        schedule: ar ? 'الجدول' : 'Schedule',
        scheduledToday: ar ? 'مجدول اليوم' : 'Scheduled today',
        unreadInbox: ar ? 'رسائل غير مقروءة' : 'Unread inbox',
        openAlerts: ar ? 'تنبيهات مفتوحة' : 'Open alerts',
        quickActions: ar ? 'إجراءات سريعة' : 'Quick actions',
        quickActionsDesc: ar ? 'اختصارات للمهام الأكثر استخدامًا يوميًا.' : 'Shortcuts for the work that matters most today.',
        scheduleContent: ar ? 'جدولة محتوى' : 'Schedule content',
        scheduleContentDesc: ar ? 'افتح الناشر وأنشئ منشورًا جديدًا أو حدد موعدًا دقيقًا.' : 'Open the publisher and prepare the next post or schedule it precisely.',
        adCampaign: ar ? 'مراجعة الإعلانات' : 'Review ads',
        adCampaignDesc: ar ? 'تابع حملاتك وحدد أين تحتاج الميزانية أو الإبداع إلى تعديل.' : 'Check campaign health and decide where budget or creative needs adjustment.',
        brandCheck: ar ? 'فحص البراند' : 'Brand check',
        brandCheckDesc: ar ? 'راجع الهوية والنبرة والرسائل الأساسية قبل التوسع في التنفيذ.' : 'Review brand identity, tone, and core messages before you scale execution.',
        inboxMessages: ar ? 'صندوق الرسائل' : 'Inbox',
        inboxMessagesDesc: ar ? 'محادثات تحتاج ردًا من الفريق الآن.' : 'conversations need attention now.',
        getStarted: ar ? 'ابدأ تشغيل البراند داخل SBrandOps' : 'Start operating your brand in SBrandOps',
        stepsDone: ar ? 'خطوات مكتملة' : 'steps done',
        onboardingDesc: ar ? 'أكمل الأساسيات مرة واحدة، ثم يتحول النظام إلى مساحة تشغيل يومية واضحة.' : 'Complete the foundation once, then the app becomes a reliable daily operating space.',
        nextStepTitle: ar ? 'الخطوة التالية الموصى بها' : 'Recommended next step',
        nextStepCtaPrefix: ar ? 'ابدأ الآن:' : 'Continue with:',
        followers: ar ? 'إجمالي المتابعين' : 'Total followers',
        reach: ar ? 'الوصول' : 'Reach',
        engagement: ar ? 'التفاعل' : 'Engagement',
        posts: ar ? 'المنشورات' : 'Posts published',
        comparedToLastMonth: ar ? 'مقارنة بالشهر الماضي' : 'vs last month',
        operatorMetrics: ar ? 'مقاييس التشغيل' : 'Operator metrics',
        operatorMetricsDesc: ar ? 'مؤشرات أداء سريعة لقراءة كفاءة الإنفاق والتحويل قبل الدخول للتفاصيل.' : 'Fast performance indicators to evaluate spend efficiency and conversion health before drilling into detail.',
        demoMetricsNote: ar ? 'هذه بيانات توضيحية. اربط Google Ads من صفحة التكاملات للحصول على أرقام فعلية.' : 'This is demo data. Connect Google Ads from Integrations for live numbers.',
        audienceGrowth: ar ? 'نمو الجمهور' : 'Audience growth',
        audienceGrowthDesc: ar ? 'قراءة سريعة لنمو الجمهور عبر القنوات خلال الفترة المحددة.' : 'A fast read on audience growth across channels in the selected period.',
        alerts: ar ? 'تنبيهات تحتاج متابعة' : 'Alerts that need attention',
        alertsDesc: ar ? 'ما يحتاج تدخلًا سريعًا الآن.' : 'What needs intervention right now.',
        viewAll: ar ? 'عرض الكل' : 'View all',
        upcomingPosts: ar ? 'المنشورات القادمة' : 'Upcoming posts',
        upcomingPostsDesc: ar ? 'أقرب المنشورات الموجودة في طابور النشر.' : 'The next posts in your publishing queue.',
        noTitle: ar ? 'بدون عنوان' : 'Untitled post',
        noUpcomingPosts: ar ? 'لا توجد منشورات مجدولة حاليًا.' : 'No scheduled posts right now.',
        latestMessages: ar ? 'آخر الرسائل' : 'Latest messages',
        latestMessagesDesc: ar ? 'محادثات غير مقروءة تحتاج ردًا من الفريق.' : 'Unread conversations that need a team reply.',
        goToInbox: ar ? 'فتح الصندوق' : 'Open inbox',
        inboxEmpty: ar ? 'لا توجد رسائل غير مقروءة حاليًا.' : 'No unread messages right now.',
        stepBrand: ar ? 'إعداد هوية البراند' : 'Set up brand identity',
        stepConnect: ar ? 'ربط قنوات النشر' : 'Connect publishing channels',
        stepPost: ar ? 'إنشاء أول منشور' : 'Create the first post',
        stepAds: ar ? 'ربط الإعلانات' : 'Connect ads account',
        stepBrandDesc: ar ? 'أضف النبرة، القيم، والجمهور المستهدف.' : 'Add tone of voice, values, and target audience.',
        stepConnectDesc: ar ? 'اربط حسابات السوشيال حتى يصبح النشر والتحليلات فعليين.' : 'Connect social accounts so publishing and analytics become live.',
        stepPostDesc: ar ? 'أنشئ أول منشور أو جدوله ليبدأ النظام في جمع الأداء.' : 'Create or schedule the first post so the system starts collecting performance.',
        stepAdsDesc: ar ? 'اربط منصة الإعلانات لتظهر مؤشرات العائد والكفاءة.' : 'Connect ad platforms to unlock efficiency and return metrics.',
        merNote: ar ? 'الإيراد ÷ الإنفاق التسويقي الكلي' : 'Revenue divided by total marketing spend',
        roasNote: ar ? 'إيراد الإعلانات ÷ إنفاق الإعلانات' : 'Ad revenue divided by ad spend',
        cpaNote: ar ? 'تكلفة اكتساب عميل جديد' : 'Cost to acquire one new customer',
        cvrNote: ar ? 'من زائر إلى عميل' : 'From visitor to customer',
        noAlerts: ar ? 'لا توجد تنبيهات جديدة الآن.' : 'No new alerts right now.',
    };

    const upcomingPosts = scheduledPosts
        .filter((post) => post.status === PostStatus.Scheduled && post.scheduledAt && new Date(post.scheduledAt) > new Date())
        .sort((left, right) => new Date(left.scheduledAt!).getTime() - new Date(right.scheduledAt!).getTime())
        .slice(0, 4);

    const hasFirstPost = scheduledPosts.length > 0;
    const onboardingSteps = [
        { id: 'brand', label: copy.stepBrand, description: copy.stepBrandDesc, done: hasBrandProfile, action: () => onNavigate('brand-hub'), icon: 'fa-palette' },
        { id: 'connect', label: copy.stepConnect, description: copy.stepConnectDesc, done: hasConnectedAccount, action: () => onNavigate('social-ops/accounts'), icon: 'fa-link' },
        { id: 'post', label: copy.stepPost, description: copy.stepPostDesc, done: hasFirstPost, action: () => onNavigate('social-ops/publisher'), icon: 'fa-paper-plane' },
        { id: 'ads', label: copy.stepAds, description: copy.stepAdsDesc, done: hasLinkedAds, action: () => onNavigate('integrations'), icon: 'fa-bullhorn' },
    ];
    const onboardingDone = onboardingSteps.filter((step) => step.done).length;
    const showOnboarding = onboardingDone < onboardingSteps.length;
    const onboardingProgress = Math.round((onboardingDone / onboardingSteps.length) * 100);
    const nextOnboardingStep = onboardingSteps.find((step) => !step.done);
    const onboardingGuidance = nextOnboardingStep
        ? {
            title: copy.nextStepTitle,
            cta: `${copy.nextStepCtaPrefix} ${nextOnboardingStep.label}`,
        }
        : null;

    const unreadConversations = conversations.filter((conversation) => !conversation.isRead).slice(0, 4);
    const criticalErrors = errors.filter((error) => error.status === 'New').slice(0, 3);
    const todayScheduledCount = scheduledPosts.filter((post) => {
        if (!post.scheduledAt || post.status !== PostStatus.Scheduled) {
            return false;
        }

        const now = new Date();
        const scheduled = new Date(post.scheduledAt);

        return scheduled.getFullYear() === now.getFullYear()
            && scheduled.getMonth() === now.getMonth()
            && scheduled.getDate() === now.getDate();
    }).length;

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return copy.greetingMorning;
        if (hour < 18) return copy.greetingAfternoon;
        return copy.greetingEvening;
    };

    const processedChartData = useMemo(() => {
        const now = new Date();
        const daysToFilter = timePeriod === '7d' ? 7 : timePeriod === '90d' ? 90 : 30;
        const startDate = new Date(now.getTime() - daysToFilter * 24 * 60 * 60 * 1000);

        return analyticsData.followerGrowth
            .filter((item) => new Date(item.date) >= startDate)
            .map((item) => {
                const total = Object.keys(item)
                    .filter((key) => key !== 'date')
                    .reduce((sum, key) => sum + (item[key] || 0), 0);

                return { ...item, Total: total };
            });
    }, [analyticsData.followerGrowth, timePeriod]);

    const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    const operatorMetrics = [
        {
            label: 'MER',
            sublabel: ar ? 'كفاءة التسويق الكلي' : 'Marketing Efficiency Ratio',
            value: '3.2x',
            trend: '+0.4x',
            positive: true,
            icon: 'fa-chart-line',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            note: copy.merNote,
        },
        {
            label: 'ROAS',
            sublabel: ar ? 'عائد إنفاق الإعلانات' : 'Return on Ad Spend',
            value: '4.8x',
            trend: '-0.2x',
            positive: false,
            icon: 'fa-dollar-sign',
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            note: copy.roasNote,
        },
        {
            label: 'CPA',
            sublabel: ar ? 'تكلفة اكتساب العميل' : 'Cost Per Acquisition',
            value: ar ? '٤٢ ج' : '$42',
            trend: '-8%',
            positive: true,
            icon: 'fa-user-plus',
            color: 'text-violet-500',
            bg: 'bg-violet-500/10',
            note: copy.cpaNote,
        },
        {
            label: 'CVR',
            sublabel: ar ? 'معدل التحويل' : 'Conversion Rate',
            value: '3.7%',
            trend: '+0.5%',
            positive: true,
            icon: 'fa-funnel-dollar',
            color: 'text-amber-500',
            bg: 'bg-amber-500/10',
            note: copy.cvrNote,
        },
    ];

    return (
        <div className="animate-fade-in space-y-6">
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <Panel className="surface-panel rounded-[2rem] bg-gradient-to-br from-brand-primary/5 via-transparent to-brand-secondary/5 font-sans !border-0 shadow-[var(--shadow-primary)]">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-2xl">
                            <p className="section-kicker">{copy.controlRoom}</p>
                            <h1 className="metric-emphasis mt-3 text-3xl font-bold text-light-text dark:text-dark-text md:text-4xl">
                                {getGreeting()}، <span className="text-brand-primary">{userName || copy.fallbackName}</span>
                            </h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                                {copy.heroDescription}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={() => onNavigate('social-ops/publisher')}
                                className="btn rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-primary)]"
                            >
                                <i className="fas fa-plus text-xs" />
                                <span>{copy.newPost}</span>
                            </button>
                            <button
                                onClick={() => onNavigate('social-ops/scheduled')}
                                className="btn rounded-2xl border-none bg-light-card/80 px-5 py-3 text-sm font-semibold text-light-text shadow-[var(--shadow-ambient)] dark:bg-dark-card/80 dark:text-dark-text"
                            >
                                <i className="fas fa-calendar-check text-xs" />
                                <span>{copy.schedule}</span>
                            </button>
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 sm:grid-cols-3">
                        {[
                            { label: copy.scheduledToday, value: todayScheduledCount, icon: 'fa-calendar-day', tone: 'text-brand-primary' },
                            { label: copy.unreadInbox, value: unreadConversations.length, icon: 'fa-inbox', tone: 'text-amber-500' },
                            { label: copy.openAlerts, value: criticalErrors.length, icon: 'fa-triangle-exclamation', tone: 'text-rose-500' },
                        ].map((item) => (
                            <div key={item.label} className="surface-panel-soft rounded-[1.4rem] px-4 py-4">
                                <div className="flex items-center gap-3">
                                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-light-bg dark:bg-dark-bg ${item.tone}`}>
                                        <i className={`fas ${item.icon}`} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{item.label}</p>
                                        <p className="text-2xl font-bold text-light-text dark:text-dark-text">{item.value}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                <Panel title={copy.quickActions} subtitle={copy.quickActionsDesc}>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                        <ActionTile
                            title={copy.scheduleContent}
                            description={copy.scheduleContentDesc}
                            icon="fa-calendar-plus"
                            tone="bg-gradient-to-br from-blue-500 to-blue-600"
                            onClick={() => onNavigate('social-ops/publisher')}
                        />
                        <ActionTile
                            title={copy.adCampaign}
                            description={copy.adCampaignDesc}
                            icon="fa-bullhorn"
                            tone="bg-gradient-to-br from-fuchsia-500 to-rose-600"
                            onClick={() => onNavigate('ads-ops')}
                        />
                        <ActionTile
                            title={copy.brandCheck}
                            description={copy.brandCheckDesc}
                            icon="fa-stethoscope"
                            tone="bg-gradient-to-br from-violet-500 to-indigo-600"
                            onClick={() => onNavigate('brand-analysis')}
                        />
                        <ActionTile
                            title={copy.inboxMessages}
                            description={`${unreadConversations.length} ${copy.inboxMessagesDesc}`}
                            icon="fa-inbox"
                            tone="bg-gradient-to-br from-orange-400 to-red-500"
                            onClick={() => onNavigate('inbox')}
                        />
                    </div>
                </Panel>
            </div>

            {showOnboarding && (
                <div className="surface-panel rounded-[1.75rem] border-0 bg-gradient-to-r from-brand-primary/10 to-transparent p-6 shadow-[var(--shadow-ambient)]">
                    <div className="mb-4 flex items-start justify-between gap-4">
                        <div>
                            <h2 className="flex items-center gap-2 text-base font-bold text-light-text dark:text-dark-text">
                                <i className="fas fa-rocket text-brand-primary" />
                                {copy.getStarted}
                            </h2>
                            <p className="mt-0.5 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? `${onboardingDone} من ${onboardingSteps.length} ${copy.stepsDone}` : `${onboardingDone} of ${onboardingSteps.length} ${copy.stepsDone}`}
                            </p>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-bold text-brand-primary">{onboardingProgress}%</span>
                        </div>
                    </div>

                    <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500" style={{ width: `${onboardingProgress}%` }} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {onboardingSteps.map((step) => (
                            <button
                                key={step.id}
                                onClick={step.done ? undefined : step.action}
                                className={`flex items-center gap-3 rounded-2xl border p-3 text-start transition-all ${step.done
                                    ? 'cursor-default border-emerald-500/30 bg-emerald-500/5'
                                    : 'cursor-pointer border-light-border hover:border-brand-primary hover:bg-brand-primary/5 dark:border-dark-border'}`}
                            >
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${step.done ? 'bg-emerald-500 text-white' : 'bg-light-bg text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary'}`}>
                                    <i className={`fas ${step.done ? 'fa-check' : step.icon} text-xs`} />
                                </div>
                                <div>
                                    <p className={`text-xs font-semibold leading-snug ${step.done ? 'text-emerald-600 line-through dark:text-emerald-400' : 'text-light-text dark:text-dark-text'}`}>
                                        {step.label}
                                    </p>
                                    {!step.done && (
                                        <p className="mt-1 text-[11px] leading-5 text-light-text-secondary dark:text-dark-text-secondary">{step.description}</p>
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>

                    {onboardingGuidance && (
                        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-primary/15 bg-white/70 p-4 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-primary">{onboardingGuidance.title}</p>
                                <p className="mt-2 text-sm text-light-text-secondary dark:text-dark-text-secondary">{copy.onboardingDesc}</p>
                            </div>
                            <button
                                onClick={() => nextOnboardingStep?.action()}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary-glow"
                            >
                                <i className={`fas ${nextOnboardingStep?.icon || 'fa-arrow-right'}`} />
                                <span>{onboardingGuidance.cta}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricTile title={copy.followers} value={formatter.format(analyticsData.overallStats.totalFollowers)} icon="fa-users" trend="12%" positive comparedText={copy.comparedToLastMonth} />
                <MetricTile title={copy.reach} value={formatter.format(analyticsData.overallStats.impressions)} icon="fa-eye" trend="5.3%" positive comparedText={copy.comparedToLastMonth} />
                <MetricTile title={copy.engagement} value={formatter.format(analyticsData.overallStats.engagement)} icon="fa-heart" trend="2.1%" positive={false} comparedText={copy.comparedToLastMonth} />
                <MetricTile title={copy.posts} value={formatter.format(analyticsData.overallStats.postsPublished)} icon="fa-paper-plane" trend="8%" positive comparedText={copy.comparedToLastMonth} />
            </div>

            <Panel title={copy.operatorMetrics} subtitle={copy.operatorMetricsDesc}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {operatorMetrics.map((metric) => (
                        <div key={metric.label} className="surface-panel-soft rounded-[1.5rem] p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-0.5 flex items-center gap-1.5">
                                        <span className="text-lg font-black text-light-text dark:text-dark-text">{metric.label}</span>
                                    </div>
                                    <p className="truncate text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{metric.sublabel}</p>
                                </div>
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${metric.bg} ${metric.color}`}>
                                    <i className={`fas ${metric.icon} text-sm`} />
                                </div>
                            </div>
                            <div className="mt-3 flex items-end justify-between gap-2">
                                <span className="text-2xl font-bold text-light-text dark:text-dark-text">{metric.value}</span>
                                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${metric.positive ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'bg-rose-500/10 text-rose-600 dark:text-rose-300'}`}>
                                    {metric.trend}
                                </span>
                            </div>
                            <p className="mt-2 text-[10px] text-light-text-secondary dark:text-dark-text-secondary">{metric.note}</p>
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <i className="fas fa-triangle-exclamation text-[10px]" />
                        {copy.demoMetricsNote}
                    </p>
                    <button
                        onClick={() => onNavigate('integrations')}
                        className="flex-shrink-0 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-500/25 dark:text-amber-400 transition-colors"
                    >
                        {ar ? 'وصّل الإعلانات الآن ←' : 'Connect ads now →'}
                    </button>
                </div>
            </Panel>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
                <Panel
                    title={copy.audienceGrowth}
                    subtitle={copy.audienceGrowthDesc}
                    actions={(
                        <div className="flex rounded-2xl bg-light-bg p-1 dark:bg-dark-bg">
                            {(['7d', '30d', '90d'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setTimePeriod(period)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${timePeriod === period
                                        ? 'bg-light-card text-brand-primary shadow-sm dark:bg-dark-card'
                                        : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    )}
                >
                    <div className="h-[320px]">
                        <LightweightLineChart
                            data={processedChartData}
                            xKey="date"
                            series={[
                                {
                                    key: 'Total',
                                    label: ar ? 'إجمالي النمو' : 'Total growth',
                                    color: '#2563eb',
                                },
                            ]}
                            height={320}
                            formatX={(value) => {
                                const date = new Date(String(value));
                                return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
                            }}
                        />
                    </div>
                </Panel>

                <div className="space-y-6">
                    <Panel
                        title={copy.alerts}
                        subtitle={copy.alertsDesc}
                        actions={(
                            <button
                                onClick={() => onNavigate('error-center')}
                                className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-secondary"
                            >
                                {copy.viewAll}
                            </button>
                        )}
                    >
                        <div className="space-y-3">
                            {criticalErrors.length > 0 ? (
                                criticalErrors.map((error) => <ErrorItem key={error.id} error={error} />)
                            ) : (
                                <div className="rounded-[1.25rem] border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                                    {copy.noAlerts}
                                </div>
                            )}
                        </div>
                    </Panel>

                    <Panel
                        title={copy.upcomingPosts}
                        subtitle={copy.upcomingPostsDesc}
                        actions={(
                            <button
                                onClick={() => onNavigate('social-ops/scheduled')}
                                className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-secondary"
                            >
                                {copy.viewAll}
                            </button>
                        )}
                    >
                        <div className="space-y-3">
                            {upcomingPosts.length > 0 ? (
                                upcomingPosts.map((post) => (
                                    <ScheduledPostItem
                                        key={post.id || `${post.content}-${post.scheduledAt ?? 'draft'}`}
                                        post={post}
                                        onEdit={() => onEditPost(post)}
                                        onDelete={onDeletePost && post.id ? () => onDeletePost(post.id!) : undefined}
                                        locale={locale}
                                        emptyTitleText={copy.noTitle}
                                    />
                                ))
                            ) : (
                                <div className="rounded-[1.25rem] border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                                    {copy.noUpcomingPosts}
                                </div>
                            )}
                        </div>
                    </Panel>

                    <Panel
                        title={copy.latestMessages}
                        subtitle={copy.latestMessagesDesc}
                        actions={(
                            <button
                                onClick={() => onNavigate('inbox')}
                                className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-secondary"
                            >
                                {copy.goToInbox}
                            </button>
                        )}
                    >
                        <div className="space-y-3">
                            {unreadConversations.length > 0 ? (
                                unreadConversations.map((conversation) => (
                                    <ConversationItem key={conversation.id} conversation={conversation} locale={locale} />
                                ))
                            ) : (
                                <div className="rounded-[1.25rem] border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                                    {copy.inboxEmpty}
                                </div>
                            )}
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
};
