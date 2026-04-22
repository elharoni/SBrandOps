import React, { useMemo, useState } from 'react';
import { AccountStatus, NotificationType, PLATFORM_ASSETS, SocialAccount, SocialAsset, SocialPlatform } from '../../types';
import { fetchAvailableAssets, initiateSocialLogin, connectSelectedAssets } from '../../services/socialAuthService';
import { disconnectSocialAccount, updateAccountStatus } from '../../services/socialAccountService';
import { AssetSelectionModal } from '../AssetSelectionModal';
import { useLanguage } from '../../context/LanguageContext';
import { PageScaffold, PageSection } from '../shared/PageScaffold';

interface AccountsPageProps {
    brandId: string;
    accounts: SocialAccount[];
    onConnect: (platform: SocialPlatform, username: string) => void;
    onRefresh: () => void;
    addNotification: (type: NotificationType, message: string) => void;
}

interface PlatformCardProps {
    platform: SocialPlatform;
    connectedAccounts: SocialAccount[];
    isLoading: boolean;
    onConnect: () => void;
    onDisconnect: (accountId: string) => void;
    onReconnect: (accountId: string) => void;
}

const STATUS_CONFIG = {
    [AccountStatus.Connected]: {
        dot: 'bg-green-500',
        label: 'متصل',
        labelEn: 'Connected',
        badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    },
    [AccountStatus.NeedsReauth]: {
        dot: 'bg-yellow-500 animate-pulse',
        label: 'يحتاج إعادة توثيق',
        labelEn: 'Needs Reauth',
        badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    },
    [AccountStatus.Expired]: {
        dot: 'bg-red-500',
        label: 'منتهي الصلاحية',
        labelEn: 'Expired',
        badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    },
};

const PLATFORM_BG: Record<SocialPlatform, string> = {
    [SocialPlatform.Facebook]: 'from-blue-600/10 to-blue-600/5 border-blue-600/20 hover:border-blue-600/50',
    [SocialPlatform.Instagram]: 'from-pink-600/10 to-purple-600/5 border-pink-600/20 hover:border-pink-600/50',
    [SocialPlatform.X]: 'from-slate-500/10 to-slate-500/5 border-slate-500/20 hover:border-slate-500/50',
    [SocialPlatform.LinkedIn]: 'from-blue-700/10 to-blue-700/5 border-blue-700/20 hover:border-blue-700/50',
    [SocialPlatform.TikTok]: 'from-zinc-900/20 to-zinc-900/5 border-zinc-700/20 hover:border-zinc-700/50',
    [SocialPlatform.Pinterest]: 'from-red-600/10 to-red-600/5 border-red-600/20 hover:border-red-600/50',
};

