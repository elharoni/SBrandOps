/**
 * hooks/page/usePageInbox.ts
 * Fetches inbox conversations only when the Inbox page is active.
 */
import { useQuery } from '@tanstack/react-query';
import { getConversations } from '../../services/inboxService';

export function usePageInbox(brandId: string | undefined) {
    return useQuery({
        queryKey: ['inbox', brandId],
        queryFn: () => getConversations(brandId!),
        enabled: !!brandId,
        staleTime: 60 * 1000, // 1 min — inbox data changes frequently
        refetchOnWindowFocus: true,
    });
}
