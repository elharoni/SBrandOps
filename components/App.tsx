
import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ErrorBoundary } from './shared/ErrorBoundary';
import { SkeletonPageLoader } from './shared/Skeleton';
import { LoginPage } from './auth/LoginPage';
import { RegisterPage } from './auth/RegisterPage';
import { ForgotPasswordPage } from './auth/ForgotPasswordPage';
import { OnboardingTour } from './onboarding/OnboardingTour';
import { WelcomeModal } from './onboarding/WelcomeModal';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminHeader } from './admin/AdminHeader';
import { BrandRouter } from './routing/BrandRouter';
import { AdminRouter } from './routing/AdminRouter';
import { AddBrandModal } from './AddBrandModal';
import { BrandOnboardingWizard } from './BrandOnboardingWizard';
import { BrandIntelligenceModal } from './BrandIntelligenceModal';
import { MobileBottomNav } from './MobileBottomNav';
import { NotificationsPanel } from './NotificationsPanel';
import { ToastStack } from './shared/ToastStack';

// Stores & Hooks
import { useBrandStore } from '../stores/brandStore';
import { useUIStore } from '../stores/uiStore';
import { useBrandData } from '../hooks/useBrandData';
import { usePageBrandProfile } from '../hooks/page/usePageBrandProfile';
import { useDesignData } from '../hooks/useDesignData';
import { useAdminData } from '../hooks/useAdminData';
import { useAppRouting } from '../hooks/useAppRouting';
import { useTrialStatus } from '../hooks/useTrialStatus';
import { isPublicPath, pathToPublicPage } from '../config/routes';
import { hasLiveProviderConnection } from './pages/integrationsModel';

// Services (AppShell-level only)
import { loadFacebookSDK } from '../services/facebookSDK';
import { setSentryUser, setSentryBrandContext } from '../services/sentryService';
import { getGeneralSettings } from '../services/adminService';

import { NotificationType, Brand } from '../types';
import { SystemData } from '../services/systemService';
import { AnalyticsData } from '../types';
import { AdsDashboardData } from '../types';
import { BrandHubProfile } from '../types';

const CommandPalette = lazy(() => import('./admin/shared/ui/CommandPalette').then(m => ({ default: m.CommandPalette })));
const MarketingSite  = lazy(() => import('./marketing/MarketingSite'));

// ── Fallback data builders ────────────────────────────────────────────────────

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

