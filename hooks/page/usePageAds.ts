/**
 * hooks/page/usePageAds.ts
 * Fetches ads data only when the AdsOps page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getAdCampaigns, getAdsDashboardData } from '../../services/adsService';

export function usePageAds(brandId: string | undefined) {
    const campaigns = useQuery({
        queryKey: ['adCampaigns', brandId],
        queryFn: () => getAdCampaigns(brandId!),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });

    const dashboard = useQuery({
        queryKey: ['adsDashboard', brandId],
        queryFn: () => getAdsDashboardData(brandId!),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });

    return { campaigns, dashboard };
}
