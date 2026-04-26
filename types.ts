
// types.ts

// --- Generic & System ---
export interface NavItem {
    id: string;
    icon: string;
    label: string;
    children?: NavItem[];
}

export interface AdminNavItem {
    id: string;
    icon: string;
    label: string;
}

export interface Brand {
    id: string;
    name: string;
    logoUrl: string;
}

export enum NotificationType {
    Success = 'Success',
    Info = 'Info',
    Warning = 'Warning',
    Error = 'Error',
}

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    timestamp: Date;
    read: boolean;
}

// --- Social Platforms ---
export enum SocialPlatform {
    Facebook = 'Facebook',
    Instagram = 'Instagram',
    X = 'X',
    LinkedIn = 'LinkedIn',
    TikTok = 'TikTok',
    Pinterest = 'Pinterest',
}

export enum AssetType {
    Page            = 'page',
    IgAccount       = 'ig_account',
    AdAccount       = 'ad_account',
    Pixel           = 'pixel',
    Store           = 'store',
    Site            = 'site',
    InboxChannel    = 'inbox_channel',
    YouTubeChannel  = 'youtube_channel',
    TikTokAccount   = 'tiktok_account',
    LinkedInPage    = 'linkedin_page',
    XAccount        = 'x_account',
}

export enum AssetPurpose {
    Publishing  = 'publishing',
    Inbox       = 'inbox',
    Analytics   = 'analytics',
    Commerce    = 'commerce',
    Ads         = 'ads',
    Seo         = 'seo',
}

export enum SyncStatus {
    Active          = 'active',
    NeedsReconnect  = 'needs_reconnect',
    TokenExpired    = 'token_expired',
    ScopeMissing    = 'scope_missing',
    WebhookInactive = 'webhook_inactive',
    PartialSync     = 'partial_sync',
    SyncDelayed     = 'sync_delayed',
    Disconnected    = 'disconnected',
}

export interface SocialAsset {
    id: string;
    name: string;
    category?: string;
    followers: number;
    avatarUrl: string;
    accessToken?: string;
    pageId?: string;  // Facebook Page ID — set for Instagram assets (IG account is linked to a page)
    // Integration OS fields
    assetType?: AssetType;
    purposes?: AssetPurpose[];
    market?: string;
}

export interface ConnectedAsset {
    id: string;
    brand_id: string;
    platform: SocialPlatform;
    asset_type: AssetType;
    asset_name: string;
    avatar_url?: string;
    followers_count?: number;
    purposes: AssetPurpose[];
    market?: string;
    is_primary: boolean;
    sync_status: SyncStatus;
    last_synced_at?: string;
    sync_error?: string;
    webhook_active: boolean;
    token_expiring_soon: boolean;
    token_expires_at?: string;
    token_is_valid: boolean;
    connection_status: string;
}

export const PLATFORM_ASSETS: { [key in SocialPlatform]: { icon: string; color: string; textColor: string; hexColor: string; } } = {
    [SocialPlatform.Facebook]: { icon: 'fab fa-facebook-square', color: 'bg-blue-600', textColor: 'text-blue-500', hexColor: '#2563eb' },
    [SocialPlatform.Instagram]: { icon: 'fab fa-instagram', color: 'bg-pink-600', textColor: 'text-pink-500', hexColor: '#e024a3' },
    [SocialPlatform.X]: { icon: 'fab fa-twitter', color: 'bg-gray-200', textColor: 'text-gray-200', hexColor: '#e6edf3' },
    [SocialPlatform.LinkedIn]: { icon: 'fab fa-linkedin', color: 'bg-blue-700', textColor: 'text-blue-600', hexColor: '#1d4ed8' },
    [SocialPlatform.TikTok]: { icon: 'fab fa-tiktok', color: 'bg-black', textColor: 'text-white', hexColor: '#000000' },
    [SocialPlatform.Pinterest]: { icon: 'fab fa-pinterest', color: 'bg-red-600', textColor: 'text-red-500', hexColor: '#dc2626' },
};

// --- Publisher ---
export enum PostStatus {
    Draft = 'Draft',
    Scheduled = 'Scheduled',
    Publishing = 'Publishing',
    Published = 'Published',
    Failed = 'Failed',
}

export enum PlatformPostStatus {
    Publishing = 'Publishing',
    Published = 'Published',
    Failed = 'Failed',
}

export interface PlatformStatus {
    status: PlatformPostStatus;
    error?: string | null;
    postId?: string;
}

export interface MediaItem {
    id: string;
    type: 'image' | 'video';
    url: string;
    file: File;
}

export interface ScheduledPost {
    id: string;
    brandId?: string;
    briefId?: string;
    briefTitle?: string;
    watchlistId?: string;
    content: string;
    platforms: SocialPlatform[];
    platformColors?: { [key: string]: string };
    media: MediaItem[];
    status: PostStatus;
    scheduledAt: Date | null;
    instagramFirstComment?: string;
    locations?: Partial<Record<SocialPlatform, string>>;
}

export interface ScheduleSuggestion {
    platform: SocialPlatform;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    reasoning: string;
}


// --- Social & Ad Accounts ---

export enum AccountStatus {
    Connected = 'Connected',
    NeedsReauth = 'NeedsReauth',
    Expired = 'Expired',
}

// --- Asset Registry (migration 048 — enums defined above in lines 49-81) ---

export interface SocialAccount {
    id: string;
    platform: SocialPlatform;
    username: string;
    avatarUrl: string;
    followers: number;
    status: AccountStatus;
    // Asset registry fields (migration 048)
    assetType?: AssetType;
    purposes?: AssetPurpose[];
    market?: string;
    isPrimary?: boolean;
    syncStatus?: SyncStatus;
    lastSyncedAt?: string | null;
    syncError?: string | null;
    webhookActive?: boolean;
    scopesGranted?: string[];
}

export interface IntegrationHealth {
    id: string;
    brandId: string;
    platform: string;
    assetType: AssetType;
    assetName: string;
    avatarUrl: string | null;
    followersCount: number | null;
    purposes: AssetPurpose[];
    market: string | null;
    isPrimary: boolean;
    syncStatus: SyncStatus;
    lastSyncedAt: string | null;
    syncError: string | null;
    webhookActive: boolean;
    scopesGranted: string[];
    connectionStatus: AccountStatus;
    tokenExpiringSoon: boolean;
    tokenExpiresAt: string | null;
    tokenIsValid: boolean | null;
    createdAt: string;
    updatedAt: string;
}

export enum AdPlatform {
    Meta = 'Meta', // Facebook & Instagram
    TikTok = 'TikTok',
    Google = 'Google',
}

export const AD_PLATFORM_ASSETS: { [key in AdPlatform]: { icon: string; color: string; } } = {
    [AdPlatform.Meta]: { icon: 'fab fa-facebook', color: '#3b82f6' },
    [AdPlatform.TikTok]: { icon: 'fab fa-tiktok', color: '#000000' },
    [AdPlatform.Google]: { icon: 'fab fa-google', color: '#ef4444' },
};

export interface AdAccount {
    id: string;
    platform: AdPlatform;
    name: string;
    accountId: string;
    status: AccountStatus;
}

// --- Brand Hub ---
export type BusinessModel = 'b2c' | 'b2b' | 'ecommerce' | 'service' | 'local' | 'saas' | 'mixed';
export type BrandGoal = 'awareness' | 'leads' | 'sales' | 'bookings' | 'engagement' | 'support' | 'recruitment';
export type BrandLanguage = 'ar' | 'en' | 'both';

export interface BrandVoice {
    toneDescription: string[];
    keywords: string[];
    negativeKeywords: string[];
    toneStrength: number;
    toneSentiment: number;
    voiceGuidelines?: {
        dos: string[];
        donts: string[];
    };
}

export interface BrandAudience {
    personaName: string;
    description: string;
    keyEmotions: string[];
    painPoints: string[];
}

export interface BrandHubProfile {
    brandName: string;
    industry: string;
    country?: string;   // ISO-2 code, sourced from brands.country
    website?: string;
    values: string[];
    keySellingPoints: string[];
    styleGuidelines: string[];
    brandVoice: BrandVoice;
    brandAudiences: BrandAudience[];
    consistencyScore: number;
    lastMemoryUpdate: string;
    // Extended wizard fields — stored in brand_profiles.extended_profile JSONB
    description?: string;
    businessModel?: BusinessModel;
    goals?: BrandGoal[];
    language?: BrandLanguage;
    ageRange?: string;
    targetAudienceSummary?: string;
    contactInfo?: { phone?: string; email?: string; };
}

// --- AI & Gemini Service Related ---
export interface AIPostAnalysis {
    brandFitScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
}

export interface BrandProfileAnalysis {
    overallScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
}

export interface BrandVoiceAnalysis {
    score: number;
    feedback: string;
    suggestions: string[];
}

export interface HashtagSuggestion {
    category: string;
    hashtags: string[];
}

export interface BrandConsistencyEvaluation {
    score: number;
    feedback: string;
    recommendations: string[];
}

export interface AIAnalyticsInsights {
    summary: string;
    trends: string;
    recommendations: string[];
}

export interface BrainstormedIdea {
    title: string;
    description: string;
    platform: SocialPlatform;
    format: string; // e.g., Reel, Carousel, Story
    angle: string; // e.g., "Educational", "Humorous"
}

export interface IdeaTestPlan {
    aiSummary: string;
    recommendedPlatforms: {
        platform: SocialPlatform;
        format: string;
        justification: string;
    }[];
    keyTalkingPoints: string[];
    suggestedCTA: string;
    successMetrics: string[];
}

// --- Ads Ops ---
export enum CampaignStatus {
    Active = 'Active',
    Paused = 'Paused',
    Completed = 'Completed',
    Draft = 'Draft',
}