const PlatformCard: React.FC<PlatformCardProps> = ({
    platform,
    connectedAccounts,
    isLoading,
    onConnect,
    onDisconnect,
    onReconnect,
}) => {
    const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
    const { language } = useLanguage();
    const ar = language === 'ar';
    const isConnected = connectedAccounts.length > 0;
    const asset = PLATFORM_ASSETS[platform];

    return (
        <div className={`surface-panel-soft rounded-[1.5rem] border bg-gradient-to-br ${PLATFORM_BG[platform]} transition-all`}>
            <div className="flex items-center justify-between gap-3 border-b border-light-border/70 p-5 dark:border-dark-border/60">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-light-bg text-lg shadow-sm dark:bg-dark-bg">
                        <i className={`${asset.icon} ${asset.textColor}`} />
                    </div>
                    <div>
                        <h3 className="font-semibold text-light-text dark:text-dark-text">{platform}</h3>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {isConnected
                                ? ar
                                    ? `${connectedAccounts.length} حساب متصل`
                                    : `${connectedAccounts.length} connected`
                                : ar ? 'غير متصل' : 'Not connected'}
                        </p>
                    </div>
                </div>

                <button
                    onClick={onConnect}
                    disabled={isLoading}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                        isConnected
                            ? 'border border-light-border text-light-text-secondary hover:bg-light-bg hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text'
                            : 'bg-brand-primary text-white hover:bg-brand-secondary'
                    } disabled:opacity-50`}
                >
                    {isLoading ? (
                        <i className="fas fa-circle-notch fa-spin text-xs" />
                    ) : (
                        <>
                            <i className="fas fa-plus me-2 text-xs" />
                            <span>{ar ? (isConnected ? 'إضافة' : 'ربط') : (isConnected ? 'Add' : 'Connect')}</span>
                        </>
                    )}
                </button>
            </div>

            {connectedAccounts.length > 0 ? (
                <div className="space-y-2 p-3">
                    {connectedAccounts.map((account) => {
                        const status = STATUS_CONFIG[account.status];
                        const isExpanded = expandedAccount === account.id;
                        const needsAction = account.status !== AccountStatus.Connected;

                        return (
                            <div key={account.id} className="rounded-[1.15rem] border border-light-border/70 bg-light-card/80 dark:border-dark-border/60 dark:bg-dark-card/80">
                                <div className="flex cursor-pointer items-center gap-3 p-3" onClick={() => setExpandedAccount(isExpanded ? null : account.id)}>
                                    <div className="relative shrink-0">
                                        <img
                                            src={account.avatarUrl}
                                            alt={account.username}
                                            className="h-10 w-10 rounded-full object-cover"
                                            onError={(event) => {
                                                (event.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(account.username)}&background=2563eb&color=fff`;
                                            }}
                                        />
                                        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-light-card dark:border-dark-card ${status.dot}`} />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">@{account.username}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                            {account.followers.toLocaleString(ar ? 'ar-EG' : 'en-US')} {ar ? 'متابع' : 'followers'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${status.badge}`}>{ar ? status.label : status.labelEn}</span>
                                        {needsAction && <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />}
                                        <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'} text-xs text-light-text-secondary dark:text-dark-text-secondary`} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="flex flex-wrap gap-2 border-t border-light-border/70 px-3 pb-3 pt-0 dark:border-dark-border/60">
                                        {needsAction && (
                                            <button
                                                onClick={() => {
                                                    onReconnect(account.id);
                                                    setExpandedAccount(null);
                                                }}
                                                className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
                                            >
                                                <i className="fas fa-sync-alt me-1.5" />
                                                {ar ? 'إعادة توثيق' : 'Reconnect'}
                                            </button>
                                        )}

                                        <a
                                            href={`https://${platform.toLowerCase()}.com`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-3 rounded-xl bg-light-bg px-3 py-2 text-xs font-medium text-light-text-secondary transition-colors hover:text-light-text dark:bg-dark-bg dark:text-dark-text-secondary dark:hover:text-dark-text"
                                        >
                                            <i className="fas fa-arrow-up-right-from-square me-1.5" />
                                            {ar ? 'فتح الصفحة' : 'Open profile'}
                                        </a>

                                        <button
                                            onClick={() => {
                                                onDisconnect(account.id);
                                                setExpandedAccount(null);
                                            }}
                                            className="ms-auto mt-3 rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/20 dark:text-red-300"
                                        >
                                            <i className="fas fa-unlink me-1.5" />
                                            {ar ? 'فصل' : 'Disconnect'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="px-5 py-7 text-center">
                    <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? `اضغط "ربط" لإضافة حساب ${platform}` : `Click connect to add a ${platform} account`}
                    </p>
                </div>
            )}
        </div>
    );
};

