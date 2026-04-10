// hooks/useQueries.ts — React Query hooks for data fetching with caching
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBrands, addBrand } from '../services/brandService';
import { getSocialAccounts } from '../services/socialAccountService';
import { getAnalyticsData } from '../services/analyticsService';
import { getContentPipeline } from '../services/contentOpsService';
import { getAdCampaigns, getAdsDashboardData } from '../services/adsService';
import { getWorkflows } from '../services/workflowService';
import { getMarketingPlans } from '../services/marketingPlansService';
import { getConversations } from '../services/inboxService';

// ── Query Keys ────────────────────────────────────────────────────────────────
export const queryKeys = {
    brands: ['brands'] as const,
    socialAccounts: (brandId: string) => ['socialAccounts', brandId] as const,
    analytics: (brandId: string, period: string) => ['analytics', brandId, period] as const,
    contentPipeline: (brandId: string) => ['contentPipeline', brandId] as const,
    adCampaigns: (brandId: string) => ['adCampaigns', brandId] as const,
    adsDashboard: (brandId: string) => ['adsDashboard', brandId] as const,
    workflows: (brandId: string) => ['workflows', brandId] as const,
    marketingPlans: (brandId: string) => ['marketingPlans', brandId] as const,
    conversations: (brandId: string) => ['conversations', brandId] as const,
};

// ── Brands ────────────────────────────────────────────────────────────────────

export function useBrands() {
    return useQuery({
        queryKey: queryKeys.brands,
        queryFn: getBrands,
        staleTime: 5 * 60 * 1000,
    });
}

export function useCreateBrand() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (name: string) => addBrand(name),
        onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.brands }),
    });
}

// ── Social Accounts ───────────────────────────────────────────────────────────

export function useSocialAccounts(brandId: string) {
    return useQuery({
        queryKey: queryKeys.socialAccounts(brandId),
        queryFn: () => getSocialAccounts(brandId),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}

// ── Analytics ─────────────────────────────────────────────────────────────────

export function useAnalytics(brandId: string, period: string = '30d') {
    return useQuery({
        queryKey: queryKeys.analytics(brandId, period),
        queryFn: () => getAnalyticsData(brandId, { period, platforms: [] }),
        enabled: !!brandId,
        staleTime: 10 * 60 * 1000, // 10 minutes — analytics don't change often
    });
}

// ── Content Pipeline ──────────────────────────────────────────────────────────

export function useContentPipeline(brandId: string) {
    return useQuery({
        queryKey: queryKeys.contentPipeline(brandId),
        queryFn: () => getContentPipeline(brandId),
        enabled: !!brandId,
        staleTime: 2 * 60 * 1000,
    });
}

// ── Ads ───────────────────────────────────────────────────────────────────────

export function useAdCampaigns(brandId: string) {
    return useQuery({
        queryKey: queryKeys.adCampaigns(brandId),
        queryFn: () => getAdCampaigns(brandId),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}

export function useAdsDashboard(brandId: string) {
    return useQuery({
        queryKey: queryKeys.adsDashboard(brandId),
        queryFn: () => getAdsDashboardData(brandId),
        enabled: !!brandId,
        staleTime: 10 * 60 * 1000,
    });
}

// ── Workflows ─────────────────────────────────────────────────────────────────

export function useWorkflows(brandId: string) {
    return useQuery({
        queryKey: queryKeys.workflows(brandId),
        queryFn: () => getWorkflows(brandId),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}

// ── Marketing Plans ───────────────────────────────────────────────────────────

export function useMarketingPlans(brandId: string) {
    return useQuery({
        queryKey: queryKeys.marketingPlans(brandId),
        queryFn: () => getMarketingPlans(brandId),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}

// ── Inbox ─────────────────────────────────────────────────────────────────────

export function useConversations(brandId: string) {
    return useQuery({
        queryKey: queryKeys.conversations(brandId),
        queryFn: () => getConversations(brandId),
        enabled: !!brandId,
        staleTime: 1 * 60 * 1000, // 1 minute — inbox needs fresher data
        refetchInterval: 2 * 60 * 1000, // auto-refetch every 2 minutes
    });
}