// ── AppShell ──────────────────────────────────────────────────────────────────

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

    const isAdmin = !!(
        user?.user_metadata?.is_admin ||
        user?.app_metadata?.role === 'admin' ||
        user?.app_metadata?.role === 'super_admin' ||
        user?.user_metadata?.role === 'ADMIN' ||
        user?.user_metadata?.role === 'SUPER_ADMIN'
    );

    const currentPublicPage = pathToPublicPage(location.pathname) as
        | 'home' | 'about' | 'pricing' | 'billing' | 'contact'
        | 'security' | 'terms' | 'privacy' | 'dpa' | 'refunds' | 'cookies';

    // ── Zustand: Brand Store ──────────────────────────────────────────────────
    const {
        brands, activeBrand, isLoading: brandsLoading,
        fetchBrands, createBrand, switchBrand, deleteBrand, updateBrand,
    } = useBrandStore();

    // ── Zustand: UI Store ─────────────────────────────────────────────────────
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

    // ── URL Routing ───────────────────────────────────────────────────────────
    useAppRouting({
        viewMode, activeBrandPage, activeAdminPage,
        isAuthenticated, isAdmin, authPage,
        setActiveBrandPage, setActiveAdminPage, setViewMode, setAuthPage,
    });

    // ── Mobile: auto-redirect dashboard → mobile-home ────────────────────────
    useEffect(() => {
        if (isAuthenticated && activeBrandPage === 'dashboard' && window.innerWidth < 1024) {
            setActiveBrandPage('mobile-home');
        }
    }, [isAuthenticated, activeBrandPage]);

    // ── Data hooks ────────────────────────────────────────────────────────────
    const {
        socialAccounts, scheduledPosts, brandConnections,
        isLoading: brandDataLoading, fetchDataForBrand,
    } = useBrandData(addNotification);

    const {
        designAssets, designWorkflows, recentJobs, fetchDesignData,
        addAssetLocally, addJobLocally, updateJobLocally, removeAssetLocally,
    } = useDesignData(addNotification);

    const {
        adminStats, adminUsers, tenants, subscriptionPlans,
        billingOverview, billingSubscriptions, billingInvoices, billingEvents, billingAuditLogs,
        aiMetrics, queueJobs, systemHealth, activityLogs,
        adminPermissions, generalSettings, securitySettings,
        isLoading: adminLoading, fetchAdminData,
    } = useAdminData(addNotification);

    // ── Local UI state ────────────────────────────────────────────────────────
    const [showBrandIntelModal, setShowBrandIntelModal] = useState(false);
    const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
    const [verifyBannerDismissed, setVerifyBannerDismissed] = useState(false);
    const trial = useTrialStatus();

    const resolvedBrandProfile = buildFallbackBrandProfile(activeBrand?.name ?? '');
    const resolvedAnalyticsData = buildFallbackAnalyticsData();
    const resolvedAdsDashboardData = buildFallbackAdsDashboardData();
    const resolvedSystemData = buildFallbackSystemData();
    const hasLiveGoogleAdsConnection = hasLiveProviderConnection(brandConnections, ['google_ads']);
    const { data: fetchedBrandProfile } = usePageBrandProfile(activeBrand?.id, activeBrand?.name ?? '');

    // ── Effects ───────────────────────────────────────────────────────────────

    useEffect(() => {
        if (isAuthenticated && viewMode === 'brand') fetchBrands();
    }, [isAuthenticated, viewMode, fetchBrands]);

    useEffect(() => {
        if (isAuthenticated && user) {
            setSentryUser({ id: user.id, email: user.email ?? undefined, name: user.user_metadata?.full_name ?? undefined });
        } else {
            setSentryUser(null);
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (activeBrand) {
            fetchDataForBrand(activeBrand);
            fetchDesignData(activeBrand.id);
            setSentryBrandContext(activeBrand.id, activeBrand.name);
        }
    }, [activeBrand, fetchDataForBrand, fetchDesignData]);

    useEffect(() => {
        if (viewMode === 'admin' && isAuthenticated) fetchAdminData();
    }, [viewMode, isAuthenticated, fetchAdminData]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const key = `onboarding_done_${user.id}`;
        if (!localStorage.getItem(key)) setShowOnboarding(true);
    }, [isAuthenticated, user]);

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

    useEffect(() => {
        if (!isAuthenticated) return;
        getGeneralSettings().then(s => {
            setMaintenanceMode(s.maintenanceMode);
            setAnnouncement({ text: s.announcementText, type: s.announcementType, enabled: s.announcementEnabled });
        }).catch(() => {});
    }, [isAuthenticated]);

    useEffect(() => {
        const fbAppId = import.meta.env.VITE_FACEBOOK_APP_ID;
        if (fbAppId) loadFacebookSDK(fbAppId).catch(err => console.warn('Facebook SDK failed to load:', err));
    }, []);

    // ── Auth Guards ───────────────────────────────────────────────────────────
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
                    <i className="fas fa-layer-group text-white text-2xl" />
                </div>
                <i className="fas fa-circle-notch fa-spin text-brand-primary text-2xl mb-2" />
                <p className="text-light-text-secondary dark:text-dark-text-secondary text-sm">
                    {ar ? 'جارٍ التحقق من الجلسة...' : 'Checking session...'}
                </p>
            </div>
        );
    }

    if (!isAuthenticated) {
        if (authPage === 'register') {
            return <RegisterPage onSuccess={() => setAuthPage('login')} onNavigateToLogin={() => setAuthPage('login')} />;
        }
        if (authPage === 'forgot') {
            return <ForgotPasswordPage onNavigateToLogin={() => setAuthPage('login')} />;
        }
        return (
            <LoginPage
                onSuccess={() => { /* AuthContext listener handles state update */ }}
                onNavigateToRegister={() => setAuthPage('register')}
                onNavigateToForgot={() => setAuthPage('forgot')}
            />
        );
    }

    if (maintenanceMode && !isAdmin) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-light-bg dark:bg-dark-bg px-6 text-center">
                <div className="max-w-md">
                    <div className="w-20 h-20 rounded-2xl bg-warning/20 flex items-center justify-center mx-auto mb-6">
                        <i className="fas fa-tools text-warning text-3xl" />
                    </div>
                    <h1 className="text-3xl font-bold text-light-text dark:text-dark-text mb-3">النظام تحت الصيانة</h1>
                    <p className="text-light-text-secondary dark:text-dark-text-secondary mb-6">
                        نعمل على تحسين التطبيق. سنعود قريباً. شكراً لصبرك.
                    </p>
                    <button
                        onClick={signOut}
                        className="px-5 py-2.5 rounded-lg border border-light-border dark:border-dark-border text-light-text-secondary hover:text-danger transition-colors text-sm"
                    >
                        <i className="fas fa-sign-out-alt me-2" />تسجيل الخروج
                    </button>
                </div>
            </div>
        );
    }

    // ── Brand Event Handlers ──────────────────────────────────────────────────
    const handleSwitchBrand = (brandId: string) => switchBrand(brandId);

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

    const handleOnboardingComplete = async (brandId: string) => {
        setShowAddBrandModal(false);
        await fetchBrands();
        switchBrand(brandId);
        setActiveBrandPage('social-ops/publisher');
        addNotification(NotificationType.Success, ar ? 'تم إنشاء البراند! أنشئ أول منشور الآن.' : 'Brand ready! Create your first post.');
        const intelKey = `brand_intel_shown_${user?.id}`;
        if (!localStorage.getItem(intelKey)) {
            localStorage.setItem(intelKey, '1');
            setTimeout(() => setShowBrandIntelModal(true), 800);
        }
    };

    // ── Admin page-specific loading ───────────────────────────────────────────
    const isAdminPageLoading = adminLoading && (
        (activeAdminPage === 'admin-dashboard' && !adminStats) ||
        (activeAdminPage === 'admin-users' && adminUsers.length === 0) ||
        (activeAdminPage === 'admin-tenants' && tenants.length === 0) ||
        (activeAdminPage === 'admin-billing' && !billingOverview && subscriptionPlans.length === 0) ||
        (activeAdminPage === 'admin-ai-monitor' && aiMetrics.length === 0) ||
        (activeAdminPage === 'admin-queues' && queueJobs.length === 0) ||
        (activeAdminPage === 'admin-system-health' && systemHealth.length === 0) ||
        (activeAdminPage === 'admin-settings' && (!adminPermissions || !generalSettings || !securitySettings))
    );

    // ── Banners ───────────────────────────────────────────────────────────────
    const announcementColors: Record<string, string> = {
        info:    'bg-blue-500/15 border-blue-500/30 text-blue-300',
        warning: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
        success: 'bg-green-500/15 border-green-500/30 text-green-300',
        danger:  'bg-red-500/15 border-red-500/30 text-red-300',
    };
    const showBanner = announcement?.enabled && announcement.text && !announcementDismissed;
    const showTrialBanner = isAuthenticated && !isAdmin && !trialBannerDismissed && (trial.isExpiringSoon || trial.isExpired);
    const emailConfirmed = !!user?.email_confirmed_at;

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="relative flex h-screen overflow-hidden bg-light-bg font-sans text-light-text dark:bg-dark-bg dark:text-dark-text">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="app-shell-orb -left-20 top-0 h-72 w-72 bg-brand-primary/20" />
                <div className="app-shell-orb bottom-[-8rem] right-[-6rem] h-80 w-80 bg-brand-secondary/20" />
            </div>

            {showBrandIntelModal && activeBrand && (
                <BrandIntelligenceModal brand={activeBrand} onClose={() => setShowBrandIntelModal(false)} />
            )}
            {showWelcomeModal && user && (
                <WelcomeModal
                    userName={user.user_metadata?.full_name || user.email?.split('@')[0] || ''}
                    onClose={() => setShowWelcomeModal(false)}
                    onUpgrade={() => setShowWelcomeModal(false)}
                />
            )}
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
                        <i className="fas fa-envelope-open text-xs" />
                        <span>فعّل بريدك الإلكتروني للوصول الكامل — تحقق من صندوق الوارد</span>
                    </div>
                    <button onClick={() => setVerifyBannerDismissed(true)} className="hover:text-white transition-colors ml-4">
                        <i className="fas fa-times text-xs" />
                    </button>
                </div>
            )}

            {/* Announcement banner */}
            {showBanner && announcement && (
                <div className={`fixed top-0 inset-x-0 z-[100] flex items-center justify-between px-4 py-2 border-b text-sm font-medium ${announcementColors[announcement.type] || announcementColors.info}`}>
                    <div className="flex items-center gap-2">
                        <i className="fas fa-bullhorn text-xs opacity-70" />
                        <span>{announcement.text}</span>
                    </div>
                    <button onClick={() => setAnnouncementDismissed(true)} className="opacity-60 hover:opacity-100 transition-opacity ms-4 flex-shrink-0">
                        <i className="fas fa-times text-xs" />
                    </button>
                </div>
            )}

            {/* Trial expiry banner */}
            {showTrialBanner && (
                <div className={`fixed top-0 inset-x-0 z-[100] flex items-center justify-between gap-3 px-4 py-2 border-b text-sm font-medium ${trial.isExpired ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-amber-500/15 border-amber-500/30 text-amber-400'}`}>
                    <div className="flex items-center gap-2">
                        <i className={`fas ${trial.isExpired ? 'fa-lock' : 'fa-hourglass-half'} text-xs opacity-80`} />
                        <span>
                            {trial.isExpired
                                ? (ar ? 'انتهت فترة التجربة المجانية. قم بالترقية للاستمرار.' : 'Your free trial has ended. Upgrade to continue.')
                                : (ar ? `تبقّى ${trial.daysLeft} ${trial.daysLeft === 1 ? 'يوم' : 'أيام'} على انتهاء التجربة المجانية.` : `${trial.daysLeft} day${trial.daysLeft === 1 ? '' : 's'} left in your free trial.`)}
                        </span>
                        <a href="/app/billing" className="ms-1 font-bold underline underline-offset-2 hover:no-underline">
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
                            unreadCount={notifications.filter(n => !n.read).length}
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
                        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-6 lg:pb-6 pb-24">
                            <ErrorBoundary key={activeBrandPage}>
                                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ تحميل الصفحة...' : 'Loading page...'} />}>
                                    <BrandRouter
                                        activePage={activeBrandPage}
                                        brandsLoading={brandsLoading}
                                        brandDataLoading={brandDataLoading}
                                        activeBrand={activeBrand}
                                        brands={brands}
                                        user={user}
                                        socialAccounts={socialAccounts}
                                        scheduledPosts={scheduledPosts}
                                        brandConnections={brandConnections}
                                        resolvedBrandProfile={resolvedBrandProfile}
                                        resolvedAnalyticsData={resolvedAnalyticsData}
                                        resolvedAdsDashboardData={resolvedAdsDashboardData}
                                        resolvedSystemData={resolvedSystemData}
                                        fetchedBrandProfile={fetchedBrandProfile}
                                        hasLinkedAds={hasLiveGoogleAdsConnection}
                                        designAssets={designAssets}
                                        designWorkflows={designWorkflows}
                                        recentJobs={recentJobs}
                                        addAssetLocally={addAssetLocally}
                                        addJobLocally={addJobLocally}
                                        updateJobLocally={updateJobLocally}
                                        removeAssetLocally={removeAssetLocally}
                                        onNavigate={setActiveBrandPage}
                                        onSwitchBrand={handleSwitchBrand}
                                        onAddBrand={() => setShowAddBrandModal(true)}
                                        onDeleteBrand={handleDeleteBrand}
                                        onRenameBrand={handleRenameBrand}
                                        onRefreshBrand={() => activeBrand && fetchDataForBrand(activeBrand)}
                                        onRefreshDesign={() => activeBrand && fetchDesignData(activeBrand.id)}
                                        addNotification={addNotification}
                                        ar={ar}
                                    />
                                </Suspense>
                            </ErrorBoundary>
                        </div>
                    </main>
                    <MobileBottomNav
                        activePage={activeBrandPage}
                        onNavigate={setActiveBrandPage}
                        onOpenSidebar={() => setMobileSidebarOpen(true)}
                        unreadCount={notifications.filter(n => !n.read).length}
                    />
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
                                    <AdminRouter
                                        activePage={activeAdminPage}
                                        adminStats={adminStats}
                                        adminUsers={adminUsers}
                                        tenants={tenants}
                                        subscriptionPlans={subscriptionPlans}
                                        billingOverview={billingOverview}
                                        billingSubscriptions={billingSubscriptions}
                                        billingInvoices={billingInvoices}
                                        billingEvents={billingEvents}
                                        billingAuditLogs={billingAuditLogs}
                                        aiMetrics={aiMetrics}
                                        queueJobs={queueJobs}
                                        systemHealth={systemHealth}
                                        activityLogs={activityLogs}
                                        adminPermissions={adminPermissions}
                                        generalSettings={generalSettings}
                                        securitySettings={securitySettings}
                                        isLoading={isAdminPageLoading}
                                        addNotification={addNotification}
                                        onRefresh={fetchAdminData}
                                    />
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

// ── App root ──────────────────────────────────────────────────────────────────

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
