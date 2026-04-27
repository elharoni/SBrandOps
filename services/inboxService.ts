// services/inboxService.ts — Unified Inbox v2 (migration 053 compatible)
import { supabase } from './supabaseClient';
import {
    InboxConversation, ConversationType, SocialPlatform,
    ConversationIntent, ConversationSentiment,
    ConversationStatus, ConversationPriority,
} from '../types';

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRowToConversation(row: any): InboxConversation {
    return {
        id: row.id,
        platform: row.platform as SocialPlatform,
        type: row.type as ConversationType,
        user: {
            name: row.user_name || 'Unknown',
            handle: row.user_handle || '',
            avatarUrl: row.user_avatar_url || `https://picsum.photos/seed/${row.user_handle || row.id}/100`,
        },
        messages: Array.isArray(row.inbox_messages)
            ? row.inbox_messages
                .map((m: any) => ({
                    id: m.id,
                    sender: m.sender,
                    text: m.text,
                    timestamp: new Date(m.sent_at),
                }))
                .sort((a: any, b: any) => a.timestamp.getTime() - b.timestamp.getTime())
            : [],
        lastMessageTimestamp: new Date(row.last_message_at),
        isRead: row.is_read,
        assignee: row.assignee || 'Unassigned',
        intent: (row.intent as ConversationIntent) || ConversationIntent.Unknown,
        sentiment: (row.sentiment as ConversationSentiment | null) ?? undefined,
        aiSummary: row.ai_summary ?? undefined,
        analyzedAt: row.analyzed_at ? new Date(row.analyzed_at) : null,
        // Enhanced fields (migration 053)
        status: (row.status as ConversationStatus) || 'open',
        priority: (row.priority as ConversationPriority) || 'medium',
        tags: Array.isArray(row.tags) ? row.tags : [],
        crmCustomerId: row.crm_customer_id ?? null,
        accountName: row.account_name ?? null,
        accountId: row.account_id ?? null,
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
    brandId: string,
): Promise<InboxConversation> {
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

    const updated = await getConversation(brandId, conversationId);
    if (!updated) throw new Error('Conversation not found after reply');
    return updated;
}

// ── Mark Read ─────────────────────────────────────────────────────────────────

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
    assignee: string,
): Promise<void> {
    const { error } = await supabase
        .from('inbox_conversations')
        .update({ assignee })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Status ────────────────────────────────────────────────────────────────────

export async function updateConversationStatus(
    brandId: string,
    conversationId: string,
    status: ConversationStatus,
): Promise<void> {
    const { error } = await supabase
        .from('inbox_conversations')
        .update({ status })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Priority ──────────────────────────────────────────────────────────────────

export async function updateConversationPriority(
    brandId: string,
    conversationId: string,
    priority: ConversationPriority,
): Promise<void> {
    const { error } = await supabase
        .from('inbox_conversations')
        .update({ priority })
        .eq('id', conversationId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function addConversationTag(
    brandId: string,
    conversationId: string,
    tag: string,
): Promise<void> {
    // Use Supabase array append (postgres array_append)
    const { error } = await supabase.rpc('append_inbox_tag', {
        p_brand_id: brandId,
        p_conv_id: conversationId,
        p_tag: tag,
    });

    if (error) {
        // Fallback: read-modify-write if RPC not available
        const conv = await getConversation(brandId, conversationId);
        if (!conv) return;
        const current = conv.tags ?? [];
        if (current.includes(tag)) return;
        const { error: e2 } = await supabase
            .from('inbox_conversations')
            .update({ tags: [...current, tag] })
            .eq('id', conversationId)
            .eq('brand_id', brandId);
        if (e2) throw new Error(e2.message);
    }
}

export async function removeConversationTag(
    brandId: string,
    conversationId: string,
    tag: string,
): Promise<void> {
    const conv = await getConversation(brandId, conversationId);
    if (!conv) return;
    const updated = (conv.tags ?? []).filter(t => t !== tag);
    const { error } = await supabase
        .from('inbox_conversations')
        .update({ tags: updated })
        .eq('id', conversationId)
        .eq('brand_id', brandId);
    if (error) throw new Error(error.message);
}

// ── AI Analysis ───────────────────────────────────────────────────────────────

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

    if (error) throw new Error(error.message);
}

// ── Unread Count ──────────────────────────────────────────────────────────────

export async function getUnreadCount(brandId: string): Promise<number> {
    const { count, error } = await supabase
        .from('inbox_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('is_read', false);

    if (error) return 0;
    return count ?? 0;
}

// ── Keyword Classification ────────────────────────────────────────────────────

export interface InboxKeywordRule {
    id: string;
    brandId: string;
    keyword: string;
    category: string;
    groupName?: string;
    language: string;
    tagToAdd?: string;
    priority?: string;
    isActive: boolean;
}

export async function getKeywordRules(brandId: string): Promise<InboxKeywordRule[]> {
    const { data, error } = await supabase
        .from('inbox_keyword_rules')
        .select('*')
        .eq('brand_id', brandId)
        .eq('is_active', true)
        .order('category');

    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        brandId: r.brand_id,
        keyword: r.keyword,
        category: r.category,
        groupName: r.group_name ?? undefined,
        language: r.language,
        tagToAdd: r.tag_to_add ?? undefined,
        priority: r.priority ?? undefined,
        isActive: r.is_active,
    }));
}

export async function upsertKeywordRule(
    brandId: string,
    rule: Omit<InboxKeywordRule, 'id' | 'brandId'>,
): Promise<boolean> {
    const { error } = await supabase
        .from('inbox_keyword_rules')
        .upsert([{
            brand_id: brandId,
            keyword: rule.keyword,
            category: rule.category,
            group_name: rule.groupName,
            language: rule.language,
            tag_to_add: rule.tagToAdd,
            priority: rule.priority,
            is_active: rule.isActive,
        }], { onConflict: 'brand_id,keyword' });
    return !error;
}

export async function deleteKeywordRule(brandId: string, ruleId: string): Promise<void> {
    await supabase
        .from('inbox_keyword_rules')
        .delete()
        .eq('id', ruleId)
        .eq('brand_id', brandId);
}

/**
 * Classify message text against keyword rules.
 * Returns list of tags and suggested priority.
 */
export function classifyMessageText(
    text: string,
    rules: InboxKeywordRule[],
): { tags: string[]; priority: ConversationPriority | null } {
    const lower = text.toLowerCase();
    const matchedTags: string[] = [];
    let topPriority: ConversationPriority | null = null;

    const priorityOrder: ConversationPriority[] = ['urgent', 'high', 'medium', 'low'];

    for (const rule of rules) {
        if (!rule.isActive) continue;
        if (lower.includes(rule.keyword.toLowerCase())) {
            if (rule.tagToAdd && !matchedTags.includes(rule.tagToAdd)) {
                matchedTags.push(rule.tagToAdd);
            }
            if (rule.priority) {
                const rp = rule.priority as ConversationPriority;
                if (!topPriority || priorityOrder.indexOf(rp) < priorityOrder.indexOf(topPriority)) {
                    topPriority = rp;
                }
            }
        }
    }

    return { tags: matchedTags, priority: topPriority };
}

// ── Internal Notes ────────────────────────────────────────────────────────────

export interface ConversationNote {
    id: string;
    conversationId: string;
    author: string;
    text: string;
    createdAt: Date;
}

export async function getConversationNotes(
    brandId: string,
    conversationId: string,
): Promise<ConversationNote[]> {
    const { data, error } = await supabase
        .from('inbox_conversation_notes')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('brand_id', brandId)
        .order('created_at', { ascending: true });

    if (error) return [];
    return (data || []).map(r => ({
        id: r.id,
        conversationId: r.conversation_id,
        author: r.author,
        text: r.text,
        createdAt: new Date(r.created_at),
    }));
}

export async function addConversationNote(
    brandId: string,
    conversationId: string,
    text: string,
    author = 'Team',
): Promise<ConversationNote | null> {
    const { data, error } = await supabase
        .from('inbox_conversation_notes')
        .insert({ conversation_id: conversationId, brand_id: brandId, author, text })
        .select()
        .single();

    if (error) { console.error('addConversationNote:', error); return null; }
    return {
        id: data.id,
        conversationId: data.conversation_id,
        author: data.author,
        text: data.text,
        createdAt: new Date(data.created_at),
    };
}

// ── CRM Lead Creation from Inbox ──────────────────────────────────────────────

export interface CreateLeadFromInboxInput {
    firstName: string;
    lastName?: string;
    phone?: string;
    email?: string;
    platform: string;
    accountName?: string;
    notes?: string;
}

export async function createCrmLeadFromConversation(
    brandId: string,
    conversationId: string,
    input: CreateLeadFromInboxInput,
): Promise<{ customerId: string } | null> {
    try {
        // 1. Create CRM customer
        const { data: customer, error: custErr } = await supabase
            .from('crm_customers')
            .insert([{
                brand_id: brandId,
                first_name: input.firstName,
                last_name: input.lastName || null,
                phone: input.phone || null,
                email: input.email || null,
                lifecycle_stage: 'lead',
                acquisition_source: 'social',
                acquisition_channel: input.platform.toLowerCase(),
                metadata: { inbox_source: conversationId, account_name: input.accountName },
            }])
            .select('id')
            .single();

        if (custErr || !customer) { console.error('createCrmLead:', custErr); return null; }

        // 2. Link conversation to customer
        await supabase
            .from('crm_conversation_links')
            .upsert([{
                conversation_id: conversationId,
                customer_id: customer.id,
                brand_id: brandId,
                matched_by: 'manual',
            }], { onConflict: 'conversation_id' });

        // 3. Update conversation with crm_customer_id
        await supabase
            .from('inbox_conversations')
            .update({ crm_customer_id: customer.id })
            .eq('id', conversationId)
            .eq('brand_id', brandId);

        // 4. Add CRM note if provided
        if (input.notes) {
            await supabase
                .from('crm_notes')
                .insert([{
                    brand_id: brandId,
                    customer_id: customer.id,
                    content: input.notes,
                    author: 'Inbox',
                }]);
        }

        return { customerId: customer.id };
    } catch (err) {
        console.error('createCrmLeadFromConversation:', err);
        return null;
    }
}

// ── Order Creation from Inbox ─────────────────────────────────────────────────

export interface InboxOrderItem {
    productName: string;
    quantity: number;
    unitPrice: number;
}

export interface CreateOrderFromInboxInput {
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    shippingAddress?: string;
    city?: string;
    items: InboxOrderItem[];
    shippingFee?: number;
    discount?: number;
    paymentMethod?: string;
    notes?: string;
    existingCustomerId?: string;
}

export async function createOrderFromInboxConversation(
    brandId: string,
    conversationId: string,
    input: CreateOrderFromInboxInput,
): Promise<{ orderId: string; customerId: string } | null> {
    try {
        const subtotal = input.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        const shippingFee = input.shippingFee ?? 0;
        const discount = input.discount ?? 0;
        const total = subtotal + shippingFee - discount;

        let customerId = input.existingCustomerId ?? null;

        // 1. Create customer if not existing
        if (!customerId) {
            const parts = input.customerName.trim().split(' ');
            const { data: cust, error: custErr } = await supabase
                .from('crm_customers')
                .insert([{
                    brand_id: brandId,
                    first_name: parts[0] || input.customerName,
                    last_name: parts.slice(1).join(' ') || null,
                    phone: input.customerPhone || null,
                    email: input.customerEmail || null,
                    lifecycle_stage: 'lead',
                    acquisition_source: 'social',
                    metadata: { inbox_source: conversationId },
                }])
                .select('id')
                .single();
            if (custErr || !cust) return null;
            customerId = cust.id;
        }

        // 2. Create order
        const externalId = `INB-${Date.now()}`;
        const shippingAddr = input.shippingAddress
            ? { address_1: input.shippingAddress, city: input.city || '', phone: input.customerPhone }
            : null;

        const { data: order, error: orderErr } = await supabase
            .from('crm_orders')
            .insert([{
                brand_id: brandId,
                customer_id: customerId,
                external_id: externalId,
                store_source: 'manual',
                status: 'pending',
                payment_status: 'pending',
                shipping_status: 'pending',
                subtotal,
                shipping_total: shippingFee,
                discount_total: discount,
                total,
                payment_method: input.paymentMethod || null,
                shipping_address: shippingAddr,
                notes: input.notes || null,
                order_date: new Date().toISOString(),
                raw_data: { source: 'inbox', conversation_id: conversationId },
            }])
            .select('id')
            .single();

        if (orderErr || !order) return null;

        // 3. Insert order items
        if (input.items.length > 0) {
            await supabase.from('crm_order_items').insert(
                input.items.map(item => ({
                    brand_id: brandId,
                    order_id: order.id,
                    product_name: item.productName,
                    quantity: item.quantity,
                    unit_price: item.unitPrice,
                    subtotal: item.quantity * item.unitPrice,
                    total: item.quantity * item.unitPrice,
                })),
            );
        }

        // 4. Link conversation → customer
        await supabase
            .from('crm_conversation_links')
            .upsert([{
                conversation_id: conversationId,
                customer_id: customerId,
                brand_id: brandId,
                matched_by: 'manual',
            }], { onConflict: 'conversation_id' });

        // 5. Update conversation status + CRM link
        await supabase
            .from('inbox_conversations')
            .update({
                crm_customer_id: customerId,
                status: 'resolved',
                tags: supabase.rpc ? undefined : undefined, // tags updated separately if needed
            })
            .eq('id', conversationId)
            .eq('brand_id', brandId);

        // 6. Add internal note
        // non-blocking internal note — ignore failures
        try {
            await supabase
                .from('inbox_conversation_notes')
                .insert([{
                    conversation_id: conversationId,
                    brand_id: brandId,
                    author: 'System',
                    text: `✅ تم إنشاء طلب رقم ${externalId} بقيمة ${total.toFixed(2)} ر.س`,
                }]);
        } catch { /* ignore */ }

        return { orderId: order.id, customerId };
    } catch (err) {
        console.error('createOrderFromInboxConversation:', err);
        return null;
    }
}

// ── Bulk Operations ───────────────────────────────────────────────────────────

export async function bulkMarkRead(brandId: string, conversationIds: string[]): Promise<void> {
    if (!conversationIds.length) return;
    await supabase
        .from('inbox_conversations')
        .update({ is_read: true })
        .in('id', conversationIds)
        .eq('brand_id', brandId);
}

export async function bulkUpdateStatus(
    brandId: string,
    conversationIds: string[],
    status: ConversationStatus,
): Promise<void> {
    if (!conversationIds.length) return;
    await supabase
        .from('inbox_conversations')
        .update({ status })
        .in('id', conversationIds)
        .eq('brand_id', brandId);
}

// ── Social Messages → InboxConversation ──────────────────────────────────────
// Reads from social_messages (written by inbox-aggregator Edge Function).
// Groups by (provider, external_thread_id) to form thread-level conversations.

const PROVIDER_TO_PLATFORM: Record<string, SocialPlatform> = {
    facebook:  SocialPlatform.Facebook,
    instagram: SocialPlatform.Instagram,
    youtube:   SocialPlatform.LinkedIn,   // YouTube maps to LinkedIn as closest fallback
    tiktok:    SocialPlatform.TikTok,
    x:         SocialPlatform.X,
    twitter:   SocialPlatform.X,
    linkedin:  SocialPlatform.LinkedIn,
    pinterest: SocialPlatform.Pinterest,
};

const MESSAGE_TYPE_TO_CONV_TYPE: Record<string, ConversationType> = {
    message: ConversationType.Message,
    comment: ConversationType.Comment,
    mention: ConversationType.Mention,
    reply:   ConversationType.Comment,
    review:  ConversationType.Comment,
};

const INTENT_MAP: Record<string, ConversationIntent> = {
    buying_intent:      ConversationIntent.PurchaseInquiry,
    inquiry:            ConversationIntent.GeneralQuestion,
    complaint:          ConversationIntent.Complaint,
    spam:               ConversationIntent.Spam,
    positive_feedback:  ConversationIntent.Feedback,
};

function priorityFromScore(score: number): ConversationPriority {
    if (score >= 80) return 'urgent';
    if (score >= 60) return 'high';
    if (score >= 30) return 'medium';
    return 'low';
}

export async function getSocialMessagesAsConversations(brandId: string): Promise<InboxConversation[]> {
    const { data, error } = await supabase
        .from('social_messages')
        .select('id, provider, message_type, external_thread_id, external_message_id, sender_name, sender_external_id, sender_avatar_url, content, is_read, is_replied, sentiment, intent, priority_score, crm_customer_id, received_at')
        .eq('brand_id', brandId)
        .order('received_at', { ascending: false })
        .limit(500);

    if (error) {
        console.error('getSocialMessagesAsConversations error:', error);
        return [];
    }

    // Group by (provider, external_thread_id)
    const threads = new Map<string, typeof data>();
    for (const row of (data ?? [])) {
        const key = `${row.provider}::${row.external_thread_id}`;
        if (!threads.has(key)) threads.set(key, []);
        threads.get(key)!.push(row);
    }

    const conversations: InboxConversation[] = [];

    for (const [, msgs] of threads) {
        // msgs already ordered newest-first; reverse for chronological display
        const chronological = [...msgs].reverse();
        const latest = msgs[0];   // newest message for metadata
        const first  = chronological[0]; // first message for sender identity

        const platform = PROVIDER_TO_PLATFORM[latest.provider] ?? SocialPlatform.Facebook;
        const convType = MESSAGE_TYPE_TO_CONV_TYPE[latest.message_type] ?? ConversationType.Message;
        const intent = INTENT_MAP[latest.intent ?? ''] ?? ConversationIntent.Unknown;
        const allRead = msgs.every(m => m.is_read);

        conversations.push({
            id: `sm::${latest.provider}::${latest.external_thread_id}`,
            platform,
            type: convType,
            user: {
                name:      first.sender_name || 'Unknown',
                handle:    first.sender_external_id || '',
                avatarUrl: first.sender_avatar_url || `https://picsum.photos/seed/${first.sender_external_id || first.id}/100`,
            },
            messages: chronological.map(m => ({
                id:        m.id,
                sender:    'user' as const,
                text:      m.content || '',
                timestamp: new Date(m.received_at),
            })),
            lastMessageTimestamp: new Date(latest.received_at),
            isRead:    allRead,
            assignee:  'Unassigned',
            intent,
            sentiment: (latest.sentiment as ConversationSentiment | null) ?? undefined,
            status:    'open' as ConversationStatus,
            priority:  priorityFromScore(Number(latest.priority_score ?? 0)),
            tags:      [],
            crmCustomerId: latest.crm_customer_id ?? null,
            accountName: null,
            accountId: null,
        });
    }

    // Sort by newest message first
    conversations.sort((a, b) => b.lastMessageTimestamp.getTime() - a.lastMessageTimestamp.getTime());
    return conversations;
}

export async function markSocialMessageRead(brandId: string, threadId: string, provider: string): Promise<void> {
    await supabase
        .from('social_messages')
        .update({ is_read: true })
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .eq('external_thread_id', threadId);
}

// ── Lead Score (client-side) ──────────────────────────────────────────────────

const PRICE_KEYWORDS   = ['سعر', 'بكام', 'كام', 'بكم', 'تكلفة', 'price', 'cost', 'how much', 'كمية', 'موجود'];
const ORDER_KEYWORDS   = ['عايز', 'أبي', 'أريد', 'محتاج', 'طلب', 'اطلب', 'want', 'order', 'buy', 'شراء', 'هشتري'];
const URGENT_KEYWORDS  = ['عاجل', 'ضروري', 'اليوم', 'دلوقتي', 'urgent', 'asap', 'now', 'today'];
const INTENT_SCORES: Partial<Record<string, number>> = {
    purchase_inquiry: 35,
    price_inquiry:    25,
    order_intent:     40,
    complaint:        -15,
    spam:             -50,
};
const TAG_SCORES: Record<string, number> = {
    'hot-lead':       25,
    'order-intent':   35,
    'price-inquiry':  20,
    'complaint':      -15,
    'support':        -5,
};

export function calculateLeadScore(conv: {
    intent?: string;
    tags?: string[];
    messages?: { text: string; sender: string }[];
    sentiment?: string;
    adCampaignId?: string | null;
}): number {
    let score = 20; // baseline

    // Intent
    const intentKey = (conv.intent ?? '').toLowerCase().replace(/ /g, '_');
    score += INTENT_SCORES[intentKey] ?? 0;

    // Tags
    for (const tag of conv.tags ?? []) {
        score += TAG_SCORES[tag] ?? 0;
    }

    // Message keywords (scan last 5 user messages)
    const userMsgs = (conv.messages ?? [])
        .filter(m => m.sender === 'user')
        .slice(-5)
        .map(m => m.text.toLowerCase());

    for (const text of userMsgs) {
        if (PRICE_KEYWORDS.some(k => text.includes(k)))  score += 15;
        if (ORDER_KEYWORDS.some(k => text.includes(k)))  score += 20;
        if (URGENT_KEYWORDS.some(k => text.includes(k))) score += 10;
    }

    // Sentiment
    if (conv.sentiment === 'positive') score += 10;
    if (conv.sentiment === 'negative') score -= 10;

    // Ad comment boost
    if (conv.adCampaignId) score += 15;

    return Math.max(0, Math.min(100, score));
}

export function detectItemType(conv: {
    type?: string;
    platform?: string;
    adCampaignId?: string | null;
    id?: string;
}): import('../types').InboxItemType {
    const type = (conv.type ?? '').toLowerCase();
    const platform = (conv.platform ?? '').toLowerCase();

    if (type === 'mention') return 'mention';
    if (conv.adCampaignId) return 'ad_comment';
    if (type === 'comment' && platform === 'facebook')  return 'facebook_comment';
    if (type === 'comment' && platform === 'instagram') return 'instagram_comment';
    if (type === 'comment') return 'facebook_comment';
    return 'dm';
}

// ── Commercial Intelligence (DB) ──────────────────────────────────────────────

export interface CommercialIntelligence {
    conversationId: string;
    leadScore: number;
    commercialIntent: string | null;
    productInterest: string | null;
    estimatedValue: number;
    closeProbability: number;
    nextBestAction: string | null;
    lossRisk: string | null;
    itemType: string;
}

export async function getCommercialIntelligence(
    brandId: string,
    conversationId: string,
): Promise<CommercialIntelligence | null> {
    const { data } = await supabase
        .from('inbox_commercial_intelligence')
        .select('*')
        .eq('brand_id', brandId)
        .eq('conversation_id', conversationId)
        .maybeSingle();

    if (!data) return null;
    return {
        conversationId: data.conversation_id,
        leadScore:        data.lead_score,
        commercialIntent: data.commercial_intent,
        productInterest:  data.product_interest,
        estimatedValue:   Number(data.estimated_value),
        closeProbability: data.close_probability,
        nextBestAction:   data.next_best_action,
        lossRisk:         data.loss_risk,
        itemType:         data.item_type,
    };
}

export async function upsertCommercialIntelligence(
    brandId: string,
    payload: Partial<CommercialIntelligence> & { conversationId: string },
): Promise<void> {
    await supabase.from('inbox_commercial_intelligence').upsert({
        brand_id:          brandId,
        conversation_id:   payload.conversationId,
        lead_score:        payload.leadScore,
        commercial_intent: payload.commercialIntent,
        product_interest:  payload.productInterest,
        estimated_value:   payload.estimatedValue,
        close_probability: payload.closeProbability,
        next_best_action:  payload.nextBestAction,
        loss_risk:         payload.lossRisk,
        item_type:         payload.itemType,
        updated_at:        new Date().toISOString(),
    }, { onConflict: 'brand_id,conversation_id' });
}

// ── Opportunity Pipeline (DB) ─────────────────────────────────────────────────

import type { InboxOpportunity, OpportunityStage } from '../types';

export async function getOpportunity(
    brandId: string,
    conversationId: string,
): Promise<InboxOpportunity | null> {
    const { data } = await supabase
        .from('inbox_opportunities')
        .select('*')
        .eq('brand_id', brandId)
        .eq('conversation_id', conversationId)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data) return null;
    return {
        id:          data.id,
        stage:       data.stage as OpportunityStage,
        value:       Number(data.value),
        probability: data.probability,
        title:       data.title,
        status:      data.status as InboxOpportunity['status'],
    };
}

