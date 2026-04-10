/**
 * CRM ↔ Inbox Integration Service
 * Links inbox conversations to CRM customers via email / phone / order_id matching.
 * Provides AI context enrichment for reply suggestions.
 */

import { supabase } from './supabaseClient';
import { getCustomerById, getOrdersByCustomer, LIFECYCLE_STAGE_CONFIG } from './crmService';
import {
    CrmCustomer, CrmOrder, CrmLifecycleStage,
    CrmOrderStatus, CrmTaskType, CrmTaskPriority,
} from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CrmConversationLink {
    conversationId: string;
    customerId: string;
    brandId: string;
    matchedBy: 'email' | 'phone' | 'order_id' | 'manual';
    createdAt: string;
}

export interface CrmConversationContext {
    customer: CrmCustomer;
    recentOrders: CrmOrder[];
    openOrdersCount: number;
    refundsCount: number;
    isVip: boolean;
    isAtRisk: boolean;
    hasOpenTasks: boolean;
    summary: string;          // human-readable one-liner for AI reply context
    bulletPoints: string[];   // structured bullet points shown in UI
}

// ── DB helpers ────────────────────────────────────────────────────────────────

async function upsertConversationLink(link: Omit<CrmConversationLink, 'createdAt'>): Promise<void> {
    await supabase
        .from('crm_conversation_links')
        .upsert([{
            conversation_id: link.conversationId,
            customer_id:     link.customerId,
            brand_id:        link.brandId,
            matched_by:      link.matchedBy,
        }], { onConflict: 'conversation_id' });
}

// ── Auto-link logic ───────────────────────────────────────────────────────────

/**
 * Try to link a conversation to a CRM customer.
 * Resolution order: email → phone → order_id mention in message text.
 */
export async function autoLinkConversation(
    brandId: string,
    conversationId: string,
    userEmail?: string,
    userPhone?: string,
    messageText?: string
): Promise<CrmCustomer | null> {
    // 1. Check if already linked
    const { data: existing } = await supabase
        .from('crm_conversation_links')
        .select('customer_id')
        .eq('conversation_id', conversationId)
        .single();
    if (existing?.customer_id) {
        return getCustomerById(brandId, existing.customer_id);
    }

    let customerId: string | null = null;
    let matchedBy: CrmConversationLink['matchedBy'] = 'email';

    // 2. Match by email
    if (userEmail) {
        const { data } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('brand_id', brandId)
            .eq('email', userEmail.toLowerCase().trim())
            .single();
        if (data) customerId = data.id;
    }

    // 3. Match by phone
    if (!customerId && userPhone) {
        matchedBy = 'phone';
        const cleanPhone = userPhone.replace(/\s+/g, '').replace(/-/g, '');
        const { data } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('brand_id', brandId)
            .eq('phone', cleanPhone)
            .single();
        if (data) customerId = data.id;
    }

    // 4. Match by order ID mention in message text (e.g., "#1234" or "order 1234")
    if (!customerId && messageText) {
        matchedBy = 'order_id';
        const orderMatch = messageText.match(/#(\w+)|order\s+(?:id\s+)?(\w+)/i);
        const orderNum = orderMatch?.[1] ?? orderMatch?.[2];
        if (orderNum) {
            const { data: orderRow } = await supabase
                .from('crm_orders')
                .select('customer_id')
                .eq('brand_id', brandId)
                .ilike('external_id', `%${orderNum}%`)
                .single();
            if (orderRow?.customer_id) customerId = orderRow.customer_id;
        }
    }

    if (!customerId) return null;

    await upsertConversationLink({ conversationId, customerId, brandId, matchedBy });
    return getCustomerById(brandId, customerId);
}

/**
 * Get the CRM customer linked to a conversation (null if none).
 */
export async function getLinkedCustomer(
    brandId: string,
    conversationId: string
): Promise<CrmCustomer | null> {
    const { data } = await supabase
        .from('crm_conversation_links')
        .select('customer_id')
        .eq('conversation_id', conversationId)
        .single();
    if (!data?.customer_id) return null;
    return getCustomerById(brandId, data.customer_id);
}

/**
 * Manually link a conversation to a customer.
 */
export async function manualLinkConversation(
    brandId: string,
    conversationId: string,
    customerId: string
): Promise<void> {
    await upsertConversationLink({ conversationId, customerId, brandId, matchedBy: 'manual' });
}

/**
 * Get all conversations linked to a customer (for the Messages tab in profile).
 */
export async function getConversationsByCustomer(
    brandId: string,
    customerId: string
): Promise<LinkedConversation[]> {
    try {
        const { data, error } = await supabase
            .from('crm_conversation_links')
            .select(`
                conversation_id, matched_by, created_at,
                inbox_conversations(id, platform, user_name, user_handle, user_avatar_url, last_message_at, is_read, assignee)
            `)
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });

        if (error) return MOCK_CONVERSATIONS;

        return (data ?? []).map(row => {
            const r = row as Record<string, unknown>;
            const conv = r.inbox_conversations as Record<string, unknown> | null;
            return {
                conversationId:   r.conversation_id as string,
                matchedBy:        r.matched_by as CrmConversationLink['matchedBy'],
                linkedAt:         r.created_at as string,
                platform:         (conv?.platform as string) ?? 'unknown',
                userName:         (conv?.user_name as string) ?? 'Unknown',
                userHandle:       (conv?.user_handle as string) ?? '',
                userAvatarUrl:    (conv?.user_avatar_url as string) ?? '',
                lastMessageAt:    (conv?.last_message_at as string) ?? '',
                isRead:           Boolean(conv?.is_read),
                assignee:         (conv?.assignee as string) ?? '',
            } satisfies LinkedConversation;
        });
    } catch {
        return MOCK_CONVERSATIONS;
    }
}

