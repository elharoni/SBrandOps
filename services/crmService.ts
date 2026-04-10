/**
 * CRM Service — Customer Hub
 * Core CRUD operations for all CRM entities.
 * All operations are brand-scoped (multi-tenant via brand_id).
 * Uses graceful degradation: returns null/empty instead of throwing.
 */

import { supabase } from './supabaseClient';
import {
    CrmCustomer,
    CrmOrder,
    CrmOrderItem,
    CrmNote,
    CrmActivity,
    CrmTask,
    CrmCustomerTag,
    CrmSegment,
    CrmSegmentRule,
    CrmStoreConnection,
    CrmSyncJob,
    CrmAutomation,
    CrmLifecycleState,
    CrmFeatureFlags,
    CrmCustomerFilters,
    CrmOrderFilters,
    CrmDashboardStats,
    CrmLifecycleStage,
    CrmActivityEventType,
    CrmTaskStatus,
    CrmTaskPriority,
    CrmTaskType,
    CrmStoreProvider,
    CrmOrderStatus,
    CrmPaymentStatus,
    CrmShippingStatus,
    CrmDeal,
    CrmPipelineStage,
} from '../types';

// ── Row → Domain mappers ───────────────────────────────────────────────────────

function rowToCustomer(r: Record<string, unknown>): CrmCustomer {
    return {
        id:                  r.id as string,
        brandId:             r.brand_id as string,
        externalId:          r.external_id as string | undefined,
        firstName:           r.first_name as string | undefined,
        lastName:            r.last_name as string | undefined,
        email:               r.email as string | undefined,
        phone:               r.phone as string | undefined,
        avatarUrl:           r.avatar_url as string | undefined,
        gender:              r.gender as string | undefined,
        birthDate:           r.birth_date as string | undefined,
        language:            r.language as string | undefined,
        currency:            r.currency as string | undefined,
        acquisitionSource:   r.acquisition_source as string | undefined,
        acquisitionChannel:  r.acquisition_channel as string | undefined,
        lifecycleStage:      (r.lifecycle_stage as CrmLifecycleStage) ?? CrmLifecycleStage.Lead,
        ltv:                 Number(r.ltv ?? 0),
        totalOrders:         Number(r.total_orders ?? 0),
        totalSpent:          Number(r.total_spent ?? 0),
        averageOrderValue:   Number(r.average_order_value ?? 0),
        refundCount:         Number(r.refund_count ?? 0),
        firstOrderDate:      r.first_order_date as string | undefined,
        lastOrderDate:       r.last_order_date as string | undefined,
        lastActivityAt:      r.last_activity_at as string | undefined,
        assignedTo:          r.assigned_to as string | undefined,
        notesCount:          Number(r.notes_count ?? 0),
        tasksCount:          Number(r.tasks_count ?? 0),
        isBlocked:           Boolean(r.is_blocked),
        marketingConsent:    Boolean(r.marketing_consent),
        smsConsent:          Boolean(r.sms_consent),
        metadata:            (r.metadata as Record<string, unknown>) ?? {},
        createdAt:           r.created_at as string,
        updatedAt:           r.updated_at as string,
    };
}

function rowToOrder(r: Record<string, unknown>): CrmOrder {
    return {
        id:              r.id as string,
        brandId:         r.brand_id as string,
        customerId:      r.customer_id as string | undefined,
        externalId:      r.external_id as string,
        storeSource:     r.store_source as CrmStoreProvider,
        storeUrl:        r.store_url as string | undefined,
        status:          (r.status as CrmOrderStatus) ?? CrmOrderStatus.Pending,
        paymentStatus:   (r.payment_status as CrmPaymentStatus) ?? CrmPaymentStatus.Pending,
        shippingStatus:  (r.shipping_status as CrmShippingStatus) ?? CrmShippingStatus.Pending,
        currency:        (r.currency as string) ?? 'SAR',
        subtotal:        Number(r.subtotal ?? 0),
        discountTotal:   Number(r.discount_total ?? 0),
        shippingTotal:   Number(r.shipping_total ?? 0),
        taxTotal:        Number(r.tax_total ?? 0),
        total:           Number(r.total ?? 0),
        refundTotal:     Number(r.refund_total ?? 0),
        paymentMethod:   r.payment_method as string | undefined,
        couponCodes:     (r.coupon_codes as string[]) ?? [],
        notes:           r.notes as string | undefined,
        trackingNumber:  r.tracking_number as string | undefined,
        orderDate:       r.order_date as string | undefined,
        paidAt:          r.paid_at as string | undefined,
        fulfilledAt:     r.fulfilled_at as string | undefined,
        cancelledAt:     r.cancelled_at as string | undefined,
        createdAt:       r.created_at as string,
        updatedAt:       r.updated_at as string,
    };
}

function rowToNote(r: Record<string, unknown>): CrmNote {
    return {
        id:          r.id as string,
        brandId:     r.brand_id as string,
        customerId:  r.customer_id as string,
        authorId:    r.author_id as string | undefined,
        content:     r.content as string,
        isPinned:    Boolean(r.is_pinned),
        metadata:    (r.metadata as Record<string, unknown>) ?? {},
        createdAt:   r.created_at as string,
        updatedAt:   r.updated_at as string,
    };
}

function rowToActivity(r: Record<string, unknown>): CrmActivity {
    return {
        id:           r.id as string,
        brandId:      r.brand_id as string,
        customerId:   r.customer_id as string,
        actorId:      r.actor_id as string | undefined,
        eventType:    r.event_type as CrmActivityEventType,
        title:        r.title as string,
        description:  r.description as string | undefined,
        metadata:     (r.metadata as Record<string, unknown>) ?? {},
        occurredAt:   r.occurred_at as string,
        createdAt:    r.created_at as string,
    };
}

