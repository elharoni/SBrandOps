import React, { useMemo, useState } from 'react';
import {
    AccountStatus,
    NotificationType,
    PLATFORM_ASSETS,
    SocialPlatform,
    type SocialAccount,
    type SocialAsset,
} from '../../types';
import {
    CONNECTABLE_BRAND_PROVIDERS,
    disconnectBrandConnection,
    type BrandAsset,
    type BrandConnection,
    type ConnectableBrandProvider,
    type ConnectionStatus,
    type Provider,
    type SyncHealth,
} from '../../services/brandConnectionService';
import {
    connectProvider,
    getConnectionAssetLabels as getProviderConnectionAssetLabels,
    refreshProviderConnection,
    type ProviderConnectionInputMap,
} from '../../services/providerConnectionService';
import { connectSelectedAssets, fetchAvailableAssets, initiateSocialLogin } from '../../services/socialAuthService';
import { SetupGuideModal, needsSetupGuide } from '../shared/SetupGuideModal';
import { disconnectSocialAccount, updateAccountStatus } from '../../services/socialAccountService';
import { useLanguage } from '../../context/LanguageContext';
import { useUIStore } from '../../stores/uiStore';
import { AssetSelectionModal } from '../AssetSelectionModal';
import { PageScaffold, PageSection } from '../shared/PageScaffold';
import {
    countConnectionsNeedingAttention,
    countLiveOperationalConnections,
    countRecentlySyncedConnections,
    groupConnectionsBySection,
} from './integrationsModel';

interface IntegrationsPageProps {
    brandId: string;
    socialAccounts: SocialAccount[];
    brandConnections: BrandConnection[];
    brandAssets: BrandAsset | null;
    onRefresh: () => Promise<void> | void;
    onNavigate: (page: string) => void;
}

type DisconnectTarget =
    | { kind: 'social'; id: string; label: string }
    | { kind: 'connection'; id: string; label: string };

const PUBLISHING_GRADIENTS: Record<SocialPlatform, string> = {
    [SocialPlatform.Facebook]: 'from-blue-600/12 to-blue-600/5 border-blue-600/20',
    [SocialPlatform.Instagram]: 'from-pink-600/12 to-purple-600/5 border-pink-600/20',
    [SocialPlatform.X]: 'from-slate-500/12 to-slate-500/5 border-slate-500/20',
    [SocialPlatform.LinkedIn]: 'from-blue-700/12 to-blue-700/5 border-blue-700/20',
    [SocialPlatform.TikTok]: 'from-zinc-900/20 to-zinc-900/5 border-zinc-700/20',
    [SocialPlatform.Pinterest]: 'from-red-600/12 to-red-600/5 border-red-600/20',
};

const SOCIAL_STATUS_STYLES: Record<AccountStatus, { tone: string; labelAr: string; labelEn: string }> = {
    [AccountStatus.Connected]: {
        tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
        labelAr: 'جاهز',
        labelEn: 'Ready',
    },
    [AccountStatus.NeedsReauth]: {
        tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
        labelAr: 'يحتاج إعادة توثيق',
        labelEn: 'Needs Re-auth',
    },
    [AccountStatus.Expired]: {
        tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
        labelAr: 'منتهي',
        labelEn: 'Expired',
    },
};

