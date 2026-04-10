/**
 * useAppRouting — syncs URL ↔ app page state (brand + admin)
 * تزامن URL مع حالة الصفحة
 */

import { useEffect, useCallback } from 'react';
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
    authPage,
    setActiveBrandPage,
    setActiveAdminPage,
    setViewMode,
    setAuthPage,
}: UseAppRoutingOptions) {
    const navigate = useNavigate();
    const location = useLocation();

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
            return;
        }

        if (isAdminPath(path)) {
            if (viewMode !== 'admin') setViewMode('admin');
            const page = pathToAdminPage(path);
            if (page !== activeAdminPage) setActiveAdminPage(page);
        } else if (!isAuthPath(path)) {
            if (viewMode !== 'brand') setViewMode('brand');
            const page = pathToBrandPage(path);
            if (page !== activeBrandPage) setActiveBrandPage(page);
        }
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
