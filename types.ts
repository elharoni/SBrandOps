
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

export interface SocialAsset {
    id: string;
    name: string;
    category?: string;
    followers: number;
    avatarUrl: string;
    accessToken?: string;
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

export interface SocialAccount {
    id: string;
    platform: SocialPlatform;
    username: string;
    avatarUrl: string;
    followers: number;
    status: AccountStatus;
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
    values: string[];
    keySellingPoints: string[];
    styleGuidelines: string[];
    brandVoice: BrandVoice;
    brandAudiences: BrandAudience[];
    consistencyScore: number;
    lastMemoryUpdate: string;
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
        impressions: number;
        engagement: number;
        postsPublished: number;
        sentiment: { positive: number; neutral: number; negative: number };
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

export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'stability' | 'replicate';

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
    | 'instagram-story'
    | 'instagram-reel-cover'
    | 'facebook-post'
    | 'twitter-post'
    | 'linkedin-post'
    | 'linkedin-banner'
    | 'tiktok-cover'
    | 'youtube-thumbnail'
    | 'ad-banner-square'
    | 'ad-banner-landscape'
    | 'custom';

export interface DesignWorkflowFormat {
    format: DesignWorkflowOutputFormat;
    width: number;
    height: number;
    label: string;
    labelAr: string;
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
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
    'instagram-post':       { format: 'instagram-post',       width: 1080, height: 1080, label: 'Instagram Post',     labelAr: 'منشور إنستاغرام',    aspectRatio: '1:1'  },
    'instagram-story':      { format: 'instagram-story',      width: 1080, height: 1920, label: 'Instagram Story',    labelAr: 'ستوري إنستاغرام',    aspectRatio: '9:16' },
    'instagram-reel-cover': { format: 'instagram-reel-cover', width: 1080, height: 1920, label: 'Reel Cover',         labelAr: 'غلاف ريل',           aspectRatio: '9:16' },
    'facebook-post':        { format: 'facebook-post',        width: 1200, height: 630,  label: 'Facebook Post',      labelAr: 'منشور فيسبوك',       aspectRatio: '16:9' },
    'twitter-post':         { format: 'twitter-post',         width: 1600, height: 900,  label: 'X (Twitter) Post',   labelAr: 'منشور X (تويتر)',    aspectRatio: '16:9' },
    'linkedin-post':        { format: 'linkedin-post',        width: 1200, height: 627,  label: 'LinkedIn Post',      labelAr: 'منشور لينكدإن',      aspectRatio: '16:9' },
    'linkedin-banner':      { format: 'linkedin-banner',      width: 1584, height: 396,  label: 'LinkedIn Banner',    labelAr: 'بانر لينكدإن',       aspectRatio: '4:3'  },
    'tiktok-cover':         { format: 'tiktok-cover',         width: 1080, height: 1920, label: 'TikTok Cover',       labelAr: 'غلاف تيك توك',       aspectRatio: '9:16' },
    'youtube-thumbnail':    { format: 'youtube-thumbnail',    width: 1280, height: 720,  label: 'YouTube Thumbnail',  labelAr: 'صورة مصغرة يوتيوب', aspectRatio: '16:9' },
    'ad-banner-square':     { format: 'ad-banner-square',     width: 1200, height: 1200, label: 'Ad Square',          labelAr: 'إعلان مربع',         aspectRatio: '1:1'  },
    'ad-banner-landscape':  { format: 'ad-banner-landscape',  width: 1200, height: 628,  label: 'Ad Landscape',       labelAr: 'إعلان أفقي',         aspectRatio: '16:9' },
    'custom':               { format: 'custom',               width: 1080, height: 1080, label: 'Custom Size',        labelAr: 'مقاس مخصص',         aspectRatio: '1:1'  },
};
