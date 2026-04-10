/**
 * hooks/useBrandData.ts
 *
 * PHASE 0 FIX: This hook now fetches ONLY the data needed on every page load
 * (social accounts, scheduled posts, brand connections). All other data is
 * fetched lazily inside the specific page that needs it.
 *
 * Before: 14 parallel API calls on every brand switch → slow, wasteful.
 * After:  3 essential calls → fast initial load, pages fetch their own data.
 *
 * Page-level data hooks live in hooks/page/ and are used directly by
 * each page component via useQuery (React Query).
 */
import { useState, useCallback } from 'react';
import { Brand, SocialAccount, NotificationType, ScheduledPost } from '../types';
import { getSocialAccounts } from '../services/socialAccountService';
import { getScheduledPosts } from '../services/postsService';
import { getBrandConnections, type BrandConnection } from '../services/brandConnectionService';

// ─── Minimal state needed by Sidebar, Header, and Dashboard ────────────────
interface BrandCoreState {
    /** Accounts connected to this brand (used by Publisher, Sidebar status) */
    socialAccounts: SocialAccount[];
    /** Upcoming & past posts (used by Calendar, Dashboard widget) */
    scheduledPosts: ScheduledPost[];
    /** Integration connection status (used by Sidebar alerts, Integrations page) */
    brandConnections: BrandConnection[];
    /** Per-source loading / error tracking */
    loadingState: {
        socialAccounts: 'idle' | 'loading' | 'success' | 'error';
        scheduledPosts: 'idle' | 'loading' | 'success' | 'error';
        brandConnections: 'idle' | 'loading' | 'success' | 'error';
    };
    /** True only while the initial fetch is in progress */
    isLoading: boolean;
}

const initialState: BrandCoreState = {
    socialAccounts: [],
    scheduledPosts: [],
    brandConnections: [],
    loadingState: {
        socialAccounts: 'idle',
        scheduledPosts: 'idle',
        brandConnections: 'idle',
    },
    isLoading: false,
};

export function useBrandData(
    addNotification: (type: NotificationType, message: string) => void,
) {
    const [state, setState] = useState<BrandCoreState>(initialState);

    const fetchDataForBrand = useCallback(async (brand: Brand) => {
        setState(prev => ({
            ...prev,
            isLoading: true,
            loadingState: {
                socialAccounts: 'loading',
                scheduledPosts: 'loading',
                brandConnections: 'loading',
            },
        }));

        const [accountsResult, postsResult, connectionsResult] = await Promise.allSettled([
            getSocialAccounts(brand.id),
            getScheduledPosts(brand.id),
            getBrandConnections(brand.id),
        ]);

        // ── Report individual failures without swallowing them ──────────────
        if (accountsResult.status === 'rejected') {
            console.error('[useBrandData] socialAccounts fetch failed:', accountsResult.reason);
            addNotification(NotificationType.Warning, 'تعذّر تحميل الحسابات الاجتماعية');
        }
        if (postsResult.status === 'rejected') {
            console.error('[useBrandData] scheduledPosts fetch failed:', postsResult.reason);
            addNotification(NotificationType.Warning, 'تعذّر تحميل المنشورات المجدولة');
        }
        if (connectionsResult.status === 'rejected') {
            console.error('[useBrandData] brandConnections fetch failed:', connectionsResult.reason);
        }

        setState({
            socialAccounts:
                accountsResult.status === 'fulfilled' ? accountsResult.value : [],
            scheduledPosts:
                postsResult.status === 'fulfilled' ? (postsResult.value ?? []) : [],
            brandConnections:
                connectionsResult.status === 'fulfilled' ? connectionsResult.value : [],
            loadingState: {
                socialAccounts: accountsResult.status === 'fulfilled' ? 'success' : 'error',
                scheduledPosts: postsResult.status === 'fulfilled' ? 'success' : 'error',
                brandConnections: connectionsResult.status === 'fulfilled' ? 'success' : 'error',
            },
            isLoading: false,
        });
    }, [addNotification]);

    const refresh = useCallback(
        (brand: Brand) => fetchDataForBrand(brand),
        [fetchDataForBrand],
    );

    return { ...state, fetchDataForBrand, refresh };
}

/*
 * ─────────────────────────────────────────────────────────────────────────────
 * PAGE-LEVEL DATA — use these hooks inside the relevant page components only.
 *
 * Each hook uses React Query for caching and background revalidation.
 * Import them directly in the page that needs them:
 *
 *   import { usePageAnalytics } from '../hooks/page/usePageAnalytics';
 *   import { usePageContentPipeline } from '../hooks/page/usePageContentPipeline';
 *   import { usePageAds } from '../hooks/page/usePageAds';
 *   import { usePageInbox } from '../hooks/page/usePageInbox';
 *   import { usePageWorkflows } from '../hooks/page/usePageWorkflows';
 *   import { usePageMarketingPlans } from '../hooks/page/usePageMarketingPlans';
 *   import { usePageBrandProfile } from '../hooks/page/usePageBrandProfile';
 *
 * These are created in hooks/page/ — see that directory.
 * ─────────────────────────────────────────────────────────────────────────────
 */
