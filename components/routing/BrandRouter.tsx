import React, { useState, lazy, Suspense } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
    Brand, SocialAccount, ScheduledPost, NotificationType,
    ContentPiece, PostStatus, ContentStatus, SocialPlatform, MediaItem,
    AIContentIdea, PublisherBrief, DesignAsset, DesignWorkflow, DesignJob,
    BrandHubProfile, AnalyticsData, OperationalError, InboxConversation,
    AdsDashboardData, Workflow, MarketingPlan,
} from '../../types';
import type { BrandConnection } from '../../services/brandConnectionService';
import type { SystemData } from '../../services/systemService';
import {
    SkeletonDashboard, SkeletonAnalytics, SkeletonTable,
    SkeletonCardGrid, SkeletonInbox, SkeletonPageLoader,
} from '../shared/Skeleton';
import { createScheduledPost, updateScheduledPost, deleteScheduledPost } from '../../services/postsService';
import { updateBrandProfile } from '../../services/brandHubService';
import { connectSocialAccount } from '../../services/socialAccountService';
import { syncAnalytics } from '../../services/analyticsService';
import { addContentPiece, updateContentPiece, addComment, deleteContentPiece } from '../../services/contentOpsService';
import { addMarketingPlan } from '../../services/marketingPlansService';
import { inviteUser, updateUserRole, deleteUser, revokeSession, generateApiKey, deleteApiKey } from '../../services/systemService';
import { BrandBrainReviewScreen } from '../BrandBrainReviewScreen';

