import React, { useMemo, useState } from 'react';
import { ContextualAIChip } from '../shared/ContextualAIChip';
import {
    AnalyticsData,
    BrandHubProfile,
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
    brandProfile?: BrandHubProfile;
    brandId?: string;
    onSyncAnalytics?: () => Promise<void>;
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

const Panel: React.FC<{
    title?: string;
    subtitle?: string;
    actions?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}> = ({ title, subtitle, actions, className = '', children }) => (
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

const SectionKicker: React.FC<{ icon: string; label: string; accent?: string }> = ({ icon, label, accent = 'text-brand-primary' }) => (
    <div className={`mb-3 flex items-center gap-2 ${accent}`}>
        <i className={`fas ${icon} text-xs`} />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]">{label}</span>
    </div>
);

// ─── Section A: "ماذا يحدث الآن" ────────────────────────────────────────────

interface NowItem {
    id: string;
    icon: string;
    label: string;
    value: number;
    tone: string;
    bg: string;
    nav: string;
    urgency: 'high' | 'medium' | 'low';
}

const NowTile: React.FC<NowItem & { onNavigate: (page: string) => void; ar: boolean }> = ({
    icon, label, value, tone, bg, nav, urgency, onNavigate, ar,
}) => (
    <button
        onClick={() => onNavigate(nav)}
        className={`group flex flex-col gap-3 rounded-[1.4rem] p-4 text-start transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-ambient)] active:scale-[0.98] ${bg} border ${urgency === 'high' ? 'border-rose-500/30' : urgency === 'medium' ? 'border-amber-500/25' : 'border-light-border/40 dark:border-dark-border/40'}`}
    >
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone} bg-white/60 dark:bg-white/10`}>
            <i className={`fas ${icon} text-sm`} />
        </div>
        <div>
            <p className="text-2xl font-black tracking-tight text-light-text dark:text-dark-text">{value}</p>
            <p className="mt-0.5 text-xs font-medium leading-5 text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
        </div>
    </button>
);

// ─── Section B: "ما الذي يجب فعله الآن" ─────────────────────────────────────

interface Priority {
    id: string;
    icon: string;
    title: string;
    description: string;
    tone: string;
    cta: string;
    nav: string;
    badge?: string;
}

const PRIORITY_ICON_BG: Record<string, string> = {
    rose: 'bg-rose-500',
    amber: 'bg-amber-500',
    violet: 'bg-violet-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    fuchsia: 'bg-fuchsia-500',
    cyan: 'bg-cyan-500',
};

const getPriorityIconBg = (tone: string): string => {
    const match = Object.keys(PRIORITY_ICON_BG).find((color) => tone.includes(color));
    return match ? PRIORITY_ICON_BG[match] : 'bg-brand-primary';
};

const PriorityCard: React.FC<Priority & { onNavigate: (page: string) => void }> = ({
    icon, title, description, tone, cta, nav, badge, onNavigate,
}) => (
    <div className={`surface-panel-soft flex items-start gap-4 rounded-[1.4rem] p-4 border ${tone}`}>
        <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white ${getPriorityIconBg(tone)}`}>
            <i className={`fas ${icon} text-sm`} />
        </div>
        <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-light-text dark:text-dark-text">{title}</p>
                {badge && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">{badge}</span>}
            </div>
            <p className="mt-1 text-xs leading-5 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
        </div>
        <button
            onClick={() => onNavigate(nav)}
            className="shrink-0 rounded-xl bg-brand-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white whitespace-nowrap"
        >
            {cta}
        </button>
    </div>
);

// ─── Section C: "ما الذي تعلمناه" ────────────────────────────────────────────

interface Insight {
    icon: string;
    label: string;
    value: string;
    sub: string;
    color: string;
    bg: string;
}

