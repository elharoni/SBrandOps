/**
 * useAppRouting — syncs URL ↔ app page state (brand + admin)
 * تزامن URL مع حالة الصفحة
 */

import { useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    brandPageToPath,
    pathToBrandPage,
    adminPageToPath,
    pathToAdminPage,
    isAdminPath,
    isAuthPath,
    isPublicPath,
    AUTH_ROUTES,
} from '../config/routes';

type ViewMode = 'brand' | 'admin';
type AuthPage = 'login' | 'register' | 'forgot';

interface UseAppRoutingOptions {
    viewMode: ViewMode;
    activeBrandPage: string;
    activeAdminPage: string;
    isAuthenticated: boolean;
    isAdmin: boolean;
    authPage: AuthPage;
    setActiveBrandPage: (page: string) => void;
    setActiveAdminPage: (page: string) => void;
    setViewMode: (mode: ViewMode) => void;
    setAuthPage: (page: AuthPage) => void;
}

export function useAppRouting({
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
}: UseAppRoutingOptions) {
    const navigate = useNavigate();
    const location = useLocation();
    // Tracks whether the URL→state sync has run at least once on mount.
    // Prevents Effect 1 from overriding a valid deep-link URL with stale
    // initial Zustand state before Effect 2 has had a chance to read it.
    const hydrated = useRef(false);

    // ── Sync state → URL ──────────────────────────────────────────────────────
    useEffect(() => {
        const path = location.pathname;

        if (isPublicPath(path)) {
            return;
        }

        if (!isAuthenticated) {
            const authPaths: Record<AuthPage, string> = {
                login:   AUTH_ROUTES.login,
                register: AUTH_ROUTES.register,
                forgot:  AUTH_ROUTES.forgotPassword,
            };
            const targetPath = authPaths[authPage];
            if (location.pathname !== targetPath) {
                navigate(targetPath, { replace: true });
            }
            return;
        }

        // On mount, Effect 2 hasn't run yet — don't clobber the URL with the
        // Zustand default ('dashboard') before it gets to read the real path.
        if (!hydrated.current) return;

        const targetPath = viewMode === 'admin'
            ? adminPageToPath(activeAdminPage)
            : brandPageToPath(activeBrandPage);

        if (location.pathname !== targetPath) {
            navigate(targetPath);
        }
    }, [viewMode, activeBrandPage, activeAdminPage, isAuthenticated, authPage]);

    // ── Sync URL → state (deep-link / browser back-forward) ───────────────────
    useEffect(() => {
        const path = location.pathname;

        if (isPublicPath(path)) {
            return;
        }

        if (!isAuthenticated) {
            if (path === AUTH_ROUTES.register) setAuthPage('register');
            else if (path === AUTH_ROUTES.forgotPassword) setAuthPage('forgot');
            else setAuthPage('login');
            hydrated.current = true;
            return;
        }

        if (isAdminPath(path)) {
            if (!isAdmin) {
                // Not authorized — redirect to brand workspace
                navigate('/app', { replace: true });
                hydrated.current = true;
                return;
            }
            if (viewMode !== 'admin') setViewMode('admin');
            const page = pathToAdminPage(path);
            if (page !== activeAdminPage) setActiveAdminPage(page);
        } else if (!isAuthPath(path)) {
            if (viewMode !== 'brand') setViewMode('brand');
            const page = pathToBrandPage(path);
            if (page !== activeBrandPage) setActiveBrandPage(page);
        }

        hydrated.current = true;
    }, [location.pathname, isAuthenticated]);

    // ── Navigation helper (use instead of setActiveBrandPage directly) ────────
    const navigateTo = useCallback((page: string, mode: ViewMode = 'brand') => {
        if (mode === 'admin') {
            setViewMode('admin');
            setActiveAdminPage(page);
        } else {
            setViewMode('brand');
            setActiveBrandPage(page);
        }
    }, [setActiveBrandPage, setActiveAdminPage, setViewMode]);

    return { navigateTo, currentPath: location.pathname };
}