export enum CampaignGoal {
    Awareness = 'Awareness',
    Traffic = 'Traffic',
    Engagement = 'Engagement',
    Conversion = 'Conversion',
}

export interface AdCreative {
    id: string;
    headline: string;
    primaryText: string;
}

export interface AdCampaign {
    id: string;
    name: string;
    platform: AdPlatform;
    status: CampaignStatus;
    budget: number;
    dailyBudget?: number;
    metrics: {
        spend: number;
        roas: number;
        cpa: number;
        ctr: number;
        impressions: number;
    };
    recommendation?: {
        type: string;
        suggestion: string;
        confidence: number;
    };
    goal: CampaignGoal;
    startDate: Date;
    endDate: Date;
    creatives: AdCreative[];
}

export interface AdsDashboardData {
    overallMetrics: {
        totalSpend: number;
        overallRoas: number;
        totalImpressions: number;
        totalConversions: number;
    };
    spendByPlatform: {
        platform: AdPlatform;
        spend: number;
    }[];
    performanceOverTime: {
        date: string;
        spend: number;
        roas: number;
    }[];
}

// --- Marketing Plans ---
export enum MarketingPlanStatus {
    Draft = 'Draft',
    Active = 'Active',
    Completed = 'Completed',
}

// ── AI Strategy types ─────────────────────────────────────────────────────────

export type ContentPostType = 'Reel' | 'Post' | 'Story' | 'Carousel' | 'TikTok' | 'Article' | 'Ad' | 'Poll';
export type PlanDuration = '1w' | '2w' | '1m' | '3m';
export type PlanObjectiveType = 'awareness' | 'engagement' | 'leads' | 'sales' | 'retention';

export interface AiContentPlanItem {
    id: string;
    dayNumber: number;
    platform: SocialPlatform;
    postType: ContentPostType;
    topic: string;
    caption: string;
    hashtags: string[];
    suggestedTime: string;
    objective: string;
    estimatedReach?: string;
}

export interface AiContentPlan {
    overview: string;
    totalPosts: number;
    weeklyFocus: string[];
    platformDistribution: Partial<Record<string, number>>;
    budgetSuggestion?: Partial<Record<string, number>>;
    items: AiContentPlanItem[];
    generatedAt: string;
}

export interface AiPriorityRecommendation {
    id: string;
    rank: number;
    title: string;
    description: string;
    actionLabel: string;
    category: 'content' | 'ads' | 'seo' | 'crm' | 'engagement';
    estimatedImpact: string;
    urgency: 'low' | 'medium' | 'high';
}

export interface AiMonthlyTask {
    title: string;
    category: string;
    dueDay: number;
    platform?: string;
}

export interface AiMonthlyWeek {
    weekNumber: number;
    focus: string;
    tasks: AiMonthlyTask[];
}

export interface AiMonthlyPlan {
    month: string;
    goals: { reach?: number; leads?: number; revenue?: number };
    overview: string;
    weeks: AiMonthlyWeek[];
    kpis: string[];
    generatedAt: string;
}

export interface MarketingPlan {
    id: string;
    name: string;
    objective: string;
    startDate: Date;
    endDate: Date;
    budget: number;
    targetAudience: string;
    kpis: string[];
    status: MarketingPlanStatus;
    channels: SocialPlatform[];
    aiPlan?: AiContentPlan;
    aiPriorities?: AiPriorityRecommendation[];
    monthlyPlan?: AiMonthlyPlan;
}


// --- Analytics ---
export interface PostPerformance {
    id: string;
    content: string;
    engagement: number;
}

export interface PlatformAnalyticsData {
    platform: SocialPlatform;
    metrics: {
        reach: number;
        engagementRate: number;
        posts: number;
    };
    topPosts: PostPerformance[];
    aiSummary: string;
}

export interface AnalyticsData {
    overallStats: {
        totalFollowers: number;
        reach: number;
        impressions: number;
        engagement: number;
        postsPublished: number;
        sentiment: { positive: number; neutral: number; negative: number };
    };
    previousPeriodStats?: {
        totalFollowers: number;
        reach: number;
        impressions: number;
        engagement: number;
        postsPublished: number;
    };
    connectedSources?: {
        ga4?: {
            propertyId: string;
            propertyName: string;
            websiteUrl?: string | null;
            sessions: number;
            engagedSessions: number;
            keyEvents: number;
            revenue: number;
            bounceRate: number;
            avgEngagementTimeSec: number;
            lastFactDate: string | null;
        };
        searchConsole?: {
            siteUrl: string;
            clicks: number;
            impressions: number;
            ctr: number;
            avgPosition: number;
            indexedPages: number;
            lastFactDate: string | null;
        };
    };
    topPosts: PostPerformance[];
    followerGrowth: {
        date: string;
        [key: string]: any; // for platform names
    }[];
    engagementRate: {
        platform: SocialPlatform;
        rate: number;
    }[];
    platformBreakdown?: Record<string, { impressions: number; engagement: number }>;
}

export interface BriefPerformanceRollup {
    briefId: string;
    watchlistId?: string;
    title: string;
    objective: string;
    angle: string;
    linkedPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    platformSpread: number;
    totalImpressions: number;
    totalReach: number;
    totalEngagement: number;
    totalClicks: number;
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    totalSaves: number;
    lastPublishedAt?: string;
}

export interface WatchlistPerformanceRollup {
    watchlistId: string;
    name: string;
    query: string;
    briefsCount: number;
    linkedPosts: number;
    publishedPosts: number;
    scheduledPosts: number;
    platformSpread: number;
    totalImpressions: number;
    totalReach: number;
    totalEngagement: number;
    totalClicks: number;
    lastPublishedAt?: string;
}

// --- Calendar ---
export interface ContentPiece {
    id: string;
    title: string;
    type: 'Blog' | 'Video' | 'Social' | 'Task';
    status: ContentStatus;
    assignee?: string;
    reviewer?: string;
    dueDate?: string;
    media: MediaItem[];
    comments: Comment[];
    generatedContent: string;
    platforms?: SocialPlatform[];
    utmParameters?: Record<string, string>;
}

// --- Content Ops ---
export enum ContentStatus {
    Ideas = 'Ideas',
    InProgress = 'In-Progress',
    InReview = 'In-Review',
    Approved = 'Approved',
}

export type ContentGoal = 'Increase Sales' | 'Increase Engagement' | 'Increase Awareness' | 'Announce Discount' | 'Educate Audience';

export interface Comment {
    id: string;
    author: string;
    text: string;
    timestamp: Date;
}

export interface AIQualityCheckResult {
    grammar: { score: number; feedback: string };
    toneOfVoice: { score: number; feedback: string };
    brandFit: { score: number; feedback: string };
    cta: { score: number; feedback: string };
}


// --- Error Center ---
export enum ErrorSeverity {
    Critical = 'Critical',
    Warning = 'Warning',
    Info = 'Info',
}

export enum ErrorSource {
    SocialOps = 'SocialOps',
    AdsOps = 'AdsOps',
    SEOOps = 'SEOOps',
    System = 'System',
}

export enum ErrorStatus {
    New = 'New',
    Acknowledged = 'Acknowledged',
    Resolved = 'Resolved',
}

export interface OperationalError {
    id: string;
    title: string;
    description: string;
    severity: ErrorSeverity;
    source: ErrorSource;
    timestamp: Date;
    resolutionLink: string;
    status: ErrorStatus;
}

export interface AIErrorAnalysis {
    summary: string;
    rootCause: string;
    recommendations: {
        priority: number;
        text: string;
    }[];
}

// --- Social Search ---
export interface AIContentIdea {
    type: 'Reel' | 'Static' | 'Article' | 'Campaign';
    title: string;
    description: string;
    suggestedPlatforms?: SocialPlatform[];
    brief?: Partial<PublisherBrief>;
}

export interface SavedSearch {
    id: string;
    name: string;
    query: string;
}

export interface CompetitiveWatchlist {
    id: string;
    brandId?: string;
    name: string;
    query: string;
    competitors: string[];
    keywords: string[];
    createdAt: string;
    lastRunAt?: string;
}

export interface PublisherBrief {
    id: string;
    brandId?: string;
    watchlistId?: string;
    source: 'social-search' | 'content-ops' | 'marketing-plans';
    title: string;
    query?: string;
    objective: string;
    angle: string;
    competitors: string[];
    keywords: string[];
    hashtags: string[];
    suggestedPlatforms: SocialPlatform[];
    cta?: string;
    notes: string[];
    createdAt?: string;
}

export interface SocialSearchAnalysisResult {
    aiSummary: string;
    sentiment: { positive: number; neutral: number; negative: number };
    contentIdeas: AIContentIdea[];
    platformPerformance: {
        platform: SocialPlatform;
        resultsCount: number;
        engagementRate: string;
        weeklyGrowth: number;
        topCompetitors: string[];
    }[];
    topHashtags: { tag: string; growth: number }[];
    relatedKeywords: string[];
}