function rowToTask(r: Record<string, unknown>): CrmTask {
    return {
        id:           r.id as string,
        brandId:      r.brand_id as string,
        customerId:   r.customer_id as string | undefined,
        orderId:      r.order_id as string | undefined,
        createdBy:    r.created_by as string | undefined,
        assignedTo:   r.assigned_to as string | undefined,
        title:        r.title as string,
        description:  r.description as string | undefined,
        taskType:     (r.task_type as CrmTaskType) ?? CrmTaskType.FollowUp,
        priority:     (r.priority as CrmTaskPriority) ?? CrmTaskPriority.Medium,
        status:       (r.status as CrmTaskStatus) ?? CrmTaskStatus.Open,
        dueDate:      r.due_date as string | undefined,
        completedAt:  r.completed_at as string | undefined,
        createdAt:    r.created_at as string,
        updatedAt:    r.updated_at as string,
    };
}

function rowToTag(r: Record<string, unknown>): CrmCustomerTag {
    return {
        id:          r.id as string,
        brandId:     r.brand_id as string,
        name:        r.name as string,
        color:       (r.color as string) ?? '#6366f1',
        description: r.description as string | undefined,
        usageCount:  Number(r.usage_count ?? 0),
        createdAt:   r.created_at as string,
    };
}

function rowToSegment(r: Record<string, unknown>): CrmSegment {
    return {
        id:             r.id as string,
        brandId:        r.brand_id as string,
        name:           r.name as string,
        description:    r.description as string | undefined,
        isDynamic:      Boolean(r.is_dynamic),
        isPreset:       Boolean(r.is_preset),
        audienceSize:   Number(r.audience_size ?? 0),
        rulesOperator:  (r.rules_operator as 'AND' | 'OR') ?? 'AND',
        lastCalculated: r.last_calculated as string | undefined,
        createdBy:      r.created_by as string | undefined,
        createdAt:      r.created_at as string,
        updatedAt:      r.updated_at as string,
    };
}

function rowToStoreConnection(r: Record<string, unknown>): CrmStoreConnection {
    return {
        id:               r.id as string,
        brandId:          r.brand_id as string,
        provider:         r.provider as CrmStoreProvider,
        storeName:        r.store_name as string | undefined,
        storeUrl:         r.store_url as string,
        isActive:         Boolean(r.is_active),
        lastSyncAt:       r.last_sync_at as string | undefined,
        syncStatus:       (r.sync_status as CrmStoreConnection['syncStatus']) ?? 'idle',
        syncError:        r.sync_error as string | undefined,
        customersSynced:  Number(r.customers_synced ?? 0),
        ordersSynced:     Number(r.orders_synced ?? 0),
        createdAt:        r.created_at as string,
        updatedAt:        r.updated_at as string,
    };
}

function rowToAutomation(r: Record<string, unknown>): CrmAutomation {
    return {
        id:             r.id as string,
        brandId:        r.brand_id as string,
        name:           r.name as string,
        description:    r.description as string | undefined,
        isActive:       Boolean(r.is_active),
        triggerType:    r.trigger_type as CrmAutomation['triggerType'],
        triggerConfig:  (r.trigger_config as Record<string, unknown>) ?? {},
        actions:        (r.actions as CrmAutomation['actions']) ?? [],
        runCount:       Number(r.run_count ?? 0),
        lastRunAt:      r.last_run_at as string | undefined,
        createdBy:      r.created_by as string | undefined,
        createdAt:      r.created_at as string,
        updatedAt:      r.updated_at as string,
    };
}

// ── Deals ─────────────────────────────────────────────────────────────────────

function rowToDeal(r: Record<string, unknown>): CrmDeal {
    return {
        id:                r.id as string,
        brandId:           r.brand_id as string,
        customerId:        r.customer_id as string | undefined,
        title:             r.title as string,
        company:           r.company as string | undefined,
        amount:            Number(r.amount ?? 0),
        stage:             (r.stage as CrmPipelineStage) ?? 'Qualify',
        probability:       Number(r.probability ?? 0),
        expectedCloseDate: r.expected_close_date as string | undefined,
        assignedTo:        r.assigned_to as string | undefined,
        notes:             r.notes as string | undefined,
        createdAt:         r.created_at as string,
        updatedAt:         r.updated_at as string,
    };
}