export async function upsertOpportunity(
    brandId: string,
    conversationId: string,
    payload: Partial<InboxOpportunity> & { title?: string },
): Promise<InboxOpportunity | null> {
    const existing = await getOpportunity(brandId, conversationId);

    if (existing) {
        const { data } = await supabase
            .from('inbox_opportunities')
            .update({
                stage:       payload.stage,
                value:       payload.value,
                probability: payload.probability,
                title:       payload.title,
                status:      payload.status,
                updated_at:  new Date().toISOString(),
            })
            .eq('id', existing.id)
            .select()
            .single();
        if (!data) return null;
        return { ...existing, ...payload, id: existing.id };
    }

    const { data } = await supabase
        .from('inbox_opportunities')
        .insert({
            brand_id:        brandId,
            conversation_id: conversationId,
            stage:           payload.stage ?? 'new_inquiry',
            value:           payload.value ?? 0,
            probability:     payload.probability ?? 50,
            title:           payload.title ?? 'فرصة بيع',
            status:          payload.status ?? 'open',
        })
        .select()
        .single();

    if (!data) return null;
    return {
        id:          data.id,
        stage:       data.stage as OpportunityStage,
        value:       Number(data.value),
        probability: data.probability,
        title:       data.title,
        status:      data.status,
    };
}

