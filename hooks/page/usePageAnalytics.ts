/**
 * hooks/page/usePageAnalytics.ts
 * Fetches analytics data only when the Analytics page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsData } from '../../services/analyticsService';
import { getBrandConnections, getBrandAssets } from '../../services/brandConnectionService';

export function usePageAnalytics(brandId: string | undefined) {
    return useQuery({
        queryKey: ['analytics', brandId],
        queryFn: async () => {
            if (!brandId) return null;
            const [connections, assets] = await Promise.all([
                getBrandConnections(brandId),
                getBrandAssets(brandId),
            ]);
            return getAnalyticsData(
                brandId,
                { period: '30d', platforms: [] },
                { brandConnections: connections, brandAssets: assets },
            );
        },
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}