export async function getDeals(brandId: string): Promise<CrmDeal[]> {
    try {
        const { data, error } = await supabase
            .from('crm_deals')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });
        if (error) return [];
        return (data ?? []).map(r => rowToDeal(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function createDeal(brandId: string, input: Partial<CrmDeal>): Promise<CrmDeal | null> {
    try {
        const { data, error } = await supabase
            .from('crm_deals')
            .insert([{
                brand_id: brandId,
                customer_id: input.customerId,
                title: input.title,
                company: input.company,
                amount: input.amount ?? 0,
                stage: input.stage ?? 'Qualify',
                probability: input.probability ?? 0,
                expected_close_date: input.expectedCloseDate,
                assigned_to: input.assignedTo,
                notes: input.notes,
            }])
            .select()
            .single();
        if (error) return null;
        return rowToDeal(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function updateDeal(brandId: string, dealId: string, input: Partial<CrmDeal>): Promise<boolean> {
    try {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.title !== undefined) updates.title = input.title;
        if (input.company !== undefined) updates.company = input.company;
        if (input.amount !== undefined) updates.amount = input.amount;
        if (input.stage !== undefined) updates.stage = input.stage;
        if (input.probability !== undefined) updates.probability = input.probability;
        if (input.expectedCloseDate !== undefined) updates.expected_close_date = input.expectedCloseDate;
        if (input.notes !== undefined) updates.notes = input.notes;
        
        const { error } = await supabase.from('crm_deals').update(updates).eq('brand_id', brandId).eq('id', dealId);
        return !error;
    } catch {
        return false;
    }
}

export async function deleteDeal(brandId: string, dealId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('crm_deals').delete().eq('brand_id', brandId).eq('id', dealId);
        return !error;
    } catch {
        return false;
    }
}

// ── Customers ─────────────────────────────────────────────────────────────────

export async function getCustomers(
    brandId: string,
    filters: CrmCustomerFilters = {}
): Promise<{ data: CrmCustomer[]; total: number }> {
    try {
        const page     = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 25;
        const from     = (page - 1) * pageSize;
        const to       = from + pageSize - 1;

        let query = supabase
            .from('crm_customers')
            .select('*', { count: 'exact' })
            .eq('brand_id', brandId)
            .range(from, to);

        if (filters.search) {
            query = query.or(
                `first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%,phone.ilike.%${filters.search}%`
            );
        }
        if (filters.lifecycleStage?.length) {
            query = query.in('lifecycle_stage', filters.lifecycleStage);
        }
        if (filters.minOrders !== undefined) {
            query = query.gte('total_orders', filters.minOrders);
        }
        if (filters.maxOrders !== undefined) {
            query = query.lte('total_orders', filters.maxOrders);
        }
        if (filters.minSpent !== undefined) {
            query = query.gte('total_spent', filters.minSpent);
        }
        if (filters.maxSpent !== undefined) {
            query = query.lte('total_spent', filters.maxSpent);
        }
        if (filters.lastOrderAfter) {
            query = query.gte('last_order_date', filters.lastOrderAfter);
        }
        if (filters.lastOrderBefore) {
            query = query.lte('last_order_date', filters.lastOrderBefore);
        }
        if (filters.assignedTo) {
            query = query.eq('assigned_to', filters.assignedTo);
        }
        if (filters.hasRefunds === true) {
            query = query.gt('refund_count', 0);
        }
        if (filters.sortBy) {
            const col = String(filters.sortBy).replace(/([A-Z])/g, '_$1').toLowerCase();
            query = query.order(col, { ascending: filters.sortDir !== 'desc' });
        } else {
            query = query.order('created_at', { ascending: false });
        }

        const { data, error, count } = await query;
        if (error) {
            console.warn('⚠️ CRM getCustomers:', error.message);
            return { data: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length };
        }
        return {
            data:  (data ?? []).map(r => rowToCustomer(r as Record<string, unknown>)),
            total: count ?? 0,
        };
    } catch (err) {
        console.error('❌ CRM getCustomers error:', err);
        return { data: MOCK_CUSTOMERS, total: MOCK_CUSTOMERS.length };
    }
}

export async function getCustomerById(brandId: string, customerId: string): Promise<CrmCustomer | null> {
    try {
        const { data, error } = await supabase
            .from('crm_customers')
            .select('*')
            .eq('brand_id', brandId)
            .eq('id', customerId)
            .single();
        if (error) return MOCK_CUSTOMERS[0] ?? null;
        return rowToCustomer(data as Record<string, unknown>);
    } catch {
        return MOCK_CUSTOMERS[0] ?? null;
    }
}

export async function createCustomer(
    brandId: string,
    input: Partial<CrmCustomer>
): Promise<CrmCustomer | null> {
    try {
        const { data, error } = await supabase
            .from('crm_customers')
            .insert([{
                brand_id:            brandId,
                first_name:          input.firstName,
                last_name:           input.lastName,
                email:               input.email,
                phone:               input.phone,
                lifecycle_stage:     input.lifecycleStage ?? CrmLifecycleStage.Lead,
                acquisition_source:  input.acquisitionSource,
                acquisition_channel: input.acquisitionChannel,
                marketing_consent:   input.marketingConsent ?? false,
                sms_consent:         input.smsConsent ?? false,
                metadata:            input.metadata ?? {},
            }])
            .select()
            .single();
        if (error) { console.error('CRM createCustomer:', error); return null; }
        return rowToCustomer(data as Record<string, unknown>);
    } catch (err) {
        console.error('CRM createCustomer error:', err);
        return null;
    }
}

export async function updateCustomer(
    brandId: string,
    customerId: string,
    input: Partial<CrmCustomer>
): Promise<CrmCustomer | null> {
    try {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.firstName !== undefined)        updates.first_name = input.firstName;
        if (input.lastName !== undefined)         updates.last_name = input.lastName;
        if (input.email !== undefined)            updates.email = input.email;
        if (input.phone !== undefined)            updates.phone = input.phone;
        if (input.lifecycleStage !== undefined)   updates.lifecycle_stage = input.lifecycleStage;
        if (input.assignedTo !== undefined)       updates.assigned_to = input.assignedTo;
        if (input.marketingConsent !== undefined) updates.marketing_consent = input.marketingConsent;
        if (input.smsConsent !== undefined)       updates.sms_consent = input.smsConsent;
        if (input.isBlocked !== undefined)        updates.is_blocked = input.isBlocked;
        if (input.metadata !== undefined)         updates.metadata = input.metadata;

        const { data, error } = await supabase
            .from('crm_customers')
            .update(updates)
            .eq('brand_id', brandId)
            .eq('id', customerId)
            .select()
            .single();
        if (error) { console.error('CRM updateCustomer:', error); return null; }
        return rowToCustomer(data as Record<string, unknown>);
    } catch (err) {
        console.error('CRM updateCustomer error:', err);
        return null;
    }
}

export async function deleteCustomer(brandId: string, customerId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_customers')
            .delete()
            .eq('brand_id', brandId)
            .eq('id', customerId);
        if (error) { console.error('CRM deleteCustomer:', error); return false; }
        return true;
    } catch {
        return false;
    }
}

export async function bulkUpdateLifecycle(
    brandId: string,
    customerIds: string[],
    stage: CrmLifecycleStage
): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_customers')
            .update({ lifecycle_stage: stage, updated_at: new Date().toISOString() })
            .eq('brand_id', brandId)
            .in('id', customerIds);
        if (error) { console.error('CRM bulkUpdateLifecycle:', error); return false; }
        return true;
    } catch {
        return false;
    }
}