// ── Follow-ups (DB) ───────────────────────────────────────────────────────────

import type { InboxFollowup } from '../types';

export async function getFollowups(
    brandId: string,
    conversationId: string,
): Promise<InboxFollowup[]> {
    const { data } = await supabase
        .from('inbox_followups')
        .select('*')
        .eq('brand_id', brandId)
        .eq('conversation_id', conversationId)
        .in('status', ['pending', 'overdue'])
        .order('due_at', { ascending: true });

    return (data ?? []).map(r => ({
        id:              r.id,
        dueAt:           new Date(r.due_at),
        type:            r.followup_type,
        status:          r.status as InboxFollowup['status'],
        messageTemplate: r.message_template ?? undefined,
    }));
}

export async function createFollowup(
    brandId: string,
    conversationId: string,
    dueAt: Date,
    type = 'manual',
    messageTemplate?: string,
): Promise<InboxFollowup | null> {
    const { data } = await supabase
        .from('inbox_followups')
        .insert({
            brand_id:         brandId,
            conversation_id:  conversationId,
            followup_type:    type,
            due_at:           dueAt.toISOString(),
            message_template: messageTemplate ?? null,
            status:           'pending',
        })
        .select()
        .single();

    if (!data) return null;
    return {
        id:              data.id,
        dueAt:           new Date(data.due_at),
        type:            data.followup_type,
        status:          data.status,
        messageTemplate: data.message_template ?? undefined,
    };
}

export async function completeFollowup(brandId: string, followupId: string): Promise<void> {
    await supabase
        .from('inbox_followups')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', followupId)
        .eq('brand_id', brandId);
}
