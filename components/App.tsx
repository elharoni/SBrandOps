
import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { SkeletonDashboard, SkeletonAnalytics, SkeletonTable, SkeletonCardGrid, SkeletonInbox, SkeletonPageLoader } from './shared/Skeleton';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';
import { OnboardingTour } from './onboarding/OnboardingTour';
import { WelcomeModal } from './onboarding/WelcomeModal';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminHeader } from './admin/AdminHeader';
const PublisherPage = lazy(() => import('./pages/PublisherPage').then(m => ({ default: m.PublisherPage })));
const ScheduledPage = lazy(() => import('./pages/ScheduledPage').then(m => ({ default: m.ScheduledPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then(m => ({ default: m.AccountsPage })));
const CalendarPage = lazy(() => import('./pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const BrandHubPage = lazy(() => import('./pages/BrandHubPage').then(m => ({ default: m.BrandHubPage })));
const BrandsManagePage = lazy(() => import('./pages/BrandsManagePage').then(m => ({ default: m.BrandsManagePage })));
import { AddBrandModal } from './AddBrandModal';
import { BrandOnboardingWizard } from './BrandOnboardingWizard';
import { BrandIntelligenceModal } from './BrandIntelligenceModal';
import { NotificationsPanel } from './NotificationsPanel';
import { ToastStack } from './shared/ToastStack';

// Stores & Hooks
import { useBrandStore } from '../stores/brandStore';
import { useUIStore } from '../stores/uiStore';
import { useBrandData }  from '../hooks/useBrandData';
import { usePageBrandProfile } from '../hooks/page/usePageBrandProfile';
import { useDesignData } from '../hooks/useDesignData';
import { useAdminData }  from '../hooks/useAdminData';
import { useAppRouting } from '../hooks/useAppRouting';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { SystemData } from '../services/systemService';
import { isPublicPath, pathToPublicPage } from '../config/routes';
import { hasLiveProviderConnection } from './pages/integrationsModel';

// Services (mutations only â€” queries handled by useBrandData / useAdminData)
import { getBrands } from '../services/brandService';
import { connectSocialAccount } from '../services/socialAccountService';
import { updateBrandProfile } from '../services/brandHubService';
import { loadFacebookSDK } from '../services/facebookSDK';
import { addContentPiece, updateContentPiece, addComment, deleteContentPiece } from '../services/contentOpsService';
import { addMarketingPlan } from '../services/marketingPlansService';
import { inviteUser, updateUserRole, deleteUser, revokeSession, generateApiKey, deleteApiKey } from '../services/systemService';
import { createScheduledPost, updateScheduledPost, deleteScheduledPost } from '../services/postsService';
import { setSentryUser, setSentryBrandContext, captureError } from '../services/sentryService';
import { getGeneralSettings } from '../services/adminService';

import {
    Brand, SocialAccount, ScheduledPost, NotificationType,
    ContentPiece, PostStatus, ContentStatus, SocialPlatform, MediaItem, AIContentIdea, PublisherBrief,
    DesignAsset,
} from '../types';
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const AdsOpsPage = lazy(() => import('./pages/AdsOpsPage').then(m => ({ default: m.AdsOpsPage })));
const SEOOpsPage = lazy(() => import('./pages/SEOOpsPageV2'));
const SocialSearchPage = lazy(() => import('./pages/SocialSearchPage').then(m => ({ default: m.SocialSearchPage })));
const ContentOpsPage = lazy(() => import('./pages/ContentOpsPage').then(m => ({ default: m.ContentOpsPage })));
const IdeaOpsPage = lazy(() => import('./pages/IdeaOpsPage').then(m => ({ default: m.IdeaOpsPage })));
const InboxPage = lazy(() => import('./pages/InboxPage').then(m => ({ default: m.InboxPage })));
const WorkflowPage = lazy(() => import('./pages/WorkflowPage').then(m => ({ default: m.WorkflowPage })));
const IntegrationsPage = lazy(() => import('./pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const ErrorCenterPage = lazy(() => import('./pages/ErrorCenterPage').then(m => ({ default: m.ErrorCenterPage })));
const SystemPage = lazy(() => import('./pages/SystemPage').then(m => ({ default: m.SystemPage })));
const UserSettingsPage = lazy(() => import('./pages/UserSettingsPage').then(m => ({ default: m.UserSettingsPage })));
import { AdCampaign, AdsDashboardData, GBPData, Workflow, User, SubscriptionPlan, PaymentRecord, ActiveSession, ApiKey, BrandHubProfile, AnalyticsData, OperationalError, InboxConversation, MarketingPlan } from '../types';

// Admin Pages (lazy)
const AdminDashboardPage = lazy(() => import('./admin/pages/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const AdminUsersPage = lazy(() => import('./admin/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })));
const TenantsPage = lazy(() => import('./admin/pages/TenantsPage').then(m => ({ default: m.TenantsPage })));
const BillingPage = lazy(() => import('./admin/pages/BillingPage').then(m => ({ default: m.BillingPage })));
const MarketingPlansPage = lazy(() => import('./pages/MarketingPlansPage').then(m => ({ default: m.MarketingPlansPage })));
const BrandAnalysisPage = lazy(() => import('./pages/BrandAnalysisPage').then(m => ({ default: m.BrandAnalysisPage })));
const AIMonitorPage = lazy(() => import('./admin/pages/AIMonitorPage').then(m => ({ default: m.AIMonitorPage })));
const QueuesPage = lazy(() => import('./admin/pages/QueuesPage').then(m => ({ default: m.QueuesPage })));
const AdminSettingsPage = lazy(() => import('./admin/pages/AdminSettingsPage').then(m => ({ default: m.AdminSettingsPage })));
const SystemHealthPage = lazy(() => import('./admin/pages/SystemHealthPage').then(m => ({ default: m.SystemHealthPage })));
const CommandPalette = lazy(() => import('./admin/shared/ui/CommandPalette').then(m => ({ default: m.CommandPalette })));
const AIProviderKeysPage = lazy(() => import('./admin/pages/AIProviderKeysPage').then(m => ({ default: m.AIProviderKeysPage })));
const AdminLogsPage = lazy(() => import('./admin/pages/AdminLogsPage').then(m => ({ default: m.AdminLogsPage })));
const TeamManagementPage = lazy(() => import('./pages/TeamManagementPage').then(m => ({ default: m.TeamManagementPage })));
const UserBillingPage = lazy(() => import('./pages/UserBillingPage').then(m => ({ default: m.UserBillingPage })));
const CrmDashboardPage = lazy(() => import('./pages/crm/CrmDashboardPage').then(m => ({ default: m.CrmDashboardPage })));
const CustomersPage = lazy(() => import('./pages/crm/CustomersPage').then(m => ({ default: m.CustomersPage })));
const CrmPipelinePage = lazy(() => import('./pages/crm/CrmPipelinePage').then(m => ({ default: m.CrmPipelinePage })));
const CrmTicketsPage = lazy(() => import('./pages/crm/CrmTicketsPage').then(m => ({ default: m.CrmTicketsPage })));
const MarketingSite  = lazy(() => import('./marketing/MarketingSite'));
const DesignOpsPage  = lazy(() => import('./pages/DesignOpsPage').then(m => ({ default: m.DesignOpsPage })));
const VideoStudioPage = lazy(() => import('./pages/VideoStudioPage').then(m => ({ default: m.VideoStudioPage })));
const ContentStudioPage = lazy(() => import('./pages/ContentStudioPage').then(m => ({ default: m.ContentStudioPage })));
const AssetLibraryPage = lazy(() => import('./pages/AssetLibraryPage').then(m => ({ default: m.AssetLibraryPage })));

const buildFallbackBrandProfile = (brandName = ''): BrandHubProfile => ({
    brandName,
    industry: '',
    values: [],
    keySellingPoints: [],
    styleGuidelines: [],
    brandVoice: {
        toneDescription: [],
        keywords: [],
        negativeKeywords: [],
        toneStrength: 0.5,
        toneSentiment: 0.5,
        voiceGuidelines: { dos: [], donts: [] },
    },
    brandAudiences: [],
    consistencyScore: 0,
    lastMemoryUpdate: new Date().toISOString(),
});

const buildFallbackAnalyticsData = (): AnalyticsData => ({
    overallStats: {
        totalFollowers: 0,
        impressions: 0,
        engagement: 0,
        postsPublished: 0,
        sentiment: { positive: 0, neutral: 0, negative: 0 },
    },
    connectedSources: {},
    topPosts: [],
    followerGrowth: [],
    engagementRate: [],
});

const buildFallbackAdsDashboardData = (): AdsDashboardData => ({
    overallMetrics: {
        totalSpend: 0,
        overallRoas: 0,
        totalImpressions: 0,
        totalConversions: 0,
    },
    spendByPlatform: [],
    performanceOverTime: [],
});

const buildFallbackSystemData = (): SystemData => ({
    users: [],
    subscription: {
        name: 'Starter Plan',
        price: 29,
        currency: 'USD',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        limits: { users: 2, brands: 1, aiTokens: 1_000_000 },
        usage: { users: 0, brands: 0 },
    },
    paymentHistory: [],
    activeSessions: [],
    apiKeys: [],
});

const NoBrandState: React.FC<{ onCreateBrand: () => void }> = ({ onCreateBrand }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="max-w-xl rounded-[2rem] border border-light-border bg-light-card p-8 text-center shadow-sm dark:border-dark-border dark:bg-dark-card">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary">
                    <i className="fas fa-layer-group text-2xl" />
                </div>
                <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">
                    {ar ? 'ابدأ بإضافة أول براند' : 'Create your first brand'}
                </h2>
                <p className="mt-3 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    {ar
                        ? 'أضف البراند أولًا حتى نجهز لك المحتوى، القنوات، والتحليلات داخل مساحة تشغيل واحدة.'
                        : 'Add your first brand to unlock content, channels, analytics, and the rest of your workspace.'}
                </p>
                <button
                    onClick={onCreateBrand}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-primary-glow transition-transform hover:-translate-y-0.5"
                >
                    <i className="fas fa-plus text-xs" />
                    <span>{ar ? 'إضافة براند' : 'Add Brand'}</span>
                </button>
            </div>
        </div>
    );
};
const AppShell: React.FC = () => {
    const location = useLocation();
    const { isAuthenticated, isLoading: authLoading, signOut, user } = useAuth();
    const { language } = useLanguage();
    const ar = language === 'ar';
    const [authPage, setAuthPage] = useState<'login' | 'register' | 'forgot'>('login');
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [showWelcomeModal, setShowWelcomeModal] = useState(false);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [announcement, setAnnouncement] = useState<{ text: string; type: 'info' | 'warning' | 'success' | 'danger'; enabled: boolean } | null>(null);
    const [announcementDismissed, setAnnouncementDismissed] = useState(false);
    const isPublicRoute = isPublicPath(location.pathname);
    // Admin access: check user_metadata or app_metadata role
    const isAdmin = !!(
        user?.user_metadata?.is_admin ||
        user?.app_metadata?.role === 'admin' ||
        user?.app_metadata?.role === 'super_admin' ||
        user?.user_metadata?.role === 'ADMIN' ||
        user?.user_metadata?.role === 'SUPER_ADMIN'
    );
    const currentPublicPage = pathToPublicPage(location.pathname) as
        | 'home'
        | 'about'
        | 'pricing'
        | 'billing'
        | 'contact'
        | 'security'
        | 'terms'
        | 'privacy'
        | 'dpa'
        | 'refunds'
        | 'cookies';

    // â”€â”€ Zustand: Brand Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const {
        brands,
        activeBrand,
        isLoading: brandsLoading,
        fetchBrands,
        createBrand,
        switchBrand,
        setActiveBrand,
        deleteBrand,
        updateBrand,
    } = useBrandStore();

    // â”€â”€ Zustand: UI Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const {
        viewMode, setViewMode,
        activeBrandPage, setActiveBrandPage,
        activeAdminPage, setActiveAdminPage,
        isSidebarCollapsed, toggleSidebar,
        isMobileSidebarOpen, setMobileSidebarOpen,
        notifications, showNotificationsPanel, setShowNotificationsPanel,
        addNotification, markNotificationRead, markAllNotificationsRead,
        isCommandPaletteOpen, setCommandPaletteOpen,
        showAddBrandModal, setShowAddBrandModal,
    } = useUIStore();

    // â”€â”€ URL Routing (syncs URL â†” app state) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    useAppRouting({
        viewMode,
        activeBrandPage,
        activeAdminPage,
        isAuthenticated,
        isAdmin,
        authPage,
        setActiveBrandPage,
        setActiveAdminPage,
        setViewMode,
        setAuthPage,
    });

    // ── Brand Data Hook (core/essential data only) ────────────────────────────
    // Phase 0: useBrandData now fetches only 3 essential items (socialAccounts,
    // scheduledPosts, brandConnections). Page-specific data is fetched lazily by
    // each page via hooks/page/* to eliminate the 14-call waterfall on brand switch.
    const {
        socialAccounts,
        scheduledPosts,
        brandConnections,
        isLoading: brandDataLoading,
        fetchDataForBrand,
    } = useBrandData(addNotification);

    // ── Page-level data defaults (pages fetch their own via hooks/page/*) ─────
    // These empty/null values are passed as initial props while pages migrate to
    // using their own useQuery hooks (hooks/page/*) for real data fetching.
    const contentPipeline: ContentPiece[] = [];
    const errors: OperationalError[] = [];
    const conversations: InboxConversation[] = [];
    const campaigns: AdCampaign[] = [];
    const adsDashboardData: AdsDashboardData | null = null;
    const workflows: Workflow[] = [];
    const systemData: SystemData | null = null;
    const marketingPlans: MarketingPlan[] = [];
    const brandAssets: null = null;
    const brandProfile: BrandHubProfile | null = null;
    const analyticsData: AnalyticsData | null = null;

    // ── Design Data Hook ──────────────────────────────────────────────────────
    const {
        designAssets,
        designWorkflows,
        recentJobs,
        fetchDesignData,
        addAssetLocally,
        addJobLocally,
        updateJobLocally,
        removeAssetLocally,
    } = useDesignData(addNotification);

    // â”€â”€ Admin Data Hook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const {
        adminStats, adminUsers, tenants, subscriptionPlans,
        billingOverview, billingSubscriptions, billingInvoices, billingEvents, billingAuditLogs,
        aiMetrics, queueJobs, systemHealth, activityLogs,
        adminPermissions, generalSettings, securitySettings,
        isLoading: adminLoading, fetchAdminData,
    } = useAdminData(addNotification);

    // â”€â”€ Local UI State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const [postToEdit, setPostToEdit] = useState<ScheduledPost | null>(null);
    const [publisherBrief, setPublisherBrief] = useState<PublisherBrief | null>(null);
    const [showBrandIntelModal, setShowBrandIntelModal] = useState(false);

    // Combined loading indicator for brand view
    const isLoading = brandsLoading || brandDataLoading;
    const resolvedBrandProfile = brandProfile ?? buildFallbackBrandProfile(activeBrand?.name ?? '');
    const resolvedAnalyticsData = analyticsData ?? buildFallbackAnalyticsData();
    const resolvedAdsDashboardData = adsDashboardData ?? buildFallbackAdsDashboardData();
    const resolvedSystemData = systemData ?? buildFallbackSystemData();
    const hasLiveGoogleAdsConnection = hasLiveProviderConnection(brandConnections, ['google_ads']);
    const { data: fetchedBrandProfile } = usePageBrandProfile(activeBrand?.id, activeBrand?.name ?? '');

    // â”€â”€ Effects â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Fetch brands when user authenticates
    useEffect(() => {
        if (isAuthenticated && viewMode === 'brand') {
            fetchBrands();
        }
    }, [isAuthenticated, viewMode, fetchBrands]);

    // Sentry user identification
    useEffect(() => {
        if (isAuthenticated && user) {
            setSentryUser({
                id: user.id,
                email: user.email ?? undefined,
                name: user.user_metadata?.full_name ?? undefined,
            });
        } else {
            setSentryUser(null);
        }
    }, [isAuthenticated, user]);

    // Fetch brand-specific data when active brand changes
    useEffect(() => {
        if (activeBrand) {
            fetchDataForBrand(activeBrand);
            fetchDesignData(activeBrand.id);
            setSentryBrandContext(activeBrand.id, activeBrand.name);
        }
    }, [activeBrand, fetchDataForBrand, fetchDesignData]);

    // Fetch admin data when switching to admin mode
    useEffect(() => {
        if (viewMode === 'admin' && isAuthenticated) {
            fetchAdminData();
        }
    }, [viewMode, isAuthenticated, fetchAdminData]);

    // Show onboarding tour on first login
    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const key = `onboarding_done_${user.id}`;
        if (!localStorage.getItem(key)) {
            setShowOnboarding(true);
        }
    }, [isAuthenticated, user]);

    // Show welcome modal after email verification (detected via hash fragment)
    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const hash = window.location.hash;
        if (hash.includes('type=signup') || hash.includes('type=email_change')) {
            const welcomeKey = `welcome_shown_${user.id}`;
            if (!localStorage.getItem(welcomeKey)) {
                localStorage.setItem(welcomeKey, '1');
                setTimeout(() => setShowWelcomeModal(true), 800);
            }
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [isAuthenticated, user]);

    // Fetch system settings (maintenance mode + announcement) on login
    useEffect(() => {
        if (!isAuthenticated) return;
        getGeneralSettings().then(s => {
            setMaintenanceMode(s.maintenanceMode);
            setAnnouncement({ text: s.announcementText, type: s.announcementType, enabled: s.announcementEnabled });
        }).catch(() => {});
    }, [isAuthenticated]);

    // Load Facebook SDK on mount
    useEffect(() => {
        const fbAppId = import.meta.env.VITE_FACEBOOK_APP_ID;
        if (fbAppId) {
            loadFacebookSDK(fbAppId).catch(error => {
                console.warn('Facebook SDK failed to load:', error);
            });
        }
    }, []);

    // â”€â”€ Auth Guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (isPublicRoute) {
        return (
            <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ تحميل الموقع...' : 'Loading site...'} />}>
                <MarketingSite pageId={currentPublicPage} isAuthenticated={isAuthenticated} />
            </Suspense>
        );
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-light-bg dark:bg-dark-bg">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-brand-primary mb-4">
                    <i className="fas fa-layer-group text-white text-2xl"></i>
                </div>
                <i className="fas fa-circle-notch fa-spin text-brand-primary text-2xl mb-2"></i>
                <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">{ar ? 'جارٍ التحقق من الجلسة...' : 'Checking session...'}</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        if (authPage === 'register') {
            return (
                <RegisterPage
                    onSuccess={() => setAuthPage('login')}
                    onNavigateToLogin={() => setAuthPage('login')}
                />
            );
        }
        if (authPage === 'forgot') {
            return (
                <ForgotPasswordPage
                    onNavigateToLogin={() => setAuthPage('login')}
                />
            );
        }
        return (
            <LoginPage
                onSuccess={() => { /* AuthContext listener handles state update */ }}
                onNavigateToRegister={() => setAuthPage('register')}
                onNavigateToForgot={() => setAuthPage('forgot')}
            />
        );
    }
    // â”€â”€ End Auth Guards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    // Maintenance Mode check (non-admin users only)
    if (maintenanceMode && !isAdmin) {
        return (
            <div className='min-h-screen flex flex-col items-center justify-center bg-light-bg dark:bg-dark-bg px-6 text-center'>
                <div className='max-w-md'>
                    <div className='w-20 h-20 rounded-2xl bg-warning/20 flex items-center justify-center mx-auto mb-6'>
                        <i className='fas fa-tools text-warning text-3xl'></i>
                    </div>
                    <h1 className='text-3xl font-bold text-light-text dark:text-dark-text mb-3'>النظام تحت الصيانة</h1>
                    <p className='text-light-text-secondary dark:text-dark-text-secondary mb-6'>
                        نعمل على تحسين التطبيق. سنعود قريباً. شكراً لصبرك.
                    </p>
                    <button onClick={signOut} className='px-5 py-2.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary hover:text-danger transition-colors text-sm'>
                        <i className='fas fa-sign-out-alt me-2'></i>تسجيل الخروج
                    </button>
                </div>
            </div>
        );
    }

    // â”€â”€ Brand Event Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const handleSwitchBrand = (brandId: string) => {
        switchBrand(brandId);
    };

    const handleAddBrand = async (name: string) => {
        await createBrand(name);
        setShowAddBrandModal(false);
        addNotification(NotificationType.Success, ar ? `تم إنشاء البراند "${name}"` : `Brand "${name}" created.`);
    };

    const handleDeleteBrand = async (brandId: string) => {
        const brand = brands.find(b => b.id === brandId);
        await deleteBrand(brandId);
        addNotification(NotificationType.Success, ar ? `تم حذف البراند "${brand?.name ?? ''}"` : `Brand "${brand?.name ?? ''}" deleted.`);
    };

    const handleRenameBrand = async (brandId: string, newName: string) => {
        await updateBrand(brandId, { name: newName });
        addNotification(NotificationType.Success, ar ? `تم تغيير الاسم إلى "${newName}"` : `Brand renamed to "${newName}".`);
    };

    /**
     * Called by BrandOnboardingWizard on "Get Started" — the wizard has already
     * created the brand and connected accounts internally. We just need to:
     * 1. Refresh the brands list so the sidebar shows the new brand
     * 2. Switch to the new brand
     * 3. Navigate the user directly to the Publisher (Aha Moment)
     */
    const handleOnboardingComplete = async (brandId: string) => {
        setShowAddBrandModal(false);
        await fetchBrands();
        switchBrand(brandId);
        setActiveBrandPage('social-ops/publisher');
        addNotification(
            NotificationType.Success,
            ar ? '🎉 تم إنشاء البراند! أنشئ أول منشور الآن.' : '🎉 Brand ready! Create your first post.',
        );
        const intelKey = `brand_intel_shown_${user?.id}`;
        if (!localStorage.getItem(intelKey)) {
            localStorage.setItem(intelKey, '1');
            setTimeout(() => setShowBrandIntelModal(true), 800);
        }
    };

    const handleSavePost = async (post: Omit<ScheduledPost, 'id'>) => {
        if (!activeBrand) return;
        await createScheduledPost({
            brandId: activeBrand.id,
            briefId: post.briefId,
            briefTitle: post.briefTitle,
            watchlistId: post.watchlistId,
            content: post.content,
            platforms: post.platforms,
            mediaUrls: post.media?.map((m: MediaItem) => m.url) ?? [],
            scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : undefined,
            instagramFirstComment: post.instagramFirstComment,
            locations: post.locations,
        });
        fetchDataForBrand(activeBrand);
    };

    const handleUpdatePost = async (postId: string, updates: Partial<Omit<ScheduledPost, 'id'>>) => {
        if (!activeBrand) return;
        await updateScheduledPost(postId, {
            briefId: updates.briefId,
            briefTitle: updates.briefTitle,
            watchlistId: updates.watchlistId,
            content: updates.content,
            platforms: updates.platforms,
            mediaUrls: updates.media?.map((m: MediaItem) => m.url),
            scheduledAt: updates.scheduledAt ? new Date(updates.scheduledAt) : undefined,
            status: updates.status,
        });
        fetchDataForBrand(activeBrand);
    };

    const handleEditPost = (post: ScheduledPost) => {
        setPublisherBrief(null);
        setPostToEdit(post);
        setActiveBrandPage('social-ops/publisher');
    };

    const handleLoadPublisherBrief = (brief: PublisherBrief) => {
        setPostToEdit(null);
        setPublisherBrief(brief);
        setActiveBrandPage('social-ops/publisher');
    };

    const handleGenerateFromBrief = (brief: PublisherBrief) => {
        setPostToEdit(null);
        setPublisherBrief(brief);
        setActiveBrandPage('social-ops/publisher');
    };

    const handleSendToPublisher = (contentPiece: ContentPiece) => {
        setPublisherBrief(null);
        const postForPublisher: ScheduledPost = {
            id: '',
            content: contentPiece.generatedContent,
            platforms: [],
            media: contentPiece.media,
            status: PostStatus.Draft,
            scheduledAt: null,
        };
        setPostToEdit(postForPublisher);
        setActiveBrandPage('social-ops/publisher');
        addNotification(NotificationType.Info, `Content "${contentPiece.title}" sent to publisher.`);
    };

    const handleSocialIdeaToPublisher = (idea: AIContentIdea) => {
        const brief = idea.brief;
        const suggestedPlatforms = brief?.suggestedPlatforms ?? idea.suggestedPlatforms ?? [];
        const content = [idea.title, idea.description, brief?.cta ? `${ar ? 'الدعوة للإجراء:' : 'CTA:'} ${brief.cta}` : '']
            .filter(Boolean)
            .join('\n\n');

        const postForPublisher: ScheduledPost = {
            id: '',
            content,
            briefId: brief?.id,
            briefTitle: brief?.title,
            watchlistId: brief?.watchlistId,
            platforms: suggestedPlatforms,
            media: [],
            status: PostStatus.Draft,
            scheduledAt: null,
            instagramFirstComment: brief?.hashtags?.length ? brief.hashtags.join(' ') : '',
        };

        setPublisherBrief(brief ? {
            id: brief.id || crypto.randomUUID(),
            source: 'social-search',
            title: brief.title || idea.title,
            query: brief.query,
            objective: brief.objective || idea.description,
            angle: brief.angle || idea.description,
            competitors: brief.competitors || [],
            keywords: brief.keywords || [],
            hashtags: brief.hashtags || [],
            suggestedPlatforms,
            cta: brief.cta,
            notes: brief.notes || [],
        } : null);
        setPostToEdit(postForPublisher);
        setActiveBrandPage('social-ops/publisher');
        addNotification(NotificationType.Info, ar ? `تم إرسال الفكرة "${idea.title}" إلى مساحة النشر.` : `Sent "${idea.title}" to the publisher workspace.`);
    };

    const handleAddTask = async (title: string, description: string) => {
        if (!activeBrand) return;
        const taskData: Omit<ContentPiece, 'id' | 'comments' | 'media'> = {
            title,
            generatedContent: description,
            type: 'Task',
            status: ContentStatus.Ideas,
            assignee: undefined,
            dueDate: undefined,
        };
        await addContentPiece(activeBrand.id, taskData);
        fetchDataForBrand(activeBrand);
        addNotification(NotificationType.Success, 'Task created in Content Ops from inbox conversation.');
    };

    const handleConnectAccount = async (platform: SocialPlatform, username: string) => {
        if (!activeBrand) return;
        try {
            await connectSocialAccount(activeBrand.id, platform, username);
            addNotification(NotificationType.Success, `Connected to ${platform} as @${username}`);
            fetchDataForBrand(activeBrand);
        } catch (error) {
            addNotification(NotificationType.Error, 'Failed to connect account.');
        }
    };

    // â”€â”€ Page Renderers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    const renderBrandPage = () => {
        if (brandsLoading || (brandDataLoading && activeBrand)) {
            // Page-specific skeleton while loading
            switch (activeBrandPage) {
                case 'dashboard': return <SkeletonDashboard />;
                case 'analytics': return <SkeletonAnalytics />;
                case 'inbox': return <SkeletonInbox />;
                case 'social-ops/scheduled': return <div className="p-6"><SkeletonTable rows={6} cols={5} /></div>;
                case 'content-ops': return <div className="p-6"><SkeletonCardGrid count={6} cols={3} /></div>;
                case 'design-ops':  return <div className="p-6"><SkeletonCardGrid count={5} cols={3} /></div>;
                case 'ads-ops': return <div className="p-6"><SkeletonAnalytics /></div>;
                default: return <SkeletonPageLoader label={ar ? 'جارٍ تحميل البيانات...' : 'Loading data...'} />;
            }
        }
        if (!activeBrand) {
            return <NoBrandState onCreateBrand={() => setShowAddBrandModal(true)} />;
        }

        switch (activeBrandPage) {
            case 'dashboard':
                return (
                    <DashboardPage
                        analyticsData={resolvedAnalyticsData}
                        scheduledPosts={scheduledPosts}
                        conversations={conversations}
                        errors={errors}
                        onEditPost={handleEditPost}
                        onDeletePost={async (id) => { await deleteScheduledPost(id); fetchDataForBrand(activeBrand); }}
                        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                        onNavigate={setActiveBrandPage}
                        hasConnectedAccount={socialAccounts.length > 0}
                        hasBrandProfile={Boolean(fetchedBrandProfile)}
                        hasLinkedAds={hasLiveGoogleAdsConnection}
                    />
                );
            case 'social-ops/publisher':
                return <PublisherPage addNotification={addNotification} onSavePost={handleSavePost} onUpdatePost={handleUpdatePost} brandProfile={resolvedBrandProfile} postToEdit={postToEdit} onPostEdited={() => { setPostToEdit(null); setPublisherBrief(null); }} brandId={activeBrand.id} publisherBrief={publisherBrief} onLoadBrief={handleLoadPublisherBrief} onGenerateFromBrief={handleGenerateFromBrief} />;
            case 'social-ops/scheduled':
                return <ScheduledPage posts={scheduledPosts} onEditPost={handleEditPost} onDeletePost={async (id) => { await deleteScheduledPost(id); fetchDataForBrand(activeBrand); }} onNavigateToPublisher={() => setActiveBrandPage('social-ops/publisher')} />;
            case 'social-ops/accounts':
                return <AccountsPage brandId={activeBrand.id} accounts={socialAccounts} onConnect={handleConnectAccount} onRefresh={() => fetchDataForBrand(activeBrand)} addNotification={addNotification} />;
            case 'social-ops/social-search':
                return <SocialSearchPage brandId={activeBrand.id} addNotification={addNotification} onSendToPublisher={handleSocialIdeaToPublisher} />;
            case 'calendar':
                return <CalendarPage posts={scheduledPosts} contentPipeline={contentPipeline} onEditPost={handleEditPost} onUpdatePost={handleUpdatePost} onDeletePost={async (id) => { await deleteScheduledPost(id); fetchDataForBrand(activeBrand); }} />;
            case 'content-ops':
                return (
                    <ContentOpsPage
                        addNotification={addNotification}
                        initialContent={contentPipeline}
                        brandProfile={resolvedBrandProfile}
                        brandId={activeBrand.id}
                        onAddPiece={async (piecesData) => {
                            if (!activeBrand) return;
                            await Promise.all(piecesData.map(piece => addContentPiece(activeBrand.id, piece)));
                            fetchDataForBrand(activeBrand);
                        }}
                        onUpdatePiece={async (id, updates) => {
                            await updateContentPiece(activeBrand.id, id, updates);
                            fetchDataForBrand(activeBrand);
                        }}
                        onAddComment={async (id, text) => {
                            await addComment(activeBrand.id, id, {
                                id: crypto.randomUUID(),
                                author: user?.user_metadata?.full_name || user?.email || 'Ù…Ø³ØªØ®Ø¯Ù…',
                                text,
                                timestamp: new Date(),
                            });
                            fetchDataForBrand(activeBrand);
                        }}
                        onSendToPublisher={handleSendToPublisher}
                        onLoadBrief={handleLoadPublisherBrief}
                        onGenerateFromBrief={handleGenerateFromBrief}
                        onDeletePiece={async (id) => {
                            await deleteContentPiece(activeBrand.id, id);
                            fetchDataForBrand(activeBrand);
                        }}
                        users={resolvedSystemData.users}
                    />
                );
            case 'design-ops':
                return (
                    <DesignOpsPage
                        brandId={activeBrand.id}
                        brandProfile={resolvedBrandProfile}
                        designAssets={designAssets}
                        designWorkflows={designWorkflows}
                        recentJobs={recentJobs}
                        addNotification={addNotification}
                        onSendToPublisher={(asset: DesignAsset) => {
                            const mediaItem: MediaItem = {
                                id:   asset.id,
                                type: 'image',
                                url:  asset.url,
                                file: new File([], asset.name, { type: 'image/jpeg' }),
                            };
                            setPostToEdit({
                                id: '', content: '', platforms: [],
                                media: [mediaItem], status: PostStatus.Draft, scheduledAt: null,
                            });
                            setPublisherBrief(null);
                            setActiveBrandPage('social-ops/publisher');
                            addNotification(NotificationType.Info, `تم إرسال "${asset.name}" للـ Publisher`);
                        }}
                        onAssetAdded={addAssetLocally}
                        onJobAdded={addJobLocally}
                        onJobUpdated={updateJobLocally}
                        onAssetDeleted={removeAssetLocally}
                        onRefresh={() => activeBrand && fetchDesignData(activeBrand.id)}
                    />
                );
            case 'idea-ops':
                return <IdeaOpsPage brandProfile={resolvedBrandProfile} addNotification={addNotification} />;
            case 'analytics':
                return (
                    <AnalyticsPage
                        addNotification={addNotification}
                        brandProfile={resolvedBrandProfile}
                        analyticsData={resolvedAnalyticsData}
                        brandId={activeBrand.id}
                        scheduledPosts={scheduledPosts}
                        brandConnections={brandConnections}
                        brandAssets={brandAssets}
                        onNavigate={setActiveBrandPage}
                    />
                );
            case 'ads-ops':
                return (
                    <AdsOpsPage
                        addNotification={addNotification}
                        brandProfile={resolvedBrandProfile}
                        campaigns={campaigns}
                        dashboardData={resolvedAdsDashboardData}
                        brandConnections={brandConnections}
                        brandAssets={brandAssets}
                        onNavigate={setActiveBrandPage}
                    />
                );
            case 'marketing-plans':
                return (
                    <MarketingPlansPage
                        plans={marketingPlans}
                        addNotification={addNotification}
                        brandProfile={resolvedBrandProfile}
                        onAddPlan={async (planData) => {
                            await addMarketingPlan(activeBrand.id, planData);
                            fetchDataForBrand(activeBrand);
                        }}
                        onSendToPublisher={handleLoadPublisherBrief}
                    />
                );
            case 'ai-video':
                return (
                    <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ التحميل...' : 'Loading...'} />}>
                        <VideoStudioPage
                            addNotification={addNotification}
                            brandId={activeBrand.id}
                            onNavigate={setActiveBrandPage}
                        />
                    </Suspense>
                );
            case 'content-studio':
                return (
                    <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ التحميل...' : 'Loading...'} />}>
                        <ContentStudioPage
                            brandProfile={resolvedBrandProfile}
                            brandId={activeBrand.id}
                            addNotification={addNotification}
                            onSendToPublisher={handleLoadPublisherBrief}
                            onNavigate={setActiveBrandPage}
                            initialBrief={publisherBrief}
                        />
                    </Suspense>
                );
            case 'asset-library':
                return (
                    <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ التحميل...' : 'Loading...'} />}>
                        <AssetLibraryPage
                            brandId={activeBrand.id}
                            addNotification={addNotification}
                            onSendToPublisher={(mediaItem) => {
                                setPostToEdit({
                                    id: '', content: '', platforms: [],
                                    media: [mediaItem], status: PostStatus.Draft, scheduledAt: null,
                                });
                                setPublisherBrief(null);
                                setActiveBrandPage('social-ops/publisher');
                            }}
                        />
                    </Suspense>
                );
            case 'seo-ops':
                return (
                    <SEOOpsPage
                        addNotification={addNotification}
                        brandProfile={resolvedBrandProfile}
                        brandId={activeBrand.id}
                        brandConnections={brandConnections}
                        brandAssets={brandAssets}
                        onNavigate={setActiveBrandPage}
                    />
                );
            case 'inbox':
                return <InboxPage brandId={activeBrand.id} addNotification={addNotification} brandProfile={resolvedBrandProfile} conversations={conversations} onAddTask={handleAddTask} />;
            case 'brand-hub':
                return <BrandHubPage initialProfile={resolvedBrandProfile} onUpdate={(p) => updateBrandProfile(activeBrand.id, p)} addNotification={addNotification} />;
            case 'brand-analysis':
                return <BrandAnalysisPage brandProfile={resolvedBrandProfile} addNotification={addNotification} />;
            case 'workflow':
                return <WorkflowPage initialWorkflows={workflows} />;
            case 'integrations':
                return (
                    <IntegrationsPage
                        brandId={activeBrand.id}
                        socialAccounts={socialAccounts}
                        brandConnections={brandConnections}
                        brandAssets={brandAssets}
                        onRefresh={() => fetchDataForBrand(activeBrand)}
                        onNavigate={setActiveBrandPage}
                    />
                );
            case 'error-center':
                return <ErrorCenterPage addNotification={addNotification} errors={errors} />;
            case 'system':
                return (
                    <SystemPage
                        brandId={activeBrand.id}
                        {...resolvedSystemData}
                        addNotification={addNotification}
                        onRefreshSystem={async () => { await fetchDataForBrand(activeBrand); }}
                        onInviteUser={async (email, role) => { await inviteUser(activeBrand.id, email, role); fetchDataForBrand(activeBrand); }}
                        onUpdateUserRole={async (userId, role) => { await updateUserRole(activeBrand.id, userId, role); fetchDataForBrand(activeBrand); }}
                        onDeleteUser={async (userId) => { await deleteUser(activeBrand.id, userId); fetchDataForBrand(activeBrand); }}
                        onRevokeSession={async (sessionId) => { await revokeSession(activeBrand.id, sessionId); fetchDataForBrand(activeBrand); }}
                        onGenerateApiKey={async (name) => { const { fullSecret } = await generateApiKey(activeBrand.id, name); fetchDataForBrand(activeBrand); return fullSecret; }}
                        onDeleteApiKey={async (keyId) => { await deleteApiKey(activeBrand.id, keyId); fetchDataForBrand(activeBrand); }}
                    />
                );
            case 'team-management':
                return (
                    <TeamManagementPage
                        users={resolvedSystemData.users}
                        onInviteUser={async (email, role) => { await inviteUser(activeBrand.id, email, role); fetchDataForBrand(activeBrand); }}
                        onUpdateUserRole={async (userId, role) => { await updateUserRole(activeBrand.id, userId, role); fetchDataForBrand(activeBrand); }}
                        onDeleteUser={async (userId) => { await deleteUser(activeBrand.id, userId); fetchDataForBrand(activeBrand); }}
                        addNotification={addNotification}
                    />
                );
            case 'billing':
                return (
                    <UserBillingPage
                        brandCount={brands.length}
                        userCount={resolvedSystemData.users.length}
                    />
                );
            case 'user-settings':
                return <UserSettingsPage addNotification={addNotification} />;
            case 'brands-manage':
                return (
                    <BrandsManagePage
                        brands={brands}
                        activeBrand={activeBrand}
                        onAddBrand={() => setShowAddBrandModal(true)}
                        onSwitchBrand={switchBrand}
                        onDeleteBrand={handleDeleteBrand}
                        onRenameBrand={handleRenameBrand}
                    />
                );
            case 'crm/dashboard':
                return <CrmDashboardPage brandId={activeBrand.id} onNavigate={setActiveBrandPage} />;
            case 'crm/customers':
                return <CustomersPage brandId={activeBrand.id} onViewCustomer={() => {}} />;
            case 'crm/pipeline':
                return <CrmPipelinePage brandId={activeBrand.id} />;
            case 'crm/tickets':
                return <CrmTicketsPage brandId={activeBrand.id} />;
            default:
                return <div>Page not found: {activeBrandPage}</div>;
        }
    };

    const renderAdminPage = () => {
        const isPageLoading = adminLoading && (
            (activeAdminPage === 'admin-dashboard' && !adminStats) ||
            (activeAdminPage === 'admin-users' && adminUsers.length === 0) ||
            (activeAdminPage === 'admin-tenants' && tenants.length === 0) ||
            (activeAdminPage === 'admin-billing' && !billingOverview && subscriptionPlans.length === 0) ||
            (activeAdminPage === 'admin-ai-monitor' && aiMetrics.length === 0) ||
            (activeAdminPage === 'admin-queues' && queueJobs.length === 0) ||
            (activeAdminPage === 'admin-system-health' && systemHealth.length === 0) ||
            (activeAdminPage === 'admin-settings' && (!adminPermissions || !generalSettings || !securitySettings))
        );

        switch (activeAdminPage) {
            case 'admin-dashboard': return <AdminDashboardPage stats={adminStats} activityLogs={activityLogs} />;
            case 'admin-users': return <AdminUsersPage users={adminUsers} isLoading={isPageLoading} addNotification={addNotification} onRefresh={fetchAdminData} />;
            case 'admin-tenants': return <TenantsPage tenants={tenants} isLoading={isPageLoading} plans={subscriptionPlans} addNotification={addNotification} onRefresh={fetchAdminData} />;
            case 'admin-billing':
                return (
                    <BillingPage
                        plans={subscriptionPlans}
                        overview={billingOverview}
                        subscriptions={billingSubscriptions}
                        invoices={billingInvoices}
                        webhookEvents={billingEvents}
                        auditLogs={billingAuditLogs}
                        isLoading={isPageLoading}
                        onRefreshBilling={fetchAdminData}
                        addNotification={addNotification}
                    />
                );
            case 'admin-ai-monitor': return <AIMonitorPage metrics={aiMetrics} isLoading={isPageLoading} />;
            case 'admin-queues': return <QueuesPage jobs={queueJobs} isLoading={isPageLoading} />;
            case 'admin-system-health': return <SystemHealthPage healthData={systemHealth} isLoading={isPageLoading} />;
            case 'admin-settings': return <AdminSettingsPage permissions={adminPermissions} generalSettings={generalSettings} securitySettings={securitySettings} isLoading={isPageLoading} addNotification={addNotification} />;
            case 'admin-ai-keys': return <AIProviderKeysPage />;
            case 'admin-logs': return <AdminLogsPage />;
            default: return <div>Admin page not found: {activeAdminPage}</div>;
        }
    };

    const announcementColors: Record<string, string> = {
        info:    'bg-blue-500/15 border-blue-500/30 text-blue-300',
        warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        success: 'bg-green-500/15 border-green-500/30 text-green-300',
        danger:  'bg-red-500/15 border-red-500/30 text-red-300',
    };
    const showBanner = announcement?.enabled && announcement.text && !announcementDismissed;

    // Trial status — shown only to authenticated, non-admin users
    const trial = useTrialStatus();
    const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
    const showTrialBanner = isAuthenticated && !isAdmin && !trialBannerDismissed
        && (trial.isExpiringSoon || trial.isExpired);

    const emailConfirmed = !!user?.email_confirmed_at;
    const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);

    return (
        <div className="relative flex h-screen overflow-hidden bg-light-bg font-sans text-light-text dark:bg-dark-bg dark:text-dark-text">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="app-shell-orb -left-20 top-0 h-72 w-72 bg-brand-primary/20" />
                <div className="app-shell-orb bottom-[-8rem] right-[-6rem] h-80 w-80 bg-brand-secondary/20" />
            </div>

            {/* Brand Intelligence "Aha Moment" Modal */}
            {showBrandIntelModal && activeBrand && (
                <BrandIntelligenceModal brand={activeBrand} onClose={() => setShowBrandIntelModal(false)} />
            )}

            {/* Post-verification welcome modal */}
            {showWelcomeModal && user && (
                <WelcomeModal
                    userName={user.user_metadata?.full_name || user.email?.split('@')[0] || ''}
                    onClose={() => setShowWelcomeModal(false)}
                    onUpgrade={() => { setShowWelcomeModal(false); /* navigate to billing */ }}
                />
            )}

            {/* Onboarding Tour */}
            {showOnboarding && user && (
                <OnboardingTour
                    userName={user.user_metadata?.full_name || user.email?.split('@')[0] || ''}
                    email={user.email || ''}
                    emailConfirmed={emailConfirmed}
                    onComplete={() => {
                        setShowOnboarding(false);
                        localStorage.setItem(`onboarding_done_${user.id}`, '1');
                    }}
                />
            )}

            {/* Email verification banner */}
            {isAuthenticated && !isAdmin && !emailConfirmed && !verifyBannerDismissed && (
                <div className="fixed top-0 inset-x-0 z-[99] flex items-center justify-between px-4 py-2 bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-sm font-medium">
                    <div className="flex items-center gap-2">
                        <i className="fas fa-envelope-open text-xs"></i>
                        <span>فعّل بريدك الإلكتروني للوصول الكامل — تحقق من صندوق الوارد</span>
                    </div>
                    <button onClick={() => setVerifyBannerDismissed(true)} className="hover:text-white transition-colors ml-4">
                        <i className="fas fa-times text-xs"></i>
                    </button>
                </div>
            )}

            {/* Announcement Banner */}
            {showBanner && announcement && (
                <div className={`fixed top-0 inset-x-0 z-[100] flex items-center justify-between px-4 py-2 border-b text-sm font-medium ${announcementColors[announcement.type] || announcementColors.info}`}>
                    <div className="flex items-center gap-2">
                        <i className="fas fa-bullhorn text-xs opacity-70"></i>
                        <span>{announcement.text}</span>
                    </div>
                    <button onClick={() => setAnnouncementDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity ms-4 flex-shrink-0">
                        <i className="fas fa-times text-xs"></i>
                    </button>
                </div>
            )}

            {/* Trial expiry banner */}
            {showTrialBanner && (
                <div className={`fixed top-0 inset-x-0 z-[100] flex items-center justify-between gap-3 px-4 py-2 border-b text-sm font-medium ${
                    trial.isExpired
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                }`}>
                    <div className="flex items-center gap-2">
                        <i className={`fas ${trial.isExpired ? 'fa-lock' : 'fa-hourglass-half'} text-xs opacity-80`} />
                        <span>
                            {trial.isExpired
                                ? (ar ? 'انتهت فترة التجربة المجانية. قم بالترقية للاستمرار.' : 'Your free trial has ended. Upgrade to continue.')
                                : (ar ? `تبقّى ${trial.daysLeft} ${trial.daysLeft === 1 ? 'يوم' : 'أيام'} على انتهاء التجربة المجانية.` : `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left in your free trial.`)}
                        </span>
                        <a
                            href="/app/billing"
                            className="ms-1 font-bold underline underline-offset-2 hover:no-underline"
                        >
                            {ar ? 'ترقية الآن' : 'Upgrade now'}
                        </a>
                    </div>
                    <button onClick={() => setTrialBannerDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0" aria-label="Dismiss">
                        <i className="fas fa-times text-xs" />
                    </button>
                </div>
            )}
            {viewMode === 'brand' ? (
                <>
                    <Sidebar
                        activePage={activeBrandPage}
                        onNavigate={setActiveBrandPage}
                        isCollapsed={isSidebarCollapsed}
                        toggleCollapse={toggleSidebar}
                        isMobileOpen={isMobileSidebarOpen}
                        closeMobile={() => setMobileSidebarOpen(false)}
                        completionSteps={[
                            { id: 'email', label: 'تفعيل البريد الإلكتروني', done: emailConfirmed, icon: 'fa-envelope', navigateTo: '' },
                            { id: 'brand', label: 'إنشاء أول براند', done: brands.length > 0, icon: 'fa-layer-group', navigateTo: 'brands' },
                            { id: 'social', label: 'ربط حساب اجتماعي', done: (socialAccounts?.length ?? 0) > 0, icon: 'fa-link', navigateTo: 'integrations' },
                            { id: 'post', label: 'نشر أول منشور', done: scheduledPosts.some(p => (p.status as string) === 'Published'), icon: 'fa-paper-plane', navigateTo: 'social-ops/publisher' },
                        ]}
                    />
                    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                        <Header
                            unreadCount={notifications.filter((notification) => !notification.read).length}
                            onToggleNotifications={() => setShowNotificationsPanel(!showNotificationsPanel)}
                            brands={brands}
                            activeBrand={activeBrand}
                            onSwitchBrand={handleSwitchBrand}
                            onAddBrand={() => setShowAddBrandModal(true)}
                            onManageBrands={() => setActiveBrandPage('brands-manage')}
                            onSwitchToAdmin={() => setViewMode('admin')}
                            onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
                            onSignOut={signOut}
                            userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                            userEmail={user?.email}
                            activePageId={activeBrandPage}
                        />
                        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6">
                            <ErrorBoundary key={activeBrandPage}>
                                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ تحميل الصفحة...' : 'Loading page...'} />}>
                                    {renderBrandPage()}
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </main>
                </>
            ) : (
                <>
                    <AdminSidebar
                        activePage={activeAdminPage}
                        onNavigate={setActiveAdminPage}
                        onSwitchToBrand={() => setViewMode('brand')}
                        onSignOut={signOut}
                        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                        userEmail={user?.email}
                        systemHealth={systemHealth}
                    />
                    <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
                        <AdminHeader
                            onSwitchToBrand={() => setViewMode('brand')}
                            systemHealth={systemHealth}
                            activePageId={activeAdminPage}
                            onToggleCommandPalette={() => setCommandPaletteOpen(true)}
                        />
                        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6">
                            <ErrorBoundary key={activeAdminPage}>
                                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ تحميل لوحة الإدارة...' : 'Loading admin page...'} />}>
                                    {renderAdminPage()}
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </main>
                </>
            )}

            {showNotificationsPanel && (
                <NotificationsPanel
                    notifications={notifications}
                    onMarkAsRead={markNotificationRead}
                    onMarkAllAsRead={markAllNotificationsRead}
                    onClose={() => setShowNotificationsPanel(false)}
                />
            )}

            {showAddBrandModal && (
                brands.length === 0
                    ? <BrandOnboardingWizard
                        onComplete={handleOnboardingComplete}
                        onCancel={() => setShowAddBrandModal(false)}
                        addNotification={addNotification}
                      />
                    : <AddBrandModal
                        onClose={() => setShowAddBrandModal(false)}
                        onCreate={handleAddBrand}
                        currentBrandCount={brands.length}
                      />
            )}

            <Suspense fallback={null}>
                <CommandPalette
                    isOpen={isCommandPaletteOpen}
                    onClose={() => setCommandPaletteOpen(false)}
                    onNavigate={setActiveAdminPage}
                />
            </Suspense>

            <ToastStack />
        </div>
    );
};

const App: React.FC = () => (
    <ErrorBoundary>
        <LanguageProvider>
            <AuthProvider>
                <AppShell />
            </AuthProvider>
        </LanguageProvider>
    </ErrorBoundary>
);

export default App;
