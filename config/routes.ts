/**
 * App Route Configuration
 */

export const PUBLIC_PAGE_ROUTES: Record<string, string> = {
    home: '/',
    about: '/about',
    pricing: '/pricing',
    billing: '/billing',
    contact: '/contact',
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
    'idea-ops': '/app/idea-ops',
    workflow: '/app/workflow',
    integrations: '/app/integrations',
    'error-center': '/app/error-center',
    'marketing-plans': '/app/marketing-plans',
    'brand-analysis': '/app/brand-analysis',
    'ai-video': '/app/ai-video',
    'content-studio': '/app/content-studio',
    'asset-library': '/app/asset-library',
    system: '/app/system',
    'user-settings': '/app/settings',
    billing: '/app/billing',
    'team-management': '/app/team',
    crm: '/app/crm',
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

    return BRAND_PAGE_ROUTES[aliases[page] ?? page] ?? '/app';
}

export function pathToBrandPage(path: string): string {
    return ROUTE_TO_BRAND_PAGE[path] ?? 'dashboard';
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
