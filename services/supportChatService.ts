import { supabase } from './supabaseClient';
import {
    SupportChatSession,
    SupportChatMessage,
    SupportTicket,
    SupportTicketReply,
    SupportTicketStatus,
    SupportTicketPriority,
    SupportTicketCategory,
    SupportSenderType,
} from '../types';

// ── Row → Domain mappers ───────────────────────────────────────────────────────

function rowToSession(r: Record<string, unknown>): SupportChatSession {
    return {
        id:        r.id as string,
        userId:    r.user_id as string,
        brandId:   r.brand_id as string | undefined,
        language:  (r.language as 'ar' | 'en') ?? 'ar',
        status:    r.status as SupportChatSession['status'],
        title:     r.title as string | undefined,
        createdAt: r.created_at as string,
        updatedAt: r.updated_at as string,
    };
}

function rowToMessage(r: Record<string, unknown>): SupportChatMessage {
    return {
        id:         r.id as string,
        sessionId:  r.session_id as string,
        senderType: r.sender_type as SupportSenderType,
        senderId:   r.sender_id as string | undefined,
        content:    r.content as string,
        metadata:   r.metadata as SupportChatMessage['metadata'],
        createdAt:  r.created_at as string,
    };
}

function rowToTicket(r: Record<string, unknown>): SupportTicket {
    return {
        id:           r.id as string,
        ticketNumber: r.ticket_number as number,
        sessionId:    r.session_id as string | undefined,
        userId:       r.user_id as string,
        brandId:      r.brand_id as string | undefined,
        title:        r.title as string,
        description:  r.description as string,
        priority:     r.priority as SupportTicketPriority,
        status:       r.status as SupportTicketStatus,
        category:     r.category as SupportTicketCategory,
        language:     (r.language as 'ar' | 'en') ?? 'ar',
        assignedTo:   r.assigned_to as string | undefined,
        resolvedAt:   r.resolved_at as string | undefined,
        createdAt:    r.created_at as string,
        updatedAt:    r.updated_at as string,
    };
}

function rowToReply(r: Record<string, unknown>): SupportTicketReply {
    return {
        id:          r.id as string,
        ticketId:    r.ticket_id as string,
        senderId:    r.sender_id as string,
        senderType:  r.sender_type as SupportTicketReply['senderType'],
        content:     r.content as string,
        isInternal:  Boolean(r.is_internal),
        createdAt:   r.created_at as string,
    };
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export async function createSession(
    userId: string,
    language: 'ar' | 'en',
    brandId?: string,
    title?: string,
): Promise<SupportChatSession | null> {
    const { data, error } = await supabase
        .from('support_chat_sessions')
        .insert({ user_id: userId, brand_id: brandId ?? null, language, title: title ?? null })
        .select()
        .single();
    if (error || !data) return null;
    return rowToSession(data as Record<string, unknown>);
}

export async function getSession(sessionId: string): Promise<SupportChatSession | null> {
    const { data, error } = await supabase
        .from('support_chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
    if (error || !data) return null;
    return rowToSession(data as Record<string, unknown>);
}

export async function updateSessionStatus(
    sessionId: string,
    status: SupportChatSession['status'],
): Promise<void> {
    await supabase
        .from('support_chat_sessions')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
}

export async function getActiveSessionForUser(userId: string): Promise<SupportChatSession | null> {
    const { data, error } = await supabase
        .from('support_chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error || !data) return null;
    return rowToSession(data as Record<string, unknown>);
}

// ── Messages ───────────────────────────────────────────────────────────────────

export async function addMessage(
    sessionId: string,
    senderType: SupportSenderType,
    content: string,
    senderId?: string,
    metadata?: SupportChatMessage['metadata'],
): Promise<SupportChatMessage | null> {
    const { data, error } = await supabase
        .from('support_chat_messages')
        .insert({
            session_id:  sessionId,
            sender_type: senderType,
            sender_id:   senderId ?? null,
            content,
            metadata:    metadata ?? {},
        })
        .select()
        .single();
    if (error || !data) return null;
    return rowToMessage(data as Record<string, unknown>);
}

export async function getMessages(sessionId: string): Promise<SupportChatMessage[]> {
    const { data, error } = await supabase
        .from('support_chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToMessage);
}

// ── Tickets ────────────────────────────────────────────────────────────────────

export async function createTicket(params: {
    sessionId?: string;
    userId: string;
    brandId?: string;
    title: string;
    description: string;
    priority: SupportTicketPriority;
    category: SupportTicketCategory;
    language: 'ar' | 'en';
}): Promise<SupportTicket | null> {
    const { data, error } = await supabase
        .from('support_tickets')
        .insert({
            session_id:  params.sessionId ?? null,
            user_id:     params.userId,
            brand_id:    params.brandId ?? null,
            title:       params.title,
            description: params.description,
            priority:    params.priority,
            category:    params.category,
            language:    params.language,
        })
        .select()
        .single();
    if (error || !data) return null;
    return rowToTicket(data as Record<string, unknown>);
}

export async function getTicketsForUser(userId: string): Promise<SupportTicket[]> {
    const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToTicket);
}

export async function getAllTickets(filters?: {
    status?: SupportTicketStatus;
    priority?: SupportTicketPriority;
    category?: SupportTicketCategory;
}): Promise<SupportTicket[]> {
    let q = supabase.from('support_tickets').select('*');
    if (filters?.status)   q = q.eq('status', filters.status);
    if (filters?.priority) q = q.eq('priority', filters.priority);
    if (filters?.category) q = q.eq('category', filters.category);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToTicket);
}

export async function getTicket(ticketId: string): Promise<SupportTicket | null> {
    const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();
    if (error || !data) return null;
    return rowToTicket(data as Record<string, unknown>);
}

export async function updateTicketStatus(
    ticketId: string,
    status: SupportTicketStatus,
    assignedTo?: string,
): Promise<void> {
    const updates: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
    };
    if (status === 'resolved') updates.resolved_at = new Date().toISOString();
    if (assignedTo !== undefined) updates.assigned_to = assignedTo;
    await supabase.from('support_tickets').update(updates).eq('id', ticketId);
}

// ── Ticket Replies ─────────────────────────────────────────────────────────────

export async function addTicketReply(
    ticketId: string,
    senderId: string,
    senderType: SupportTicketReply['senderType'],
    content: string,
    isInternal = false,
): Promise<SupportTicketReply | null> {
    const { data, error } = await supabase
        .from('support_ticket_replies')
        .insert({
            ticket_id:   ticketId,
            sender_id:   senderId,
            sender_type: senderType,
            content,
            is_internal: isInternal,
        })
        .select()
        .single();
    if (error || !data) return null;

    await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

    return rowToReply(data as Record<string, unknown>);
}

export async function getTicketReplies(
    ticketId: string,
    includeInternal = false,
): Promise<SupportTicketReply[]> {
    let q = supabase
        .from('support_ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId);
    if (!includeInternal) q = q.eq('is_internal', false);
    const { data, error } = await q.order('created_at', { ascending: true });
    if (error || !data) return [];
    return (data as Record<string, unknown>[]).map(rowToReply);
}

// ── Admin Inbox helpers ────────────────────────────────────────────────────────

export async function getOpenTicketsCount(): Promise<number> {
    const { count, error } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open');
    if (error) return 0;
    return count ?? 0;
}
