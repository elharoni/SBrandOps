/**
 * Tests: Route configuration
 * اختبارات تكوين المسارات
 */

import { describe, it, expect } from 'vitest';
import {
    publicPageToPath,
    pathToPublicPage,
    brandPageToPath,
    pathToBrandPage,
    adminPageToPath,
    pathToAdminPage,
    isAdminPath,
    isAuthPath,
    isPublicPath,
    PUBLIC_PAGE_ROUTES,
    BRAND_PAGE_ROUTES,
    ADMIN_PAGE_ROUTES,
    AUTH_ROUTES,
} from '../config/routes';

describe('routes config', () => {
    describe('public routes', () => {
        it('maps home to /', () => {
            expect(publicPageToPath('home')).toBe('/');
        });

        it('maps pricing correctly', () => {
            expect(publicPageToPath('pricing')).toBe('/pricing');
        });

        it('maps billing, security, and dpa correctly', () => {
            expect(publicPageToPath('billing')).toBe('/billing');
            expect(publicPageToPath('security')).toBe('/security');
            expect(publicPageToPath('dpa')).toBe('/dpa');
        });

        it('maps /about back to about', () => {
            expect(pathToPublicPage('/about')).toBe('about');
        });

        it('recognizes public paths', () => {
            expect(isPublicPath('/')).toBe(true);
            expect(isPublicPath('/pricing')).toBe(true);
            expect(isPublicPath('/app')).toBe(false);
        });
    });

    describe('brandPageToPath', () => {
        it('maps dashboard to /app', () => {
            expect(brandPageToPath('dashboard')).toBe('/app');
        });

        it('maps publisher correctly', () => {
            expect(brandPageToPath('social-ops/publisher')).toBe('/app/publisher');
        });

        it('maps calendar correctly', () => {
            expect(brandPageToPath('calendar')).toBe('/app/calendar');
        });

        it('defaults unknown page to /app', () => {
            expect(brandPageToPath('unknown-page')).toBe('/app');
        });
    });

    describe('pathToBrandPage', () => {
        it('maps /app to dashboard', () => {
            expect(pathToBrandPage('/app')).toBe('dashboard');
        });

        it('maps /app/publisher to social-ops/publisher', () => {
            expect(pathToBrandPage('/app/publisher')).toBe('social-ops/publisher');
        });

        it('defaults unknown path to dashboard', () => {
            expect(pathToBrandPage('/nonexistent')).toBe('dashboard');
        });
    });

    describe('adminPageToPath', () => {
        it('maps admin-dashboard to /admin', () => {
            expect(adminPageToPath('admin-dashboard')).toBe('/admin');
        });

        it('maps admin-users to /admin/users', () => {
            expect(adminPageToPath('admin-users')).toBe('/admin/users');
        });
    });

    describe('isAdminPath', () => {
        it('returns true for /admin paths', () => {
            expect(isAdminPath('/admin')).toBe(true);
            expect(isAdminPath('/admin/users')).toBe(true);
        });

        it('returns false for brand paths', () => {
            expect(isAdminPath('/dashboard')).toBe(false);
            expect(isAdminPath('/app/publisher')).toBe(false);
        });
    });

    describe('isAuthPath', () => {
        it('returns true for auth paths', () => {
            expect(isAuthPath('/login')).toBe(true);
            expect(isAuthPath('/register')).toBe(true);
            expect(isAuthPath('/forgot-password')).toBe(true);
        });

        it('returns false for app paths', () => {
            expect(isAuthPath('/app')).toBe(false);
            expect(isAuthPath('/admin')).toBe(false);
        });
    });

    describe('round-trip consistency', () => {
        it('every public page maps back from its path', () => {
            for (const [page, path] of Object.entries(PUBLIC_PAGE_ROUTES)) {
                const resolved = pathToPublicPage(path);
                expect(resolved).toBe(page);
            }
        });

        it('every brand page maps back from its path', () => {
            for (const [page, path] of Object.entries(BRAND_PAGE_ROUTES)) {
                const resolved = pathToBrandPage(path);
                expect(resolved).toBe(page);
            }
        });

        it('every admin page maps back from its path', () => {
            for (const [page, path] of Object.entries(ADMIN_PAGE_ROUTES)) {
                const resolved = pathToAdminPage(path);
                expect(resolved).toBe(page);
            }
        });
    });
});