// --- SEO Ops ---
export interface AuditIssue {
    id: string;
    severity: 'error' | 'warning' | 'good';
    title: string;
    description: string;
    recommendation: string;
}
export interface CoreWebVitals {
    lcp: { value: number, rating: 'good' | 'average' | 'poor' };
    cls: { value: number, rating: 'good' | 'average' | 'poor' };
    inp: { value: number, rating: 'good' | 'average' | 'poor' };
}
export interface TechnicalSEOAuditResult {
    overallScore: number;
    url: string;
    auditedAt: Date;
    /** Lighthouse category scores 0-100 */
    scores?: {
        performance: number;
        seo: number;
        bestPractices: number;
        accessibility: number;
    };
    crawling: { totalUrls: number, status200: number, status301: number, status404: number, issues: AuditIssue[] };
    performance: { vitals: CoreWebVitals, issues: AuditIssue[] };
    structuredData: { typesFound: string[], issues: AuditIssue[] };
}
export enum GBPPostCTA {
    LearnMore = 'Learn More',
    Book = 'Book',
    Order = 'Order',
    Shop = 'Shop',
    SignUp = 'Sign Up',
}
export interface GBPPost {
    id: string;
    content: string;
    imageUrl?: string;
    cta: GBPPostCTA;
    createdAt: Date;
}
export interface GBPQuestion {
    id: string;
    questionText: string;
    author: string;
    answerText: string | null;
}
export interface GBPReview {
    id: string;
    author: string;
    rating: number;
    comment: string;
    createdAt: Date;
    reply: string | null;
}
export interface GBPData {
    info: { name: string; address: string; phone: string; website: string; };
    posts: GBPPost[];
    questions: GBPQuestion[];
    reviews: GBPReview[];
}

// --- Inbox ---
export enum ConversationType {
    Message = 'Message',
    Comment = 'Comment',
    Mention = 'Mention',
}
export enum ConversationIntent {
    PurchaseInquiry = 'Purchase Inquiry',
    GeneralQuestion = 'General Question',
    Complaint = 'Complaint',
    Feedback = 'Feedback',
    Spam = 'Spam',
    Unknown = 'Unknown'
}
export type ConversationSentiment = 'positive' | 'neutral' | 'negative';
export type ConversationStatus   = 'open' | 'pending' | 'resolved' | 'spam' | 'archived';
export type ConversationPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface InboxConversation {
    id: string;
    platform: SocialPlatform;
    type: ConversationType;
    user: { name: string; handle: string; avatarUrl: string };
    messages: { id: string; sender: 'user' | 'agent'; text: string; timestamp: Date }[];
    lastMessageTimestamp: Date;
    isRead: boolean;
    assignee: string;
    intent: ConversationIntent;
    sentiment?: ConversationSentiment;
    aiSummary?: string;
    analyzedAt?: Date | null;
    // Enhanced fields (migration 053)
    status?: ConversationStatus;
    priority?: ConversationPriority;
    tags?: string[];
    crmCustomerId?: string | null;
    accountName?: string | null;
    accountId?: string | null;
}

// --- Workflow & Integrations ---
export interface Workflow {
    id: string;
    name: string;
    description: string;
    trigger: string;
    steps: {
        id: string;
        name: string;
        type: 'approval' | 'notification';
        tasks: { id: string; description: string; completed: boolean }[];
    }[];
}
export enum IntegrationCategory {
    Communication = 'Communication',
    Storage = 'Storage',
    Design = 'Design',
    Analytics = 'Analytics',
}
export interface Integration {
    id: string;
    name: string;
    description: string;
    category: IntegrationCategory;
    isConnected: boolean;
}

// --- System ---
export enum UserRole {
    Owner = 'Owner',
    Admin = 'Admin',
    Editor = 'Editor',
    Analyst = 'Analyst',
    Client = 'Client',
}
export interface User {
    id: string;
    name: string;
    email: string;
    avatarUrl: string;
    role: UserRole;
    lastActive: Date;
}
export interface SubscriptionPlan {
    id?: string;
    tenantId?: string | null;
    planId?: string;
    name: string;
    price: number;
    currency: string;
    nextBillingDate: Date;
    status?: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'inactive' | 'trial';
    billingCycle?: BillingCycle;
    trialEndsAt?: Date | null;
    cancelAtPeriodEnd?: boolean;
    scheduledChangeAction?: 'pause' | 'cancel' | null;
    pauseReason?: string | null;
    portalUrl?: string | null;
    updatePaymentMethodUrl?: string | null;
    canManage?: boolean;
    canPause?: boolean;
    canCancel?: boolean;
    canResume?: boolean;
    canChangeBillingCycle?: boolean;
    limits: { users: number; brands: number; aiTokens: number };
    usage: { users: number; brands: number; aiTokens?: number };
}
export interface PaymentRecord {
    id: string;
    date: Date;
    amount: number;
    currency?: string;
    status: 'Paid' | 'Failed' | 'Open' | 'Refunded';
    invoiceUrl: string;
    invoiceNumber?: string | null;
}
export interface ActiveSession {
    id: string;
    device: string;
    location: string;
    ip: string;
    lastAccessed: Date;
    isCurrent: boolean;
}
export interface ApiKey {
    id: string;
    name: string;
    prefix: string;
    createdAt: Date;
    lastUsed: Date | null;
}

// --- Admin Panel ---
export enum AdminUserRole {
    SUPER_ADMIN = 'SUPER_ADMIN',
    ADMIN = 'ADMIN',
    MODERATOR = 'MODERATOR',
    SUPPORT = 'SUPPORT',
}

export interface AdminUser {
    id: string;
    name: string;
    email: string;
    role: AdminUserRole;
    tenantName: string;
    lastLogin: string;
    twoFactorEnabled: boolean;
}

export interface Tenant {
    id: string;
    name: string;
    billingEmail?: string;
    status: 'active' | 'trial' | 'past_due' | 'suspended' | 'cancelled' | 'inactive';
    plan: string;
    planName?: string;
    usersCount: number;
    brandsCount: number;
    aiTokenUsage: number;
    aiTokenLimit: number;
    userLimit?: number | null;
    brandLimit?: number | null;
    // Per-tenant custom overrides (override plan defaults)
    customBrandLimit?: number | null;
    customUserLimit?: number | null;
    customAiTokenLimit?: number | null;
    createdAt?: string;
    trialEndsAt?: string | null;
    notes?: string | null;
}

export interface AdminDashboardStats {
    totalUsers: number;
    activeTenants: number;
    totalRevenue: number;
    userGrowth: { date: string, count: number }[];
    revenueOverTime: { date: string, revenue: number }[];
}

export interface SubscriptionPlanAdmin {
    id: string;
    name: string;
    tagline?: string;
    description?: string;
    badge?: string;
    highlighted?: boolean;
    currency: string;
    monthlyPrice: number;
    yearlyPrice: number;
    trialDays: number;
    userLimit: number;
    brandLimit: number;
    aiTokenLimit: number;
    features: string[];
    paddleMonthlyPriceId?: string | null;
    paddleYearlyPriceId?: string | null;
}

export type BillingCycle = 'monthly' | 'yearly';

export interface AdminBillingOverview {
    activeSubscriptions: number;
    trialSubscriptions: number;
    pastDueSubscriptions: number;
    scheduledPauses: number;
    scheduledCancellations: number;
    monthlyRecurringRevenue: number;
    annualRecurringRevenue: number;
    openInvoices: number;
    failedWebhooks: number;
    retriedWebhooks: number;
    queuedWebhookRetries: number;
}

export interface AdminBillingSubscription {
    id: string;
    tenantId: string;
    tenantName: string;
    planId: string;
    planName: string;
    status: 'trialing' | 'active' | 'past_due' | 'paused' | 'canceled' | 'inactive';
    billingCycle: BillingCycle;
    amount: number;
    currency: string;
    customerEmail: string;
    paddleSubscriptionId: string;
    nextBilledAt: string | null;
    trialEndsAt: string | null;
    cancelAtPeriodEnd: boolean;
    scheduledChangeAction?: 'pause' | 'cancel' | null;
    pauseReason?: string | null;
}

export interface AdminBillingInvoice {
    id: string;
    tenantId: string;
    tenantName: string;
    subscriptionId?: string | null;
    amount: number;
    currency: string;
    status: 'draft' | 'open' | 'paid' | 'past_due' | 'failed' | 'refunded';
    invoiceNumber?: string | null;
    invoiceUrl?: string | null;
    billedAt?: string | null;
    paidAt?: string | null;
}

export interface AdminBillingEvent {
    id: string;
    eventType: string;
    source: string;
    tenantId?: string | null;
    tenantName: string;
    processingStatus: 'received' | 'processed' | 'failed';
    occurredAt: string;
    processedAt?: string | null;
    errorMessage?: string | null;
    retryCount?: number;
    lastRetryAt?: string | null;
    lastRetryReason?: string | null;
    nextRetryAt?: string | null;
}

export interface AdminBillingAuditLog {
    id: string;
    tenantId?: string | null;
    tenantName: string;
    subscriptionId?: string | null;
    action: string;
    actorUserId?: string | null;
    actorScope: 'brand' | 'tenant' | 'system';
    reason?: string | null;
    metadata?: Record<string, unknown>;
    createdAt: string;
}

export interface AIMetric {
    timestamp: string; // ISO date string
    feature: string; // e.g., 'Caption Generation', 'Hashtag Suggestion'
    tokens: number;
    latency: number; // in ms
}

export interface QueueJob {
    id: string;
    type: 'Video Processing' | 'Analytics Report' | 'Data Sync';
    status: 'pending' | 'running' | 'completed' | 'failed';
    submittedAt: Date;
}

export interface AdminPermission {
    id: string; // e.g., 'tenants:manage'
    label: string; // e.g., 'Manage Tenants'
    description: string;
}

export interface AIInsight {
    id: string;
    text: string;
    priority: 'high' | 'medium' | 'low';
}

export interface SystemHealthStatus {
    service: string;
    status: 'ok' | 'degraded' | 'down';
    details: string;
}

export interface ActivityLog {
    id: string;
    user: { name: string, role: AdminUserRole };
    action: string;
    timestamp: Date;
}

export interface AdminSearchResultItem {
    id: string;
    label: string;
    description: string;
    type: 'Tenant' | 'User' | 'Page';
    navTarget: string;
}

export interface AdminSearchResultGroup {
    title: string;
    items: AdminSearchResultItem[];
}