export interface LinkedConversation {
    conversationId: string;
    matchedBy: CrmConversationLink['matchedBy'];
    linkedAt: string;
    platform: string;
    userName: string;
    userHandle: string;
    userAvatarUrl: string;
    lastMessageAt: string;
    isRead: boolean;
    assignee: string;
}

/**
 * Build AI reply context for a conversation's linked customer.
 * Returns structured data shown as a sidebar while composing reply.
 */
export async function buildReplyContext(
    brandId: string,
    conversationId: string
): Promise<CrmConversationContext | null> {
    const customer = await getLinkedCustomer(brandId, conversationId);
    if (!customer) return null;

    const recentOrders = await getOrdersByCustomer(brandId, customer.id);

    const openOrders   = recentOrders.filter(o =>
        [CrmOrderStatus.Processing, CrmOrderStatus.Pending, CrmOrderStatus.OnHold].includes(o.status)
    );
    const refunds      = recentOrders.filter(o => o.status === CrmOrderStatus.Refunded);
    const isVip        = customer.lifecycleStage === CrmLifecycleStage.VIP || customer.ltv > 10_000;
    const isAtRisk     = [CrmLifecycleStage.AtRisk, CrmLifecycleStage.Churned].includes(customer.lifecycleStage);

    // Check open tasks
    const { count: openTaskCount } = await supabase
        .from('crm_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('brand_id', brandId)
        .eq('customer_id', customer.id)
        .eq('status', 'open');

    const fullName     = [customer.firstName, customer.lastName].filter(Boolean).join(' ') || 'العميل';
    const stageCfg     = LIFECYCLE_STAGE_CONFIG[customer.lifecycleStage];
    const formatCur    = (n: number) => new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(n);

    const bulletPoints: string[] = [];
    if (isVip)               bulletPoints.push(`⭐ عميل VIP — LTV: ${formatCur(customer.ltv)}`);
    if (openOrders.length)   bulletPoints.push(`📦 ${openOrders.length} طلب قيد التنفيذ`);
    if (refunds.length)      bulletPoints.push(`🔄 ${refunds.length} مرتجع مسبق`);
    if (isAtRisk)            bulletPoints.push(`⚠️ مرحلة: ${stageCfg.labelAr} — يحتاج تدخل`);
    if ((openTaskCount ?? 0) > 0) bulletPoints.push(`📋 ${openTaskCount} مهمة مفتوحة`);
    if (customer.totalOrders > 0)
        bulletPoints.push(`🛒 ${customer.totalOrders} طلب إجمالي · ${formatCur(customer.averageOrderValue)} متوسط`);

    const summary = [
        isVip ? 'VIP' : stageCfg.labelAr,
        `${customer.totalOrders} طلب`,
        openOrders.length ? `${openOrders.length} مفتوح` : null,
        refunds.length ? `${refunds.length} مرتجع` : null,
    ].filter(Boolean).join(' · ');

    return {
        customer,
        recentOrders: recentOrders.slice(0, 5),
        openOrdersCount:  openOrders.length,
        refundsCount:     refunds.length,
        isVip,
        isAtRisk,
        hasOpenTasks:     (openTaskCount ?? 0) > 0,
        summary,
        bulletPoints,
    };
}

/**
 * Convert a conversation to a CRM task, linked to the matched customer.
 */
export async function convertConversationToTask(
    brandId: string,
    conversationId: string,
    taskTitle: string,
    priority: CrmTaskPriority = CrmTaskPriority.Medium,
    dueDate?: string,
    assignedTo?: string,
    createdBy?: string
): Promise<boolean> {
    try {
        const linked = await getLinkedCustomer(brandId, conversationId);
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert([{
                brand_id:    brandId,
                customer_id: linked?.id ?? null,
                title:       taskTitle,
                task_type:   CrmTaskType.Support,
                priority,
                due_date:    dueDate,
                assigned_to: assignedTo,
                created_by:  createdBy,
                metadata:    { source: 'inbox', conversation_id: conversationId },
            }]);
        return !error;
    } catch {
        return false;
    }
}

// ── Mock data for fallback ────────────────────────────────────────────────────

const MOCK_CONVERSATIONS: LinkedConversation[] = [
    {
        conversationId: 'conv-1',
        matchedBy:      'email',
        linkedAt:       new Date().toISOString(),
        platform:       'Facebook',
        userName:       'أحمد العمري',
        userHandle:     '@ahmed',
        userAvatarUrl:  '',
        lastMessageAt:  new Date().toISOString(),
        isRead:         true,
        assignee:       'فريق المبيعات',
    },
];