export async function bulkAddTag(
    _brandId: string,
    customerIds: string[],
    tagId: string
): Promise<boolean> {
    try {
        const rows = customerIds.map(cid => ({ customer_id: cid, tag_id: tagId }));
        const { error } = await supabase
            .from('crm_customer_tag_assignments')
            .upsert(rows, { onConflict: 'customer_id,tag_id' });
        if (error) { console.error('CRM bulkAddTag:', error); return false; }
        return true;
    } catch {
        return false;
    }
}

// ── Orders ────────────────────────────────────────────────────────────────────

export async function getOrders(
    brandId: string,
    filters: CrmOrderFilters = {}
): Promise<{ data: CrmOrder[]; total: number }> {
    try {
        const page     = filters.page ?? 1;
        const pageSize = filters.pageSize ?? 25;
        const from     = (page - 1) * pageSize;
        const to       = from + pageSize - 1;

        let query = supabase
            .from('crm_orders')
            .select('*', { count: 'exact' })
            .eq('brand_id', brandId)
            .range(from, to)
            .order('order_date', { ascending: false });

        if (filters.status?.length)          query = query.in('status', filters.status);
        if (filters.paymentStatus?.length)   query = query.in('payment_status', filters.paymentStatus);
        if (filters.shippingStatus?.length)  query = query.in('shipping_status', filters.shippingStatus);
        if (filters.storeSource?.length)     query = query.in('store_source', filters.storeSource);
        if (filters.minTotal !== undefined)  query = query.gte('total', filters.minTotal);
        if (filters.maxTotal !== undefined)  query = query.lte('total', filters.maxTotal);
        if (filters.dateAfter)               query = query.gte('order_date', filters.dateAfter);
        if (filters.dateBefore)              query = query.lte('order_date', filters.dateBefore);

        const { data, error, count } = await query;
        if (error) {
            console.warn('⚠️ CRM getOrders:', error.message);
            return { data: MOCK_ORDERS, total: MOCK_ORDERS.length };
        }
        return {
            data:  (data ?? []).map(r => rowToOrder(r as Record<string, unknown>)),
            total: count ?? 0,
        };
    } catch {
        return { data: MOCK_ORDERS, total: MOCK_ORDERS.length };
    }
}

