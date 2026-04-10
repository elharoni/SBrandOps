/**
 * hooks/page/usePageErrors.ts
 * Fetches operational errors only when the Error Center page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getErrors } from '../../services/errorCenterService';

export function usePageErrors(brandId: string | undefined) {
    return useQuery({
        queryKey: ['operationalErrors', brandId],
        queryFn: () => getErrors(brandId!),
        enabled: !!brandId,
        staleTime: 2 * 60 * 1000,
    });
}