const DisconnectModal: React.FC<{
    accountId: string | null;
    onClose: () => void;
    onConfirm: (id: string) => void;
}> = ({ accountId, onClose, onConfirm }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    if (!accountId) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="surface-panel w-full max-w-sm rounded-[1.5rem] p-6 text-center" onClick={(event) => event.stopPropagation()}>
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-2xl text-red-500">
                    <i className="fas fa-unlink" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-light-text dark:text-dark-text">{ar ? 'فصل الحساب؟' : 'Disconnect account?'}</h3>
                <p className="mb-6 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                    {ar ? 'سيتم إلغاء الربط ولن تتمكن من النشر على هذا الحساب حتى تعيد توثيقه.' : 'The connection will be removed and publishing will stop until the account is re-authorized.'}
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 rounded-xl border border-light-border px-4 py-2.5 text-sm font-medium text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                        {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button onClick={() => onConfirm(accountId)} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                        {ar ? 'فصل الحساب' : 'Disconnect'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Platform Setup Guide Modal ─────────────────────────────────────────────

const SETUP_GUIDES: Partial<Record<SocialPlatform, {
    steps: string[];
    envVar?: string;
    docsUrl: string;
    icon: string;
    color: string;
}>> = {
    [SocialPlatform.Facebook]: {
        icon: 'fab fa-facebook',
        color: 'text-blue-500',
        docsUrl: 'https://developers.facebook.com/apps',
        envVar: 'VITE_FACEBOOK_APP_ID',
        steps: [
            'اذهب إلى developers.facebook.com وأنشئ تطبيقاً جديداً من نوع "Business"',
            'من لوحة التطبيق، انسخ "App ID"',
            'في EasyPanel → Environment Variables، أضف: VITE_FACEBOOK_APP_ID = <App ID>',
            'في إعدادات التطبيق على Meta، أضف دومين موقعك في "App Domains"',
            'أعد النشر (Redeploy) ثم عد لتجربة الربط',
        ],
    },
    [SocialPlatform.Instagram]: {
        icon: 'fab fa-instagram',
        color: 'text-pink-500',
        docsUrl: 'https://developers.facebook.com/apps',
        envVar: 'VITE_FACEBOOK_APP_ID',
        steps: [
            'Instagram يستخدم نفس Facebook App ID',
            'اتبع نفس خطوات Facebook لإنشاء التطبيق',
            'فعّل منتج "Instagram Basic Display" أو "Instagram Graph API" من التطبيق',
            'أضف VITE_FACEBOOK_APP_ID في EasyPanel بنفس القيمة',
        ],
    },
    [SocialPlatform.LinkedIn]: {
        icon: 'fab fa-linkedin',
        color: 'text-blue-700',
        docsUrl: 'https://developer.linkedin.com/apps',
        steps: [
            'اذهب إلى developer.linkedin.com/apps وأنشئ تطبيقاً جديداً',
            'فعّل "Sign In with LinkedIn using OpenID Connect" و"Share on LinkedIn"',
            'أضف Redirect URL: <supabase-url>/functions/v1/linkedin-oauth-callback',
            'انسخ Client ID و Client Secret',
            'أضفهما في Supabase Edge Function Secrets كـ LINKEDIN_CLIENT_ID و LINKEDIN_CLIENT_SECRET',
        ],
    },
    [SocialPlatform.X]: {
        icon: 'fab fa-x-twitter',
        color: 'text-slate-700 dark:text-slate-300',
        docsUrl: 'https://developer.twitter.com/en/portal/dashboard',
        steps: [
            'سجّل في developer.twitter.com وأنشئ Project + App',
            'فعّل OAuth 2.0 و "Read and Write" permissions',
            'أضف Callback URL: <supabase-url>/functions/v1/twitter-oauth-callback',
            'انسخ Client ID و Client Secret (OAuth 2.0)',
            'أضفهما في Supabase Edge Function Secrets كـ TWITTER_CLIENT_ID و TWITTER_CLIENT_SECRET',
        ],
    },
};

const SetupGuideModal: React.FC<{
    platform: SocialPlatform;
    onClose: () => void;
    ar: boolean;
}> = ({ platform, onClose, ar }) => {
    const guide = SETUP_GUIDES[platform];
    if (!guide) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl border border-light-border dark:border-dark-border bg-white dark:bg-[#151b2a] shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-light-border dark:border-dark-border">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-light-bg dark:bg-dark-bg flex items-center justify-center">
                            <i className={`${guide.icon} ${guide.color} text-lg`} />
                        </div>
                        <div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'إعداد مطلوب' : 'Setup Required'}
                            </p>
                            <p className="font-bold text-light-text dark:text-dark-text text-sm">
                                {ar ? `ربط ${platform}` : `Connect ${platform}`}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-light-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-all">
                        <i className="fas fa-xmark text-sm" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                        <i className="fas fa-triangle-exclamation text-amber-500 text-sm mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
                            {ar
                                ? `ربط ${platform} يتطلب تسجيل تطبيق مطور على منصتهم الرسمية. هذه خطوة لمرة واحدة فقط.`
                                : `Connecting ${platform} requires registering a developer app on their platform. This is a one-time setup.`}
                        </p>
                    </div>

                    <div className="space-y-3">
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text flex items-center gap-2">
                            <i className="fas fa-list-check text-brand-primary text-xs" />
                            {ar ? 'خطوات الإعداد:' : 'Setup Steps:'}
                        </p>
                        <ol className="space-y-2.5">
                            {guide.steps.map((step, i) => (
                                <li key={i} className="flex gap-3 text-xs text-light-text-secondary dark:text-dark-text-secondary leading-relaxed">
                                    <span className="shrink-0 w-5 h-5 rounded-md bg-brand-primary/10 text-brand-primary font-bold text-[10px] flex items-center justify-center mt-0.5">
                                        {i + 1}
                                    </span>
                                    {step}
                                </li>
                            ))}
                        </ol>
                    </div>

                    {guide.envVar && (
                        <div className="p-3 rounded-xl bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border">
                            <p className="text-[11px] font-semibold text-light-text-secondary dark:text-dark-text-secondary mb-1">
                                {ar ? 'متغير البيئة المطلوب:' : 'Required env variable:'}
                            </p>
                            <code className="text-xs text-brand-primary font-mono">{guide.envVar}</code>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex gap-3">
                    <a
                        href={guide.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-primary text-white text-sm font-semibold hover:bg-brand-primary/90 transition-all"
                    >
                        <i className="fas fa-arrow-up-right-from-square text-xs" />
                        {ar ? 'افتح بوابة المطورين' : 'Open Developer Portal'}
                    </a>
                    <button
                        onClick={onClose}
                        className="px-4 py-2.5 rounded-xl border border-light-border dark:border-dark-border text-sm text-light-text-secondary dark:text-dark-text-secondary hover:bg-light-bg dark:hover:bg-dark-bg transition-all"
                    >
                        {ar ? 'إغلاق' : 'Close'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────

const AccountsStatsBar: React.FC<{ accounts: SocialAccount[] }> = ({ accounts }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';
    const total = accounts.length;
    const connected = accounts.filter((account) => account.status === AccountStatus.Connected).length;
    const needsAction = accounts.filter((account) => account.status !== AccountStatus.Connected).length;
    const totalFollowers = accounts.reduce((sum, account) => sum + account.followers, 0);

    const stats = [
        { label: ar ? 'إجمالي الحسابات' : 'Total accounts', value: total.toString(), icon: 'fas fa-users', color: 'text-brand-primary' },
        { label: ar ? 'متصلة' : 'Connected', value: connected.toString(), icon: 'fas fa-check-circle', color: 'text-emerald-500' },
        { label: ar ? 'تحتاج إجراء' : 'Need action', value: needsAction.toString(), icon: 'fas fa-triangle-exclamation', color: 'text-amber-500' },
        { label: ar ? 'إجمالي المتابعين' : 'Total followers', value: totalFollowers.toLocaleString(ar ? 'ar-EG' : 'en-US'), icon: 'fas fa-heart', color: 'text-pink-500' },
    ];

    return (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {stats.map((stat) => (
                <div key={stat.label} className="surface-panel-soft flex items-center gap-3 rounded-[1.35rem] p-4">
                    <i className={`${stat.icon} ${stat.color} text-lg`} />
                    <div>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{stat.label}</p>
                        <p className="text-lg font-bold text-light-text dark:text-dark-text">{stat.value}</p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const AccountsPage: React.FC<AccountsPageProps> = ({ brandId, accounts, onConnect, onRefresh, addNotification }) => {
    const { t, language } = useLanguage();
    const ar = language === 'ar';
    const [loadingPlatform, setLoadingPlatform] = useState<SocialPlatform | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [foundAssets, setFoundAssets] = useState<SocialAsset[]>([]);
    const [currentPlatform, setCurrentPlatform] = useState<SocialPlatform | null>(null);
    const [currentToken, setCurrentToken] = useState<string | null>(null);
    const [pendingDisconnectId, setPendingDisconnectId] = useState<string | null>(null);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
    const [setupPlatform, setSetupPlatform] = useState<SocialPlatform | null>(null);

    const notifyConnectionError = () => {
        addNotification(NotificationType.Error, t.errors.connectionFailed);
    };

    const accountsByPlatform = useMemo(() => {
        const map: Partial<Record<SocialPlatform, SocialAccount[]>> = {};
        for (const account of accounts) {
            if (!map[account.platform]) map[account.platform] = [];
            map[account.platform]!.push(account);
        }
        return map;
    }, [accounts]);

    const handleConnectClick = async (platform: SocialPlatform) => {
        // Facebook / Instagram require VITE_FACEBOOK_APP_ID
        if (platform === SocialPlatform.Facebook || platform === SocialPlatform.Instagram) {
            const appId = import.meta.env.VITE_FACEBOOK_APP_ID;
            if (!appId) {
                setSetupPlatform(platform);
                return;
            }
        }
        // LinkedIn and X (Twitter) require server-side OAuth apps — show setup guide
        if (platform === SocialPlatform.LinkedIn || platform === SocialPlatform.X) {
            setSetupPlatform(platform);
            return;
        }

        setLoadingPlatform(platform);
        try {
            const authResponse = await initiateSocialLogin(platform);
            setCurrentToken(authResponse.accessToken);
            setCurrentPlatform(platform);
            const assets = await fetchAvailableAssets(platform, authResponse.accessToken);
            setFoundAssets(assets);
            setIsModalOpen(true);
        } catch (error: any) {
            console.error('Auth failed:', error);
            addNotification(
                NotificationType.Error,
                ar
                    ? `فشل الاتصال: ${error?.message ?? 'خطأ غير متوقع'}`
                    : `Connection failed: ${error?.message ?? 'Unexpected error'}`,
            );
        } finally {
            setLoadingPlatform(null);
        }
    };

    const handleAssetsConfirmed = async (selectedAssets: SocialAsset[]) => {
        if (!currentPlatform || !currentToken) return;
        setLoadingPlatform(currentPlatform);
        try {
            await connectSelectedAssets(brandId, selectedAssets, currentPlatform, currentToken);
            setIsModalOpen(false);
            onRefresh();
        } catch (error) {
            console.error('Failed to connect assets:', error);
            notifyConnectionError();
        } finally {
            setLoadingPlatform(null);
        }
    };

    const handleReconnect = async (accountId: string) => {
        const account = accounts.find((item) => item.id === accountId);
        if (!account) return;

        setLoadingPlatform(account.platform);
        try {
            await initiateSocialLogin(account.platform);
            await updateAccountStatus(accountId, AccountStatus.Connected);
            onRefresh();
        } catch (error) {
            console.error('Reconnect failed:', error);
            notifyConnectionError();
        } finally {
            setLoadingPlatform(null);
        }
    };

    const handleDisconnectConfirm = async (accountId: string) => {
        setPendingDisconnectId(null);
        setDisconnectingId(accountId);
        try {
            await disconnectSocialAccount(accountId);
            onRefresh();
        } catch (error) {
            console.error('Failed to disconnect:', error);
            notifyConnectionError();
        } finally {
            setDisconnectingId(null);
        }
    };

    const actionRequired = accounts.filter((account) => account.status !== AccountStatus.Connected).length;

    return (
        <PageScaffold
            kicker={ar ? 'القنوات والمنصات' : 'Channels & Platforms'}
            title={t.accounts.connectedAccounts}
            description={ar ? 'إدارة الربط، حالة التوثيق، وإتاحة النشر لكل قناة من مكان واحد.' : 'Manage connection health, authentication status and publishing readiness for every channel.'}
            actions={(
                <div className="flex items-center gap-3">
                    {actionRequired > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-600 dark:text-amber-300">
                            <i className="fas fa-triangle-exclamation text-xs" />
                            <span>{actionRequired} {ar ? 'يحتاج إجراء' : 'need action'}</span>
                        </span>
                    )}
                    <button
                        onClick={onRefresh}
                        className="rounded-2xl border border-light-border bg-light-card px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-bg dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
                    >
                        <i className="fas fa-sync-alt me-2 text-xs" />
                        {ar ? 'تحديث' : 'Refresh'}
                    </button>
                </div>
            )}
            stats={[
                { label: ar ? 'إجمالي الحسابات' : 'Total accounts', value: accounts.length.toString() },
                { label: ar ? 'جاهزة للنشر' : 'Ready to publish', value: accounts.filter((account) => account.status === AccountStatus.Connected).length.toString(), tone: 'text-emerald-600 dark:text-emerald-300' },
                { label: ar ? 'تحتاج إعادة توثيق' : 'Need re-auth', value: actionRequired.toString(), tone: 'text-amber-600 dark:text-amber-300' },
            ]}
        >
            {accounts.length > 0 && <AccountsStatsBar accounts={accounts} />}

            <div className="flex items-start gap-3 rounded-[1.25rem] border border-sky-500/20 bg-sky-500/5 p-4">
                <i className="fas fa-circle-info mt-0.5 text-sky-500" />
                <div>
                    <p className="text-sm font-semibold text-light-text dark:text-dark-text">
                        {ar ? 'هذه الصفحة مخصصة لحسابات النشر الاجتماعي فقط.' : 'This page is only for social publishing accounts.'}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                        {ar ? 'تكاملات Google Ads و GA4 و Search Console و Shopify و WooCommerce و WordPress تتم إدارتها من مساحة Integrations الموحدة.' : 'Google Ads, GA4, Search Console, Shopify, WooCommerce, and WordPress are managed from the unified Integrations workspace.'}
                    </p>
                </div>
            </div>

            <PageSection
                title={ar ? 'المنصات' : 'Platforms'}
                description={ar ? 'كل منصة تعرض الحسابات المتصلة وحالتها والإجراءات المتاحة.' : 'Each platform shows connected accounts, auth state and available actions.'}
            >
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Object.values(SocialPlatform).map((platform) => (
                        <PlatformCard
                            key={platform}
                            platform={platform}
                            connectedAccounts={(accountsByPlatform[platform] ?? []).filter((account) => account.id !== disconnectingId)}
                            isLoading={loadingPlatform === platform}
                            onConnect={() => handleConnectClick(platform)}
                            onDisconnect={(id) => setPendingDisconnectId(id)}
                            onReconnect={handleReconnect}
                        />
                    ))}
                </div>
            </PageSection>

            <PageSection
                title={ar ? 'الأمان والخصوصية' : 'Security & privacy'}
                description={ar ? 'الاتصال يتم عبر OAuth مع حفظ أقل قدر ممكن من البيانات الحساسة.' : 'Connections use OAuth and keep sensitive data exposure to a minimum.'}
            >
                <div className="flex items-start gap-3 rounded-[1.25rem] border border-brand-primary/20 bg-brand-primary/5 p-4">
                    <i className="fas fa-shield-alt mt-0.5 text-brand-primary" />
                    <div>
                        <p className="text-sm font-semibold text-light-text dark:text-dark-text">{ar ? 'آلية الاتصال' : 'Connection model'}</p>
                        <p className="mt-1 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                            {ar ? 'يتم استخدام OAuth 2.0 للربط مع المنصات. لا يتم عرض التوكنات الحساسة للواجهة، ويمكنك فصل الوصول أو إعادة التوثيق في أي وقت.' : 'OAuth 2.0 is used to connect platforms. Sensitive tokens are not exposed to the client, and access can be revoked or re-authorized at any time.'}
                        </p>
                    </div>
                </div>
            </PageSection>

            <AssetSelectionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onConfirm={handleAssetsConfirmed}
                assets={foundAssets}
                platform={currentPlatform ?? SocialPlatform.Facebook}
                isLoading={loadingPlatform !== null}
            />

            <DisconnectModal
                accountId={pendingDisconnectId}
                onClose={() => setPendingDisconnectId(null)}
                onConfirm={handleDisconnectConfirm}
            />

            {setupPlatform && (
                <SetupGuideModal
                    platform={setupPlatform}
                    onClose={() => setSetupPlatform(null)}
                    ar={ar}
                />
            )}
        </PageScaffold>
    );
};