const CONNECTION_STATUS_STYLES: Record<ConnectionStatus, { tone: string; labelAr: string; labelEn: string }> = {
    connected: { tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', labelAr: 'متصل', labelEn: 'Connected' },
    expired: { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', labelAr: 'منتهي', labelEn: 'Expired' },
    needs_reauth: { tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', labelAr: 'يحتاج إعادة توثيق', labelEn: 'Needs Re-auth' },
    paused: { tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', labelAr: 'متوقف', labelEn: 'Paused' },
    error: { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', labelAr: 'خطأ', labelEn: 'Error' },
    disconnected: { tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', labelAr: 'مفصول', labelEn: 'Disconnected' },
};

const HEALTH_STYLES: Record<SyncHealth, { tone: string; labelAr: string; labelEn: string }> = {
    healthy: { tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300', labelAr: 'صحي', labelEn: 'Healthy' },
    degraded: { tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300', labelAr: 'متراجع', labelEn: 'Degraded' },
    failing: { tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300', labelAr: 'متعثر', labelEn: 'Failing' },
    unknown: { tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', labelAr: 'غير معروف', labelEn: 'Unknown' },
};

const PROVIDER_META: Record<Provider, {
    icon: string;
    iconTone: string;
    labelAr: string;
    labelEn: string;
    descriptionAr: string;
    descriptionEn: string;
    route?: string;
}> = {
    meta: { icon: 'fab fa-facebook-square', iconTone: 'bg-blue-500/10 text-blue-500', labelAr: 'Meta', labelEn: 'Meta', descriptionAr: 'اتصال أعمال وإعلانات Meta المرتبط بالبراند.', descriptionEn: 'Meta business and ads connection linked to the brand.', route: 'ads-ops' },
    instagram: { icon: 'fab fa-instagram', iconTone: 'bg-pink-500/10 text-pink-500', labelAr: 'Instagram', labelEn: 'Instagram', descriptionAr: 'اتصال Instagram الخلفي الخاص بالنشر أو الأصول.', descriptionEn: 'Background Instagram connection for publishing or assets.', route: 'social-ops/accounts' },
    x: { icon: 'fab fa-twitter', iconTone: 'bg-slate-500/10 text-slate-300', labelAr: 'X', labelEn: 'X', descriptionAr: 'اتصال X الخلفي للقنوات والأصول.', descriptionEn: 'Background X connection for channels and assets.', route: 'social-ops/accounts' },
    linkedin: { icon: 'fab fa-linkedin', iconTone: 'bg-blue-700/10 text-blue-600 dark:text-blue-300', labelAr: 'LinkedIn', labelEn: 'LinkedIn', descriptionAr: 'اتصال LinkedIn الخاص بالحسابات أو الصفحات.', descriptionEn: 'LinkedIn connection for pages and brand assets.', route: 'social-ops/accounts' },
    tiktok: { icon: 'fab fa-tiktok', iconTone: 'bg-zinc-900/20 text-light-text dark:text-dark-text', labelAr: 'TikTok', labelEn: 'TikTok', descriptionAr: 'اتصال TikTok المرتبط بالأصول أو الحملات.', descriptionEn: 'TikTok connection linked to assets or campaigns.', route: 'social-ops/accounts' },
    youtube: { icon: 'fab fa-youtube', iconTone: 'bg-red-500/10 text-red-500', labelAr: 'YouTube', labelEn: 'YouTube', descriptionAr: 'اتصال قناة YouTube الخاصة بالبراند.', descriptionEn: 'YouTube channel connection for the brand.', route: 'social-ops/accounts' },
    snapchat: { icon: 'fab fa-snapchat', iconTone: 'bg-yellow-500/15 text-yellow-500', labelAr: 'Snapchat', labelEn: 'Snapchat', descriptionAr: 'اتصال Snapchat للأصول أو الإعلانات.', descriptionEn: 'Snapchat connection for assets or ads.', route: 'social-ops/accounts' },
    ga4: { icon: 'fas fa-chart-line', iconTone: 'bg-emerald-500/10 text-emerald-500', labelAr: 'Google Analytics 4', labelEn: 'Google Analytics 4', descriptionAr: 'مصدر الأداء والتحويل المرتبط بتقارير البراند.', descriptionEn: 'Performance and conversion source connected to brand reporting.', route: 'analytics' },
    search_console: { icon: 'fas fa-magnifying-glass-chart', iconTone: 'bg-cyan-500/10 text-cyan-500', labelAr: 'Search Console', labelEn: 'Search Console', descriptionAr: 'مصدر الظهور والبحث العضوي المرتبط بالبراند.', descriptionEn: 'Organic search visibility source linked to the brand.', route: 'seo-ops' },
    google_ads: { icon: 'fab fa-google', iconTone: 'bg-amber-500/10 text-amber-500', labelAr: 'Google Ads', labelEn: 'Google Ads', descriptionAr: 'حسابات Google Ads المرتبطة بالتقارير والحملات.', descriptionEn: 'Google Ads accounts linked to campaigns and reporting.', route: 'ads-ops' },
    woocommerce: { icon: 'fas fa-store', iconTone: 'bg-violet-500/10 text-violet-500', labelAr: 'WooCommerce', labelEn: 'WooCommerce', descriptionAr: 'متجر WooCommerce كمصدر تشغيل وطلبات.', descriptionEn: 'WooCommerce store used as an operational source.', route: 'crm' },
    shopify: { icon: 'fab fa-shopify', iconTone: 'bg-green-500/10 text-green-500', labelAr: 'Shopify', labelEn: 'Shopify', descriptionAr: 'متجر Shopify كمصدر للطلبات والبيانات التجارية.', descriptionEn: 'Shopify store connected for orders and commercial data.', route: 'crm' },
    wordpress: { icon: 'fab fa-wordpress', iconTone: 'bg-sky-500/10 text-sky-500', labelAr: 'WordPress', labelEn: 'WordPress', descriptionAr: 'اتصال WordPress لنشر المحتوى أو مزامنة الموقع.', descriptionEn: 'WordPress connection for publishing or site sync.', route: 'seo-ops' },
    slack: { icon: 'fab fa-slack', iconTone: 'bg-violet-500/10 text-violet-500', labelAr: 'Slack', labelEn: 'Slack', descriptionAr: 'ربط تنبيهات الفريق وسير الموافقات بقنوات Slack.', descriptionEn: 'Connect team alerts and approval flows to Slack channels.', route: 'workflow' },
    zapier: { icon: 'fas fa-bolt', iconTone: 'bg-orange-500/10 text-orange-500', labelAr: 'Zapier', labelEn: 'Zapier', descriptionAr: 'Webhook تشغيلي لربط SBrandOps بالتدفقات الخارجية.', descriptionEn: 'Operational webhook connection for external Zapier flows.', route: 'workflow' },
    n8n: { icon: 'fas fa-network-wired', iconTone: 'bg-rose-500/10 text-rose-500', labelAr: 'n8n', labelEn: 'n8n', descriptionAr: 'ربط Webhooks وتدفقات n8n التشغيلية مع SBrandOps.', descriptionEn: 'Connect n8n webhooks and operational workflows to SBrandOps.', route: 'workflow' },
    google_drive: { icon: 'fab fa-google-drive', iconTone: 'bg-emerald-500/10 text-emerald-500', labelAr: 'Google Drive', labelEn: 'Google Drive', descriptionAr: 'ربط ملفات البراند والمجلدات المرجعية من Google Drive.', descriptionEn: 'Connect brand files and working folders from Google Drive.', route: 'brand-hub' },
    figma: { icon: 'fab fa-figma', iconTone: 'bg-pink-500/10 text-pink-500', labelAr: 'Figma', labelEn: 'Figma', descriptionAr: 'ربط مساحة التصميم والفرق الإبداعية بالبراند.', descriptionEn: 'Connect the design workspace and creative teams to the brand.', route: 'brand-hub' },
};

const COMING_SOON_SECTIONS = {
    ads: [
        { id: 'meta-ads', icon: 'fab fa-facebook-square', tone: 'bg-blue-500/10 text-blue-500', titleAr: 'Meta Ads', titleEn: 'Meta Ads', descriptionAr: 'إدارة ربط حسابات الإعلانات وأصول البيزنس من نفس الشاشة.', descriptionEn: 'Connect ad accounts and business assets from this workspace.' },
        { id: 'tiktok-ads', icon: 'fab fa-tiktok', tone: 'bg-zinc-900/20 text-light-text dark:text-dark-text', titleAr: 'TikTok Ads', titleEn: 'TikTok Ads', descriptionAr: 'ربط حسابات TikTok Ads مع المقاييس والحملات.', descriptionEn: 'Connect TikTok Ads accounts to metrics and campaigns.' },
    ],
    analytics: [
        { id: 'meta-pixel', icon: 'fas fa-wave-square', tone: 'bg-cyan-500/10 text-cyan-500', titleAr: 'Meta Pixel', titleEn: 'Meta Pixel', descriptionAr: 'قراءة حالة البيكسل والتحقق من الإطلاقات والأحداث.', descriptionEn: 'Monitor pixel health and event delivery from here.' },
        { id: 'hotjar', icon: 'fas fa-fire', tone: 'bg-rose-500/10 text-rose-500', titleAr: 'Hotjar', titleEn: 'Hotjar', descriptionAr: 'تجميع الخرائط الحرارية والإشارات السلوكية في نفس مساحة الربط.', descriptionEn: 'Bring heatmaps and behavioral signals into the same workspace.' },
    ],
    messaging: [
        { id: 'whatsapp', icon: 'fab fa-whatsapp', tone: 'bg-green-500/10 text-green-500', titleAr: 'WhatsApp Business', titleEn: 'WhatsApp Business', descriptionAr: 'ربط رسائل واتساب مع الـ Inbox والردود التشغيلية من داخل SBrandOps.', descriptionEn: 'Connect WhatsApp conversations to the Inbox and ops replies inside SBrandOps.' },
        { id: 'telegram', icon: 'fab fa-telegram', tone: 'bg-sky-500/10 text-sky-500', titleAr: 'Telegram', titleEn: 'Telegram', descriptionAr: 'ربط بوتات Telegram للتنبيهات، الاستفسارات، ومسارات الدعم السريعة.', descriptionEn: 'Connect Telegram bots for alerts, inquiries, and lightweight support flows.' },
    ],
    automation: [
        { id: 'make', icon: 'fas fa-shuffle', tone: 'bg-indigo-500/10 text-indigo-500', titleAr: 'Make', titleEn: 'Make', descriptionAr: 'أتمتة متعددة الخطوات للعمليات التشغيلية والتنبيهات.', descriptionEn: 'Multi-step automation for ops flows and alerts.' },
        { id: 'mailchimp', icon: 'fas fa-envelope-open-text', tone: 'bg-yellow-500/10 text-yellow-500', titleAr: 'Mailchimp', titleEn: 'Mailchimp', descriptionAr: 'مزامنة القوائم ورسائل الإطلاق الآلية.', descriptionEn: 'Sync lists and lifecycle email automations.' },
    ],
    files: [
        { id: 'canva', icon: 'fas fa-palette', tone: 'bg-sky-500/10 text-sky-500', titleAr: 'Canva', titleEn: 'Canva', descriptionAr: 'ربط قوالب التصميم والأصول الجاهزة للنشر.', descriptionEn: 'Connect design templates and ready-to-publish assets.' },
        { id: 'dropbox', icon: 'fab fa-dropbox', tone: 'bg-blue-500/10 text-blue-500', titleAr: 'Dropbox', titleEn: 'Dropbox', descriptionAr: 'مزامنة التخزين السحابي مع فريق التنفيذ.', descriptionEn: 'Sync cloud storage with the execution team.' },
        { id: 'notion', icon: 'fas fa-book', tone: 'bg-slate-500/10 text-slate-300', titleAr: 'Notion', titleEn: 'Notion', descriptionAr: 'ربط قواعد المعرفة وخطط المحتوى بمساحة التشغيل.', descriptionEn: 'Connect knowledge bases and content plans to ops.' },
    ],
    commerce: [],
} as const;

const SOCIAL_PROVIDER_SET = new Set<Provider>(['instagram', 'x', 'linkedin', 'tiktok', 'youtube', 'snapchat']);

const CONNECTABLE_PROVIDER_SECTIONS = {
    ads: ['google_ads'],
    analytics: ['ga4', 'search_console'],
    automation: ['slack', 'zapier', 'n8n'],
    files: ['google_drive', 'figma'],
    commerce: ['shopify', 'woocommerce', 'wordpress'],
} as const satisfies Record<'ads' | 'analytics' | 'automation' | 'files' | 'commerce', readonly ConnectableBrandProvider[]>;

type ProviderDialogState = {
    mode: 'connect' | 'reconnect';
    provider: ConnectableBrandProvider;
    connection?: BrandConnection | null;
};

type ProviderFieldConfig = {
    key: string;
    labelAr: string;
    labelEn: string;
    placeholderAr: string;
    placeholderEn: string;
    type?: 'text' | 'password';
    noteAr?: string;
    noteEn?: string;
};

const PROVIDER_FIELD_CONFIG: Record<ConnectableBrandProvider, ProviderFieldConfig[]> = {
    google_ads: [
        { key: 'accessToken', labelAr: 'Access Token', labelEn: 'Access token', placeholderAr: 'ألصق Google access token', placeholderEn: 'Paste a Google access token' },
        { key: 'developerToken', labelAr: 'Developer Token', labelEn: 'Developer token', placeholderAr: 'ألصق Google Ads developer token', placeholderEn: 'Paste a Google Ads developer token' },
        { key: 'loginCustomerId', labelAr: 'Login Customer ID', labelEn: 'Login customer ID', placeholderAr: 'اختياري: MCC أو manager ID', placeholderEn: 'Optional: MCC or manager ID' },
    ],
    ga4: [
        { key: 'accessToken', labelAr: 'Access Token', labelEn: 'Access token', placeholderAr: 'ألصق Google access token', placeholderEn: 'Paste a Google access token' },
    ],
    search_console: [
        { key: 'accessToken', labelAr: 'Access Token', labelEn: 'Access token', placeholderAr: 'ألصق Google access token', placeholderEn: 'Paste a Google access token' },
    ],
    shopify: [
        { key: 'shopDomain', labelAr: 'Shop Domain', labelEn: 'Shop domain', placeholderAr: 'mystore.myshopify.com', placeholderEn: 'mystore.myshopify.com' },
        { key: 'accessToken', labelAr: 'Access Token', labelEn: 'Access token', placeholderAr: 'shpat_...', placeholderEn: 'shpat_...', type: 'password' },
        { key: 'storeName', labelAr: 'Store Name', labelEn: 'Store name', placeholderAr: 'اسم المتجر', placeholderEn: 'Store name' },
    ],
    woocommerce: [
        { key: 'storeUrl', labelAr: 'Store URL', labelEn: 'Store URL', placeholderAr: 'https://mystore.com', placeholderEn: 'https://mystore.com' },
        { key: 'consumerKey', labelAr: 'Consumer Key', labelEn: 'Consumer key', placeholderAr: 'ck_...', placeholderEn: 'ck_...' },
        { key: 'consumerSecret', labelAr: 'Consumer Secret', labelEn: 'Consumer secret', placeholderAr: 'cs_...', placeholderEn: 'cs_...', type: 'password' },
        { key: 'storeName', labelAr: 'Store Name', labelEn: 'Store name', placeholderAr: 'اسم المتجر', placeholderEn: 'Store name' },
    ],
    wordpress: [
        { key: 'siteUrl', labelAr: 'Site URL', labelEn: 'Site URL', placeholderAr: 'https://yoursite.com', placeholderEn: 'https://yoursite.com' },
        { key: 'username', labelAr: 'Username', labelEn: 'Username', placeholderAr: 'اسم مستخدم WordPress', placeholderEn: 'WordPress username' },
        { key: 'appPassword', labelAr: 'Application Password', labelEn: 'Application password', placeholderAr: 'ألصق Application Password', placeholderEn: 'Paste an application password', type: 'password', noteAr: 'استخدم WordPress Application Passwords بدل كلمة المرور العادية.', noteEn: 'Use WordPress Application Passwords instead of the normal password.' },
        { key: 'websiteName', labelAr: 'Website Name', labelEn: 'Website name', placeholderAr: 'اسم الموقع', placeholderEn: 'Website name' },
    ],
    slack: [
        { key: 'botToken', labelAr: 'Bot Token', labelEn: 'Bot token', placeholderAr: 'xoxb-...', placeholderEn: 'xoxb-...', type: 'password' },
        { key: 'channelId', labelAr: 'Channel ID', labelEn: 'Channel ID', placeholderAr: 'اختياري: C0123456789', placeholderEn: 'Optional: C0123456789', noteAr: 'أدخل القناة إذا كنت تريد ربط تنبيه أو موافقة تشغيلية محددة.', noteEn: 'Enter a channel only if you want to bind alerts or approvals to a specific destination.' },
    ],
    zapier: [
        { key: 'webhookUrl', labelAr: 'Webhook URL', labelEn: 'Webhook URL', placeholderAr: 'https://hooks.zapier.com/...', placeholderEn: 'https://hooks.zapier.com/...' },
        { key: 'workflowName', labelAr: 'Workflow Name', labelEn: 'Workflow name', placeholderAr: 'اسم التدفق', placeholderEn: 'Workflow name' },
        { key: 'sharedSecret', labelAr: 'Shared Secret', labelEn: 'Shared secret', placeholderAr: 'اختياري', placeholderEn: 'Optional', type: 'password', noteAr: 'استخدم secret إذا كان الـ Zap يتحقق من التوقيع أو المصدر.', noteEn: 'Use a shared secret if the Zap validates signatures or the request source.' },
    ],
    n8n: [
        { key: 'baseUrl', labelAr: 'Base URL', labelEn: 'Base URL', placeholderAr: 'https://n8n.yourcompany.com', placeholderEn: 'https://n8n.yourcompany.com' },
        { key: 'webhookUrl', labelAr: 'Webhook URL', labelEn: 'Webhook URL', placeholderAr: 'اختياري: https://n8n.yourcompany.com/webhook/...', placeholderEn: 'Optional: https://n8n.yourcompany.com/webhook/...' },
        { key: 'workflowName', labelAr: 'Workflow Name', labelEn: 'Workflow name', placeholderAr: 'اسم التدفق في n8n', placeholderEn: 'n8n workflow name' },
        { key: 'apiKey', labelAr: 'API Key', labelEn: 'API key', placeholderAr: 'اختياري', placeholderEn: 'Optional', type: 'password', noteAr: 'أضف API key إذا كنت تريد الاحتفاظ بوصول REST إلى نفس مساحة n8n.', noteEn: 'Provide an API key only if you want to keep REST access to the same n8n workspace.' },
        { key: 'sharedSecret', labelAr: 'Shared Secret', labelEn: 'Shared secret', placeholderAr: 'اختياري', placeholderEn: 'Optional', type: 'password', noteAr: 'استخدم secret إذا كانت Webhooks في n8n تتحقق من التوقيع أو مصدر الطلب.', noteEn: 'Use a shared secret if your n8n webhooks validate the request source or signature.' },
    ],
    google_drive: [
        { key: 'accessToken', labelAr: 'Access Token', labelEn: 'Access token', placeholderAr: 'ألصق Google access token', placeholderEn: 'Paste a Google access token' },
        { key: 'folderId', labelAr: 'Folder ID', labelEn: 'Folder ID', placeholderAr: 'اختياري: مجلد البراند', placeholderEn: 'Optional: brand folder ID' },
    ],
    figma: [
        { key: 'personalAccessToken', labelAr: 'Personal Access Token', labelEn: 'Personal access token', placeholderAr: 'ألصق Figma token', placeholderEn: 'Paste a Figma token', type: 'password' },
        { key: 'teamId', labelAr: 'Team ID', labelEn: 'Team ID', placeholderAr: 'اختياري: team ID', placeholderEn: 'Optional: team ID' },
        { key: 'teamName', labelAr: 'Team Name', labelEn: 'Team name', placeholderAr: 'اسم الفريق الإبداعي', placeholderEn: 'Creative team name' },
    ],
};

function formatNumber(value: number, locale: string): string {
    return new Intl.NumberFormat(locale).format(value);
}

function formatDateTime(value: string | null, locale: string, fallback: string): string {
    if (!value) return fallback;

    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function readConnectionMetadataString(connection: BrandConnection | null | undefined, key: string): string {
    const value = connection?.metadata?.[key];
    return typeof value === 'string' ? value : '';
}

function buildProviderFormValues(
    provider: ConnectableBrandProvider,
    connection?: BrandConnection | null,
): Record<string, string> {
    switch (provider) {
        case 'google_ads':
            return {
                accessToken: connection?.access_token ?? '',
                developerToken: readConnectionMetadataString(connection, 'developer_token'),
                loginCustomerId: readConnectionMetadataString(connection, 'login_customer_id'),
            };
        case 'ga4':
        case 'search_console':
            return {
                accessToken: connection?.access_token ?? '',
            };
        case 'shopify':
            return {
                shopDomain: connection?.external_account_id ?? '',
                accessToken: connection?.access_token ?? '',
                storeName: connection?.external_account_name ?? '',
            };
        case 'woocommerce':
            return {
                storeUrl: readConnectionMetadataString(connection, 'website_url'),
                consumerKey: connection?.access_token ?? '',
                consumerSecret: connection?.refresh_token ?? '',
                storeName: connection?.external_account_name ?? '',
            };
        case 'wordpress':
            return {
                siteUrl: readConnectionMetadataString(connection, 'website_url'),
                username: readConnectionMetadataString(connection, 'username'),
                appPassword: connection?.access_token ?? '',
                websiteName: connection?.external_account_name ?? '',
            };
        case 'slack':
            return {
                botToken: connection?.access_token ?? '',
                channelId: readConnectionMetadataString(connection, 'channel_id'),
            };
        case 'zapier':
            return {
                webhookUrl: readConnectionMetadataString(connection, 'inbound_webhook_url'),
                workflowName: connection?.external_account_name ?? '',
                sharedSecret: readConnectionMetadataString(connection, 'shared_secret'),
            };
        case 'n8n':
            return {
                baseUrl: readConnectionMetadataString(connection, 'base_url'),
                webhookUrl: readConnectionMetadataString(connection, 'inbound_webhook_url'),
                workflowName: connection?.external_account_name ?? '',
                apiKey: connection?.access_token ?? '',
                sharedSecret: readConnectionMetadataString(connection, 'shared_secret'),
            };
        case 'google_drive':
            return {
                accessToken: connection?.access_token ?? '',
                folderId: readConnectionMetadataString(connection, 'folder_id'),
            };
        case 'figma':
            return {
                personalAccessToken: connection?.access_token ?? '',
                teamId: readConnectionMetadataString(connection, 'team_id'),
                teamName: readConnectionMetadataString(connection, 'team_name'),
            };
        default:
            return {};
    }
}

function buildProviderPayload(
    provider: ConnectableBrandProvider,
    values: Record<string, string>,
): ProviderConnectionInputMap[ConnectableBrandProvider] {
    switch (provider) {
        case 'google_ads':
            return {
                accessToken: values.accessToken ?? '',
                developerToken: values.developerToken ?? '',
                loginCustomerId: values.loginCustomerId || undefined,
            };
        case 'ga4':
            return {
                accessToken: values.accessToken ?? '',
            };
        case 'search_console':
            return {
                accessToken: values.accessToken ?? '',
            };
        case 'shopify':
            return {
                shopDomain: values.shopDomain ?? '',
                accessToken: values.accessToken ?? '',
                storeName: values.storeName || undefined,
            };
        case 'woocommerce':
            return {
                storeUrl: values.storeUrl ?? '',
                consumerKey: values.consumerKey ?? '',
                consumerSecret: values.consumerSecret ?? '',
                storeName: values.storeName || undefined,
            };
        case 'wordpress':
            return {
                siteUrl: values.siteUrl ?? '',
                username: values.username ?? '',
                appPassword: values.appPassword ?? '',
                websiteName: values.websiteName || undefined,
            };
        case 'slack':
            return {
                botToken: values.botToken ?? '',
                channelId: values.channelId || undefined,
            };
        case 'zapier':
            return {
                webhookUrl: values.webhookUrl ?? '',
                workflowName: values.workflowName || undefined,
                sharedSecret: values.sharedSecret || undefined,
            };
        case 'n8n':
            return {
                baseUrl: values.baseUrl ?? '',
                webhookUrl: values.webhookUrl || undefined,
                workflowName: values.workflowName || undefined,
                apiKey: values.apiKey || undefined,
                sharedSecret: values.sharedSecret || undefined,
            };
        case 'google_drive':
            return {
                accessToken: values.accessToken ?? '',
                folderId: values.folderId || undefined,
            };
        case 'figma':
            return {
                personalAccessToken: values.personalAccessToken ?? '',
                teamId: values.teamId || undefined,
                teamName: values.teamName || undefined,
            };
        default:
            throw new Error(`Unsupported provider ${provider}`);
    }
}

function getProviderActionLabel(provider: ConnectableBrandProvider, ar: boolean): string {
    switch (provider) {
        case 'google_ads':
            return ar ? 'ربط Google Ads' : 'Connect Google Ads';
        case 'ga4':
            return ar ? 'ربط GA4' : 'Connect GA4';
        case 'search_console':
            return ar ? 'ربط Search Console' : 'Connect Search Console';
        case 'shopify':
            return ar ? 'ربط Shopify' : 'Connect Shopify';
        case 'woocommerce':
            return ar ? 'ربط WooCommerce' : 'Connect WooCommerce';
        case 'wordpress':
            return ar ? 'ربط WordPress' : 'Connect WordPress';
        case 'slack':
            return ar ? 'ربط Slack' : 'Connect Slack';
        case 'zapier':
            return ar ? 'ربط Zapier' : 'Connect Zapier';
        case 'n8n':
            return ar ? 'ربط n8n' : 'Connect n8n';
        case 'google_drive':
            return ar ? 'ربط Google Drive' : 'Connect Google Drive';
        case 'figma':
            return ar ? 'ربط Figma' : 'Connect Figma';
        default:
            return ar ? 'ربط المزود' : 'Connect provider';
    }
}

function StatusPill({ tone, label }: { tone: string; label: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>
            {label}
        </span>
    );
}

function ComingSoonTile({
    title,
    description,
    icon,
    tone,
    buttonLabel,
}: {
    title: string;
    description: string;
    icon: string;
    tone: string;
    buttonLabel: string;
}) {
    return (
        <div className="rounded-[1.35rem] border border-dashed border-light-border/80 bg-light-bg/70 p-4 dark:border-dark-border/70 dark:bg-dark-bg/40">
            <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tone}`}>
                    <i className={`${icon} text-base`} />
                </div>
                <StatusPill tone="bg-slate-500/10 text-slate-600 dark:text-slate-300" label={buttonLabel} />
            </div>
            <div className="mt-4">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{title}</h3>
                <p className="mt-1 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
            </div>
            <button
                type="button"
                disabled
                className="mt-4 inline-flex rounded-xl border border-light-border/80 px-3 py-2 text-xs font-semibold text-light-text-secondary opacity-70 dark:border-dark-border/70 dark:text-dark-text-secondary"
            >
                {buttonLabel}
            </button>
        </div>
    );
}

function ProviderConnectTile({
    provider,
    ar,
    isLoading,
    onConnect,
}: {
    provider: ConnectableBrandProvider;
    ar: boolean;
    isLoading: boolean;
    onConnect: () => void;
}) {
    const meta = PROVIDER_META[provider];

    return (
        <div className="rounded-[1.35rem] border border-light-border/80 bg-light-card/90 p-4 dark:border-dark-border/70 dark:bg-dark-card/85">
            <div className="flex items-start justify-between gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${meta.iconTone}`}>
                    <i className={`${meta.icon} text-base`} />
                </div>
                <StatusPill tone="bg-brand-primary/10 text-brand-primary" label={ar ? 'جاهز للربط' : 'Ready to connect'} />
            </div>
            <div className="mt-4">
                <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{ar ? meta.labelAr : meta.labelEn}</h3>
                <p className="mt-1 text-xs leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    {ar ? meta.descriptionAr : meta.descriptionEn}
                </p>
            </div>
            <button
                type="button"
                onClick={onConnect}
                disabled={isLoading}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-70"
            >
                {isLoading && <i className="fas fa-circle-notch fa-spin text-[10px]" />}
                <span>{getProviderActionLabel(provider, ar)}</span>
            </button>
        </div>
    );
}

function ProviderCredentialsDialog({
    dialog,
    values,
    ar,
    isLoading,
    errorMessage,
    onClose,
    onChange,
    onSubmit,
}: {
    dialog: ProviderDialogState | null;
    values: Record<string, string>;
    ar: boolean;
    isLoading: boolean;
    errorMessage: string | null;
    onClose: () => void;
    onChange: (key: string, value: string) => void;
    onSubmit: () => void;
}) {
    if (!dialog) return null;

    const meta = PROVIDER_META[dialog.provider];
    const fields = PROVIDER_FIELD_CONFIG[dialog.provider];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="surface-panel w-full max-w-lg rounded-[1.75rem] p-6" onClick={(event) => event.stopPropagation()}>
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${meta.iconTone}`}>
                            <i className={`${meta.icon} text-lg`} />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">
                                {dialog.mode === 'reconnect'
                                    ? (ar ? `إعادة ربط ${meta.labelAr}` : `Reconnect ${meta.labelEn}`)
                                    : (ar ? `ربط ${meta.labelAr}` : `Connect ${meta.labelEn}`)}
                            </h3>
                            <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'أدخل بيانات المزود لحفظ الاتصال والأصول المرتبطة في البراند.' : 'Enter provider credentials to save the connection and linked brand assets.'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-xl p-2 text-light-text-secondary hover:bg-light-bg hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-bg dark:hover:text-dark-text">
                        <i className="fas fa-times text-sm" />
                    </button>
                </div>

                {errorMessage && (
                    <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-xs leading-6 text-rose-600 dark:text-rose-300">
                        {errorMessage}
                    </p>
                )}

                <div className="mt-4 space-y-3">
                    {fields.map((field) => (
                        <label key={field.key} className="block">
                            <span className="mb-1 block text-xs font-semibold text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? field.labelAr : field.labelEn}
                            </span>
                            <input
                                type={field.type ?? 'text'}
                                value={values[field.key] ?? ''}
                                onChange={(event) => onChange(field.key, event.target.value)}
                                placeholder={ar ? field.placeholderAr : field.placeholderEn}
                                className="w-full rounded-xl border border-light-border bg-light-card px-3 py-2 text-sm text-light-text focus:border-brand-primary focus:outline-none dark:border-dark-border dark:bg-dark-card dark:text-dark-text"
                            />
                            {(field.noteAr || field.noteEn) && (
                                <span className="mt-1 block text-[11px] text-light-text-secondary dark:text-dark-text-secondary">
                                    {ar ? field.noteAr : field.noteEn}
                                </span>
                            )}
                        </label>
                    ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={onSubmit}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90 disabled:opacity-70"
                    >
                        {isLoading && <i className="fas fa-circle-notch fa-spin text-xs" />}
                        <span>{dialog.mode === 'reconnect' ? (ar ? 'حفظ وإعادة الربط' : 'Save and reconnect') : (ar ? 'حفظ وربط المزود' : 'Save and connect')}</span>
                    </button>
                    <button type="button" onClick={onClose} className="rounded-xl border border-light-border px-4 py-2 text-sm font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                        {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function DisconnectDialog({
    target,
    ar,
    isLoading,
    onClose,
    onConfirm,
}: {
    target: DisconnectTarget | null;
    ar: boolean;
    isLoading: boolean;
    onClose: () => void;
    onConfirm: () => void;
}) {
    if (!target) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className="surface-panel w-full max-w-md rounded-[1.75rem] p-6" onClick={(event) => event.stopPropagation()}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-2xl text-rose-500">
                    <i className="fas fa-unlink" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-light-text dark:text-dark-text">
                    {ar ? 'تأكيد فصل الاتصال' : 'Confirm disconnect'}
                </h3>
                <p className="mt-2 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">
                    {ar
                        ? `سيتم فصل ${target.label} من البراند الحالي. يمكنك إعادة الربط لاحقًا من مساحة الإعداد المناسبة.`
                        : `${target.label} will be disconnected from the current brand. You can reconnect it later from the relevant setup workspace.`}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl border border-light-border px-4 py-2.5 text-sm font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                    >
                        {ar ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-70"
                    >
                        {isLoading && <i className="fas fa-circle-notch fa-spin text-xs" />}
                        <span>{ar ? 'فصل الآن' : 'Disconnect now'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}

function PublishingPlatformPanel({
    platform,
    accounts,
    locale,
    ar,
    isLoading,
    onConnect,
    onReconnect,
    onRequestDisconnect,
    onOpenManager,
    disconnectingId,
}: {
    platform: SocialPlatform;
    accounts: SocialAccount[];
    locale: string;
    ar: boolean;
    isLoading: boolean;
    onConnect: () => void;
    onReconnect: (accountId: string) => void;
    onRequestDisconnect: (account: SocialAccount) => void;
    onOpenManager: () => void;
    disconnectingId: string | null;
}) {
    const asset = PLATFORM_ASSETS[platform];

    return (
        <div className={`rounded-[1.5rem] border bg-gradient-to-br p-4 ${PUBLISHING_GRADIENTS[platform]}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-light-card shadow-sm dark:bg-dark-card">
                        <i className={`${asset.icon} ${asset.textColor} text-lg`} />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-light-text dark:text-dark-text">{platform}</h3>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                            {accounts.length > 0
                                ? ar
                                    ? `${formatNumber(accounts.length, locale)} حساب متصل`
                                    : `${formatNumber(accounts.length, locale)} connected`
                                : ar ? 'لا يوجد حساب متصل' : 'No connected account'}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onConnect}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-light-card px-3 py-2 text-sm font-semibold text-light-text shadow-sm transition-colors hover:bg-white disabled:opacity-70 dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
                >
                    {isLoading ? <i className="fas fa-circle-notch fa-spin text-xs" /> : <i className="fas fa-plus text-xs" />}
                    <span>{ar ? (accounts.length > 0 ? 'إضافة حساب' : 'ربط الحساب') : (accounts.length > 0 ? 'Add account' : 'Connect')}</span>
                </button>
            </div>

            {accounts.length === 0 ? (
                <div className="mt-4 rounded-[1.25rem] border border-dashed border-light-border/80 bg-light-card/70 p-4 dark:border-dark-border/70 dark:bg-dark-card/50">
                    <p className="text-sm font-medium text-light-text dark:text-dark-text">
                        {ar ? `ابدأ ربط ${platform} من هنا، ثم تابع إدارة الأصول من شاشة القنوات.` : `Start connecting ${platform} here, then manage assets in the channels screen.`}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={onOpenManager}
                            className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                        >
                            {ar ? 'فتح مدير القنوات' : 'Open channel manager'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="mt-4 space-y-3">
                    {accounts.map((account) => {
                        const status = SOCIAL_STATUS_STYLES[account.status];
                        const needsAction = account.status !== AccountStatus.Connected;
                        const isDisconnecting = disconnectingId === account.id;

                        return (
                            <div key={account.id} className="rounded-[1.25rem] border border-light-border/80 bg-light-card/85 p-4 dark:border-dark-border/70 dark:bg-dark-card/80">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <img src={account.avatarUrl} alt={account.username} className="h-10 w-10 rounded-full object-cover" />
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="truncate text-sm font-semibold text-light-text dark:text-dark-text">@{account.username}</p>
                                                <StatusPill tone={status.tone} label={ar ? status.labelAr : status.labelEn} />
                                            </div>
                                            <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                                {formatNumber(account.followers, locale)} {ar ? 'متابع' : 'followers'}
                                            </p>
                                        </div>
                                    </div>
                                    {needsAction && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                            {ar ? 'يلزم إجراء' : 'Action needed'}
                                        </span>
                                    )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    {needsAction && (
                                        <button
                                            type="button"
                                            onClick={() => onReconnect(account.id)}
                                            className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
                                        >
                                            <i className="fas fa-sync-alt me-1.5 text-[10px]" />
                                            {ar ? 'إعادة التوثيق' : 'Reconnect'}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={onOpenManager}
                                        className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                                    >
                                        {ar ? 'عرض الأصول' : 'View assets'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={onOpenManager}
                                        className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                                    >
                                        {ar ? 'تهيئة' : 'Configure'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onRequestDisconnect(account)}
                                        disabled={isDisconnecting}
                                        className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 disabled:opacity-70 dark:text-rose-300"
                                    >
                                        {isDisconnecting && <i className="fas fa-circle-notch fa-spin me-1.5 text-[10px]" />}
                                        {ar ? 'فصل' : 'Disconnect'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ConnectionRow({
    connection,
    brandAssets,
    locale,
    ar,
    disconnectingId,
    actioningId,
    onNavigate,
    onReconnect,
    onRefresh,
    onRequestDisconnect,
}: {
    connection: BrandConnection;
    brandAssets: BrandAsset | null;
    locale: string;
    ar: boolean;
    disconnectingId: string | null;
    actioningId: string | null;
    onNavigate: (page: string) => void;
    onReconnect: (connection: BrandConnection) => void;
    onRefresh: (connection: BrandConnection) => void;
    onRequestDisconnect: (connection: BrandConnection) => void;
}) {
    const providerMeta = PROVIDER_META[connection.provider];
    const status = CONNECTION_STATUS_STYLES[connection.status];
    const health = HEALTH_STYLES[connection.sync_health];
    const assetLabels = getProviderConnectionAssetLabels(connection, brandAssets);
    const canConfigure = Boolean(providerMeta.route);
    const needsSetup = connection.status === 'needs_reauth' || connection.status === 'expired' || connection.status === 'error';
    const isDisconnecting = disconnectingId === connection.id;
    const isActioning = actioningId === connection.id;
    const supportsReconnect = CONNECTABLE_BRAND_PROVIDERS.includes(connection.provider as ConnectableBrandProvider);

    return (
        <div className="rounded-[1.35rem] border border-light-border/80 bg-light-card/90 p-4 dark:border-dark-border/70 dark:bg-dark-card/85">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${providerMeta.iconTone}`}>
                        <i className={`${providerMeta.icon} text-base`} />
                    </div>
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">
                                {ar ? providerMeta.labelAr : providerMeta.labelEn}
                            </h3>
                            <StatusPill tone={status.tone} label={ar ? status.labelAr : status.labelEn} />
                            <StatusPill tone={health.tone} label={ar ? health.labelAr : health.labelEn} />
                        </div>
                        <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">
                            {connection.external_account_name || (ar ? providerMeta.descriptionAr : providerMeta.descriptionEn)}
                        </p>
                    </div>
                </div>
                <div className="text-xs text-light-text-secondary dark:text-dark-text-secondary">
                    {ar ? 'آخر مزامنة:' : 'Last sync:'} {formatDateTime(connection.last_sync_at, locale, ar ? 'لم تتم بعد' : 'Not synced yet')}
                </div>
            </div>

            {assetLabels.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {assetLabels.map((label) => (
                        <span key={`${connection.id}-${label}`} className="inline-flex max-w-full items-center rounded-full bg-light-bg px-2.5 py-1 text-[11px] font-medium text-light-text-secondary dark:bg-dark-bg dark:text-dark-text-secondary">
                            {label}
                        </span>
                    ))}
                </div>
            )}

            {connection.last_error && (
                <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-xs leading-6 text-rose-600 dark:text-rose-300">
                    {ar ? 'آخر خطأ:' : 'Last error:'} {connection.last_error}
                </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
                {supportsReconnect && needsSetup && (
                    <button
                        type="button"
                        onClick={() => onReconnect(connection)}
                        disabled={isActioning}
                        className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 disabled:opacity-70 dark:text-amber-300"
                    >
                        {isActioning && <i className="fas fa-circle-notch fa-spin me-1.5 text-[10px]" />}
                        {ar ? 'إعادة الربط' : 'Reconnect'}
                    </button>
                )}
                {supportsReconnect && !needsSetup && (
                    <button
                        type="button"
                        onClick={() => onRefresh(connection)}
                        disabled={isActioning}
                        className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text disabled:opacity-70 dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                    >
                        {isActioning && <i className="fas fa-circle-notch fa-spin me-1.5 text-[10px]" />}
                        {ar ? 'تحديث الأصول' : 'Refresh assets'}
                    </button>
                )}
                {needsSetup && canConfigure && (
                    <button
                        type="button"
                        onClick={() => onNavigate(providerMeta.route!)}
                        className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 dark:text-amber-300"
                    >
                        {ar ? 'إكمال الإعداد' : 'Continue setup'}
                    </button>
                )}
                {assetLabels.length > 0 && canConfigure && (
                    <button
                        type="button"
                        onClick={() => onNavigate(providerMeta.route!)}
                        className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                    >
                        {ar ? 'عرض الأصول' : 'View assets'}
                    </button>
                )}
                {canConfigure && (
                    <button
                        type="button"
                        onClick={() => onNavigate(providerMeta.route!)}
                        className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text"
                    >
                        {ar ? 'تهيئة' : 'Configure'}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onRequestDisconnect(connection)}
                    disabled={isDisconnecting}
                    className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-500/20 disabled:opacity-70 dark:text-rose-300"
                >
                    {isDisconnecting && <i className="fas fa-circle-notch fa-spin me-1.5 text-[10px]" />}
                    {ar ? 'فصل' : 'Disconnect'}
                </button>
            </div>
        </div>
    );
}

function EmptyStateCard({
    title,
    description,
    primaryActionLabel,
    secondaryActionLabel,
    onPrimaryAction,
    onSecondaryAction,
}: {
    title: string;
    description: string;
    primaryActionLabel?: string;
    secondaryActionLabel?: string;
    onPrimaryAction?: () => void;
    onSecondaryAction?: () => void;
}) {
    return (
        <div className="rounded-[1.35rem] border border-dashed border-light-border/80 bg-light-bg/60 p-5 dark:border-dark-border/70 dark:bg-dark-bg/40">
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-light-text-secondary dark:text-dark-text-secondary">{description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
                {primaryActionLabel && onPrimaryAction && (
                    <button type="button" onClick={onPrimaryAction} className="rounded-xl bg-brand-primary px-3 py-2 text-xs font-semibold text-white hover:bg-brand-primary/90">
                        {primaryActionLabel}
                    </button>
                )}
                {secondaryActionLabel && onSecondaryAction && (
                    <button type="button" onClick={onSecondaryAction} className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                        {secondaryActionLabel}
                    </button>
                )}
            </div>
        </div>
    );
}

export const IntegrationsPage: React.FC<IntegrationsPageProps> = ({
    brandId,
    socialAccounts,
    brandConnections,
    brandAssets,
    onRefresh,
    onNavigate,
}) => {
    const { language } = useLanguage();
    const { addNotification } = useUIStore();
    const ar = language === 'ar';
    const locale = ar ? 'ar-EG' : 'en-US';

    const [isRefreshing, setIsRefreshing] = useState(false);
    const [loadingPlatform, setLoadingPlatform] = useState<SocialPlatform | null>(null);
    const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
    const [currentPlatform, setCurrentPlatform] = useState<SocialPlatform | null>(null);
    const [currentToken, setCurrentToken] = useState<string | null>(null);
    const [foundAssets, setFoundAssets] = useState<SocialAsset[]>([]);
    const [pendingDisconnect, setPendingDisconnect] = useState<DisconnectTarget | null>(null);
    const [disconnectingId, setDisconnectingId] = useState<string | null>(null);
    const [providerDialog, setProviderDialog] = useState<ProviderDialogState | null>(null);
    const [providerFormValues, setProviderFormValues] = useState<Record<string, string>>({});
    const [providerError, setProviderError] = useState<string | null>(null);
    const [providerActionId, setProviderActionId] = useState<string | null>(null);
    const [setupPlatform, setSetupPlatform] = useState<SocialPlatform | null>(null);

    const accountsByPlatform = useMemo(() => {
        const grouped: Partial<Record<SocialPlatform, SocialAccount[]>> = {};

        for (const account of socialAccounts) {
            if (!grouped[account.platform]) grouped[account.platform] = [];
            grouped[account.platform]!.push(account);
        }

        return grouped;
    }, [socialAccounts]);

    const visibleConnections = useMemo(
        () => brandConnections.filter((connection) => !SOCIAL_PROVIDER_SET.has(connection.provider) && connection.status !== 'disconnected'),
        [brandConnections],
    );

    const groupedConnections = useMemo(() => groupConnectionsBySection(visibleConnections), [visibleConnections]);
    const activeProviderSet = useMemo(
        () => new Set(visibleConnections.map((connection) => connection.provider)),
        [visibleConnections],
    );
    const connectableProviders = useMemo(() => ({
        ads: CONNECTABLE_PROVIDER_SECTIONS.ads.filter((provider) => !activeProviderSet.has(provider)),
        analytics: CONNECTABLE_PROVIDER_SECTIONS.analytics.filter((provider) => !activeProviderSet.has(provider)),
        automation: CONNECTABLE_PROVIDER_SECTIONS.automation.filter((provider) => !activeProviderSet.has(provider)),
        files: CONNECTABLE_PROVIDER_SECTIONS.files.filter((provider) => !activeProviderSet.has(provider)),
        commerce: CONNECTABLE_PROVIDER_SECTIONS.commerce.filter((provider) => !activeProviderSet.has(provider)),
    }), [activeProviderSet]);
    const liveConnectionsCount = useMemo(() => countLiveOperationalConnections(socialAccounts, visibleConnections), [socialAccounts, visibleConnections]);
    const attentionCount = useMemo(() => countConnectionsNeedingAttention(socialAccounts, visibleConnections), [socialAccounts, visibleConnections]);
    const recentSyncCount = useMemo(() => countRecentlySyncedConnections(visibleConnections), [visibleConnections]);
    const comingSoonCount = useMemo(() => Object.values(COMING_SOON_SECTIONS).reduce((total, items) => total + items.length, 0), []);

    const refreshData = async () => {
        setIsRefreshing(true);
        try {
            await Promise.resolve(onRefresh());
        } finally {
            setIsRefreshing(false);
        }
    };

    const openProviderDialog = (provider: ConnectableBrandProvider, mode: ProviderDialogState['mode'], connection?: BrandConnection | null) => {
        if (provider === 'google_ads' || provider === 'ga4' || provider === 'search_console' || provider === 'google_drive') {
            handleGoogleOAuthConnect(provider, mode, connection);
            return;
        }
        
        setProviderDialog({ provider, mode, connection });
        setProviderFormValues(buildProviderFormValues(provider, connection));
        setProviderError(null);
    };

    const handleGoogleOAuthConnect = async (provider: ConnectableBrandProvider, mode: ProviderDialogState['mode'], connection?: BrandConnection | null) => {
        const actionId = connection?.id ?? provider;
        setProviderActionId(actionId);
        
        try {
            const { initiateGoogleOAuth } = await import('../../services/providerConnectionService');
            const authResponse = await initiateGoogleOAuth(brandId, provider);
            
            // authResponse contains accessToken and potentially refreshToken. 
            // We pass this as the input to the existing connectProvider functionality.
            const result = await connectProvider(
                brandId,
                provider,
                { accessToken: authResponse.accessToken } as any
            );
            
            const linkedCount = result.linkedAssetLabels.length;
            addNotification(
                NotificationType.Success,
                ar
                    ? `تم حفظ ${ar ? PROVIDER_META[provider].labelAr : PROVIDER_META[provider].labelEn} بنجاح${linkedCount > 0 ? ` مع ${linkedCount} أصل مرتبط.` : '.'}`
                    : `${PROVIDER_META[provider].labelEn} connected successfully${linkedCount > 0 ? ` with ${linkedCount} linked assets.` : '.'}`
            );
            await refreshData();
        } catch (error) {
            console.error('IntegrationsPage Google OAuth failed:', error);
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'فشل بدء أو استكمال الربط بخوادم مزود الخدمة.' : 'Failed to connect to the provider servers.'));
        } finally {
            setProviderActionId(null);
        }
    };

    const handleProviderFieldChange = (key: string, value: string) => {
        setProviderFormValues((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const handleProviderConnectSubmit = async () => {
        if (!providerDialog) return;

        const actionId = providerDialog.connection?.id ?? providerDialog.provider;
        setProviderActionId(actionId);
        setProviderError(null);

        try {
            const result = await connectProvider(
                brandId,
                providerDialog.provider,
                buildProviderPayload(providerDialog.provider, providerFormValues) as ProviderConnectionInputMap[typeof providerDialog.provider],
            );
            const linkedCount = result.linkedAssetLabels.length;
            addNotification(
                NotificationType.Success,
                ar
                    ? `تم حفظ ${ar ? PROVIDER_META[providerDialog.provider].labelAr : PROVIDER_META[providerDialog.provider].labelEn} بنجاح${linkedCount > 0 ? ` مع ${linkedCount} أصل مرتبط.` : '.'}`
                    : `${PROVIDER_META[providerDialog.provider].labelEn} connected successfully${linkedCount > 0 ? ` with ${linkedCount} linked assets.` : '.'}`,
            );
            setProviderDialog(null);
            setProviderFormValues({});
            await refreshData();
        } catch (error) {
            console.error('IntegrationsPage provider connect failed:', error);
            setProviderError(error instanceof Error ? error.message : (ar ? 'فشل حفظ بيانات المزود.' : 'Failed to save provider credentials.'));
        } finally {
            setProviderActionId(null);
        }
    };

    const handleProviderRefresh = async (connection: BrandConnection) => {
        setProviderActionId(connection.id);
        try {
            const result = await refreshProviderConnection(brandId, connection);
            addNotification(
                NotificationType.Success,
                ar
                    ? `تم تحديث ${PROVIDER_META[connection.provider].labelAr} واسترجاع ${result.linkedAssetLabels.length} أصل مرتبط.`
                    : `${PROVIDER_META[connection.provider].labelEn} refreshed with ${result.linkedAssetLabels.length} linked assets.`,
            );
            await refreshData();
        } catch (error) {
            console.error('IntegrationsPage provider refresh failed:', error);
            addNotification(NotificationType.Error, error instanceof Error ? error.message : (ar ? 'فشل تحديث المزود.' : 'Failed to refresh the provider.'));
        } finally {
            setProviderActionId(null);
        }
    };

    const handleConnectPlatform = async (platform: SocialPlatform) => {
        if (needsSetupGuide(platform)) {
            setSetupPlatform(platform);
            return;
        }
        setLoadingPlatform(platform);
        try {
            const authResponse = await initiateSocialLogin(platform);
            const assets = await fetchAvailableAssets(platform, authResponse.accessToken);
            setCurrentPlatform(platform);
            setCurrentToken(authResponse.accessToken);
            setFoundAssets(assets);
            setIsAssetModalOpen(true);
        } catch (error) {
            console.error('IntegrationsPage connect platform failed:', error);
            addNotification(NotificationType.Error, ar ? 'فشل بدء الربط. تأكد من إعداد OAuth ثم حاول مرة أخرى.' : 'Failed to start the connection. Verify OAuth setup and try again.');
        } finally {
            setLoadingPlatform(null);
        }
    };

    const handleAssetsConfirmed = async (selectedAssets: SocialAsset[]) => {
        if (!currentPlatform || !currentToken) return;

        setLoadingPlatform(currentPlatform);
        try {
            await connectSelectedAssets(brandId, selectedAssets, currentPlatform, currentToken);
            addNotification(NotificationType.Success, ar ? `تم ربط ${currentPlatform} بنجاح.` : `${currentPlatform} connected successfully.`);
            setIsAssetModalOpen(false);
            setCurrentPlatform(null);
            setCurrentToken(null);
            setFoundAssets([]);
            await refreshData();
        } catch (error) {
            console.error('IntegrationsPage connect assets failed:', error);
            addNotification(NotificationType.Error, ar ? 'فشل حفظ الأصول المرتبطة. حاول مرة أخرى.' : 'Failed to save connected assets. Please try again.');
        } finally {
            setLoadingPlatform(null);
        }
    };

    const handleReconnectSocialAccount = async (accountId: string) => {
        const account = socialAccounts.find((item) => item.id === accountId);
        if (!account) return;

        setLoadingPlatform(account.platform);
        try {
            await initiateSocialLogin(account.platform);
            await updateAccountStatus(account.id, AccountStatus.Connected);
            addNotification(NotificationType.Success, ar ? `تمت إعادة توثيق ${account.platform}.` : `${account.platform} re-authenticated successfully.`);
            await refreshData();
        } catch (error) {
            console.error('IntegrationsPage reconnect social failed:', error);
            addNotification(NotificationType.Error, ar ? 'فشل إعادة التوثيق. حاول من شاشة القنوات إذا استمرت المشكلة.' : 'Re-authentication failed. Try again from the channels workspace if the issue persists.');
        } finally {
            setLoadingPlatform(null);
        }
    };

    const handleProviderReconnect = (connection: BrandConnection) => {
        if (!CONNECTABLE_BRAND_PROVIDERS.includes(connection.provider as ConnectableBrandProvider)) {
            return;
        }

        openProviderDialog(connection.provider as ConnectableBrandProvider, 'reconnect', connection);
    };

    const handleDisconnectConfirm = async () => {
        if (!pendingDisconnect) return;

        const target = pendingDisconnect;
        setDisconnectingId(target.id);

        try {
            if (target.kind === 'social') {
                await disconnectSocialAccount(target.id);
            } else {
                await disconnectBrandConnection(target.id);
            }

            addNotification(NotificationType.Success, ar ? `تم فصل ${target.label}.` : `${target.label} disconnected successfully.`);
            setPendingDisconnect(null);
            await refreshData();
        } catch (error) {
            console.error('IntegrationsPage disconnect failed:', error);
            addNotification(NotificationType.Error, ar ? 'فشل فصل الاتصال. حاول مرة أخرى.' : 'Failed to disconnect. Please try again.');
        } finally {
            setDisconnectingId(null);
        }
    };

    return (
        <>
            <PageScaffold
                kicker={ar ? 'مساحة الربط' : 'Connection workspace'}
                title={ar ? 'التكاملات والتوصيلات' : 'Integrations & connections'}
                description={ar ? 'هذه الشاشة تعرض ما هو حي فعليًا داخل البراند: قنوات النشر، مصادر الإعلانات والتحليلات، وما هو ما يزال قيد الإطلاق. أي مزود غير جاهز يظهر بوضوح كـ Coming soon بدل ربط وهمي.' : 'This workspace shows what is truly live for the brand: publishing channels, ads and analytics sources, and what is still not available. Any provider that is not ready is explicitly marked as coming soon instead of using fake connect actions.'}
                actions={(
                    <>
                        <button type="button" onClick={refreshData} disabled={isRefreshing} className="inline-flex items-center gap-2 rounded-2xl border border-light-border bg-light-card px-4 py-2 text-sm font-semibold text-light-text transition-colors hover:bg-light-bg disabled:opacity-70 dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg">
                            {isRefreshing ? <i className="fas fa-circle-notch fa-spin text-xs" /> : <i className="fas fa-sync-alt text-xs" />}
                            <span>{ar ? 'تحديث الحالة' : 'Refresh status'}</span>
                        </button>
                        <button type="button" onClick={() => onNavigate('social-ops/accounts')} className="inline-flex items-center gap-2 rounded-2xl bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-primary/90">
                            <i className="fas fa-link text-xs" />
                            <span>{ar ? 'فتح مدير القنوات' : 'Open channel manager'}</span>
                        </button>
                    </>
                )}
                stats={[
                    { label: ar ? 'اتصالات فعالة' : 'Live connections', value: formatNumber(liveConnectionsCount, locale) },
                    { label: ar ? 'تحتاج متابعة' : 'Need attention', value: formatNumber(attentionCount, locale), tone: attentionCount > 0 ? 'text-amber-600 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-300' },
                    { label: ar ? 'تمت مزامنتها خلال 24 ساعة' : 'Synced in 24h', value: formatNumber(recentSyncCount, locale) },
                    { label: ar ? 'قريبًا' : 'Coming soon', value: formatNumber(comingSoonCount, locale) },
                ]}
            >
                <PageSection title="Publishing" description={ar ? 'قنوات النشر الحية وحسابات السوشيال المتصلة. من هنا ترى الحالة الفعلية للحسابات، ثم تفتح شاشة القنوات إذا احتجت إدارة الأصول أو إعادة التهيئة.' : 'Live publishing channels and connected social accounts. Use this section to review real account state, then open the channels screen when you need deeper asset management.'} actions={(
                    <button type="button" onClick={() => onNavigate('social-ops/accounts')} className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                        {ar ? 'فتح شاشة القنوات' : 'Open channels'}
                    </button>
                )}>
                    <div className="grid gap-4 xl:grid-cols-2">
                        {Object.values(SocialPlatform).map((platform) => (
                            <PublishingPlatformPanel
                                key={platform}
                                platform={platform}
                                accounts={accountsByPlatform[platform] ?? []}
                                locale={locale}
                                ar={ar}
                                isLoading={loadingPlatform === platform}
                                onConnect={() => handleConnectPlatform(platform)}
                                onReconnect={handleReconnectSocialAccount}
                                onRequestDisconnect={(account) => setPendingDisconnect({ kind: 'social', id: account.id, label: `@${account.username}` })}
                                onOpenManager={() => onNavigate('social-ops/accounts')}
                                disconnectingId={disconnectingId}
                            />
                        ))}
                    </div>
                </PageSection>

                <PageSection title="Ads" description={ar ? 'مصادر الإعلان الفعلية المرتبطة بالتقارير والحملات. أي مزود غير مفعل يظهر هنا كـ Coming soon حتى لا يختلط بالمصادر الحية.' : 'Live ad sources connected to campaigns and reporting. Anything not actually wired yet is shown here as coming soon.'} actions={(
                    <button type="button" onClick={() => onNavigate('ads-ops')} className="rounded-xl border border-light-border px-3 py-2 text-xs font-semibold text-light-text-secondary hover:text-light-text dark:border-dark-border dark:text-dark-text-secondary dark:hover:text-dark-text">
                        {ar ? 'فتح Ads Ops' : 'Open Ads Ops'}
                    </button>
                )}>
                    <div className="space-y-3">
                        {groupedConnections.ads.length > 0 ? groupedConnections.ads.map((connection) => (
                            <ConnectionRow
                                key={connection.id}
                                connection={connection}
                                brandAssets={brandAssets}
                                locale={locale}
                                ar={ar}
                                disconnectingId={disconnectingId}
                                actioningId={providerActionId}
                                onNavigate={onNavigate}
                                onReconnect={handleProviderReconnect}
                                onRefresh={handleProviderRefresh}
                                onRequestDisconnect={(item) => setPendingDisconnect({ kind: 'connection', id: item.id, label: item.external_account_name || (ar ? PROVIDER_META[item.provider].labelAr : PROVIDER_META[item.provider].labelEn) })}
                            />
                        )) : (
                            <EmptyStateCard
                                title={ar ? 'لا توجد اتصالات إعلانية حية بعد' : 'No live ad connections yet'}
                                description={ar ? 'يمكنك متابعة العمل من Ads Ops، وستظهر الاتصالات الحية هنا بمجرد ربطها فعليًا.' : 'Continue working in Ads Ops. Real ad connections will appear here once they are actually linked.'}
                                primaryActionLabel={ar ? 'فتح Ads Ops' : 'Open Ads Ops'}
                                onPrimaryAction={() => onNavigate('ads-ops')}
                            />
                        )}
                    </div>

                    {connectableProviders.ads.length > 0 && (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {connectableProviders.ads.map((provider) => (
                                <ProviderConnectTile
                                    key={provider}
                                    provider={provider}
                                    ar={ar}
                                    isLoading={providerActionId === provider}
                                    onConnect={() => openProviderDialog(provider, 'connect')}
                                />
                            ))}
                        </div>
                    )}

                    <div className="mt-6 border-t border-light-border/70 pt-6 dark:border-dark-border/70">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">{ar ? 'قريبًا' : 'Coming soon'}</h3>
                            <p className="mt-1 text-xs text-light-text-secondary dark:text-dark-text-secondary">
                                {ar ? 'مزودات معلنة لكنها ليست مفعلة بعد في هذه الشاشة.' : 'Planned providers that are not yet active in this workspace.'}
                            </p>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                            {COMING_SOON_SECTIONS.ads.map((item) => (
                                <ComingSoonTile key={item.id} title={ar ? item.titleAr : item.titleEn} description={ar ? item.descriptionAr : item.descriptionEn} icon={item.icon} tone={item.tone} buttonLabel={ar ? 'قريبًا' : 'Coming soon'} />
                            ))}
                        </div>
                    </div>
                </PageSection>

                <PageSection title="Analytics" description={ar ? 'حالة مصادر التحليل والقياس المرتبطة بالبراند، مع آخر مزامنة وصحة الاتصال والخطأ الأخير عند وجوده.' : 'Status of analytics and measurement sources linked to the brand, including last sync, health, and the latest error when available.'}>
                    <div className="space-y-3">
                        {groupedConnections.analytics.length > 0 ? groupedConnections.analytics.map((connection) => (
                            <ConnectionRow
                                key={connection.id}
                                connection={connection}
                                brandAssets={brandAssets}
                                locale={locale}
                                ar={ar}
                                disconnectingId={disconnectingId}
                                actioningId={providerActionId}
                                onNavigate={onNavigate}
                                onReconnect={handleProviderReconnect}
                                onRefresh={handleProviderRefresh}
                                onRequestDisconnect={(item) => setPendingDisconnect({ kind: 'connection', id: item.id, label: item.external_account_name || (ar ? PROVIDER_META[item.provider].labelAr : PROVIDER_META[item.provider].labelEn) })}
                            />
                        )) : (
                            <EmptyStateCard
                                title={ar ? 'لا توجد مصادر تحليل متصلة بعد' : 'No analytics sources connected yet'}
                                description={ar ? 'عندما يتم ربط GA4 أو Search Console فعليًا ستظهر حالتها هنا مع آخر مزامنة وصحة الاتصال.' : 'When GA4 or Search Console are actually linked, their sync state and health will show up here.'}
                                primaryActionLabel={ar ? 'فتح Analytics' : 'Open Analytics'}
                                secondaryActionLabel={ar ? 'فتح SEO Ops' : 'Open SEO Ops'}
                                onPrimaryAction={() => onNavigate('analytics')}
                                onSecondaryAction={() => onNavigate('seo-ops')}
                            />
                        )}
                    </div>

                    {connectableProviders.analytics.length > 0 && (
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {connectableProviders.analytics.map((provider) => (
                                <ProviderConnectTile
                                    key={provider}
                                    provider={provider}
                                    ar={ar}
                                    isLoading={providerActionId === provider}
                                    onConnect={() => openProviderDialog(provider, 'connect')}
                                />
                            ))}
                        </div>
                    )}

                    <div className="mt-6 border-t border-light-border/70 pt-6 dark:border-dark-border/70">
                        <div className="grid gap-3 md:grid-cols-2">
                            {COMING_SOON_SECTIONS.analytics.map((item) => (
                                <ComingSoonTile key={item.id} title={ar ? item.titleAr : item.titleEn} description={ar ? item.descriptionAr : item.descriptionEn} icon={item.icon} tone={item.tone} buttonLabel={ar ? 'قريبًا' : 'Coming soon'} />
                            ))}
                        </div>
                    </div>
                </PageSection>

                {(groupedConnections.commerce.length > 0 || connectableProviders.commerce.length > 0 || COMING_SOON_SECTIONS.commerce.length > 0) && (
                    <PageSection title={ar ? 'Commerce & Web' : 'Commerce & web'} description={ar ? 'مصادر المواقع والمتاجر المرتبطة بالطلبات والمحتوى.' : 'Site and commerce sources tied to content and order operations.'}>
                        {groupedConnections.commerce.length > 0 && (
                            <div className="space-y-3">
                                {groupedConnections.commerce.map((connection) => (
                                    <ConnectionRow
                                        key={connection.id}
                                        connection={connection}
                                        brandAssets={brandAssets}
                                        locale={locale}
                                        ar={ar}
                                        disconnectingId={disconnectingId}
                                        actioningId={providerActionId}
                                        onNavigate={onNavigate}
                                        onReconnect={handleProviderReconnect}
                                        onRefresh={handleProviderRefresh}
                                        onRequestDisconnect={(item) => setPendingDisconnect({ kind: 'connection', id: item.id, label: item.external_account_name || (ar ? PROVIDER_META[item.provider].labelAr : PROVIDER_META[item.provider].labelEn) })}
                                    />
                                ))}
                            </div>
                        )}

                        {connectableProviders.commerce.length > 0 && (
                            <div className={`${groupedConnections.commerce.length > 0 ? 'mt-4' : ''} grid gap-3 md:grid-cols-3`}>
                                {connectableProviders.commerce.map((provider) => (
                                    <ProviderConnectTile
                                        key={provider}
                                        provider={provider}
                                        ar={ar}
                                        isLoading={providerActionId === provider}
                                        onConnect={() => openProviderDialog(provider, 'connect')}
                                    />
                                ))}
                            </div>
                        )}

                        {COMING_SOON_SECTIONS.commerce.length > 0 && (
                            <div className={`${groupedConnections.commerce.length > 0 || connectableProviders.commerce.length > 0 ? 'mt-6 border-t border-light-border/70 pt-6 dark:border-dark-border/70' : ''}`}>
                                <div className="grid gap-3 md:grid-cols-3">
                                    {COMING_SOON_SECTIONS.commerce.map((item) => (
                                        <ComingSoonTile key={item.id} title={ar ? item.titleAr : item.titleEn} description={ar ? item.descriptionAr : item.descriptionEn} icon={item.icon} tone={item.tone} buttonLabel={ar ? 'قريبًا' : 'Coming soon'} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </PageSection>
                )}

                <PageSection title={ar ? 'Messaging & Support' : 'Messaging & support'} description={ar ? 'قنوات المحادثة والدعم التي ستتصل مباشرة بالـ Inbox ومسارات الرد والتصعيد.' : 'Conversation and support channels that will plug directly into the Inbox and reply/escalation flows.'}>
                    <div className="grid gap-3 md:grid-cols-2">
                        {COMING_SOON_SECTIONS.messaging.map((item) => (
                            <ComingSoonTile key={item.id} title={ar ? item.titleAr : item.titleEn} description={ar ? item.descriptionAr : item.descriptionEn} icon={item.icon} tone={item.tone} buttonLabel={ar ? 'قريبًا' : 'Coming soon'} />
                        ))}
                    </div>
                </PageSection>

                {(groupedConnections.automation.length > 0 || connectableProviders.automation.length > 0 || COMING_SOON_SECTIONS.automation.length > 0) && (
                    <PageSection title="Automation" description={ar ? 'التنبيهات الخارجية ومسارات الأتمتة التي تعتمد على Webhooks أو قنوات الفريق بدلاً من ربط وهمي.' : 'External alerts and automation flows that rely on live webhooks or team channels instead of placeholder connections.'}>
                        {groupedConnections.automation.length > 0 && (
                            <div className="space-y-3">
                                {groupedConnections.automation.map((connection) => (
                                    <ConnectionRow
                                        key={connection.id}
                                        connection={connection}
                                        brandAssets={brandAssets}
                                        locale={locale}
                                        ar={ar}
                                        disconnectingId={disconnectingId}
                                        actioningId={providerActionId}
                                        onNavigate={onNavigate}
                                        onReconnect={handleProviderReconnect}
                                        onRefresh={handleProviderRefresh}
                                        onRequestDisconnect={(item) => setPendingDisconnect({ kind: 'connection', id: item.id, label: item.external_account_name || (ar ? PROVIDER_META[item.provider].labelAr : PROVIDER_META[item.provider].labelEn) })}
                                    />
                                ))}
                            </div>
                        )}

                        {connectableProviders.automation.length > 0 && (
                            <div className={`${groupedConnections.automation.length > 0 ? 'mt-4' : ''} grid gap-3 md:grid-cols-2 xl:grid-cols-4`}>
                                {connectableProviders.automation.map((provider) => (
                                    <ProviderConnectTile
                                        key={provider}
                                        provider={provider}
                                        ar={ar}
                                        isLoading={providerActionId === provider}
                                        onConnect={() => openProviderDialog(provider, 'connect')}
                                    />
                                ))}
                            </div>
                        )}

                        {COMING_SOON_SECTIONS.automation.length > 0 && (
                            <div className={`${groupedConnections.automation.length > 0 || connectableProviders.automation.length > 0 ? 'mt-6 border-t border-light-border/70 pt-6 dark:border-dark-border/70' : ''}`}>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                    {COMING_SOON_SECTIONS.automation.map((item) => (
                                        <ComingSoonTile key={item.id} title={ar ? item.titleAr : item.titleEn} description={ar ? item.descriptionAr : item.descriptionEn} icon={item.icon} tone={item.tone} buttonLabel={ar ? 'قريبًا' : 'Coming soon'} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </PageSection>
                )}

                {(groupedConnections.files.length > 0 || connectableProviders.files.length > 0 || COMING_SOON_SECTIONS.files.length > 0) && (
                    <PageSection title={ar ? 'Files & Creative' : 'Files & creative'} description={ar ? 'الأصول والملفات ومساحات التصميم الفعلية المرتبطة بالبراند، مع إبقاء المزودات غير المفعلة في قسم قريبًا.' : 'Live file systems and creative workspaces linked to the brand, while non-active providers stay clearly marked as coming soon.'}>
                        {groupedConnections.files.length > 0 && (
                            <div className="space-y-3">
                                {groupedConnections.files.map((connection) => (
                                    <ConnectionRow
                                        key={connection.id}
                                        connection={connection}
                                        brandAssets={brandAssets}
                                        locale={locale}
                                        ar={ar}
                                        disconnectingId={disconnectingId}
                                        actioningId={providerActionId}
                                        onNavigate={onNavigate}
                                        onReconnect={handleProviderReconnect}
                                        onRefresh={handleProviderRefresh}
                                        onRequestDisconnect={(item) => setPendingDisconnect({ kind: 'connection', id: item.id, label: item.external_account_name || (ar ? PROVIDER_META[item.provider].labelAr : PROVIDER_META[item.provider].labelEn) })}
                                    />
                                ))}
                            </div>
                        )}

                        {connectableProviders.files.length > 0 && (
                            <div className={`${groupedConnections.files.length > 0 ? 'mt-4' : ''} grid gap-3 md:grid-cols-2 xl:grid-cols-4`}>
                                {connectableProviders.files.map((provider) => (
                                    <ProviderConnectTile
                                        key={provider}
                                        provider={provider}
                                        ar={ar}
                                        isLoading={providerActionId === provider}
                                        onConnect={() => openProviderDialog(provider, 'connect')}
                                    />
                                ))}
                            </div>
                        )}

                        {COMING_SOON_SECTIONS.files.length > 0 && (
                            <div className={`${groupedConnections.files.length > 0 || connectableProviders.files.length > 0 ? 'mt-6 border-t border-light-border/70 pt-6 dark:border-dark-border/70' : ''}`}>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                    {COMING_SOON_SECTIONS.files.map((item) => (
                                        <ComingSoonTile key={item.id} title={ar ? item.titleAr : item.titleEn} description={ar ? item.descriptionAr : item.descriptionEn} icon={item.icon} tone={item.tone} buttonLabel={ar ? 'قريبًا' : 'Coming soon'} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </PageSection>
                )}
            </PageScaffold>

            <AssetSelectionModal
                isOpen={isAssetModalOpen}
                onClose={() => {
                    setIsAssetModalOpen(false);
                    setCurrentPlatform(null);
                    setCurrentToken(null);
                    setFoundAssets([]);
                }}
                onConfirm={handleAssetsConfirmed}
                assets={foundAssets}
                platform={currentPlatform ?? SocialPlatform.Facebook}
                isLoading={loadingPlatform !== null}
            />

            <ProviderCredentialsDialog
                dialog={providerDialog}
                values={providerFormValues}
                ar={ar}
                isLoading={providerActionId === (providerDialog?.connection?.id ?? providerDialog?.provider ?? null)}
                errorMessage={providerError}
                onClose={() => {
                    setProviderDialog(null);
                    setProviderFormValues({});
                    setProviderError(null);
                }}
                onChange={handleProviderFieldChange}
                onSubmit={handleProviderConnectSubmit}
            />

            <DisconnectDialog
                target={pendingDisconnect}
                ar={ar}
                isLoading={disconnectingId !== null}
                onClose={() => setPendingDisconnect(null)}
                onConfirm={handleDisconnectConfirm}
            />

            {setupPlatform && (
                <SetupGuideModal
                    platform={setupPlatform}
                    onClose={() => setSetupPlatform(null)}
                    ar={ar}
                />
            )}
        </>
    );
};