export interface GeneralSettings {
    appName: string;
    maintenanceMode: boolean;
    defaultLanguage: 'en' | 'ar';
    supportEmail: string;
    logoUrl: string;
    supportWebsite: string;
    announcementEnabled: boolean;
    announcementText: string;
    announcementType: 'info' | 'warning' | 'success' | 'danger';
}

export interface SecuritySettings {
    passwordMinLength: number;
    passwordRequiresUppercase: boolean;
    passwordRequiresNumber: boolean;
    passwordRequiresSymbol: boolean;
    sessionTimeout: number; // in minutes
    require2FAForAdmins: boolean;
}

export type AIProvider =
    | 'gemini' | 'openai' | 'anthropic' | 'stability' | 'replicate'
    | 'gemini-content' | 'gemini-design' | 'gemini-video'
    | 'openai-image'   | 'openai-video';

export interface AIProviderKey {
    id: string;
    provider: AIProvider;
    name: string;
    keyMasked: string;
    isActive: boolean;
    createdAt: string;
    lastTestedAt: string | null;
    testStatus: 'ok' | 'failed' | 'untested';
}

export interface AdminLog {
    id: string;
    adminName: string;
    adminEmail: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
}

// ============================================================
// CRM Module Types — Customer Hub
// ============================================================

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum CrmLifecycleStage {
    Lead           = 'lead',
    Prospect       = 'prospect',
    FirstPurchase  = 'first_purchase',
    Active         = 'active',
    Repeat         = 'repeat',
    VIP            = 'vip',
    AtRisk         = 'at_risk',
    Churned        = 'churned',
}

export enum CrmOrderStatus {
    Pending        = 'pending',
    Processing     = 'processing',
    OnHold         = 'on-hold',
    Completed      = 'completed',
    Cancelled      = 'cancelled',
    Refunded       = 'refunded',
    Failed         = 'failed',
}

export enum CrmPaymentStatus {
    Pending            = 'pending',
    Paid               = 'paid',
    Failed             = 'failed',
    Refunded           = 'refunded',
    PartiallyRefunded  = 'partially_refunded',
}

export enum CrmShippingStatus {
    Pending     = 'pending',
    Processing  = 'processing',
    Shipped     = 'shipped',
    Delivered   = 'delivered',
    Returned    = 'returned',
}

export enum CrmStoreProvider {
    WooCommerce = 'woocommerce',
    Shopify     = 'shopify',
    Manual      = 'manual',
}

export enum CrmTaskPriority {
    Low    = 'low',
    Medium = 'medium',
    High   = 'high',
    Urgent = 'urgent',
}

export enum CrmTaskStatus {
    Open       = 'open',
    InProgress = 'in_progress',
    Done       = 'done',
    Cancelled  = 'cancelled',
}

export enum CrmTaskType {
    FollowUp = 'follow_up',
    Call     = 'call',
    Email    = 'email',
    Review   = 'review',
    Support  = 'support',
    Custom   = 'custom',
}

export enum CrmActivityEventType {
    CustomerCreated      = 'customer_created',
    OrderPlaced          = 'order_placed',
    OrderPaid            = 'order_paid',
    OrderCancelled       = 'order_cancelled',
    Refunded             = 'refunded',
    MessageSent          = 'message_sent',
    NoteAdded            = 'note_added',
    TagChanged           = 'tag_changed',
    AssignedToRep        = 'assigned_to_rep',
    LifecycleChanged     = 'lifecycle_changed',
    CampaignInteraction  = 'campaign_interaction',
    TaskCreated          = 'task_created',
    TaskCompleted        = 'task_completed',
}

export enum CrmAutomationTrigger {
    CustomerCreated          = 'customer_created',
    OrderCreated             = 'order_created',
    FirstOrderCompleted      = 'first_order_completed',
    OrderCancelled           = 'order_cancelled',
    RefundCreated            = 'refund_created',
    CustomerInactive30d      = 'customer_inactive_30d',
    CustomerInactive60d      = 'customer_inactive_60d',
    CustomerInactive90d      = 'customer_inactive_90d',
    CustomerSpentOverThreshold = 'customer_spent_over_threshold',
    CustomerTagAdded         = 'customer_tag_added',
    VipCustomerDetected      = 'vip_customer_detected',
}

export enum CrmSegmentOperator {
    Eq          = 'eq',
    Neq         = 'neq',
    Gt          = 'gt',
    Lt          = 'lt',
    Gte         = 'gte',
    Lte         = 'lte',
    Contains    = 'contains',
    NotContains = 'not_contains',
    In          = 'in',
    NotIn       = 'not_in',
    IsNull      = 'is_null',
    IsNotNull   = 'is_not_null',
    Between     = 'between',
}

// ── Core Entities ─────────────────────────────────────────────────────────────

export interface CrmCustomer {
    id: string;
    brandId: string;
    externalId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    avatarUrl?: string;
    gender?: string;
    birthDate?: string;
    language?: string;
    currency?: string;
    acquisitionSource?: string;
    acquisitionChannel?: string;
    lifecycleStage: CrmLifecycleStage;
    ltv: number;
    totalOrders: number;
    totalSpent: number;
    averageOrderValue: number;
    refundCount: number;
    firstOrderDate?: string;
    lastOrderDate?: string;
    lastActivityAt?: string;
    assignedTo?: string;
    notesCount: number;
    tasksCount: number;
    isBlocked: boolean;
    marketingConsent: boolean;
    smsConsent: boolean;
    metadata?: Record<string, unknown>;
    tags?: CrmCustomerTag[];
    createdAt: string;
    updatedAt: string;
}

export interface CrmCustomerIdentity {
    id: string;
    brandId: string;
    customerId: string;
    provider: CrmStoreProvider;
    providerId: string;
    storeUrl?: string;
    rawData?: Record<string, unknown>;
    syncedAt?: string;
    createdAt: string;
}

export interface CrmAddress {
    id: string;
    brandId: string;
    customerId: string;
    type: 'billing' | 'shipping';
    firstName?: string;
    lastName?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    phone?: string;
    isDefault: boolean;
    createdAt: string;
}

export interface CrmOrder {
    id: string;
    brandId: string;
    customerId?: string;
    externalId: string;
    storeSource: CrmStoreProvider;
    storeUrl?: string;
    status: CrmOrderStatus;
    paymentStatus: CrmPaymentStatus;
    shippingStatus: CrmShippingStatus;
    currency: string;
    subtotal: number;
    discountTotal: number;
    shippingTotal: number;
    taxTotal: number;
    total: number;
    refundTotal: number;
    paymentMethod?: string;
    couponCodes?: string[];
    shippingAddress?: Partial<CrmAddress>;
    billingAddress?: Partial<CrmAddress>;
    notes?: string;
    trackingNumber?: string;
    orderDate?: string;
    paidAt?: string;
    fulfilledAt?: string;
    cancelledAt?: string;
    items?: CrmOrderItem[];
    createdAt: string;
    updatedAt: string;
}

export interface CrmOrderItem {
    id: string;
    brandId: string;
    orderId: string;
    productId?: string;
    productName: string;
    sku?: string;
    variantName?: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    discount: number;
    total: number;
    imageUrl?: string;
    category?: string;
    createdAt: string;
}

export interface CrmCustomerTag {
    id: string;
    brandId: string;
    name: string;
    color: string;
    description?: string;
    usageCount: number;
    createdAt: string;
}

