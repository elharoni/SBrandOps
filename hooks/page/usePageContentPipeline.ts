/**
 * hooks/page/usePageContentPipeline.ts
 * Fetches content pipeline only when ContentOps page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getContentPipeline } from '../../services/contentOpsService';

export function usePageContentPipeline(brandId: string | undefined) {
    return useQuery({
        queryKey: ['contentPipeline', brandId],
        queryFn: () => getContentPipeline(brandId!),
        enabled: !!brandId,
        staleTime: 3 * 60 * 1000,
    });
}
