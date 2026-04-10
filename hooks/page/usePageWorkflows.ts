/**
 * hooks/page/usePageWorkflows.ts
 * Fetches workflows only when the Workflows page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getWorkflows } from '../../services/workflowService';

export function usePageWorkflows(brandId: string | undefined) {
    return useQuery({
        queryKey: ['workflows', brandId],
        queryFn: () => getWorkflows(brandId!),
        enabled: !!brandId,
        staleTime: 5 * 60 * 1000,
    });
}