const MobileHomePage    = lazy(() => import('../pages/MobileHomePage').then(m => ({ default: m.MobileHomePage })));
const DashboardPage     = lazy(() => import('../pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PublisherPage     = lazy(() => import('../pages/PublisherPage').then(m => ({ default: m.PublisherPage })));
const ScheduledPage     = lazy(() => import('../pages/ScheduledPage').then(m => ({ default: m.ScheduledPage })));
const AccountsPage      = lazy(() => import('../pages/AccountsPage').then(m => ({ default: m.AccountsPage })));
const CalendarPage      = lazy(() => import('../pages/CalendarPage').then(m => ({ default: m.CalendarPage })));
const AnalyticsPage     = lazy(() => import('../pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const BrandHubPage      = lazy(() => import('../pages/BrandHubPage').then(m => ({ default: m.BrandHubPage })));
const BrandsManagePage  = lazy(() => import('../pages/BrandsManagePage').then(m => ({ default: m.BrandsManagePage })));
const ContentOpsPage    = lazy(() => import('../pages/ContentOpsPage').then(m => ({ default: m.ContentOpsPage })));
const AdsOpsPage        = lazy(() => import('../pages/AdsOpsPage').then(m => ({ default: m.AdsOpsPage })));
const SEOOpsPage        = lazy(() => import('../pages/SEOOpsPageV2'));
const SocialSearchPage  = lazy(() => import('../pages/SocialSearchPage').then(m => ({ default: m.SocialSearchPage })));
const IdeaOpsPage       = lazy(() => import('../pages/IdeaOpsPage').then(m => ({ default: m.IdeaOpsPage })));
const InboxPage         = lazy(() => import('../pages/InboxPage').then(m => ({ default: m.InboxPage })));
const WorkflowPage      = lazy(() => import('../pages/WorkflowPage').then(m => ({ default: m.WorkflowPage })));
const SmartBotPage      = lazy(() => import('../pages/SmartBotPage').then(m => ({ default: m.SmartBotPage })));
const IntegrationsPage  = lazy(() => import('../pages/IntegrationsPage').then(m => ({ default: m.IntegrationsPage })));
const ErrorCenterPage   = lazy(() => import('../pages/ErrorCenterPage').then(m => ({ default: m.ErrorCenterPage })));
const SystemPage        = lazy(() => import('../pages/SystemPage').then(m => ({ default: m.SystemPage })));
const UserSettingsPage  = lazy(() => import('../pages/UserSettingsPage').then(m => ({ default: m.UserSettingsPage })));
const MarketingPlansPage = lazy(() => import('../pages/MarketingPlansPage').then(m => ({ default: m.MarketingPlansPage })));
const BrandAnalysisPage  = lazy(() => import('../pages/BrandAnalysisPage').then(m => ({ default: m.BrandAnalysisPage })));
const BrandBrainPage     = lazy(() => import('../pages/BrandBrainPage').then(m => ({ default: m.BrandBrainPage })));
const BrandKnowledgePage = lazy(() => import('../pages/BrandKnowledgePage').then(m => ({ default: m.BrandKnowledgePage })));
const IntegrationOSPage  = lazy(() => import('../pages/IntegrationOSPage').then(m => ({ default: m.IntegrationOSPage })));
const TeamManagementPage = lazy(() => import('../pages/TeamManagementPage').then(m => ({ default: m.TeamManagementPage })));
const UserBillingPage    = lazy(() => import('../pages/UserBillingPage').then(m => ({ default: m.UserBillingPage })));
const CrmDashboardPage   = lazy(() => import('../pages/crm/CrmDashboardPage').then(m => ({ default: m.CrmDashboardPage })));
const CustomersPage      = lazy(() => import('../pages/crm/CustomersPage').then(m => ({ default: m.CustomersPage })));
const CrmPipelinePage    = lazy(() => import('../pages/crm/CrmPipelinePage').then(m => ({ default: m.CrmPipelinePage })));
const CrmTicketsPage     = lazy(() => import('../pages/crm/CrmTicketsPage').then(m => ({ default: m.CrmTicketsPage })));
const DesignOpsPage      = lazy(() => import('../pages/DesignOpsPage').then(m => ({ default: m.DesignOpsPage })));
const VideoStudioPage    = lazy(() => import('../pages/VideoStudioPage').then(m => ({ default: m.VideoStudioPage })));
const ContentStudioPage  = lazy(() => import('../pages/ContentStudioPage').then(m => ({ default: m.ContentStudioPage })));
const MediaOpsPage       = lazy(() => import('../pages/MediaOpsPage').then(m => ({ default: m.MediaOpsPage })));
const AssetLibraryPage     = lazy(() => import('../pages/AssetLibraryPage').then(m => ({ default: m.AssetLibraryPage })));
const CampaignBrainPage    = lazy(() => import('../pages/CampaignBrainPage').then(m => ({ default: m.CampaignBrainPage })));
const SupportInboxPage     = lazy(() => import('../pages/support/SupportInboxPage').then(m => ({ default: m.SupportInboxPage })));

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

export interface BrandRouterProps {
    activePage: string;
    brandsLoading: boolean;
    brandDataLoading: boolean;
    activeBrand: Brand | null;
    brands: Brand[];
    user: any;
    socialAccounts: SocialAccount[];
    scheduledPosts: ScheduledPost[];
    brandConnections: BrandConnection[];
    resolvedBrandProfile: BrandHubProfile;
    resolvedAnalyticsData: AnalyticsData;
    resolvedAdsDashboardData: AdsDashboardData;
    resolvedSystemData: SystemData;
    fetchedBrandProfile?: BrandHubProfile | null;
    hasLinkedAds: boolean;
    designAssets: DesignAsset[];
    designWorkflows: DesignWorkflow[];
    recentJobs: DesignJob[];
    addAssetLocally: (asset: DesignAsset) => void;
    addJobLocally: (job: DesignJob) => void;
    updateJobLocally: (updatedJob: DesignJob) => void;
    removeAssetLocally: (id: string) => void;
    onNavigate: (page: string) => void;
    onSwitchBrand: (id: string) => void;
    onAddBrand: () => void;
    onDeleteBrand: (id: string) => void | Promise<void>;
    onRenameBrand: (id: string, name: string) => void | Promise<void>;
    onRefreshBrand: () => void | Promise<void>;
    onRefreshDesign: () => void;
    addNotification: (type: NotificationType, message: string) => void;
    ar: boolean;
}

export const BrandRouter: React.FC<BrandRouterProps> = ({
    activePage,
    brandsLoading, brandDataLoading,
    activeBrand, brands, user,
    socialAccounts, scheduledPosts, brandConnections,
    resolvedBrandProfile, resolvedAnalyticsData, resolvedAdsDashboardData, resolvedSystemData,
    fetchedBrandProfile, hasLinkedAds,
    designAssets, designWorkflows, recentJobs,
    addAssetLocally, addJobLocally, updateJobLocally, removeAssetLocally,
    onNavigate, onSwitchBrand, onAddBrand, onDeleteBrand, onRenameBrand,
    onRefreshBrand, onRefreshDesign,
    addNotification, ar,
}) => {
    // Publisher flow state lives here — only used within brand page rendering
    const [postToEdit, setPostToEdit] = useState<ScheduledPost | null>(null);
    const [publisherBrief, setPublisherBrief] = useState<PublisherBrief | null>(null);

    // ── Empty-value stubs for pages that fetch their own data via hooks/page/* ─
    const contentPipeline: ContentPiece[] = [];
    const errors: OperationalError[] = [];
    const conversations: InboxConversation[] = [];
    const workflows: Workflow[] = [];
    const marketingPlans: MarketingPlan[] = [];
    const brandAssets: null = null;

    // ── Publisher handlers ────────────────────────────────────────────────────
    const handleEditPost = (post: ScheduledPost) => {
        setPublisherBrief(null);
        setPostToEdit(post);
        onNavigate('social-ops/publisher');
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
            status: post.status,
            instagramFirstComment: post.instagramFirstComment,
            locations: post.locations,
        });
        onRefreshBrand();
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
        onRefreshBrand();
    };

    const handleDeletePost = async (id: string) => {
        await deleteScheduledPost(id);
        onRefreshBrand();
    };

    const handleLoadPublisherBrief = (brief: PublisherBrief) => {
        setPostToEdit(null);
        setPublisherBrief(brief);
        onNavigate('social-ops/publisher');
    };

    const handleGenerateFromBrief = (brief: PublisherBrief) => {
        setPostToEdit(null);
        setPublisherBrief(brief);
        onNavigate('social-ops/publisher');
    };

    const handleSendToPublisher = (contentPiece: ContentPiece) => {
        setPublisherBrief(null);
        setPostToEdit({
            id: '',
            content: contentPiece.generatedContent,
            platforms: [],
            media: contentPiece.media,
            status: PostStatus.Draft,
            scheduledAt: null,
        });
        onNavigate('social-ops/publisher');
        addNotification(NotificationType.Info, `Content "${contentPiece.title}" sent to publisher.`);
    };

    const handleSocialIdeaToPublisher = (idea: AIContentIdea) => {
        const brief = idea.brief;
        const suggestedPlatforms = brief?.suggestedPlatforms ?? idea.suggestedPlatforms ?? [];
        const content = [idea.title, idea.description, brief?.cta ? `${ar ? 'الدعوة للإجراء:' : 'CTA:'} ${brief.cta}` : '']
            .filter(Boolean)
            .join('\n\n');

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
        setPostToEdit({
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
        });
        onNavigate('social-ops/publisher');
        addNotification(NotificationType.Info, ar ? `تم إرسال الفكرة "${idea.title}" إلى مساحة النشر.` : `Sent "${idea.title}" to the publisher workspace.`);
    };

    const handleAddTask = async (title: string, description: string) => {
        if (!activeBrand) return;
        await addContentPiece(activeBrand.id, {
            title,
            generatedContent: description,
            type: 'Task',
            status: ContentStatus.Ideas,
            assignee: undefined,
            dueDate: undefined,
        });
        onRefreshBrand();
        addNotification(NotificationType.Success, 'Task created in Content Ops from inbox conversation.');
    };

    const handleConnectAccount = async (platform: SocialPlatform, username: string) => {
        if (!activeBrand) return;
        try {
            await connectSocialAccount(activeBrand.id, platform, username);
            addNotification(NotificationType.Success, `Connected to ${platform} as @${username}`);
            onRefreshBrand();
        } catch {
            addNotification(NotificationType.Error, 'Failed to connect account.');
        }
    };

    const handleDesignSendToPublisher = (asset: DesignAsset) => {
        const mediaItem: MediaItem = {
            id: asset.id,
            type: 'image',
            url: asset.url,
            file: new File([], asset.name, { type: 'image/jpeg' }),
        };
        setPostToEdit({
            id: '', content: '', platforms: [],
            media: [mediaItem], status: PostStatus.Draft, scheduledAt: null,
        });
        setPublisherBrief(null);
        onNavigate('social-ops/publisher');
        addNotification(NotificationType.Info, `تم إرسال "${asset.name}" للـ Publisher`);
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (brandsLoading || (brandDataLoading && activeBrand)) {
        switch (activePage) {
            case 'mobile-home':
            case 'dashboard':            return <SkeletonDashboard />;
            case 'analytics':            return <SkeletonAnalytics />;
            case 'inbox':                return <SkeletonInbox />;
            case 'social-ops/scheduled': return <div className="p-6"><SkeletonTable rows={6} cols={5} /></div>;
            case 'content-ops':          return <div className="p-6"><SkeletonCardGrid count={6} cols={3} /></div>;
            case 'design-ops':           return <div className="p-6"><SkeletonCardGrid count={5} cols={3} /></div>;
            case 'ads-ops':              return <div className="p-6"><SkeletonAnalytics /></div>;
            default:                     return <SkeletonPageLoader label={ar ? 'جارٍ تحميل البيانات...' : 'Loading data...'} />;
        }
    }

    if (!activeBrand) {
        return <NoBrandState onCreateBrand={onAddBrand} />;
    }

    // ── Brand page router ─────────────────────────────────────────────────────
    switch (activePage) {
        case 'mobile-home':
            return (
                <MobileHomePage
                    brandId={activeBrand.id}
                    brandName={activeBrand.name}
                    onNavigate={onNavigate}
                />
            );

        case 'dashboard':
            return (
                <DashboardPage
                    analyticsData={resolvedAnalyticsData}
                    scheduledPosts={scheduledPosts}
                    conversations={conversations}
                    errors={errors}
                    onEditPost={handleEditPost}
                    onDeletePost={handleDeletePost}
                    userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]}
                    onNavigate={onNavigate}
                    hasConnectedAccount={socialAccounts.length > 0}
                    hasBrandProfile={Boolean(fetchedBrandProfile)}
                    hasLinkedAds={hasLinkedAds}
                    brandProfile={resolvedBrandProfile ?? undefined}
                    brandId={activeBrand.id}
                    onSyncAnalytics={() => syncAnalytics(activeBrand.id)}
                />
            );

        case 'social-ops/publisher':
            return (
                <PublisherPage
                    addNotification={addNotification}
                    onSavePost={handleSavePost}
                    onUpdatePost={handleUpdatePost}
                    brandProfile={resolvedBrandProfile}
                    postToEdit={postToEdit}
                    onPostEdited={() => { setPostToEdit(null); setPublisherBrief(null); }}
                    brandId={activeBrand.id}
                    publisherBrief={publisherBrief}
                    onLoadBrief={handleLoadPublisherBrief}
                    onGenerateFromBrief={handleGenerateFromBrief}
                    onNavigate={onNavigate}
                />
            );

        case 'social-ops/scheduled':
            return (
                <ScheduledPage
                    posts={scheduledPosts}
                    onEditPost={handleEditPost}
                    onDeletePost={handleDeletePost}
                    onNavigateToPublisher={() => onNavigate('social-ops/publisher')}
                />
            );

        case 'social-ops/accounts':
            return (
                <AccountsPage
                    brandId={activeBrand.id}
                    accounts={socialAccounts}
                    onConnect={handleConnectAccount}
                    onRefresh={onRefreshBrand}
                    addNotification={addNotification}
                />
            );

        case 'social-ops/social-search':
            return (
                <SocialSearchPage
                    brandId={activeBrand.id}
                    addNotification={addNotification}
                    onSendToPublisher={handleSocialIdeaToPublisher}
                />
            );

        case 'calendar':
            return (
                <CalendarPage
                    posts={scheduledPosts}
                    contentPipeline={contentPipeline}
                    onEditPost={handleEditPost}
                    onUpdatePost={handleUpdatePost}
                    onDeletePost={handleDeletePost}
                    brandProfile={resolvedBrandProfile}
                    brandId={activeBrand.id}
                    onSendToPublisher={handleLoadPublisherBrief}
                    addNotification={addNotification}
                    onAddToContentPipeline={(title, content) =>
                        addContentPiece(activeBrand.id, { title, generatedContent: content, type: 'Social', status: 'Ideas' as any, platforms: [] })
                    }
                />
            );

        case 'content-ops':
            return (
                <ContentOpsPage
                    addNotification={addNotification}
                    initialContent={contentPipeline}
                    brandProfile={resolvedBrandProfile}
                    brandId={activeBrand.id}
                    onAddPiece={async (piecesData) => {
                        await Promise.all(piecesData.map(piece => addContentPiece(activeBrand.id, piece)));
                        onRefreshBrand();
                    }}
                    onUpdatePiece={async (id, updates) => {
                        await updateContentPiece(activeBrand.id, id, updates);
                        onRefreshBrand();
                    }}
                    onAddComment={async (id, text) => {
                        await addComment(activeBrand.id, id, {
                            id: crypto.randomUUID(),
                            author: user?.user_metadata?.full_name || user?.email || 'مستخدم',
                            text,
                            timestamp: new Date(),
                        });
                        onRefreshBrand();
                    }}
                    onSendToPublisher={handleSendToPublisher}
                    onLoadBrief={handleLoadPublisherBrief}
                    onGenerateFromBrief={handleGenerateFromBrief}
                    onDeletePiece={async (id) => {
                        await deleteContentPiece(activeBrand.id, id);
                        onRefreshBrand();
                    }}
                    users={resolvedSystemData.users}
                />
            );

        case 'design-ops':
            return (
                <DesignOpsPage
                    brandId={activeBrand.id}
                    brand={activeBrand}
                    brandProfile={resolvedBrandProfile}
                    designAssets={designAssets}
                    designWorkflows={designWorkflows}
                    recentJobs={recentJobs}
                    addNotification={addNotification}
                    onSendToPublisher={handleDesignSendToPublisher}
                    onAssetAdded={addAssetLocally}
                    onJobAdded={addJobLocally}
                    onJobUpdated={updateJobLocally}
                    onAssetDeleted={removeAssetLocally}
                    onRefresh={onRefreshDesign}
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
                    onNavigate={onNavigate}
                />
            );

        case 'ads-ops':
            return (
                <AdsOpsPage
                    addNotification={addNotification}
                    brandProfile={resolvedBrandProfile}
                    campaigns={[]}
                    dashboardData={resolvedAdsDashboardData}
                    brandConnections={brandConnections}
                    brandAssets={brandAssets}
                    onNavigate={onNavigate}
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
                        onRefreshBrand();
                    }}
                    onSendToPublisher={handleLoadPublisherBrief}
                />
            );

        case 'ai-video':
            return (
                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ التحميل...' : 'Loading...'} />}>
                    <VideoStudioPage addNotification={addNotification} brandId={activeBrand.id} onNavigate={onNavigate} />
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
                        onNavigate={onNavigate}
                        initialBrief={publisherBrief}
                    />
                </Suspense>
            );

        case 'media-ops':
            return (
                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ التحميل...' : 'Loading...'} />}>
                    <MediaOpsPage
                        brandId={activeBrand.id}
                        brandProfile={resolvedBrandProfile}
                        addNotification={addNotification}
                        onNavigate={onNavigate}
                        onSendToPublisher={handleLoadPublisherBrief}
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
                            onNavigate('social-ops/publisher');
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
                    onNavigate={onNavigate}
                />
            );

        case 'inbox':
            return (
                <InboxPage
                    brandId={activeBrand.id}
                    addNotification={addNotification}
                    brandProfile={resolvedBrandProfile}
                    conversations={conversations}
                    onAddTask={handleAddTask}
                />
            );

        case 'brand-hub':
            return (
                <BrandHubPage
                    brandId={activeBrand.id}
                    initialProfile={resolvedBrandProfile}
                    onUpdate={(p) => updateBrandProfile(activeBrand.id, p)}
                    addNotification={addNotification}
                />
            );

        case 'brand-brain':
            return <BrandBrainPage brandId={activeBrand.id} brandName={activeBrand.name} addNotification={addNotification} />;

        case 'campaign-brain':
            return (
                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ تحميل Campaign Brain...' : 'Loading Campaign Brain...'} />}>
                    <CampaignBrainPage
                        brandId={activeBrand.id}
                        brandProfile={resolvedBrandProfile}
                        addNotification={addNotification}
                    />
                </Suspense>
            );

        case 'brand-knowledge':
            return (
                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ التحميل...' : 'Loading...'} />}>
                    <BrandKnowledgePage brandId={activeBrand.id} addNotification={addNotification} />
                </Suspense>
            );

        case 'brand-brain-review':
            return resolvedBrandProfile
                ? (
                    <BrandBrainReviewScreen
                        brandProfile={resolvedBrandProfile}
                        onApprove={() => onNavigate('dashboard')}
                        onEdit={() => onNavigate('brand-hub')}
                    />
                )
                : (
                    <BrandHubPage
                        brandId={activeBrand.id}
                        initialProfile={resolvedBrandProfile}
                        onUpdate={(p) => updateBrandProfile(activeBrand.id, p)}
                        addNotification={addNotification}
                    />
                );

        case 'brand-analysis':
            return <BrandAnalysisPage brandProfile={resolvedBrandProfile} addNotification={addNotification} />;

        case 'workflow':
            return (
                <SmartBotPage
                    brandId={activeBrand.id}
                    brand={activeBrand}
                    brandProfile={resolvedBrandProfile}
                    addNotification={addNotification}
                />
            );

        case 'integrations':
            return (
                <IntegrationsPage
                    brandId={activeBrand.id}
                    socialAccounts={socialAccounts}
                    brandConnections={brandConnections}
                    brandAssets={brandAssets}
                    onRefresh={onRefreshBrand}
                    onNavigate={onNavigate}
                />
            );

        case 'integration-os':
            return <IntegrationOSPage brandId={activeBrand.id} addNotification={addNotification} />;

        case 'error-center':
            return <ErrorCenterPage addNotification={addNotification} errors={errors} />;

        case 'system':
            return (
                <SystemPage
                    brandId={activeBrand.id}
                    {...resolvedSystemData}
                    addNotification={addNotification}
                    onRefreshSystem={async () => { await Promise.resolve(onRefreshBrand()); }}
                    onInviteUser={async (email, role) => { await inviteUser(activeBrand.id, email, role); onRefreshBrand(); }}
                    onUpdateUserRole={async (userId, role) => { await updateUserRole(activeBrand.id, userId, role); onRefreshBrand(); }}
                    onDeleteUser={async (userId) => { await deleteUser(activeBrand.id, userId); onRefreshBrand(); }}
                    onRevokeSession={async (sessionId) => { await revokeSession(activeBrand.id, sessionId); onRefreshBrand(); }}
                    onGenerateApiKey={async (name) => { const { fullSecret } = await generateApiKey(activeBrand.id, name); onRefreshBrand(); return fullSecret; }}
                    onDeleteApiKey={async (keyId) => { await deleteApiKey(activeBrand.id, keyId); onRefreshBrand(); }}
                />
            );

        case 'team-management':
            return (
                <TeamManagementPage
                    users={resolvedSystemData.users}
                    onInviteUser={async (email, role) => { await inviteUser(activeBrand.id, email, role); onRefreshBrand(); }}
                    onUpdateUserRole={async (userId, role) => { await updateUserRole(activeBrand.id, userId, role); onRefreshBrand(); }}
                    onDeleteUser={async (userId) => { await deleteUser(activeBrand.id, userId); onRefreshBrand(); }}
                    addNotification={addNotification}
                />
            );

        case 'billing':
            return <UserBillingPage brandCount={brands.length} userCount={resolvedSystemData.users.length} />;

        case 'user-settings':
            return <UserSettingsPage addNotification={addNotification} />;

        case 'brands-manage':
            return (
                <BrandsManagePage
                    brands={brands}
                    activeBrand={activeBrand}
                    onAddBrand={onAddBrand}
                    onSwitchBrand={onSwitchBrand}
                    onDeleteBrand={async (id) => { await Promise.resolve(onDeleteBrand(id)); }}
                    onRenameBrand={async (id, name) => { await Promise.resolve(onRenameBrand(id, name)); }}
                />
            );

        case 'crm/dashboard':
            return <CrmDashboardPage brandId={activeBrand.id} onNavigate={onNavigate} />;
        case 'crm/customers':
            return <CustomersPage brandId={activeBrand.id} onViewCustomer={() => {}} />;
        case 'crm/pipeline':
            return <CrmPipelinePage brandId={activeBrand.id} brandProfile={resolvedBrandProfile} addNotification={addNotification} />;
        case 'crm/tickets':
            return <CrmTicketsPage brandId={activeBrand.id} />;

        case 'support-inbox':
            return (
                <Suspense fallback={<SkeletonPageLoader label={ar ? 'جارٍ تحميل صندوق الدعم...' : 'Loading Support Inbox...'} />}>
                    <SupportInboxPage />
                </Suspense>
            );

        default:
            return <div>Page not found: {activePage}</div>;
    }
};