const InsightTile: React.FC<Insight> = ({ icon, label, value, sub, color, bg }) => (
    <div className={`surface-panel-soft rounded-[1.4rem] p-4 ${bg} border border-transparent`}>
        <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${color} bg-white/60 dark:bg-white/10`}>
            <i className={`fas ${icon} text-sm`} />
        </div>
        <p className="text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">{label}</p>
        <p className="mt-1 text-base font-bold leading-snug text-light-text dark:text-dark-text">{value}</p>
        <p className="mt-1 text-[11px] text-light-text-secondary dark:text-dark-text-secondary">{sub}</p>
    </div>
);

// ─── Section D: "ما الذي نقترحه" ─────────────────────────────────────────────

interface Suggestion {
    id: string;
    icon: string;
    title: string;
    reason: string;
    confidence: 'high' | 'medium';
    nav: string;
}

const SuggestionCard: React.FC<Suggestion & { onNavigate: (page: string) => void; ar: boolean }> = ({
    icon, title, reason, confidence, nav, onNavigate, ar,
}) => (
    <div className="surface-panel-soft flex flex-col gap-3 rounded-[1.4rem] p-4">
        <div className="flex items-start justify-between gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-primary/10 text-brand-primary">
                <i className={`fas ${icon} text-sm`} />
            </div>
            <span className={`mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${confidence === 'high' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>
                {confidence === 'high' ? (ar ? 'ثقة عالية' : 'High confidence') : (ar ? 'يستحق المراجعة' : 'Review suggested')}
            </span>
        </div>
        <div>
            <p className="text-sm font-bold text-light-text dark:text-dark-text">{title}</p>
            <p className="mt-1 text-xs leading-5 text-light-text-secondary dark:text-dark-text-secondary">
                <i className="fas fa-circle-info text-[9px] text-brand-primary/60 mr-1" />
                {reason}
            </p>
        </div>
        <button
            onClick={() => onNavigate(nav)}
            className="mt-auto rounded-xl bg-brand-primary/8 px-3 py-2 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white text-center"
        >
            {ar ? 'ابدأ الآن' : 'Start now'} <i className={`fas ${ar ? 'fa-arrow-left' : 'fa-arrow-right'} text-[9px]`} />
        </button>
    </div>
);

// ─── Smaller sub-components ───────────────────────────────────────────────────

const MetricTile: React.FC<{
    title: string; value: string; icon: string; trend?: string;
    positive?: boolean; comparedText?: string;
}> = ({ title, value, icon, trend, positive, comparedText }) => (
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

const ScheduledPostItem: React.FC<{
    post: ScheduledPost; onEdit: () => void; onDelete?: () => void;
    locale: string; emptyTitleText: string;
}> = ({ post, onEdit, onDelete, locale, emptyTitleText }) => (
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
            <button onClick={onEdit} aria-label="Edit" className="flex h-10 w-10 items-center justify-center rounded-2xl text-light-text-secondary transition-colors hover:bg-light-bg hover:text-brand-primary dark:text-dark-text-secondary dark:hover:bg-dark-bg">
                <i className="fas fa-pen text-xs" />
            </button>
            {onDelete && (
                <button onClick={onDelete} aria-label="Delete" className="flex h-10 w-10 items-center justify-center rounded-2xl text-light-text-secondary transition-colors hover:bg-rose-500/10 hover:text-rose-500 dark:text-dark-text-secondary">
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

// ─── Main component ───────────────────────────────────────────────────────────

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
    brandProfile,
    onSyncAnalytics,
}) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const locale = ar ? 'ar-EG' : 'en-US';
    const [timePeriod, setTimePeriod] = useState<'7d' | '30d' | '90d'>('30d');
    const [isSyncing, setIsSyncing] = useState(false);

    const handleSyncAnalytics = async () => {
        if (!onSyncAnalytics || isSyncing) return;
        setIsSyncing(true);
        try {
            await onSyncAnalytics();
        } finally {
            setIsSyncing(false);
        }
    };

    // ── Derived state ────────────────────────────────────────────────────────
    const upcomingPosts = useMemo(() =>
        scheduledPosts
            .filter((p) => p.status === PostStatus.Scheduled && p.scheduledAt && new Date(p.scheduledAt) > new Date())
            .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())
            .slice(0, 4),
    [scheduledPosts]);

    const unreadConversations = useMemo(() =>
        conversations.filter((c) => !c.isRead).slice(0, 4),
    [conversations]);

    const criticalErrors = useMemo(() =>
        errors.filter((e) => e.status === 'New').slice(0, 3),
    [errors]);

    const todayScheduledCount = useMemo(() => {
        const now = new Date();
        return scheduledPosts.filter((p) => {
            if (!p.scheduledAt || p.status !== PostStatus.Scheduled) return false;
            const d = new Date(p.scheduledAt);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
        }).length;
    }, [scheduledPosts]);

    const hasFirstPost = scheduledPosts.length > 0;

    // ── Onboarding ───────────────────────────────────────────────────────────
    const onboardingSteps = [
        { id: 'brand',   done: hasBrandProfile,     action: () => onNavigate('brand-hub'),              icon: 'fa-brain',       label: ar ? 'إعداد هوية البراند'  : 'Set up brand identity'  },
        { id: 'connect', done: hasConnectedAccount,  action: () => onNavigate('social-ops/accounts'),    icon: 'fa-link',        label: ar ? 'ربط قنوات النشر'     : 'Connect channels'        },
        { id: 'post',    done: hasFirstPost,         action: () => onNavigate('social-ops/publisher'),   icon: 'fa-paper-plane', label: ar ? 'إنشاء أول منشور'     : 'Create first post'       },
        { id: 'ads',     done: hasLinkedAds,         action: () => onNavigate('integrations'),           icon: 'fa-bullhorn',    label: ar ? 'ربط الإعلانات'       : 'Connect ads'             },
    ];
    const onboardingDone = onboardingSteps.filter((s) => s.done).length;
    const showOnboarding = onboardingDone < onboardingSteps.length;
    const onboardingProgress = Math.round((onboardingDone / onboardingSteps.length) * 100);
    const nextOnboardingStep = onboardingSteps.find((s) => !s.done);

    // ── Section A — ماذا يحدث الآن ──────────────────────────────────────────
    const nowItems: NowItem[] = [
        {
            id: 'scheduled',
            icon: 'fa-calendar-day',
            label: ar ? 'منشورات مجدولة اليوم' : 'Scheduled today',
            value: todayScheduledCount,
            tone: 'text-brand-primary',
            bg: 'bg-brand-primary/5',
            nav: 'social-ops/scheduled',
            urgency: 'low',
        },
        {
            id: 'unread',
            icon: 'fa-inbox',
            label: ar ? 'رسائل تحتاج رد' : 'Messages need reply',
            value: unreadConversations.length,
            tone: 'text-amber-600',
            bg: 'bg-amber-500/5',
            nav: 'inbox',
            urgency: unreadConversations.length > 5 ? 'high' : 'medium',
        },
        {
            id: 'alerts',
            icon: 'fa-triangle-exclamation',
            label: ar ? 'تنبيهات مفتوحة' : 'Open alerts',
            value: criticalErrors.length,
            tone: 'text-rose-600',
            bg: 'bg-rose-500/5',
            nav: 'error-center',
            urgency: criticalErrors.length > 0 ? 'high' : 'low',
        },
        {
            id: 'queue',
            icon: 'fa-layer-group',
            label: ar ? 'في طابور النشر' : 'In publish queue',
            value: upcomingPosts.length,
            tone: 'text-violet-600',
            bg: 'bg-violet-500/5',
            nav: 'social-ops/scheduled',
            urgency: 'low',
        },
    ];

    // ── Section B — ما الذي يجب فعله الآن ───────────────────────────────────
    const priorities: Priority[] = useMemo(() => {
        const list: Priority[] = [];

        if (criticalErrors.length > 0) {
            list.push({
                id: 'fix-errors',
                icon: 'fa-circle-exclamation',
                title: ar ? `${criticalErrors.length} تنبيه يحتاج تدخلًا` : `${criticalErrors.length} alert${criticalErrors.length > 1 ? 's' : ''} need attention`,
                description: ar ? 'يوجد مشاكل تشغيلية مفتوحة تؤثر على أداء المنصة.' : 'Open operational issues affecting platform performance.',
                tone: 'border-rose-500/25',
                cta: ar ? 'عالج الآن' : 'Fix now',
                nav: 'error-center',
                badge: ar ? 'عاجل' : 'Urgent',
            });
        }

        if (unreadConversations.length > 0) {
            list.push({
                id: 'reply-inbox',
                icon: 'fa-comment-dots',
                title: ar ? `${unreadConversations.length} رسالة بدون رد` : `${unreadConversations.length} unanswered message${unreadConversations.length > 1 ? 's' : ''}`,
                description: ar ? 'الرد السريع يرفع رضا العملاء ومعدل التحويل.' : 'Quick replies boost customer satisfaction and conversion.',
                tone: 'border-amber-500/25',
                cta: ar ? 'ردّ الآن' : 'Reply now',
                nav: 'inbox',
                badge: unreadConversations.length > 3 ? (ar ? 'مهم' : 'Important') : undefined,
            });
        }

        if (!hasBrandProfile) {
            list.push({
                id: 'setup-brand',
                icon: 'fa-brain',
                title: ar ? 'عقل البراند لم يُبنَ بعد' : 'Brand Brain not set up yet',
                description: ar ? 'بدون هوية البراند، لا يستطيع النظام توليد محتوى مناسب أو ردود ذكية.' : 'Without brand identity, the system cannot generate relevant content or smart replies.',
                tone: 'border-violet-500/25',
                cta: ar ? 'ابنِ الآن' : 'Build now',
                nav: 'brand-hub',
            });
        }

        if (todayScheduledCount === 0 && hasConnectedAccount) {
            list.push({
                id: 'create-content',
                icon: 'fa-pen-nib',
                title: ar ? 'لا محتوى مجدول اليوم' : 'No content scheduled today',
                description: ar ? 'الاتساق في النشر يزيد الوصول العضوي على مدار الوقت.' : 'Consistent publishing grows organic reach over time.',
                tone: 'border-blue-500/25',
                cta: ar ? 'أنشئ محتوى' : 'Create content',
                nav: 'content-studio',
            });
        }

        if (!hasConnectedAccount) {
            list.push({
                id: 'connect-channels',
                icon: 'fa-link',
                title: ar ? 'لم تربط قنوات نشر بعد' : 'No publishing channels connected',
                description: ar ? 'ربط الحسابات يُفعّل النشر والتحليلات والردود الذكية.' : 'Connecting accounts enables publishing, analytics, and smart replies.',
                tone: 'border-emerald-500/25',
                cta: ar ? 'اربط الآن' : 'Connect now',
                nav: 'social-ops/accounts',
            });
        }

        if (!hasLinkedAds) {
            list.push({
                id: 'connect-ads',
                icon: 'fa-bullhorn',
                title: ar ? 'بيانات الإعلانات غير مرتبطة' : 'Ad data not connected',
                description: ar ? 'بدون بيانات الإعلانات، مؤشرات ROAS وCPA تبقى تقديرية.' : 'Without ad data, ROAS and CPA indicators remain estimates.',
                tone: 'border-fuchsia-500/25',
                cta: ar ? 'وصّل الآن' : 'Connect now',
                nav: 'integrations',
            });
        }

        return list;
    }, [ar, criticalErrors, unreadConversations, hasBrandProfile, hasConnectedAccount, hasLinkedAds, todayScheduledCount]);

    // ── Section C — ما الذي تعلمناه ─────────────────────────────────────────
    // Thresholds: <1 post = empty state, 1-9 posts = collecting state,
    // 10+ posts = real insights (best platform from actual data; others are industry benchmarks)
    const postsCount = analyticsData.overallStats.postsPublished;
    const hasEnoughData = postsCount >= 10;
    const hasAnyData = postsCount > 0;

    // Compute best platform from actual engagement rate data
    const bestPlatformEntry = analyticsData.engagementRate
        .filter((p) => p.rate > 0)
        .sort((a, b) => b.rate - a.rate)[0];

    const insights: Insight[] = hasEnoughData
        ? [
            {
                icon: 'fa-heart',
                label: ar ? 'أفضل نوع محتوى' : 'Best content type',
                value: ar ? 'فيديو قصير (ريلز)' : 'Short video (Reels)',
                sub: ar ? '٣.٢x تفاعل — متوسط صناعي، يتخصص مع تراكم بياناتك' : '3.2x engagement — industry benchmark, personalizes with your data',
                color: 'text-pink-600',
                bg: 'bg-pink-500/5',
            },
            {
                icon: 'fa-clock',
                label: ar ? 'أفضل وقت للنشر' : 'Best time to post',
                value: ar ? 'الثلاثاء ٧–٩ مساءً' : 'Tuesday 7–9 PM',
                sub: ar ? 'متوسط صناعي — يتحدد بدقة بعد ٣٠ يوم من بياناتك' : 'Industry avg — pinpointed after 30 days of your data',
                color: 'text-blue-600',
                bg: 'bg-blue-500/5',
            },
            bestPlatformEntry
                ? {
                    icon: 'fa-chart-bar',
                    label: ar ? 'أعلى منصة تفاعلًا' : 'Top engagement platform',
                    value: bestPlatformEntry.platform,
                    sub: ar
                        ? `${(bestPlatformEntry.rate * 100).toFixed(1)}% معدل تفاعل — من بياناتك الفعلية`
                        : `${(bestPlatformEntry.rate * 100).toFixed(1)}% engagement rate — from your real data`,
                    color: 'text-violet-600',
                    bg: 'bg-violet-500/5',
                }
                : {
                    icon: 'fa-chart-bar',
                    label: ar ? 'أفضل منصة أداءً' : 'Top performing platform',
                    value: ar ? 'جارٍ التحليل' : 'Analyzing...',
                    sub: ar ? 'يظهر بعد ربط حساباتك الاجتماعية وتراكم التفاعلات' : 'Appears after linking social accounts and accumulating engagement',
                    color: 'text-light-text-secondary',
                    bg: 'bg-light-bg/50',
                },
            {
                icon: 'fa-comment-alt',
                label: ar ? 'أنماط المحادثات' : 'Conversation patterns',
                value: ar ? 'جارٍ التحليل' : 'Analyzing...',
                sub: ar ? 'يستخلص من محادثات الـ Inbox بعد تراكم كافٍ من الردود' : 'Extracted from Inbox conversations as data accumulates',
                color: 'text-amber-600',
                bg: 'bg-amber-500/5',
            },
        ]
        : hasAnyData
        ? [
            {
                icon: 'fa-chart-line',
                label: ar ? 'أنماط المحتوى' : 'Content patterns',
                value: ar ? `${postsCount} ${postsCount === 1 ? 'منشور' : 'منشورات'} حتى الآن` : `${postsCount} post${postsCount !== 1 ? 's' : ''} so far`,
                sub: ar ? `نحتاج ١٠ على الأقل. ${10 - postsCount} متبقٍ لبدء التحليل.` : `Need at least 10. ${10 - postsCount} more to unlock insights.`,
                color: 'text-blue-600',
                bg: 'bg-blue-500/5',
            },
            {
                icon: 'fa-clock',
                label: ar ? 'أفضل وقت للنشر' : 'Best posting time',
                value: ar ? 'جمع البيانات...' : 'Collecting...',
                sub: ar ? 'يحتسب تلقائيًا مع تراكم المنشورات والتفاعلات' : 'Auto-calculated as posts and engagement accumulate',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
            {
                icon: 'fa-comment-dots',
                label: ar ? 'أنماط المحادثات' : 'Conversation patterns',
                value: ar ? 'جمع البيانات...' : 'Collecting...',
                sub: ar ? 'ردّ على عملائك عبر الـ Inbox لتراكم البيانات' : 'Reply to customers via Inbox to build conversation data',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
            {
                icon: 'fa-star',
                label: ar ? 'تقييم مخرجات AI' : 'AI output rating',
                value: ar ? 'لا تقييمات بعد' : 'No ratings yet',
                sub: ar ? 'قيّم المحتوى الذي يولّده النظام حتى يتحسن مع الوقت' : 'Rate system-generated content to improve it over time',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
        ]
        : [
            {
                icon: 'fa-chart-line',
                label: ar ? 'أداء المحتوى' : 'Content performance',
                value: ar ? 'يحتاج بيانات' : 'Needs data',
                sub: ar ? 'انشر محتوى واربط حساباتك لنتعلم من أدائك.' : 'Publish content and connect accounts to start learning.',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
            {
                icon: 'fa-comment-dots',
                label: ar ? 'أنماط المحادثات' : 'Conversation patterns',
                value: ar ? 'يحتاج رسائل' : 'Needs messages',
                sub: ar ? 'ردّ على عملائك عبر الـ Inbox حتى يبدأ النظام في رصد الأنماط.' : 'Reply to customers via Inbox to start detecting patterns.',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
            {
                icon: 'fa-bullhorn',
                label: ar ? 'كفاءة الإعلانات' : 'Ad efficiency',
                value: ar ? 'غير مرتبط' : 'Not connected',
                sub: ar ? 'ربط منصة الإعلانات سيكشف ROAS وCPA الحقيقي.' : 'Connect ad platform to reveal real ROAS and CPA.',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
            {
                icon: 'fa-star',
                label: ar ? 'تقييم مخرجات AI' : 'AI output rating',
                value: ar ? 'لا تقييمات بعد' : 'No ratings yet',
                sub: ar ? 'قيّم المحتوى الذي يولّده النظام حتى يتحسن مع الوقت.' : 'Rate system-generated content to improve it over time.',
                color: 'text-light-text-secondary',
                bg: 'bg-light-bg/50',
            },
        ];

    // ── Section D — ما الذي نقترحه ───────────────────────────────────────────
    const industryLabel = brandProfile?.industry || '';
    const suggestions: Suggestion[] = [
        {
            id: 'content-idea',
            icon: 'fa-lightbulb',
            title: ar ? 'فكرة محتوى مقترحة للأسبوع' : 'Suggested content idea this week',
            reason: ar
                ? (industryLabel ? `بناءً على مجال "${industryLabel}" وأداء المحتوى الأخير` : 'بناءً على أنماط المحتوى الأفضل أداءً في مجالك')
                : (industryLabel ? `Based on your "${industryLabel}" industry and recent performance` : 'Based on top-performing content patterns in your field'),
            confidence: 'high',
            nav: 'content-studio',
        },
        {
            id: 'occasion',
            icon: 'fa-calendar-star',
            title: ar ? 'فرصة موسمية خلال 7 أيام' : 'Seasonal opportunity in 7 days',
            reason: ar ? 'مناسبة مرتبطة بسوقك المستهدف — استعد مبكرًا' : 'An occasion relevant to your target market — prepare early',
            confidence: 'high',
            nav: 'calendar',
        },
        {
            id: 'reply-flow',
            icon: 'fa-diagram-project',
            title: ar ? 'بناء فلو رد تلقائي للتساؤلات الشائعة' : 'Build auto-reply flow for common questions',
            reason: ar ? 'الأنماط المتكررة في الـ Inbox تستحق أتمتة لتوفير وقت الفريق' : 'Repeated Inbox patterns worth automating to save team time',
            confidence: 'medium',
            nav: 'workflow',
        },
        {
            id: 'brand-brain',
            icon: 'fa-brain',
            title: ar ? 'راجع عقل البراند وحدّثه' : 'Review and update Brand Brain',
            reason: ar ? 'دقة عقل البراند تؤثر مباشرة على جودة كل مخرجات النظام' : 'Brand Brain accuracy directly impacts all system output quality',
            confidence: 'high',
            nav: 'brand-hub',
        },
    ];

    // ── Analytics chart ───────────────────────────────────────────────────────
    const processedChartData = useMemo(() => {
        const now = new Date();
        const days = timePeriod === '7d' ? 7 : timePeriod === '90d' ? 90 : 30;
        const start = new Date(now.getTime() - days * 86400000);
        return analyticsData.followerGrowth
            .filter((item) => new Date(item.date) >= start)
            .map((item) => ({
                ...item,
                Total: Object.keys(item).filter((k) => k !== 'date').reduce((s, k) => s + (item[k] || 0), 0),
            }));
    }, [analyticsData.followerGrowth, timePeriod]);

    const formatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return ar ? 'صباح الخير' : 'Good morning';
        if (h < 18) return ar ? 'مساء الخير' : 'Good afternoon';
        return ar ? 'مساء الخير' : 'Good evening';
    };

    const operatorMetrics = [
        { label: 'MER',  sublabel: ar ? 'كفاءة التسويق الكلي'  : 'Marketing Efficiency Ratio', value: '3.2x', trend: '+0.4x', positive: true,  icon: 'fa-chart-line',   color: 'text-emerald-500', bg: 'bg-emerald-500/10', note: ar ? 'الإيراد ÷ الإنفاق التسويقي الكلي'     : 'Revenue ÷ total marketing spend' },
        { label: 'ROAS', sublabel: ar ? 'عائد إنفاق الإعلانات' : 'Return on Ad Spend',           value: '4.8x', trend: '-0.2x', positive: false, icon: 'fa-dollar-sign',  color: 'text-blue-500',    bg: 'bg-blue-500/10',    note: ar ? 'إيراد الإعلانات ÷ إنفاق الإعلانات' : 'Ad revenue ÷ ad spend'           },
        { label: 'CPA',  sublabel: ar ? 'تكلفة اكتساب العميل'  : 'Cost Per Acquisition',         value: ar ? '٤٢ ج' : '$42', trend: '-8%',    positive: true,  icon: 'fa-user-plus',    color: 'text-violet-500',  bg: 'bg-violet-500/10',  note: ar ? 'تكلفة اكتساب عميل جديد'            : 'Cost to acquire one new customer'},
        { label: 'CVR',  sublabel: ar ? 'معدل التحويل'          : 'Conversion Rate',              value: '3.7%', trend: '+0.5%', positive: true,  icon: 'fa-funnel-dollar',color: 'text-amber-500',   bg: 'bg-amber-500/10',   note: ar ? 'من زائر إلى عميل'                  : 'From visitor to customer'        },
    ];

    return (
        <div className="animate-fade-in space-y-8">

            {/* ── Hero greeting ─────────────────────────────────────────────── */}
            <div className="surface-panel rounded-[2rem] bg-gradient-to-br from-brand-primary/5 via-transparent to-brand-secondary/5 p-6 shadow-[var(--shadow-primary)] !border-0">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="section-kicker">{ar ? 'مركز التشغيل اليومي' : 'Daily Control Center'}</p>
                        <h1 className="metric-emphasis mt-2 text-3xl font-bold text-light-text dark:text-dark-text md:text-4xl">
                            {getGreeting()}، <span className="text-brand-primary">{userName || (ar ? 'أنت' : 'there')}</span>
                        </h1>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                            {ar
                                ? 'يعرض لك النظام ما يحدث، ما الأولويات، ماذا تعلّمنا، وماذا نقترح — كل شيء من مكان واحد.'
                                : 'The system shows you what\'s happening, what to prioritize, what we\'ve learned, and what we suggest — all in one place.'}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button onClick={() => onNavigate('content-studio')} className="btn rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-[var(--shadow-primary)]">
                            <i className="fas fa-wand-magic-sparkles text-xs" />
                            <span>{ar ? 'أنشئ محتوى' : 'Create content'}</span>
                        </button>
                        <button onClick={() => onNavigate('social-ops/scheduled')} className="btn rounded-2xl border-none bg-light-card/80 px-5 py-3 text-sm font-semibold text-light-text shadow-[var(--shadow-ambient)] dark:bg-dark-card/80 dark:text-dark-text">
                            <i className="fas fa-calendar-check text-xs" />
                            <span>{ar ? 'الجدول' : 'Schedule'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Onboarding checklist ──────────────────────────────────────── */}
            {showOnboarding && (
                <div className="surface-panel rounded-[1.75rem] border-0 bg-gradient-to-r from-brand-primary/10 to-transparent p-6 shadow-[var(--shadow-ambient)]">
                    <div className="mb-4 flex items-center justify-between gap-4">
                        <div>
                            <h2 className="flex items-center gap-2 text-base font-bold text-light-text dark:text-dark-text">
                                <i className="fas fa-rocket text-brand-primary" />
                                {ar ? 'ابدأ تشغيل البراند داخل SBrandOps' : 'Start operating your brand in SBrandOps'}
                            </h2>
                            <p className="mt-0.5 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? `${onboardingDone} من ${onboardingSteps.length} خطوات مكتملة` : `${onboardingDone} of ${onboardingSteps.length} steps done`}
                            </p>
                        </div>
                        <span className="text-2xl font-bold text-brand-primary">{onboardingProgress}%</span>
                    </div>
                    <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-light-bg dark:bg-dark-bg">
                        <div className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary transition-all duration-500" style={{ width: `${onboardingProgress}%` }} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {onboardingSteps.map((step) => (
                            <button
                                key={step.id}
                                onClick={step.done ? undefined : step.action}
                                className={`flex items-center gap-3 rounded-2xl border p-3 text-start transition-all ${step.done ? 'cursor-default border-emerald-500/30 bg-emerald-500/5' : 'cursor-pointer border-light-border hover:border-brand-primary hover:bg-brand-primary/5 dark:border-dark-border'}`}
                            >
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${step.done ? 'bg-emerald-500 text-white' : 'bg-light-bg text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary'}`}>
                                    <i className={`fas ${step.done ? 'fa-check' : step.icon} text-xs`} />
                                </div>
                                <p className={`text-xs font-semibold leading-snug ${step.done ? 'text-emerald-600 line-through dark:text-emerald-400' : 'text-light-text dark:text-dark-text'}`}>
                                    {step.label}
                                </p>
                            </button>
                        ))}
                    </div>
                    {nextOnboardingStep && (
                        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand-primary/15 bg-white/70 p-4 dark:bg-slate-950/40 md:flex-row md:items-center md:justify-between">
                            <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'أكمل الأساسيات مرة واحدة، ثم يتحول النظام إلى مساحة تشغيل يومية واضحة.' : 'Complete the foundation once, then the app becomes a reliable daily operating space.'}
                            </p>
                            <button
                                onClick={nextOnboardingStep.action}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white shadow-primary-glow whitespace-nowrap"
                            >
                                <i className={`fas ${nextOnboardingStep.icon || 'fa-arrow-right'}`} />
                                <span>{ar ? 'الخطوة التالية:' : 'Next step:'} {nextOnboardingStep.label}</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ══ SECTION A: ماذا يحدث الآن ════════════════════════════════════ */}
            <div>
                <SectionKicker icon="fa-circle-dot" label={ar ? 'ماذا يحدث الآن' : "What's happening now"} />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {nowItems.map((item) => (
                        <NowTile key={item.id} {...item} onNavigate={onNavigate} ar={ar} />
                    ))}
                </div>
            </div>

            {/* ══ SECTION B + Upcoming posts (2-col) ═══════════════════════════ */}
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
                {/* Section B */}
                <div>
                    <SectionKicker icon="fa-bolt" label={ar ? 'ما الذي يجب فعله الآن' : 'What to do now'} accent="text-amber-600" />
                    {priorities.length > 0 ? (
                        <div className="space-y-3">
                            {priorities.slice(0, 4).map((p) => (
                                <PriorityCard key={p.id} {...p} onNavigate={onNavigate} />
                            ))}
                            {priorities.length > 4 && (
                                <button
                                    onClick={() => onNavigate('error-center')}
                                    className="w-full rounded-2xl border border-dashed border-light-border px-4 py-3 text-center text-sm font-medium text-light-text-secondary transition-colors hover:border-brand-primary hover:text-brand-primary dark:border-dark-border"
                                >
                                    {ar
                                        ? `و${priorities.length - 4} مهام إضافية أخرى…`
                                        : `and ${priorities.length - 4} more action${priorities.length - 4 > 1 ? 's' : ''}…`}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="surface-panel-soft rounded-[1.4rem] px-5 py-8 text-center">
                            <i className="fas fa-check-circle text-2xl text-emerald-500" />
                            <p className="mt-3 text-sm font-semibold text-light-text dark:text-dark-text">
                                {ar ? 'كل شيء على ما يرام!' : 'Everything looks great!'}
                            </p>
                            <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'لا توجد مهام عاجلة الآن.' : 'No urgent tasks at the moment.'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Upcoming posts */}
                <Panel
                    title={ar ? 'المنشورات القادمة' : 'Upcoming posts'}
                    subtitle={ar ? 'أقرب المنشورات في طابور النشر' : 'Next posts in publishing queue'}
                    actions={(
                        <button onClick={() => onNavigate('social-ops/scheduled')} className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-secondary">
                            {ar ? 'عرض الكل' : 'View all'}
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
                                    emptyTitleText={ar ? 'بدون عنوان' : 'Untitled post'}
                                />
                            ))
                        ) : (
                            <div className="rounded-[1.25rem] border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">
                                {ar ? 'لا توجد منشورات مجدولة حاليًا.' : 'No scheduled posts right now.'}
                            </div>
                        )}
                    </div>
                </Panel>
            </div>

            {/* ══ SECTION C: ما الذي تعلمناه ═══════════════════════════════════ */}
            <div>
                <div className="mb-3 flex items-center justify-between gap-4">
                    <SectionKicker icon="fa-graduation-cap" label={ar ? 'ما الذي تعلمناه' : "What we've learned"} accent="text-violet-600" />
                    {hasAnyData && !hasEnoughData && (
                        <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            <i className="fas fa-circle-notch fa-spin text-[8px]" />
                            {ar ? `جمع البيانات — ${postsCount}/١٠ منشورات` : `Collecting — ${postsCount}/10 posts`}
                        </span>
                    )}
                    {hasEnoughData && (
                        <span className="flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-[10px] font-semibold text-violet-600 dark:text-violet-400">
                            <i className="fas fa-circle-info text-[8px]" />
                            {ar ? 'بعض الأرقام متوسطات صناعية' : 'Some figures are industry benchmarks'}
                        </span>
                    )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {insights.map((ins, i) => (
                        <InsightTile key={i} {...ins} />
                    ))}
                </div>
            </div>

            {/* ══ SECTION D: ما الذي نقترحه ════════════════════════════════════ */}
            <div>
                <SectionKicker icon="fa-wand-magic-sparkles" label={ar ? 'ما الذي نقترحه' : "What we suggest"} accent="text-brand-primary" />
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {suggestions.map((s) => (
                        <SuggestionCard key={s.id} {...s} onNavigate={onNavigate} ar={ar} />
                    ))}
                </div>
            </div>

            {/* ── Analytics metrics ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary font-medium">
                    {ar ? 'الأداء الكلي' : 'Overall performance'}
                </p>
                {onSyncAnalytics && (
                    <button
                        onClick={handleSyncAnalytics}
                        disabled={isSyncing}
                        title={ar ? 'مزامنة الإحصائيات من المنصات' : 'Sync stats from platforms'}
                        className="flex items-center gap-1.5 rounded-lg border border-light-border dark:border-dark-border px-2.5 py-1 text-xs font-medium text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary hover:border-brand-primary transition-colors disabled:opacity-50"
                    >
                        <i className={`fas fa-rotate-right text-xs ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? (ar ? 'جارٍ المزامنة...' : 'Syncing...') : (ar ? 'مزامنة' : 'Sync')}
                    </button>
                )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile title={ar ? 'إجمالي المتابعين' : 'Total followers'} value={formatter.format(analyticsData.overallStats.totalFollowers)} icon="fa-users" positive />
                <MetricTile title={ar ? 'الوصول' : 'Reach'} value={formatter.format(analyticsData.overallStats.impressions)} icon="fa-eye" positive />
                <MetricTile title={ar ? 'التفاعل' : 'Engagement'} value={formatter.format(analyticsData.overallStats.engagement)} icon="fa-heart" positive={false} />
                <MetricTile title={ar ? 'المنشورات' : 'Posts published'} value={formatter.format(analyticsData.overallStats.postsPublished)} icon="fa-paper-plane" />
            </div>

            {/* ── Operator metrics + chart + alerts + messages ─────────────── */}
            <Panel
                title={ar ? 'مقاييس التشغيل' : 'Operator metrics'}
                subtitle={ar ? 'مؤشرات أداء سريعة قبل الدخول للتفاصيل.' : 'Fast performance indicators before drilling into detail.'}
            >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {operatorMetrics.map((metric) => (
                        <div key={metric.label} className="surface-panel-soft rounded-[1.5rem] p-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-lg font-black text-light-text dark:text-dark-text">{metric.label}</span>
                                        <span className="rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Demo</span>
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
                        {ar ? 'هذه بيانات توضيحية. اربط Google Ads من صفحة التكاملات للحصول على أرقام فعلية.' : 'All figures are demo data. Connect Google Ads from Integrations for live numbers.'}
                    </p>
                    {!hasLinkedAds && (
                        <button
                            onClick={() => onNavigate('integrations')}
                            className="flex-shrink-0 rounded-xl bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-500/25 dark:text-amber-400 transition-colors"
                        >
                            {ar ? 'وصّل الإعلانات الآن ←' : 'Connect ads now →'}
                        </button>
                    )}
                </div>
            </Panel>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
                <Panel
                    title={ar ? 'نمو الجمهور' : 'Audience growth'}
                    subtitle={ar ? 'قراءة سريعة لنمو الجمهور خلال الفترة المحددة.' : 'Quick read on audience growth in the selected period.'}
                    actions={(
                        <div className="flex rounded-2xl bg-light-bg p-1 dark:bg-dark-bg">
                            {(['7d', '30d', '90d'] as const).map((period) => (
                                <button
                                    key={period}
                                    onClick={() => setTimePeriod(period)}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${timePeriod === period ? 'bg-light-card text-brand-primary shadow-sm dark:bg-dark-card' : 'text-light-text-secondary hover:text-light-text dark:text-dark-text-secondary dark:hover:text-dark-text'}`}
                                >
                                    {period}
                                </button>
                            ))}
                        </div>
                    )}
                >
                    <div className="h-[280px]">
                        <LightweightLineChart
                            data={processedChartData}
                            xKey="date"
                            series={[{ key: 'Total', label: ar ? 'إجمالي النمو' : 'Total growth', color: '#2563eb' }]}
                            height={280}
                            formatX={(v) => new Date(String(v)).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
                        />
                    </div>
                </Panel>

                <div className="space-y-6">
                    <Panel
                        title={ar ? 'تنبيهات تحتاج متابعة' : 'Alerts needing attention'}
                        subtitle={ar ? 'ما يحتاج تدخلًا سريعًا.' : 'What needs intervention right now.'}
                        actions={(
                            <button onClick={() => onNavigate('error-center')} className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-secondary">
                                {ar ? 'عرض الكل' : 'View all'}
                            </button>
                        )}
                    >
                        <div className="space-y-3">
                            {criticalErrors.length > 0
                                ? criticalErrors.map((e) => <ErrorItem key={e.id} error={e} />)
                                : <div className="rounded-[1.25rem] border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">{ar ? 'لا توجد تنبيهات جديدة الآن.' : 'No new alerts right now.'}</div>
                            }
                        </div>
                    </Panel>

                    <Panel
                        title={ar ? 'آخر الرسائل' : 'Latest messages'}
                        subtitle={ar ? 'محادثات غير مقروءة تحتاج ردًا.' : 'Unread conversations needing a reply.'}
                        actions={(
                            <button onClick={() => onNavigate('inbox')} className="text-xs font-semibold text-brand-primary transition-colors hover:text-brand-secondary">
                                {ar ? 'فتح الصندوق' : 'Open inbox'}
                            </button>
                        )}
                    >
                        <div className="space-y-3">
                            {unreadConversations.length > 0
                                ? unreadConversations.map((c) => <ConversationItem key={c.id} conversation={c} locale={locale} />)
                                : <div className="rounded-[1.25rem] border border-dashed border-light-border px-4 py-6 text-center text-sm text-light-text-secondary dark:border-dark-border dark:text-dark-text-secondary">{ar ? 'لا توجد رسائل غير مقروءة.' : 'No unread messages right now.'}</div>
                            }
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
};
