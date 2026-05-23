/**
 * App Route Configuration
 */

export const PUBLIC_PAGE_ROUTES: Record<string, string> = {
    home: '/',
    about: '/about',
    features: '/features',
    'for-agencies': '/for-agencies',
    'for-ecommerce': '/for-ecommerce',
    pricing: '/pricing',
    billing: '/billing',
    contact: '/contact',
    demo: '/demo',
    'thank-you': '/thank-you',
    security: '/security',
    terms: '/terms',
    privacy: '/privacy',
    dpa: '/dpa',
    refunds: '/refunds',
    cookies: '/cookies',
};

export const ROUTE_TO_PUBLIC_PAGE: Record<string, string> = Object.fromEntries(
    Object.entries(PUBLIC_PAGE_ROUTES).map(([page, path]) => [path, page])
);

export const BRAND_PAGE_ROUTES: Record<string, string> = {
    dashboard: '/app',
    'social-ops/publisher': '/app/publisher',
    'social-ops/scheduled': '/app/scheduled',
    'social-ops/accounts': '/app/accounts',
    'social-ops/social-search': '/app/social-search',
    calendar: '/app/calendar',
    analytics: '/app/analytics',
    'content-ops': '/app/content-ops',
    inbox: '/app/inbox',
    'ads-ops': '/app/ads',
    'seo-ops': '/app/seo',
    'brand-hub': '/app/brand-hub',
    'brand-brain': '/app/brand-brain',
    'idea-ops': '/app/idea-ops',
    workflow: '/app/workflow',
    integrations: '/app/integrations',
    'integration-os': '/app/integration-os',
    'error-center': '/app/error-center',
    'marketing-plans': '/app/marketing-plans',
    'brand-analysis': '/app/brand-analysis',
    'brand-brain-review': '/app/brand-brain-review',
    'ai-video': '/app/ai-video',
    'content-studio': '/app/content-studio',
    'media-ops': '/app/media-ops',
    'brand-knowledge': '/app/brand-knowledge',
    'design-ops': '/app/design-ops',
    'asset-library': '/app/asset-library',
    system: '/app/system',
    'user-settings': '/app/settings',
    billing: '/app/billing',
    'team-management': '/app/team',
    'crm/dashboard': '/app/crm/dashboard',
    'crm/customers': '/app/crm/customers',
    'crm/pipeline': '/app/crm/pipeline',
    'crm/tickets': '/app/crm/tickets',
    'brand-agent':           '/app/brand-agent',
    'brand-agent/settings':  '/app/brand-agent/settings',
    'brand-agent/shift':     '/app/brand-agent/shift',
    'brand-agent/stats':     '/app/brand-agent/stats',
    'smart-bot':             '/app/smart-bot',
    'support-inbox':         '/app/support-inbox',
    'ads-cockpit':           '/app/ads-cockpit',
    'mobile-home': '/app/mobile-home',
    'campaign-brain': '/app/campaign-brain',
    'brands-manage': '/app/brands-manage',
};

export const ROUTE_TO_BRAND_PAGE: Record<string, string> = Object.fromEntries(
    Object.entries(BRAND_PAGE_ROUTES).map(([page, path]) => [path, page])
);

export const ADMIN_PAGE_ROUTES: Record<string, string> = {
    'admin-dashboard':   '/admin',
    'admin-users':       '/admin/users',
    'admin-tenants':     '/admin/tenants',
    'admin-billing':     '/admin/billing',
    'admin-ai-monitor':  '/admin/ai-monitor',
    'admin-queues':      '/admin/queues',
    'admin-system-health': '/admin/health',
    'admin-settings':    '/admin/settings',
    'admin-logs':        '/admin/logs',
    'admin-ai-keys':     '/admin/ai-keys',
};

export const ROUTE_TO_ADMIN_PAGE: Record<string, string> = Object.fromEntries(
    Object.entries(ADMIN_PAGE_ROUTES).map(([page, path]) => [path, page])
);

export const AUTH_ROUTES = {
    login: '/login',
    register: '/register',
    forgotPassword: '/forgot-password',
} as const;

export function publicPageToPath(page: string): string {
    return PUBLIC_PAGE_ROUTES[page] ?? '/';
}

export function pathToPublicPage(path: string): string {
    return ROUTE_TO_PUBLIC_PAGE[path] ?? 'home';
}

export function brandPageToPath(page: string): string {
    const aliases: Record<string, string> = {
        ads: 'ads-ops',
        seo: 'seo-ops',
    };

    const resolved = aliases[page] ?? page;
    // Direct match first
    if (BRAND_PAGE_ROUTES[resolved]) return BRAND_PAGE_ROUTES[resolved];
    
    // Check if it is a sub-path of a registered route or contains a slash
    const hasRegisteredPrefix = Object.keys(BRAND_PAGE_ROUTES).some(routeKey => 
        routeKey !== 'dashboard' && resolved.startsWith(routeKey + '/')
    );
    if (hasRegisteredPrefix || resolved.includes('/')) {
        return `/app/${resolved}`;
    }
    
    return '/app';
}

export function pathToBrandPage(path: string): string {
    // Direct match first
    if (ROUTE_TO_BRAND_PAGE[path]) return ROUTE_TO_BRAND_PAGE[path];
    // Strip /app/ prefix and use remainder as page id
    if (path.startsWith('/app/')) {
        const page = path.slice(5); // remove '/app/'
        return page || 'dashboard';
    }
    return 'dashboard';
}

export function adminPageToPath(page: string): string {
    return ADMIN_PAGE_ROUTES[page] ?? '/admin';
}

export function pathToAdminPage(path: string): string {
    return ROUTE_TO_ADMIN_PAGE[path] ?? 'admin-dashboard';
}

export function isAdminPath(path: string): boolean {
    return path.startsWith('/admin');
}

export function isPublicPath(path: string): boolean {
    return Object.values(PUBLIC_PAGE_ROUTES).includes(path as any);
}

export function isAuthPath(path: string): boolean {
    return Object.values(AUTH_ROUTES).includes(path as any);
}
