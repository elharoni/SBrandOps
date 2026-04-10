import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConversationIntent } from '../types';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import { supabase } from '../services/supabaseClient';
import { getConversations, persistConversationAnalysis } from '../services/inboxService';

const makeChain = (overrides: Record<string, any> = {}) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
    ...overrides,
});

describe('inboxService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('maps persisted sentiment analysis fields from inbox conversations', async () => {
        const chain = makeChain({
            order: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: 'conv-1',
                        platform: 'Instagram',
                        type: 'Message',
                        user_name: 'Nora',
                        user_handle: 'nora',
                        user_avatar_url: null,
                        is_read: false,
                        assignee: 'Support',
                        intent: ConversationIntent.Feedback,
                        sentiment: 'positive',
                        ai_summary: 'عميلة سعيدة بالتجربة الأخيرة.',
                        analyzed_at: '2026-04-01T10:00:00.000Z',
                        last_message_at: '2026-04-01T09:55:00.000Z',
                        inbox_messages: [],
                    },
                ],
                error: null,
            }),
        });

        (supabase.from as any).mockReturnValue(chain);

        const result = await getConversations('brand-1');

        expect(result[0]).toEqual(
            expect.objectContaining({
                id: 'conv-1',
                sentiment: 'positive',
                aiSummary: 'عميلة سعيدة بالتجربة الأخيرة.',
                analyzedAt: new Date('2026-04-01T10:00:00.000Z'),
            }),
        );
    });

    it('persists analysis payload to inbox_conversations', async () => {
        const chain = makeChain({
            eq: vi.fn().mockReturnThis(),
        });
        chain.eq
            .mockReturnValueOnce(chain)
            .mockResolvedValueOnce({ error: null });

        (supabase.from as any).mockReturnValue(chain);

        await persistConversationAnalysis('brand-1', 'conv-1', {
            summary: 'العميل متحمس للشراء لكنه يحتاج تفاصيل أكثر.',
            intent: ConversationIntent.PurchaseInquiry,
            sentiment: 'positive',
        });

        expect(supabase.from).toHaveBeenCalledWith('inbox_conversations');
        expect(chain.update).toHaveBeenCalledWith(
            expect.objectContaining({
                intent: ConversationIntent.PurchaseInquiry,
                sentiment: 'positive',
                ai_summary: 'العميل متحمس للشراء لكنه يحتاج تفاصيل أكثر.',
                analyzed_at: expect.any(String),
            }),
        );
    });
});