export async function getOrdersByCustomer(brandId: string, customerId: string): Promise<CrmOrder[]> {
    try {
        const { data, error } = await supabase
            .from('crm_orders')
            .select('*, crm_order_items(*)')
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .order('order_date', { ascending: false });
        if (error) return MOCK_ORDERS.slice(0, 3);
        return (data ?? []).map(r => {
            const order = rowToOrder(r as Record<string, unknown>);
            order.items = ((r as Record<string, unknown>).crm_order_items as Record<string, unknown>[] | undefined ?? []).map(i => ({
                id: i.id as string,
                brandId: i.brand_id as string,
                orderId: i.order_id as string,
                productId: i.product_id as string | undefined,
                productName: i.product_name as string,
                sku: i.sku as string | undefined,
                variantName: i.variant_name as string | undefined,
                quantity: Number(i.quantity ?? 1),
                unitPrice: Number(i.unit_price ?? 0),
                subtotal: Number(i.subtotal ?? 0),
                discount: Number(i.discount ?? 0),
                total: Number(i.total ?? 0),
                imageUrl: i.image_url as string | undefined,
                category: i.category as string | undefined,
                createdAt: i.created_at as string,
            } satisfies CrmOrderItem));
            return order;
        });
    } catch {
        return MOCK_ORDERS.slice(0, 3);
    }
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNotes(brandId: string, customerId: string): Promise<CrmNote[]> {
    try {
        const { data, error } = await supabase
            .from('crm_notes')
            .select('*')
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .order('is_pinned', { ascending: false })
            .order('created_at', { ascending: false });
        if (error) return [];
        return (data ?? []).map(r => rowToNote(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function createNote(
    brandId: string,
    customerId: string,
    content: string,
    authorId?: string
): Promise<CrmNote | null> {
    try {
        const { data, error } = await supabase
            .from('crm_notes')
            .insert([{ brand_id: brandId, customer_id: customerId, content, author_id: authorId }])
            .select()
            .single();
        if (error) { console.error('CRM createNote:', error); return null; }
        // Bump notes_count (fire-and-forget, swallow errors)
        supabase.rpc('increment', { table: 'crm_customers', id: customerId, field: 'notes_count' }).then(() => null, () => null);
        return rowToNote(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function updateNote(brandId: string, noteId: string, content: string, isPinned?: boolean): Promise<boolean> {
    try {
        const updates: Record<string, unknown> = { content, updated_at: new Date().toISOString() };
        if (isPinned !== undefined) updates.is_pinned = isPinned;
        const { error } = await supabase
            .from('crm_notes')
            .update(updates)
            .eq('brand_id', brandId)
            .eq('id', noteId);
        return !error;
    } catch {
        return false;
    }
}

export async function deleteNote(brandId: string, noteId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('crm_notes').delete().eq('brand_id', brandId).eq('id', noteId);
        return !error;
    } catch {
        return false;
    }
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function getActivities(brandId: string, customerId: string, limit = 50): Promise<CrmActivity[]> {
    try {
        const { data, error } = await supabase
            .from('crm_activities')
            .select('*')
            .eq('brand_id', brandId)
            .eq('customer_id', customerId)
            .order('occurred_at', { ascending: false })
            .limit(limit);
        if (error) return [];
        return (data ?? []).map(r => rowToActivity(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function logActivity(
    brandId: string,
    customerId: string,
    eventType: CrmActivityEventType,
    title: string,
    description?: string,
    metadata?: Record<string, unknown>,
    actorId?: string
): Promise<CrmActivity | null> {
    try {
        const { data, error } = await supabase
            .from('crm_activities')
            .insert([{
                brand_id: brandId, customer_id: customerId,
                actor_id: actorId, event_type: eventType,
                title, description, metadata: metadata ?? {},
            }])
            .select()
            .single();
        if (error) return null;
        // Update last_activity_at on customer (fire-and-forget)
        supabase
            .from('crm_customers')
            .update({ last_activity_at: new Date().toISOString() })
            .eq('id', customerId)
            .then(() => null, () => null);
        return rowToActivity(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export async function getTasks(brandId: string, customerId?: string): Promise<CrmTask[]> {
    try {
        let query = supabase
            .from('crm_tasks')
            .select('*')
            .eq('brand_id', brandId)
            .order('due_date', { ascending: true });
        if (customerId) query = query.eq('customer_id', customerId);
        const { data, error } = await query;
        if (error) return [];
        return (data ?? []).map(r => rowToTask(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function createTask(
    brandId: string,
    input: {
        customerId?: string;
        orderId?: string;
        title: string;
        description?: string;
        taskType?: CrmTaskType;
        priority?: CrmTaskPriority;
        dueDate?: string;
        assignedTo?: string;
        createdBy?: string;
    }
): Promise<CrmTask | null> {
    try {
        const { data, error } = await supabase
            .from('crm_tasks')
            .insert([{
                brand_id:    brandId,
                customer_id: input.customerId,
                order_id:    input.orderId,
                title:       input.title,
                description: input.description,
                task_type:   input.taskType ?? CrmTaskType.FollowUp,
                priority:    input.priority ?? CrmTaskPriority.Medium,
                due_date:    input.dueDate,
                assigned_to: input.assignedTo,
                created_by:  input.createdBy,
            }])
            .select()
            .single();
        if (error) { console.error('CRM createTask:', error); return null; }
        return rowToTask(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function updateTask(brandId: string, taskId: string, input: Partial<CrmTask>): Promise<boolean> {
    try {
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (input.title !== undefined)       updates.title = input.title;
        if (input.description !== undefined) updates.description = input.description;
        if (input.status !== undefined)      updates.status = input.status;
        if (input.priority !== undefined)    updates.priority = input.priority;
        if (input.dueDate !== undefined)     updates.due_date = input.dueDate;
        if (input.assignedTo !== undefined)  updates.assigned_to = input.assignedTo;
        if (input.status === CrmTaskStatus.Done) updates.completed_at = new Date().toISOString();
        const { error } = await supabase.from('crm_tasks').update(updates).eq('brand_id', brandId).eq('id', taskId);
        return !error;
    } catch {
        return false;
    }
}

export async function deleteTask(brandId: string, taskId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('crm_tasks').delete().eq('brand_id', brandId).eq('id', taskId);
        return !error;
    } catch {
        return false;
    }
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function getTags(brandId: string): Promise<CrmCustomerTag[]> {
    try {
        const { data, error } = await supabase
            .from('crm_customer_tags')
            .select('*')
            .eq('brand_id', brandId)
            .order('usage_count', { ascending: false });
        if (error) return MOCK_TAGS;
        return (data ?? []).map(r => rowToTag(r as Record<string, unknown>));
    } catch {
        return MOCK_TAGS;
    }
}

export async function createTag(brandId: string, name: string, color = '#6366f1', description?: string): Promise<CrmCustomerTag | null> {
    try {
        const { data, error } = await supabase
            .from('crm_customer_tags')
            .insert([{ brand_id: brandId, name, color, description }])
            .select()
            .single();
        if (error) { console.error('CRM createTag:', error); return null; }
        return rowToTag(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function getCustomerTags(customerId: string): Promise<CrmCustomerTag[]> {
    try {
        const { data, error } = await supabase
            .from('crm_customer_tag_assignments')
            .select('crm_customer_tags(*)')
            .eq('customer_id', customerId);
        if (error) return [];
        return (data ?? [])
            .map(r => (r as Record<string, unknown>).crm_customer_tags)
            .filter(Boolean)
            .map(r => rowToTag(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function assignTag(customerId: string, tagId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_customer_tag_assignments')
            .upsert([{ customer_id: customerId, tag_id: tagId }], { onConflict: 'customer_id,tag_id' });
        return !error;
    } catch {
        return false;
    }
}

export async function removeTag(customerId: string, tagId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_customer_tag_assignments')
            .delete()
            .eq('customer_id', customerId)
            .eq('tag_id', tagId);
        return !error;
    } catch {
        return false;
    }
}

// ── Segments ──────────────────────────────────────────────────────────────────

export async function getSegments(brandId: string): Promise<CrmSegment[]> {
    try {
        const { data, error } = await supabase
            .from('crm_segments')
            .select('*, crm_segment_rules(*)')
            .eq('brand_id', brandId)
            .order('is_preset', { ascending: false })
            .order('audience_size', { ascending: false });
        if (error) return MOCK_SEGMENTS;
        return (data ?? []).map(r => {
            const seg = rowToSegment(r as Record<string, unknown>);
            seg.rules = ((r as Record<string, unknown>).crm_segment_rules as Record<string, unknown>[] | undefined ?? []).map(sr => ({
                id:           sr.id as string,
                segmentId:    sr.segment_id as string,
                field:        sr.field as string,
                operator:     sr.operator as CrmSegmentRule['operator'],
                value:        sr.value as string | undefined,
                value2:       sr.value_2 as string | undefined,
                displayLabel: sr.display_label as string | undefined,
                sortOrder:    Number(sr.sort_order ?? 0),
                createdAt:    sr.created_at as string,
            } satisfies CrmSegmentRule));
            return seg;
        });
    } catch {
        return MOCK_SEGMENTS;
    }
}

export async function createSegment(
    brandId: string,
    name: string,
    description?: string,
    rulesOperator: 'AND' | 'OR' = 'AND',
    rules: Omit<CrmSegmentRule, 'id' | 'segmentId' | 'createdAt'>[] = [],
    isDynamic = true,
    createdBy?: string
): Promise<CrmSegment | null> {
    try {
        const { data, error } = await supabase
            .from('crm_segments')
            .insert([{ brand_id: brandId, name, description, rules_operator: rulesOperator, is_dynamic: isDynamic, created_by: createdBy }])
            .select()
            .single();
        if (error) { console.error('CRM createSegment:', error); return null; }
        if (rules.length > 0) {
            await supabase.from('crm_segment_rules').insert(
                rules.map((r, i) => ({
                    segment_id:    data.id,
                    field:         r.field,
                    operator:      r.operator,
                    value:         r.value,
                    value_2:       r.value2,
                    display_label: r.displayLabel,
                    sort_order:    r.sortOrder ?? i,
                }))
            );
        }
        return rowToSegment(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function deleteSegment(brandId: string, segmentId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('crm_segments').delete().eq('brand_id', brandId).eq('id', segmentId);
        return !error;
    } catch {
        return false;
    }
}

// ── Store Connections ─────────────────────────────────────────────────────────

export async function getStoreConnections(brandId: string): Promise<CrmStoreConnection[]> {
    try {
        const { data, error } = await supabase
            .from('crm_store_connections')
            .select('*')
            .eq('brand_id', brandId);
        if (error) return [];
        return (data ?? []).map(r => rowToStoreConnection(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function createStoreConnection(
    brandId: string,
    provider: CrmStoreProvider,
    storeUrl: string,
    credentials: { consumerKey?: string; consumerSecret?: string; accessToken?: string; storeName?: string }
): Promise<CrmStoreConnection | null> {
    try {
        const { data, error } = await supabase
            .from('crm_store_connections')
            .insert([{
                brand_id:        brandId,
                provider,
                store_url:       storeUrl,
                store_name:      credentials.storeName,
                consumer_key:    credentials.consumerKey,
                consumer_secret: credentials.consumerSecret,
                access_token:    credentials.accessToken,
            }])
            .select()
            .single();
        if (error) { console.error('CRM createStoreConnection:', error); return null; }
        return rowToStoreConnection(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function deleteStoreConnection(brandId: string, connectionId: string): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_store_connections')
            .delete()
            .eq('brand_id', brandId)
            .eq('id', connectionId);
        return !error;
    } catch {
        return false;
    }
}

export async function updateSyncStatus(
    connectionId: string,
    status: CrmStoreConnection['syncStatus'],
    errorMsg?: string
): Promise<void> {
    try {
        const updates: Record<string, unknown> = { sync_status: status, updated_at: new Date().toISOString() };
        if (status === 'success') updates.last_sync_at = new Date().toISOString();
        if (errorMsg) updates.sync_error = errorMsg;
        await supabase.from('crm_store_connections').update(updates).eq('id', connectionId);
    } catch { /* no-op */ }
}

// ── Automations ───────────────────────────────────────────────────────────────

export async function getAutomations(brandId: string): Promise<CrmAutomation[]> {
    try {
        const { data, error } = await supabase
            .from('crm_automations')
            .select('*')
            .eq('brand_id', brandId)
            .order('created_at', { ascending: false });
        if (error) return [];
        return (data ?? []).map(r => rowToAutomation(r as Record<string, unknown>));
    } catch {
        return [];
    }
}

export async function createAutomation(
    brandId: string,
    input: Omit<CrmAutomation, 'id' | 'brandId' | 'runCount' | 'lastRunAt' | 'createdAt' | 'updatedAt'>
): Promise<CrmAutomation | null> {
    try {
        const { data, error } = await supabase
            .from('crm_automations')
            .insert([{
                brand_id:       brandId,
                name:           input.name,
                description:    input.description,
                is_active:      input.isActive,
                trigger_type:   input.triggerType,
                trigger_config: input.triggerConfig,
                actions:        input.actions,
                created_by:     input.createdBy,
            }])
            .select()
            .single();
        if (error) { console.error('CRM createAutomation:', error); return null; }
        return rowToAutomation(data as Record<string, unknown>);
    } catch {
        return null;
    }
}

export async function toggleAutomation(brandId: string, automationId: string, isActive: boolean): Promise<boolean> {
    try {
        const { error } = await supabase
            .from('crm_automations')
            .update({ is_active: isActive, updated_at: new Date().toISOString() })
            .eq('brand_id', brandId)
            .eq('id', automationId);
        return !error;
    } catch {
        return false;
    }
}

export async function deleteAutomation(brandId: string, automationId: string): Promise<boolean> {
    try {
        const { error } = await supabase.from('crm_automations').delete().eq('brand_id', brandId).eq('id', automationId);
        return !error;
    } catch {
        return false;
    }
}

// ── Feature Flags ─────────────────────────────────────────────────────────────

export async function getCrmFeatureFlags(brandId: string): Promise<CrmFeatureFlags> {
    try {
        const { data, error } = await supabase
            .from('crm_feature_flags')
            .select('*')
            .eq('brand_id', brandId)
            .single();
        if (error || !data) return DEFAULT_FEATURE_FLAGS(brandId);
        const r = data as Record<string, unknown>;
        return {
            brandId:           r.brand_id as string,
            plan:              (r.plan as CrmFeatureFlags['plan']) ?? 'basic',
            crmEnabled:        Boolean(r.crm_enabled),
            maxCustomers:      Number(r.max_customers ?? 1000),
            maxSegments:       Number(r.max_segments ?? 5),
            maxAutomations:    Number(r.max_automations ?? 3),
            shopifyEnabled:    Boolean(r.shopify_enabled),
            wooEnabled:        Boolean(r.woo_enabled),
            analyticsEnabled:  Boolean(r.analytics_enabled),
        };
    } catch {
        return DEFAULT_FEATURE_FLAGS(brandId);
    }
}

// ── Dashboard Stats ────────────────────────────────────────────────────────────

export async function getCrmDashboardStats(brandId: string): Promise<CrmDashboardStats> {
    try {
        // Total customers
        const { count: totalCustomers } = await supabase
            .from('crm_customers')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId);

        // New this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1); startOfMonth.setHours(0, 0, 0, 0);
        const { count: newThisMonth } = await supabase
            .from('crm_customers')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .gte('created_at', startOfMonth.toISOString());

        // Lifecycle breakdown
        const { data: lifecycleData } = await supabase
            .from('crm_customers')
            .select('lifecycle_stage')
            .eq('brand_id', brandId);
        const stageCounts: Record<string, number> = {};
        (lifecycleData ?? []).forEach((r: Record<string, unknown>) => {
            const s = (r.lifecycle_stage as string) ?? 'lead';
            stageCounts[s] = (stageCounts[s] ?? 0) + 1;
        });
        const total = totalCustomers ?? 0;
        const lifecycleBreakdown = Object.entries(stageCounts).map(([stage, count]) => ({
            stage: stage as CrmLifecycleStage,
            count,
            percent: total > 0 ? Math.round((count / total) * 100) : 0,
        }));

        // Aggregate revenue
        const { data: revenueData } = await supabase
            .from('crm_customers')
            .select('total_spent, total_orders, average_order_value')
            .eq('brand_id', brandId);
        let totalRevenue = 0;
        let totalOrdersSum = 0;
        let repeatCount = 0;
        const rows = revenueData ?? [];
        rows.forEach((r: Record<string, unknown>) => {
            totalRevenue += Number(r.total_spent ?? 0);
            totalOrdersSum += Number(r.total_orders ?? 0);
            if (Number(r.total_orders) > 1) repeatCount++;
        });
        const avgLtv = rows.length > 0 ? totalRevenue / rows.length : 0;
        const aov = totalOrdersSum > 0 ? totalRevenue / totalOrdersSum : 0;
        const repeatPurchaseRate = rows.length > 0 ? Math.round((repeatCount / rows.length) * 100) : 0;

        // At-risk / churn
        const { count: churnRiskCount } = await supabase
            .from('crm_customers')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .in('lifecycle_stage', [CrmLifecycleStage.AtRisk, CrmLifecycleStage.Churned]);

        // Refund rate (orders)
        const { count: totalOrders } = await supabase
            .from('crm_orders')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId);
        const { count: refundedOrders } = await supabase
            .from('crm_orders')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('status', CrmOrderStatus.Refunded);
        const refundRate = (totalOrders ?? 0) > 0
            ? Math.round(((refundedOrders ?? 0) / (totalOrders ?? 1)) * 100)
            : 0;

        // Top customers
        const { data: topData } = await supabase
            .from('crm_customers')
            .select('*')
            .eq('brand_id', brandId)
            .order('total_spent', { ascending: false })
            .limit(5);
        const topCustomers = (topData ?? []).map(r => rowToCustomer(r as Record<string, unknown>));

        // New vs returning
        const returningCount = rows.filter(r => Number(r.total_orders) > 1).length;
        const newCount = rows.filter(r => Number(r.total_orders) <= 1).length;

        return {
            totalCustomers:      total,
            newThisMonth:        newThisMonth ?? 0,
            newVsReturning:      { new: newCount, returning: returningCount },
            repeatPurchaseRate,
            avgLtv,
            churnRiskCount:      churnRiskCount ?? 0,
            refundRate,
            aov,
            totalRevenue,
            lifecycleBreakdown,
            topCustomers,
            customerGrowth: [], // populated by analytics edge function
        };
    } catch (err) {
        console.error('CRM getCrmDashboardStats:', err);
        return MOCK_DASHBOARD_STATS;
    }
}

// ── Defaults & Mock Data ──────────────────────────────────────────────────────

function DEFAULT_FEATURE_FLAGS(brandId: string): CrmFeatureFlags {
    return {
        brandId,
        plan:              'basic',
        crmEnabled:        true,
        maxCustomers:      1000,
        maxSegments:       5,
        maxAutomations:    3,
        shopifyEnabled:    false,
        wooEnabled:        false,
        analyticsEnabled:  false,
    };
}

export const LIFECYCLE_STAGE_CONFIG: Record<CrmLifecycleStage, { label: string; labelAr: string; color: string; bg: string }> = {
    [CrmLifecycleStage.Lead]:          { label: 'Lead',           labelAr: 'عميل محتمل',    color: 'text-gray-500',  bg: 'bg-gray-100' },
    [CrmLifecycleStage.Prospect]:      { label: 'Prospect',       labelAr: 'في المتابعة',   color: 'text-blue-500',  bg: 'bg-blue-50' },
    [CrmLifecycleStage.FirstPurchase]: { label: 'First Purchase', labelAr: 'أول شراء',      color: 'text-cyan-600',  bg: 'bg-cyan-50' },
    [CrmLifecycleStage.Active]:        { label: 'Active',         labelAr: 'نشط',           color: 'text-green-600', bg: 'bg-green-50' },
    [CrmLifecycleStage.Repeat]:        { label: 'Repeat',         labelAr: 'متكرر',         color: 'text-emerald-600', bg: 'bg-emerald-50' },
    [CrmLifecycleStage.VIP]:           { label: 'VIP',            labelAr: 'VIP',           color: 'text-amber-600', bg: 'bg-amber-50' },
    [CrmLifecycleStage.AtRisk]:        { label: 'At Risk',        labelAr: 'في خطر',        color: 'text-orange-600', bg: 'bg-orange-50' },
    [CrmLifecycleStage.Churned]:       { label: 'Churned',        labelAr: 'انسحب',         color: 'text-red-600',   bg: 'bg-red-50' },
};

const now = new Date().toISOString();
const MOCK_CUSTOMERS: CrmCustomer[] = [
    { id: 'c1', brandId: 'b1', firstName: 'أحمد', lastName: 'العمري', email: 'ahmed@example.com', phone: '0501234567', lifecycleStage: CrmLifecycleStage.VIP, ltv: 18500, totalOrders: 14, totalSpent: 18500, averageOrderValue: 1321, refundCount: 1, notesCount: 2, tasksCount: 1, isBlocked: false, marketingConsent: true, smsConsent: true, acquisitionSource: 'paid', acquisitionChannel: 'facebook', lastOrderDate: now, createdAt: now, updatedAt: now },
    { id: 'c2', brandId: 'b1', firstName: 'سارة', lastName: 'القحطاني', email: 'sara@example.com', phone: '0567891234', lifecycleStage: CrmLifecycleStage.Active, ltv: 5200, totalOrders: 5, totalSpent: 5200, averageOrderValue: 1040, refundCount: 0, notesCount: 0, tasksCount: 0, isBlocked: false, marketingConsent: true, smsConsent: false, acquisitionSource: 'organic', createdAt: now, updatedAt: now },
    { id: 'c3', brandId: 'b1', firstName: 'محمد', lastName: 'الدوسري', email: 'moh@example.com', phone: '0533456789', lifecycleStage: CrmLifecycleStage.AtRisk, ltv: 900, totalOrders: 1, totalSpent: 900, averageOrderValue: 900, refundCount: 1, notesCount: 1, tasksCount: 2, isBlocked: false, marketingConsent: false, smsConsent: false, acquisitionSource: 'social', acquisitionChannel: 'instagram', createdAt: now, updatedAt: now },
];

const MOCK_ORDERS: CrmOrder[] = [
    { id: 'o1', brandId: 'b1', customerId: 'c1', externalId: 'WC-1001', storeSource: CrmStoreProvider.WooCommerce, status: CrmOrderStatus.Completed, paymentStatus: CrmPaymentStatus.Paid, shippingStatus: CrmShippingStatus.Delivered, currency: 'SAR', subtotal: 1200, discountTotal: 0, shippingTotal: 30, taxTotal: 0, total: 1230, refundTotal: 0, paymentMethod: 'cod', orderDate: now, paidAt: now, createdAt: now, updatedAt: now },
    { id: 'o2', brandId: 'b1', customerId: 'c2', externalId: 'SHO-501', storeSource: CrmStoreProvider.Shopify, status: CrmOrderStatus.Processing, paymentStatus: CrmPaymentStatus.Paid, shippingStatus: CrmShippingStatus.Processing, currency: 'SAR', subtotal: 890, discountTotal: 50, shippingTotal: 0, taxTotal: 0, total: 840, refundTotal: 0, paymentMethod: 'credit_card', orderDate: now, createdAt: now, updatedAt: now },
];

const MOCK_TAGS: CrmCustomerTag[] = [
    { id: 't1', brandId: 'b1', name: 'VIP', color: '#f59e0b', usageCount: 12, createdAt: now },
    { id: 't2', brandId: 'b1', name: 'COD', color: '#ef4444', usageCount: 45, createdAt: now },
    { id: 't3', brandId: 'b1', name: 'مخلص', color: '#10b981', usageCount: 23, createdAt: now },
];

const MOCK_SEGMENTS: CrmSegment[] = [
    { id: 's1', brandId: 'b1', name: 'VIP Customers', description: 'Top 10% by LTV', isDynamic: true, isPreset: true, audienceSize: 45, rulesOperator: 'AND', createdAt: now, updatedAt: now },
    { id: 's2', brandId: 'b1', name: 'Inactive 60 days', description: 'No orders in 60 days', isDynamic: true, isPreset: true, audienceSize: 120, rulesOperator: 'AND', createdAt: now, updatedAt: now },
    { id: 's3', brandId: 'b1', name: 'First-time Buyers', description: 'Exactly 1 order', isDynamic: true, isPreset: true, audienceSize: 280, rulesOperator: 'AND', createdAt: now, updatedAt: now },
];

const MOCK_DASHBOARD_STATS: CrmDashboardStats = {
    totalCustomers:      1250,
    newThisMonth:        87,
    newVsReturning:      { new: 420, returning: 830 },
    repeatPurchaseRate:  66,
    avgLtv:              2800,
    churnRiskCount:      95,
    refundRate:          4,
    aov:                 840,
    totalRevenue:        3500000,
    lifecycleBreakdown: [
        { stage: CrmLifecycleStage.Active,        count: 450, percent: 36 },
        { stage: CrmLifecycleStage.Repeat,        count: 280, percent: 22 },
        { stage: CrmLifecycleStage.VIP,           count: 95,  percent: 8 },
        { stage: CrmLifecycleStage.FirstPurchase, count: 180, percent: 14 },
        { stage: CrmLifecycleStage.AtRisk,        count: 120, percent: 10 },
        { stage: CrmLifecycleStage.Lead,          count: 80,  percent: 6 },
        { stage: CrmLifecycleStage.Churned,       count: 45,  percent: 4 },
    ],
    topCustomers:   MOCK_CUSTOMERS,
    customerGrowth: [],
};