export interface CrmSegment {
    id: string;
    brandId: string;
    name: string;
    description?: string;
    isDynamic: boolean;
    isPreset: boolean;
    audienceSize: number;
    rulesOperator: 'AND' | 'OR';
    rules?: CrmSegmentRule[];
    lastCalculated?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CrmSegmentRule {
    id: string;
    segmentId: string;
    field: string;
    operator: CrmSegmentOperator;
    value?: string;
    value2?: string;
    displayLabel?: string;
    sortOrder: number;
    createdAt: string;
}

export interface CrmNote {
    id: string;
    brandId: string;
    customerId: string;
    authorId?: string;
    content: string;
    isPinned: boolean;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export interface CrmActivity {
    id: string;
    brandId: string;
    customerId: string;
    actorId?: string;
    eventType: CrmActivityEventType;
    title: string;
    description?: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
    createdAt: string;
}

export type CrmPipelineStage = 'Qualify' | 'Proposal' | 'Won' | 'Lost';

export interface CrmDeal {
    id: string;
    brandId: string;
    customerId?: string;
    title: string;
    company?: string;
    amount: number;
    stage: CrmPipelineStage;
    probability: number;
    expectedCloseDate?: string;
    assignedTo?: string;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CrmTask {
    id: string;
    brandId: string;
    customerId?: string;
    orderId?: string;
    createdBy?: string;
    assignedTo?: string;
    title: string;
    description?: string;
    taskType: CrmTaskType;
    priority: CrmTaskPriority;
    status: CrmTaskStatus;
    dueDate?: string;
    completedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CrmStoreConnection {
    id: string;
    brandId: string;
    provider: CrmStoreProvider;
    storeName?: string;
    storeUrl: string;
    isActive: boolean;
    lastSyncAt?: string;
    syncStatus: 'idle' | 'running' | 'success' | 'error';
    syncError?: string;
    customersSynced: number;
    ordersSynced: number;
    createdAt: string;
    updatedAt: string;
}

export interface CrmSyncJob {
    id: string;
    brandId: string;
    connectionId: string;
    jobType: 'full_sync' | 'incremental' | 'webhook';
    entityType?: 'customers' | 'orders' | 'products';
    status: 'pending' | 'running' | 'success' | 'error' | 'partial';
    totalRecords: number;
    processed: number;
    failed: number;
    startedAt?: string;
    completedAt?: string;
    createdAt: string;
}

export interface CrmAutomation {
    id: string;
    brandId: string;
    name: string;
    description?: string;
    isActive: boolean;
    triggerType: CrmAutomationTrigger;
    triggerConfig: Record<string, unknown>;
    actions: CrmAutomationAction[];
    runCount: number;
    lastRunAt?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CrmAutomationAction {
    type: 'create_task' | 'send_internal_notification' | 'add_tag' | 'assign_owner' | 'move_lifecycle_stage' | 'send_to_campaign_audience' | 'create_support_followup';
    config: Record<string, unknown>;
}

export interface CrmLifecycleState {
    id: string;
    brandId: string;
    stage: CrmLifecycleStage;
    displayName: string;
    displayNameAr?: string;
    color: string;
    icon?: string;
    sortOrder: number;
    autoRules: Record<string, unknown>;
    isActive: boolean;
    createdAt: string;
}

export interface CrmFeatureFlags {
    brandId: string;
    plan: 'basic' | 'pro' | 'agency';
    crmEnabled: boolean;
    maxCustomers: number;
    maxSegments: number;
    maxAutomations: number;
    shopifyEnabled: boolean;
    wooEnabled: boolean;
    analyticsEnabled: boolean;
}

// ── Dashboard / Analytics DTOs ────────────────────────────────────────────────

export interface CrmDashboardStats {
    totalCustomers: number;
    newThisMonth: number;
    newVsReturning: { new: number; returning: number };
    repeatPurchaseRate: number;
    avgLtv: number;
    churnRiskCount: number;
    refundRate: number;
    aov: number;
    totalRevenue: number;
    lifecycleBreakdown: { stage: CrmLifecycleStage; count: number; percent: number }[];
    topCustomers: CrmCustomer[];
    customerGrowth: { month: string; count: number; cumulative: number }[];
}

export interface CrmAnalyticsCohort {
    cohortMonth: string;
    initialSize: number;
    retentionByMonth: number[];
}

// ── Filters ────────────────────────────────────────────────────────────────────

export interface CrmCustomerFilters {
    search?: string;
    lifecycleStage?: CrmLifecycleStage[];
    tags?: string[];
    storeSource?: CrmStoreProvider[];
    minOrders?: number;
    maxOrders?: number;
    minSpent?: number;
    maxSpent?: number;
    minAov?: number;
    maxAov?: number;
    acquisitionSource?: string[];
    country?: string;
    city?: string;
    lastOrderAfter?: string;
    lastOrderBefore?: string;
    assignedTo?: string;
    hasRefunds?: boolean;
    page?: number;
    pageSize?: number;
    sortBy?: keyof CrmCustomer;
    sortDir?: 'asc' | 'desc';
}

export interface CrmOrderFilters {
    search?: string;
    storeSource?: CrmStoreProvider[];
    status?: CrmOrderStatus[];
    paymentStatus?: CrmPaymentStatus[];
    shippingStatus?: CrmShippingStatus[];
    minTotal?: number;
    maxTotal?: number;
    dateAfter?: string;
    dateBefore?: string;
    paymentMethod?: string;
    couponCode?: string;
    page?: number;
    pageSize?: number;
}

// ── CRM Roles & Permissions ────────────────────────────────────────────────────

export type CrmPermission =
    | 'view_customers'
    | 'edit_customers'
    | 'delete_customers'
    | 'view_orders'
    | 'edit_orders'
    | 'view_analytics'
    | 'manage_automations'
    | 'manage_integrations'
    | 'manage_roles'
    | 'export_data'
    | 'view_notes'
    | 'edit_notes'
    | 'view_tasks'
    | 'edit_tasks'
    | 'manage_segments'
    | 'view_inbox'
    | 'reply_inbox';

export type CrmRoleKey =
    | 'owner'
    | 'admin'
    | 'sales_manager'
    | 'sales_rep'
    | 'support_agent'
    | 'analyst'
    | 'read_only_client';

export interface CrmRole {
    id: string;
    brandId: string;
    roleKey: CrmRoleKey;
    name: string;
    nameAr?: string;
    permissions: CrmPermission[];
    isSystem: boolean;
    createdAt: string;
}

export interface CrmUserRole {
    id: string;
    brandId: string;
    userId: string;
    roleKey: CrmRoleKey;
    assignedBy?: string;
    assignedAt: string;
}

// ── CRM Analytics ──────────────────────────────────────────────────────────────

export interface CrmRfmScore {
    id: string;
    brandId: string;
    customerId: string;
    recencyDays: number;
    frequency: number;
    monetary: number;
    rScore: number;       // 1–5
    fScore: number;
    mScore: number;
    rfmScore: number;     // composite 1–15
    rfmSegment: CrmRfmSegment;
    calculatedAt: string;
}

export type CrmRfmSegment =
    | 'champions'
    | 'loyal'
    | 'potential_loyal'
    | 'new_customers'
    | 'promising'
    | 'need_attention'
    | 'about_to_sleep'
    | 'at_risk'
    | 'cant_lose'
    | 'lost';

export interface CrmRetentionCohort {
    id: string;
    brandId: string;
    cohortMonth: string;      // 'YYYY-MM'
    periodNumber: number;     // months after acquisition
    cohortSize: number;
    retainedCount: number;
    retentionRate: number;    // percentage 0–100
    calculatedAt: string;
}

export interface CrmRevenueBySegment {
    segment: string;
    revenue: number;
    customerCount: number;
    avgLtv: number;
    percentageOfTotal: number;
}

export interface CrmChurnTrend {
    month: string;
    churnedCount: number;
    churnRate: number;    // percentage
    totalAtStart: number;
}

export interface CrmCrossSellOpportunity {
    customerId: string;
    customerName: string;
    currentSegment: string;
    recommendedProducts: string[];
    potentialValue: number;
    lastOrderDate?: string;
}

// ── SEO Ops ───────────────────────────────────────────────────────────────────

export type SeoSearchIntent = 'informational' | 'navigational' | 'commercial' | 'transactional';
export type SeoDifficulty   = 'low' | 'medium' | 'high';
export type SeoArticleStatus = 'draft' | 'optimizing' | 'ready' | 'published';

export interface SeoKeyword {
    id: string;
    brandId: string;
    keyword: string;
    searchIntent: SeoSearchIntent;
    difficulty: SeoDifficulty;
    priorityScore: number;    // 1-100
    monthlyVolume: string;
    notes: string;
    createdAt: string;
}

export interface SeoFaqItem {
    question: string;
    answer: string;
}

export interface SeoArticle {
    id: string;
    brandId: string;
    keywordId?: string;
    keyword: string;
    h1: string;
    h2s: string[];
    intro: string;
    body: string;
    faq: SeoFaqItem[];
    metaTitle: string;
    metaDescription: string;
    readabilityScore: number;   // 0-100 (Flesch-Kincaid approximation)
    keywordDensity: number;     // percentage
    seoScore: number;           // 0-100
    wordCount: number;
    status: SeoArticleStatus;
    wpPostId?: number;
    createdAt: string;
    updatedAt: string;
}

export interface SeoScoreResult {
    score: number;
    suggestions: string[];
    keywordDensity: number;
    readabilityScore: number;
    wordCount: number;
}

export interface WpExportPayload {
    title: string;
    content: string;         // HTML
    excerpt: string;
    status: 'draft' | 'publish';
    categories?: string[];
    tags?: string[];
    meta: { yoast_wpseo_title?: string; yoast_wpseo_metadesc?: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// --- Design Ops ---
// ─────────────────────────────────────────────────────────────────────────────

export type DesignAssetType = 'logo' | 'image' | 'template' | 'video' | 'icon' | 'font';
export type DesignAssetSource = 'upload' | 'ai-generated' | 'stock' | 'canva' | 'figma';

export interface DesignAsset {
    id: string;
    brandId: string;
    name: string;
    url: string;
    thumbnailUrl?: string;
    type: DesignAssetType;
    source: DesignAssetSource;
    tags: string[];
    width?: number;
    height?: number;
    fileSize?: number;
    mimeType?: string;
    aspectRatio?: string;
    prompt?: string;
    createdAt: string;
    updatedAt?: string;
}

export type DesignWorkflowStatus = 'draft' | 'active' | 'archived';
export type DesignWorkflowCategory =
    | 'social-post'
    | 'story'
    | 'ad-creative'
    | 'campaign-pack'
    | 'logo-usage'
    | 'custom';

export type DesignWorkflowOutputFormat =
    | 'instagram-post'
    | 'instagram-portrait'
    | 'instagram-story'
    | 'instagram-reel-cover'
    | 'facebook-post'
    | 'facebook-story'
    | 'twitter-post'
    | 'twitter-portrait'
    | 'linkedin-post'
    | 'linkedin-banner'
    | 'tiktok-cover'
    | 'youtube-thumbnail'
    | 'pinterest-pin'
    | 'snapchat-story'
    | 'whatsapp-status'
    | 'ad-banner-square'
    | 'ad-banner-landscape'
    | 'ad-banner-portrait'
    | 'custom';

export interface DesignWorkflowFormat {
    format: DesignWorkflowOutputFormat;
    width: number;
    height: number;
    label: string;
    labelAr: string;
    /** Closest ratio supported by AI image generators (Imagen / Pollinations) */
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
    /** True = best-practice format for this platform (highest reach / engagement) */
    recommended?: boolean;
    /** Short Arabic tip shown in the format picker */
    tipAr?: string;
}

export type DesignStepType =
    | 'input-topic'
    | 'input-tone'
    | 'input-text-overlay'
    | 'select-format'
    | 'apply-brand-colors'
    | 'generate-image'
    | 'select-variant'
    | 'review';

export interface DesignWorkflowStep {
    id: string;
    order: number;
    type: DesignStepType;
    labelAr: string;
    labelEn: string;
    config?: Record<string, any>;
}

export interface DesignWorkflow {
    id: string;
    brandId: string;
    name: string;
    nameEn: string;
    description: string;
    icon: string;
    category: DesignWorkflowCategory;
    formats: DesignWorkflowFormat[];
    steps: DesignWorkflowStep[];
    promptTemplate: string;
    useBrandColors: boolean;
    useBrandVoice: boolean;
    status: DesignWorkflowStatus;
    variantsCount: 1 | 2 | 3;
    createdAt: string;
    updatedAt?: string;
    lastUsedAt?: string;
    usageCount: number;
    isDefault?: boolean;
}

export type DesignJobStatus = 'pending' | 'generating' | 'done' | 'error';

export interface DesignJob {
    id: string;
    brandId: string;
    workflowId?: string;
    workflowName?: string;
    inputs: Record<string, any>;
    format: DesignWorkflowFormat;
    status: DesignJobStatus;
    prompt: string;
    enhancedPrompt?: string;
    assets: DesignAsset[];
    selectedAssetId?: string;
    error?: string;
    createdAt: string;
}

export interface DesignOpsStats {
    totalAssets: number;
    aiGeneratedCount: number;
    uploadedCount: number;
    workflowsCount: number;
    jobsThisMonth: number;
}

export const DESIGN_FORMAT_MAP: Record<DesignWorkflowOutputFormat, DesignWorkflowFormat> = {
    // ── Instagram ─────────────────────────────────────────────────────────────
    'instagram-post':       { format: 'instagram-post',       width: 1080, height: 1080, label: 'Instagram Post',       labelAr: 'منشور مربع',          aspectRatio: '1:1',  recommended: true,  tipAr: 'الأكثر انتشاراً' },
    'instagram-portrait':   { format: 'instagram-portrait',   width: 1080, height: 1350, label: 'Instagram Portrait',   labelAr: 'صورة عمودية',         aspectRatio: '3:4',  recommended: true,  tipAr: 'أعلى تفاعل 4:5' },
    'instagram-story':      { format: 'instagram-story',      width: 1080, height: 1920, label: 'Instagram Story',      labelAr: 'ستوري إنستاغرام',     aspectRatio: '9:16',                     tipAr: 'ستوري كاملة الشاشة' },
    'instagram-reel-cover': { format: 'instagram-reel-cover', width: 1080, height: 1920, label: 'Reel Cover',           labelAr: 'غلاف ريل',            aspectRatio: '9:16',                     tipAr: 'غلاف الريلز' },

    // ── Facebook ──────────────────────────────────────────────────────────────
    'facebook-post':        { format: 'facebook-post',        width: 1200, height: 630,  label: 'Facebook Post',        labelAr: 'منشور فيسبوك',        aspectRatio: '16:9', recommended: true,  tipAr: 'المقاس المثالي 1.91:1' },
    'facebook-story':       { format: 'facebook-story',       width: 1080, height: 1920, label: 'Facebook Story',       labelAr: 'ستوري فيسبوك',        aspectRatio: '9:16',                     tipAr: 'ستوري كاملة الشاشة' },

    // ── X / Twitter ───────────────────────────────────────────────────────────
    'twitter-post':         { format: 'twitter-post',         width: 1600, height: 900,  label: 'X Post (Landscape)',   labelAr: 'منشور X أفقي',        aspectRatio: '16:9', recommended: true,  tipAr: '16:9 — أفضل ظهور' },
    'twitter-portrait':     { format: 'twitter-portrait',     width: 1080, height: 1350, label: 'X Post (Portrait)',    labelAr: 'منشور X عمودي',       aspectRatio: '3:4',                      tipAr: 'يملأ الـ feed عمودياً' },

    // ── LinkedIn ──────────────────────────────────────────────────────────────
    'linkedin-post':        { format: 'linkedin-post',        width: 1200, height: 627,  label: 'LinkedIn Post',        labelAr: 'منشور لينكدإن',       aspectRatio: '16:9', recommended: true,  tipAr: '1.91:1 — مثالي للـ feed' },
    'linkedin-banner':      { format: 'linkedin-banner',      width: 1584, height: 396,  label: 'LinkedIn Banner',      labelAr: 'بانر لينكدإن',        aspectRatio: '4:3',                      tipAr: 'صورة البروفايل الخلفية' },

    // ── TikTok ────────────────────────────────────────────────────────────────
    'tiktok-cover':         { format: 'tiktok-cover',         width: 1080, height: 1920, label: 'TikTok Cover',         labelAr: 'غلاف تيك توك',        aspectRatio: '9:16', recommended: true,  tipAr: 'غلاف الفيديو 9:16' },

    // ── YouTube ───────────────────────────────────────────────────────────────
    'youtube-thumbnail':    { format: 'youtube-thumbnail',    width: 1280, height: 720,  label: 'YouTube Thumbnail',    labelAr: 'صورة مصغرة يوتيوب',  aspectRatio: '16:9', recommended: true,  tipAr: '1280×720 — المعيار الرسمي' },

    // ── Pinterest ─────────────────────────────────────────────────────────────
    'pinterest-pin':        { format: 'pinterest-pin',        width: 1000, height: 1500, label: 'Pinterest Pin',        labelAr: 'دبوس بينتريست',       aspectRatio: '3:4',  recommended: true,  tipAr: '2:3 — أفضل أداء على المنصة' },

    // ── Snapchat ──────────────────────────────────────────────────────────────
    'snapchat-story':       { format: 'snapchat-story',       width: 1080, height: 1920, label: 'Snapchat Story',       labelAr: 'ستوري سناب شات',      aspectRatio: '9:16', recommended: true,  tipAr: 'كاملة الشاشة 9:16' },

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    'whatsapp-status':      { format: 'whatsapp-status',      width: 1080, height: 1920, label: 'WhatsApp Status',      labelAr: 'ستاتس واتساب',        aspectRatio: '9:16', recommended: true,  tipAr: 'حالة واتساب 9:16' },

    // ── Ads ───────────────────────────────────────────────────────────────────
    'ad-banner-square':     { format: 'ad-banner-square',     width: 1080, height: 1080, label: 'Ad Square',            labelAr: 'إعلان مربع',          aspectRatio: '1:1',  recommended: true,  tipAr: 'مربع — يعمل على كل المنصات' },
    'ad-banner-landscape':  { format: 'ad-banner-landscape',  width: 1200, height: 628,  label: 'Ad Landscape',         labelAr: 'إعلان أفقي',          aspectRatio: '16:9',                     tipAr: 'بانر أفقي — Meta Ads' },
    'ad-banner-portrait':   { format: 'ad-banner-portrait',   width: 1080, height: 1350, label: 'Ad Portrait',          labelAr: 'إعلان عمودي',         aspectRatio: '3:4',                      tipAr: '4:5 — أعلى تحويل في الهاتف' },

    // ── Custom ────────────────────────────────────────────────────────────────
    'custom':               { format: 'custom',               width: 1080, height: 1080, label: 'Custom Size',          labelAr: 'مقاس مخصص',           aspectRatio: '1:1' },
};

// ══════════════════════════════════════════════════════════════════════════════
// SKILL ENGINE — محرك المهارات
// ══════════════════════════════════════════════════════════════════════════════

export enum SkillType {
    ContentGeneration       = 'content_generation',
    OccasionOpportunity     = 'occasion_opportunity',
    ConversationReply       = 'conversation_reply',
    CampaignBrief           = 'campaign_brief',
    MarketingPlanSuggestion = 'marketing_plan_suggestion',
    HashtagResearch         = 'hashtag_research',
    CompetitorAnalysis      = 'competitor_analysis',
    ContentCalendar         = 'content_calendar',
    AdCopywriting           = 'ad_copywriting',
    SEOContentBrief         = 'seo_content_brief',
    AudienceInsight         = 'audience_insight',
    BrandVoiceCheck         = 'brand_voice_check',
    LeadQualification       = 'lead_qualification',
    FollowUpSequence        = 'follow_up_sequence',
}

export type SkillContextLevel = 'minimal' | 'standard' | 'full';
// minimal  ~80 tokens  : name + tone + forbidden words
// standard ~300 tokens : + audience + selling points
// full     ~1200 tokens: + products + FAQs + policies + memory

export type SkillPreferredModel = 'gemini-2.5-flash' | 'gemini-2.5-pro';

export interface SkillDefinition {
    type: SkillType;
    nameAr: string;
    nameEn: string;
    description: string;
    triggerKeywords: string[];
    inputSchema: string[];
    outputKeys: string[];
    kpis: string[];
    confidenceThreshold: number;
    requiresHumanApproval: boolean;
    contextLevel: SkillContextLevel;
    preferredModel: SkillPreferredModel;
}

export interface TaskClassification {
    detectedSkill: SkillType;
    confidence: number;
    extractedEntities: Record<string, string>;
    ambiguous: boolean;
    alternativeSkills: SkillType[];
}

export interface SkillExecution {
    id: string;
    skillType: SkillType;
    brandId: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    rawOutput: string;
    confidence: number;
    brandPolicyPassed: boolean;
    requiresApproval: boolean;
    executionTimeMs: number;
    timestamp: string;
}

// ── Evaluation (التغذية الراجعة) ─────────────────────────────────────────────

export type EvaluationSignalType =
    | 'used'            // المستخدم استخدم المخرج مباشرة
    | 'edited'          // المستخدم عدّل المخرج
    | 'rejected'        // المستخدم رفض المخرج
    | 'converted'       // المخرج حقق conversion
    | 'human_escalated' // احتاج تدخل بشري
    | 'rated';          // المستخدم قيّم المخرج بالنجوم

export interface EvaluationSignal {
    executionId: string;
    brandId: string;
    skillType: SkillType;
    signal: EvaluationSignalType;
    originalOutput: string;
    editedOutput?: string;
    rating?: number;    // 1-5
    note?: string;
}

export interface SkillStats {
    totalExecutions: number;
    usedRate: number;
    editedRate: number;
    rejectedRate: number;
    averageRating: number;
}

// ── Marketing Request (الطلب العام للمنسق) ───────────────────────────────────

export interface MarketingRequest {
    brandId: string;
    requestText: string;
    context?: Record<string, unknown>;
    platform?: SocialPlatform;
    urgency?: 'high' | 'medium' | 'low';
    forcedSkill?: SkillType;
}

export interface PlatformBrainResponse {
    executionId: string;
    skill: SkillType;
    confidence: number;
    output: Record<string, unknown>;
    requiresApproval: boolean;
    brandPolicyPassed: boolean;
    classification: TaskClassification;
    executionTimeMs: number;
}

// ══════════════════════════════════════════════════════════════════════════════
// BRAND BRAIN — نواة عقل البراند
// نظام التشغيل التسويقي: يجمع هوية البراند وقاعدة معرفته وذاكرته في سياق موحد
// ══════════════════════════════════════════════════════════════════════════════

// --- Brand Knowledge Base ---

export type BrandKnowledgeType =
    | 'product'          // منتج أو خدمة
    | 'faq'              // سؤال شائع وإجابته
    | 'policy'           // سياسة (شحن، دفع، إرجاع)
    | 'competitor'       // معلومات منافس
    | 'scenario_script'; // سكريبت سيناريو محادثة

export interface BrandKnowledgeEntry {
    id: string;
    brandId: string;
    type: BrandKnowledgeType;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
    sortOrder: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// --- Conversation Scenarios ---

export enum ConversationScenario {
    FirstInquiry       = 'first_inquiry',       // استفسار أول مرة
    PriceAsk           = 'price_ask',            // سؤال عن السعر
    CompetitorCompare  = 'competitor_compare',   // مقارنة بمنافس
    PriceObjection     = 'price_objection',      // اعتراض على السعر
    ShippingIssue      = 'shipping_issue',       // مشكلة شحن أو توصيل
    Complaint          = 'complaint',            // شكوى
    ProductUnavailable = 'product_unavailable',  // منتج غير متوفر
    AppointmentRequest = 'appointment_request',  // حجز موعد
    FollowUp           = 'follow_up',            // متابعة بعد عدم الرد
    LeadCapture        = 'lead_capture',         // تحويل المحادثة لبيع أو Lead
    General            = 'general',              // استفسار عام
    Escalate           = 'escalate',             // تحويل لموظف بشري
}

export interface ConversationReply {
    reply: string;                          // الرد الجاهز للإرسال
    scenario: ConversationScenario;         // السيناريو الذي تم اكتشافه
    escalate: boolean;                      // هل يجب تحويل المحادثة لبشري؟
    followUpSuggestion?: string;            // اقتراح متابعة
    internalNote?: string;                  // ملاحظة داخلية للفريق
}

// --- Occasion Opportunity (المناسبة كفرصة تسويقية) ---

export interface OccasionOpportunity {
    occasionId: string;
    occasionName: string;
    daysUntil: number;
    urgency: 'high' | 'medium' | 'low';    // high ≤3 days, medium ≤7, low ≤14
    contentAngles: string[];               // 3 زوايا محتوى مختلفة
    reelIdea: string;                      // فكرة Reel جاهزة
    offerIdea: string;                     // فكرة عرض أو ترويج
    messageTone: string;                   // نبرة الرسالة المناسبة لهذه المناسبة
    sampleCaption: string;                 // كابشن جاهز مناسب للبراند
    hashtags: string[];                    // هاشتاقات مناسبة
}

// --- Brand Brain Context (السياق الكامل لعقل البراند) ---

export interface BrandBrainContext {
    brandId: string;
    identity: {
        name: string;
        industry: string;
        country: string;
        website?: string;
    };
    voice: {
        tone: string[];
        keywords: string[];
        negativeKeywords: string[];
        dos: string[];
        donts: string[];
    };
    audiences: {
        name: string;
        description: string;
        painPoints: string[];
        emotions: string[];
    }[];
    knowledge: {
        products: string;     // مُهيَّأ للـ AI prompt
        faqs: string;
        policies: string;
        competitors: string;
    };
    memory: string;           // ذاكرة المحتوى السابق والتصحيحات
    sellingPoints: string[];
    values: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// MEDIA PRODUCTION FLOW — خط إنتاج الميديا
// Creative Studio: من الهدف إلى مخرجات ميديا جاهزة ومرتبطة بالأداء
// ══════════════════════════════════════════════════════════════════════════════

export type MediaProjectGoal =
    | 'awareness'
    | 'engagement'
    | 'conversion'
    | 'leads'
    | 'retention'
    | 'traffic';

export type MediaProjectOutputType =
    | 'static'
    | 'carousel'
    | 'reel'
    | 'story'
    | 'ad'
    | 'motion'
    | 'mixed';

export type MediaProjectPriority = 'low' | 'normal' | 'high' | 'urgent';

export type MediaProjectStatus =
    | 'request'     // مرحلة الطلب
    | 'brief'       // AI يولّد البريف
    | 'matrix'      // Idea Matrix جاهز
    | 'production'  // التنفيذ جارٍ
    | 'review'      // في المراجعة
    | 'approved'    // مُعتمد
    | 'published'   // منشور
    | 'archived';   // أرشيف

export type MediaProjectTrack = 'design' | 'video' | 'copy';
export type MediaPieceStatus = 'draft' | 'in_progress' | 'review' | 'approved' | 'published';
export type MediaReviewLevel = 'internal' | 'marketing' | 'client';
export type MediaReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'rejected';

// ── AI Creative Brief ─────────────────────────────────────────────────────────

export interface CreativeBrief {
    objective: string;
    audience: string;
    coreMessage: string;
    offer: string;
    tone: string;
    visualDirection: string;
    formatSpecs: string;
    deliverables: string[];
    mandatoryElements: string[];
    prohibitions: string[];
    cta: string;
    successCriteria: string[];
}

// ── Idea Matrix ───────────────────────────────────────────────────────────────

export interface IdeaMatrixFormat {
    type: string;        // Static / Reel / Carousel / Story / Ad
    description: string; // وصف مختصر لكيفية تنفيذ هذا الفورمات بهذا الـ hook
}

export interface IdeaMatrixAngle {
    angle: string;                // اسم الزاوية (Pain Point / Social Proof / Urgency)
    hook: string;                 // الـ hook المقترح
    rationale: string;            // لماذا هذه الزاوية تناسب البراند والهدف
    formats: IdeaMatrixFormat[];  // الفورمات المقترحة لهذه الزاوية
}

// ── Core Entities ─────────────────────────────────────────────────────────────

export interface MediaProject {
    id: string;
    brandId: string;
    title: string;
    goal: MediaProjectGoal;
    outputType: MediaProjectOutputType;
    campaign?: string;
    productOffer?: string;
    cta?: string;
    platforms: string[];
    deadline?: string;           // ISO date
    priority: MediaProjectPriority;
    status: MediaProjectStatus;
    brief: CreativeBrief | null;
    ideaMatrix: IdeaMatrixAngle[];
    performance: Record<string, unknown>;
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MediaProjectPiece {
    id: string;
    projectId: string;
    brandId: string;
    isMaster: boolean;
    variantOf?: string;
    title: string;
    content: string;
    track?: MediaProjectTrack;
    format?: string;
    angle?: string;
    hook?: string;
    script?: string;
    platform?: string;
    variantLabel?: string;       // '1:1' / '9:16' / 'Arabic' / 'No-audio'
    status: MediaPieceStatus;
    notes?: string;
    publishedPostId?: string;    // linked scheduled_post after publishing
    createdAt: string;
    updatedAt: string;
}

// ── Campaign Insights (Learning Loop) ─────────────────────────────────────────

export interface MediaCampaignInsight {
    id: string;
    projectId: string;
    brandId: string;
    whatWorked: string;
    whatToImprove: string;
    nextCampaignRecommendation: string;
    creativeScore: number;
    piecesSummary: Array<{ id: string; title: string; format?: string; status: string }>;
    generatedAt: string;
    createdAt: string;
}

export interface MediaProjectReview {
    id: string;
    projectId: string;
    brandId: string;
    pieceId?: string;
    reviewLevel: MediaReviewLevel;
    status: MediaReviewStatus;
    reviewerName?: string;
    comment?: string;
    createdAt: string;
}

// ── Summary (from view) ───────────────────────────────────────────────────────

export interface MediaProjectSummary {
    id: string;
    brandId: string;
    title: string;
    goal: MediaProjectGoal;
    outputType: MediaProjectOutputType;
    campaign?: string;
    platforms: string[];
    deadline?: string;
    priority: MediaProjectPriority;
    status: MediaProjectStatus;
    createdAt: string;
    updatedAt: string;
    piecesCount: number;
    masterCount: number;
    approvedPieces: number;
    pendingReviews: number;
}

// ── Creative Request Form (UI intake) ─────────────────────────────────────────

export interface CreativeRequestForm {
    title: string;
    goal: MediaProjectGoal;
    outputType: MediaProjectOutputType;
    campaign: string;
    productOffer: string;
    cta: string;
    platforms: SocialPlatform[];
    deadline: string;
    priority: MediaProjectPriority;
    notes: string;
}

// ════════════════════════════════════════════════════════════════════════════
// Campaign Brain — AI Marketing Operating System
// ════════════════════════════════════════════════════════════════════════════

export type CampaignGoalType = 'awareness' | 'engagement' | 'leads' | 'sales' | 'retention';

export type CampaignBrainStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export type CBContentFormat = 'post' | 'story' | 'reel' | 'carousel' | 'video' | 'ad';

export type CBContentType = 'educational' | 'promotional' | 'testimonial' | 'behind-scenes' | 'occasion' | 'entertainment';

export type CBItemStatus =
    | 'draft'
    | 'brief_ready'
    | 'design_in_progress'
    | 'design_ready'
    | 'caption_ready'
    | 'needs_review'
    | 'approved'
    | 'scheduled'
    | 'publishing'
    | 'published'
    | 'publish_failed'
    | 'performance_tracked'
    | 'needs_optimization';

export type CBApprovalDecision = 'pending' | 'approved' | 'rejected' | 'needs_changes';

export interface CBGoal {
    id: string;
    brandId: string;
    title: string;
    description?: string;
    goalType: CampaignGoalType;
    kpis: Array<{ metric: string; target: number; unit: string }>;
    targetDate?: string;
    status: 'active' | 'completed' | 'paused' | 'cancelled';
    progress: number;
    createdAt: string;
}

export interface CBCampaign {
    id: string;
    brandId: string;
    goalId?: string;
    name: string;
    description?: string;
    status: CampaignBrainStatus;
    strategyData: CBStrategyDocument;
    startDate?: string;
    endDate?: string;
    budget?: number;
    currency: string;
    platforms: string[];
    contentCount: number;
    publishedCount: number;
    healthScore: number;
    createdAt: string;
    updatedAt: string;
}

export interface CBStrategyDocument {
    coreMessage?: string;
    contentMix?: Array<{ type: CBContentType; percentage: number }>;
    keyMessages?: Array<{ text: string; priority: number }>;
    platformDistribution?: Array<{ platform: string; weight: number }>;
    toneGuidance?: string;
    avoidTopics?: string[];
    confidenceScore?: number;
    reasoning?: string;
}

export interface CBContentPlan {
    id: string;
    brandId: string;
    campaignId: string;
    title: string;
    totalItems: number;
    status: 'draft' | 'active' | 'locked';
    createdAt: string;
}

export interface CBContentItem {
    id: string;
    brandId: string;
    campaignId?: string;
    contentPlanId?: string;
    title: string;
    contentType: CBContentType;
    platform: string;
    format: CBContentFormat;
    status: CBItemStatus;
    caption?: string;
    mediaUrl?: string;
    briefData?: CBBriefData;
    designPrompt?: string;
    brandFitScore?: number;
    scheduledAt?: string;
    publishedAt?: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
}

export interface CBBriefData {
    objective?: string;
    targetSegment?: string;
    keyMessage?: string;
    tone?: string;
    hooks?: string[];
    cta?: string;
    slideStructure?: CBSlide[];
}

export interface CBSlide {
    order: number;
    headline: string;
    subtext?: string;
    visualNote?: string;
    cta?: string;
}

export interface CBCreativeBrief {
    id: string;
    brandId: string;
    contentItemId: string;
    objective: string;
    targetSegment?: string;
    keyMessage: string;
    tone?: string;
    hooks: string[];
    cta?: string;
    visualDirection?: string;
    negativeSpace?: string;
    slideStructure: CBSlide[];
    version: number;
    isApproved: boolean;
    createdAt: string;
}

export interface CBDesignPrompt {
    id: string;
    brandId: string;
    contentItemId: string;
    creativeBriefId?: string;
    promptText: string;
    negativePrompt?: string;
    model: string;
    aspectRatio: string;
    stylePreset?: string;
    generatedImageUrl?: string;
    generationStatus: 'pending' | 'generating' | 'done' | 'failed';
    isSelected: boolean;
    version: number;
    createdAt: string;
}

export interface CBApproval {
    id: string;
    brandId: string;
    contentItemId: string;
    decision: CBApprovalDecision;
    reviewType: 'content' | 'design' | 'compliance' | 'final';
    notes?: string;
    changesRequested: string[];
    expiresAt?: string;
    createdAt: string;
}

export interface CBPublishingJob {
    id: string;
    brandId: string;
    contentItemId: string;
    platform: string;
    scheduledAt: string;
    status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'retry';
    attempts: number;
    platformPostId?: string;
    platformUrl?: string;
    publishedAt?: string;
    lastError?: string;
    createdAt: string;
}

export interface CBQualityScore {
    overall: number;
    brandFit: number;
    audienceFit: number;
    goalFit: number;
    platformFit: number;
    visualClarity: number;
    captionPower: number;
    ctaStrength: number;
    algorithm: number;
    safety: number;
    conversion: number;
    issues: Array<{ dimension: string; message: string; autoFixable: boolean }>;
    predictedCtr: 'low' | 'medium' | 'high';
}

export interface CBRecommendation {
    priority: 'high' | 'medium' | 'low';
    title: string;
    reason: string;
    action: string;
    confidence: number;
}

// ── Campaign Brain wizard step type ──────────────────────────────────────────

export type CBWizardStep =
    | 'campaigns-list'
    | 'goal-builder'
    | 'strategy-generator'
    | 'content-calendar'
    | 'item-workspace'
    | 'performance'
    | 'recommendations';

export interface CBCalendarSlot {
    date: string;         // YYYY-MM-DD
    platform: string;
    format: CBContentFormat;
    contentType: CBContentType;
    topic: string;
    angle: string;
    occasionLink?: string;
}

// ── Campaign Brain Performance & Learning types ──────────────────────────────

export interface CBKPIPerformance {
    metric: string;
    predicted: number;
    actual: number;
    unit: string;
    status: 'on_target' | 'exceeded' | 'below';
}

export interface CBPerformanceLearning {
    type: 'success' | 'weakness' | 'trend';
    text: string;
}

export interface CBPerformanceAnalysis {
    campaignId: string;
    kpiPerformance: CBKPIPerformance[];
    learnings: CBPerformanceLearning[];
    healthScore: number;
    avgEngagement: number;
    topPerformerType: string;
    weakPerformerType: string;
    generatedAt: string;
}

// ── Captions table type ───────────────────────────────────────────────────────

export interface CBCaption {
    id: string;
    brandId: string;
    contentItemId: string;
    platform: string;
    version: number;
    captionText: string;
    headline?: string;
    hashtags: string[];
    cta?: string;
    altText?: string;
    charCount: number;
    language: string;
    isSelected: boolean;
    createdAt: string;
}

// ── Media Assets table type ───────────────────────────────────────────────────

export interface CBMediaAsset {
    id: string;
    brandId: string;
    contentItemId?: string;
    designPromptId?: string;
    name: string;
    url: string;
    type: string;
    source: string;
    provider?: string;
    aiScore?: number;
    aspectRatio?: string;
    width?: number;
    height?: number;
    prompt?: string;
    tags: string[];
    isSelected: boolean;
    createdAt: string;
}

// ── Support Chat ──────────────────────────────────────────────────────────────

export type SupportSenderType = 'user' | 'ai' | 'agent';
export type SupportSessionStatus = 'active' | 'resolved' | 'closed';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportTicketCategory = 'technical' | 'billing' | 'feature' | 'bug' | 'other';

export interface SupportChatSession {
    id: string;
    userId: string;
    brandId?: string;
    language: 'ar' | 'en';
    status: SupportSessionStatus;
    title?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SupportChatMessage {
    id: string;
    sessionId: string;
    senderType: SupportSenderType;
    senderId?: string;
    content: string;
    metadata?: {
        category?: SupportTicketCategory;
        priority?: SupportTicketPriority;
        canResolve?: boolean;
        suggestTicket?: boolean;
    };
    createdAt: string;
}

export interface SupportTicket {
    id: string;
    ticketNumber: number;
    sessionId?: string;
    userId: string;
    brandId?: string;
    title: string;
    description: string;
    priority: SupportTicketPriority;
    status: SupportTicketStatus;
    category: SupportTicketCategory;
    language: 'ar' | 'en';
    assignedTo?: string;
    resolvedAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface SupportTicketReply {
    id: string;
    ticketId: string;
    senderId: string;
    senderType: 'user' | 'admin' | 'support_agent';
    content: string;
    isInternal: boolean;
    createdAt: string;
}

export interface AISupportResponse {
    reply: string;
    canResolve: boolean;
    suggestTicket: boolean;
    category: SupportTicketCategory;
    priority: SupportTicketPriority;
}

// ─── Smart Bot Studio ─────────────────────────────────────────────────────────

export type BotScenario =
    | 'sales-closing'
    | 'lead-qualification'
    | 'faq'
    | 'product-advisor'
    | 'retention'
    | 'appointment';

export type BotPersonality = 'professional' | 'friendly' | 'urgent' | 'luxury' | 'enthusiastic';
export type BotLanguage = 'arabic' | 'english' | 'bilingual';
export type BotStatus = 'active' | 'paused' | 'draft';
export type BotTrigger = 'dm-received' | 'keyword-match' | 'comment-reply' | 'manual';

export interface BotPersona {
    id: string;
    brandId: string;
    name: string;
    avatarEmoji: string;
    scenario: BotScenario;
    personality: BotPersonality;
    language: BotLanguage;
    persuasionLevel: 1 | 2 | 3;
    systemPrompt: string;
    greetingMessage: string;
    closingMessage: string;
    trigger: BotTrigger;
    triggerKeywords: string[];
    status: BotStatus;
    conversationCount: number;
    conversionRate: number;
    createdAt: string;
    updatedAt?: string;
}

export interface BotMessage {
    id: string;
    role: 'bot' | 'customer';
    content: string;
    timestamp: string;
}

export interface BotConversation {
    id: string;
    brandId: string;
    personaId: string;
    platform: 'instagram' | 'facebook' | 'whatsapp' | 'website';
    customerName: string;
    customerId: string;
    status: 'active' | 'closed' | 'escalated' | 'converted';
    messages: BotMessage[];
    createdAt: string;
    updatedAt: string;
}
