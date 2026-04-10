/**
 * hooks/page/usePageBrandProfile.ts
 * Fetches brand hub profile only when BrandHub page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getBrandHubProfile } from '../../services/brandHubService';

export function usePageBrandProfile(brandId: string | undefined, brandName: string) {
    return useQuery({
        queryKey: ['brandProfile', brandId],
        queryFn: () => getBrandHubProfile(brandId!, brandName),
        enabled: !!brandId,
        staleTime: 10 * 60 * 1000,
    });
}
