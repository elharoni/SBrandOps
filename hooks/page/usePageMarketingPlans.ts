/**
 * hooks/page/usePageMarketingPlans.ts
 * Fetches marketing plans only when the Marketing Plans page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getMarketingPlans } from '../../services/marketingPlansService';

export function usePageMarketingPlans(brandId: string | undefined) {
    return useQuery({
        queryKey: ['marketingPlans', brandId],
        queryFn: () => getMarketingPlans(brandId!),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}
