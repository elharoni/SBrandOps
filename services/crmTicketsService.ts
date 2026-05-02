import { supabase } from './supabaseClient';
import {
    CrmTicket,
    CrmTicketStats,
    CrmTicketFilters,
    CrmTicketStatus,
} from '../types';

function rowToTicket(r: Record<string, unknown>): CrmTicket {
    return {
        id:               r.id as string,
        brandId:          r.brand_id as string,
        customerId:       r.customer_id as string | undefined,
        subject:          r.subject as string,
        description:      r.description as string | undefined,
        status:           r.status as CrmTicketStatus,
        priority:         r.priority as CrmTicket['priority'],
        source:           (r.source as CrmTicket['source']) ?? 'manual',
        assigneeName:     r.assignee_name as string | undefined,
        firstResponseAt:  r.first_response_at as string | undefined,
        resolvedAt:       r.resolved_at as string | undefined,
        tags:             (r.tags as string[]) ?? [],
        createdAt:        r.created_at as string,
        updatedAt:        r.updated_at as string,
    };
}

const EMPTY_STATS: CrmTicketStats = { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0, urgent: 0 };

export async function getTickets(
    brandId: string,
    filters: CrmTicketFilters = {}
): Promise<{ data: CrmTicket[]; total: number }> {
    try {
        const page     = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 25;
        const from     = (page - 1) * pageSize;
        const to       = from + pageSize - 1;

        let q = supabase
            .from('crm_tickets')
            .select('*', { count: 'exact' })
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (filters.status?.length)   q = q.in('status', filters.status);
        if (filters.priority?.length) q = q.in('priority', filters.priority);
        if (filters.search)           q = q.ilike('subject', `%${filters.search}%`);

        const { data, error, count } = await q;
        if (error) { console.error('getTickets:', error); return { data: [], total: 0 }; }
        return {
            data:  (data ?? []).map(r => rowToTicket(r as Record<string, unknown>)),
            total: count ?? 0,
        };
    } catch {
        return { data: [], total: 0 };
    }
}

export async function getTicketStats(brandId: string): Promise<CrmTicketStats> {
    try {
        const { data, error } = await supabase
            .from('crm_tickets')
            .select('status, priority, resolved_at, created_at')
            .eq('brand_id', brandId);

        if (error || !data) return EMPTY_STATS;

        let open = 0, inProgress = 0, resolved = 0, closed = 0, urgent = 0;
        let resMinSum = 0, resCount = 0;

        for (const row of data as Record<string, unknown>[]) {
            const s = row.status as string;
            const p = row.priority as string;
            if (s === 'open')        open++;
            else if (s === 'in_progress') inProgress++;
            else if (s === 'resolved')    resolved++;
            else if (s === 'closed')      closed++;
            if (p === 'urgent') urgent++;

            if (row.resolved_at && row.created_at) {
                const mins = (new Date(row.resolved_at as string).getTime() - new Date(row.created_at as string).getTime()) / 60_000;
                if (mins > 0) { resMinSum += mins; resCount++; }
            }
        }

        return {
            total: data.length,
            open, inProgress, resolved, closed, urgent,
            avgResolutionMinutes: resCount > 0 ? Math.round(resMinSum / resCount) : undefined,
        };
    } catch {
        return EMPTY_STATS;
    }
}

export async function createTicket(
    brandId: string,
    input: {
        subject:       string;
        description?:  string;
        priority?:     string;
        source?:       string;
        customerId?:   string;
        assigneeName?: string;
    }
): Promise<CrmTicket | null> {
    try {
        const { data, error } = await supabase
            .from('crm_tickets')
            .insert([{
                brand_id:      brandId,
                customer_id:   input.customerId   ?? null,
                subject:       input.subject,
                description:   input.description  ?? null,
                priority:      input.priority      ?? 'medium',
                source:        input.source        ?? 'manual',
                assignee_name: input.assigneeName  ?? null,
            }])
            .select()
            .single();
        if (error) { console.error('createTicket:', error); return null; }
        return rowToTicket(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function updateTicketStatus(
    brandId: string,
    ticketId: string,
    status: CrmTicketStatus
): Promise<boolean> {
    try {
        const updates: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };
        if (status === 'resolved' || status === 'closed') {
            updates.resolved_at = new Date().toISOString();
        }
        const { error } = await supabase
            .from('crm_tickets')
            .update(updates)
            .eq('brand_id', brandId)
            .eq('id', ticketId);
        return !error;
    } catch {
        return false;
    }
}
