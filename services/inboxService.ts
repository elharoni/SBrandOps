// services/inboxService.ts — Real Supabase Implementation
import { supabase } from './supabaseClient';
import { InboxConversation, ConversationType, SocialPlatform, ConversationIntent, ConversationSentiment } from '../types';

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToConversation(row: any): InboxConversation {
    return {
        id: row.id,
        platform: row.platform as SocialPlatform,
        type: row.type as ConversationType,
        user: {
            name: row.user_name || 'Unknown',
            handle: row.user_handle || '',
            avatarUrl: row.user_avatar_url || `https://picsum.photos/seed/${row.user_handle}/100`,
        },
        messages: Array.isArray(row.inbox_messages)
            ? row.inbox_messages.map((m: any) => ({
                id: m.id,
                sender: m.sender,
                text: m.text,
                timestamp: new Date(m.sent_at),
            }))
            : [],
        lastMessageTimestamp: new Date(row.last_message_at),
        isRead: row.is_read,
        assignee: row.assignee || 'Unassigned',
        intent: row.intent as ConversationIntent || ConversationIntent.GeneralQuestion,
        sentiment: (row.sentiment as ConversationSentiment | null) || undefined,
        aiSummary: row.ai_summary || undefined,
        analyzedAt: row.analyzed_at ? new Date(row.analyzed_at) : null,
    };
}

export interface ConversationAnalysisPayload {
    summary: string;
    intent: ConversationIntent;
    sentiment: ConversationSentiment;
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getConversations(brandId: string): Promise<InboxConversation[]> {
    const { data, error } = await supabase
        .from('inbox_conversations')
        .select('*, inbox_messages(id, sender, text, sent_at)')
        .eq('brand_id', brandId)
        .order('last_message_at', { ascending: false });

    if (error) {
        console.error('getConversations error:', error);
        return [];
    }
    return (data || []).map(mapRowToConversation);
}

export async function getConversation(brandId: string, conversationId: string): Promise<InboxConversation | null> {
    const { data, error } = await supabase
        .from('inbox_conversations')
        .select('*, inbox_messages(id, sender, text, sent_at)')
        .eq('id', conversationId)
        .eq('brand_id', brandId)
        .single();

    if (error) return null;
    return mapRowToConversation(data);
}

// ── Reply ─────────────────────────────────────────────────────────────────────

export async function replyToConversation(
    conversationId: string,
    replyText: string,
    brandId: string
): Promise<InboxConversation> {
    // 1. Insert the reply message
    const { error: msgError } = await supabase
        .from('inbox_messages')
        .insert({
            conversation_id: conversationId,
            brand_id: brandId,
            sender: 'agent',
            text: replyText,
            sent_at: new Date().toISOString(),
        });

    if (msgError) throw new Error(msgError.message);

    // 2. Update conversation metadata
    const { error: convError } = await supabase
        .from('inbox_conversations')
        .update({
            last_message_text: replyText,
            last_message_at: new Date().toISOString(),
            is_read: true,
        })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (convError) throw new Error(convError.message);

    // 3. Return updated conversation
    const updated = await getConversation(brandId, conversationId);
    if (!updated) throw new Error('Conversation not found after reply');
    return updated;
}

// ── Mark as Read ──────────────────────────────────────────────────────────────

export async function markConversationRead(brandId: string, conversationId: string): Promise<void> {
    const { error } = await supabase
        .from('inbox_conversations')
        .update({ is_read: true })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Assign ────────────────────────────────────────────────────────────────────

export async function assignConversation(
    brandId: string,
    conversationId: string,
    assignee: string
): Promise<void> {
    const { error } = await supabase
        .from('inbox_conversations')
        .update({ assignee })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function persistConversationAnalysis(
    brandId: string,
    conversationId: string,
    analysis: ConversationAnalysisPayload,
): Promise<void> {
    const { error } = await supabase
        .from('inbox_conversations')
        .update({
            intent: analysis.intent,
            sentiment: analysis.sentiment,
            ai_summary: analysis.summary,
            analyzed_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (error) {
        throw new Error(error.message);
    }
}

// ── Mark Unread Count ─────────────────────────────────────────────────────────

export async function getUnreadCount(brandId: string): Promise<number> {
    const { count, error } = await supabase
        .from('inbox_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('is_read', false);

    if (error) return 0;
    return count ?? 0;
}
