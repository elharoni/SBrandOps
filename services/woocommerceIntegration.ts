/**
 * WooCommerce Integration
 * Connects via Consumer Key / Secret (Basic Auth over HTTPS).
 * Handles: initial full sync, incremental sync, webhook processing.
 * All data is normalized into CRM tables (crm_customers, crm_orders, crm_order_items).
 */

import { supabase } from './supabaseClient';
import {
    createCustomer,
    createStoreConnection,
    updateSyncStatus,
} from './crmService';
import {
    CrmStoreProvider,
    CrmCustomer,
    CrmOrder,
    CrmOrderStatus,
    CrmPaymentStatus,
    CrmShippingStatus,
    CrmLifecycleStage,
    CrmStoreConnection,
} from '../types';

// ── WooCommerce REST API types ─────────────────────────────────────────────────

interface WooCustomer {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    username: string;
    avatar_url?: string;
    date_created: string;
    date_modified: string;
    billing: WooAddress;
    shipping: WooAddress;
    is_paying_customer: boolean;
    orders_count: number;
    total_spent: string;
    meta_data: { key: string; value: string }[];
}

interface WooAddress {
    first_name?: string;
    last_name?: string;
    company?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    email?: string;
    phone?: string;
}

interface WooOrder {
    id: number;
    number: string;
    status: string;
    date_created: string;
    date_paid?: string;
    date_completed?: string;
    currency: string;
    total: string;
    subtotal: string;
    total_discount: string;
    shipping_total: string;
    total_tax: string;
    customer_id: number;
    customer_note: string;
    payment_method: string;
    payment_method_title: string;
    billing: WooAddress;
    shipping: WooAddress;
    line_items: WooLineItem[];
    coupon_lines: { code: string }[];
    refunds: { total: string }[];
}

interface WooLineItem {
    id: number;
    product_id: number;
    name: string;
    sku: string;
    quantity: number;
    price: number;
    subtotal: string;
    total: string;
    image?: { src: string };
}

// ── API client ────────────────────────────────────────────────────────────────

function buildAuthHeader(consumerKey: string, consumerSecret: string): string {
    const credentials = btoa(`${consumerKey}:${consumerSecret}`);
    return `Basic ${credentials}`;
}

async function wooFetch<T>(
    storeUrl: string,
    endpoint: string,
    consumerKey: string,
    consumerSecret: string,
    params: Record<string, string | number> = {}
): Promise<T> {
    const base = storeUrl.replace(/\/$/, '');
    const url = new URL(`${base}/wp-json/wc/v3/${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const response = await fetch(url.toString(), {
        headers: {
            'Authorization': buildAuthHeader(consumerKey, consumerSecret),
            'Content-Type':  'application/json',
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`WooCommerce API ${response.status}: ${text}`);
    }
    return response.json() as Promise<T>;
}

// ── Status mappers ────────────────────────────────────────────────────────────

function mapWooOrderStatus(wooStatus: string): CrmOrderStatus {
    const map: Record<string, CrmOrderStatus> = {
        'pending':    CrmOrderStatus.Pending,
        'processing': CrmOrderStatus.Processing,
        'on-hold':    CrmOrderStatus.OnHold,
        'completed':  CrmOrderStatus.Completed,
        'cancelled':  CrmOrderStatus.Cancelled,
        'refunded':   CrmOrderStatus.Refunded,
        'failed':     CrmOrderStatus.Failed,
    };
    return map[wooStatus] ?? CrmOrderStatus.Pending;
}

function mapWooPaymentStatus(wooOrder: WooOrder): CrmPaymentStatus {
    if (wooOrder.status === 'refunded') return CrmPaymentStatus.Refunded;
    if (wooOrder.date_paid)             return CrmPaymentStatus.Paid;
    if (wooOrder.status === 'failed')   return CrmPaymentStatus.Failed;
    return CrmPaymentStatus.Pending;
}

function mapWooShippingStatus(wooOrder: WooOrder): CrmShippingStatus {
    if (wooOrder.status === 'completed') return CrmShippingStatus.Delivered;
    if (wooOrder.status === 'processing') return CrmShippingStatus.Processing;
    if (wooOrder.status === 'refunded')   return CrmShippingStatus.Returned;
    return CrmShippingStatus.Pending;
}

// ── Customer normalization ────────────────────────────────────────────────────

function normalizeWooCustomer(woo: WooCustomer, brandId: string): Partial<CrmCustomer> {
    const totalSpent = parseFloat(woo.total_spent ?? '0');
    return {
        brandId,
        externalId:         String(woo.id),
        firstName:          woo.first_name,
        lastName:           woo.last_name,
        email:              woo.email,
        phone:              woo.billing?.phone,
        avatarUrl:          woo.avatar_url,
        lifecycleStage:     woo.orders_count === 0 ? CrmLifecycleStage.Lead
                          : woo.orders_count === 1 ? CrmLifecycleStage.FirstPurchase
                          : totalSpent > 10000     ? CrmLifecycleStage.VIP
                          : CrmLifecycleStage.Active,
        totalOrders:        woo.orders_count,
        totalSpent,
        averageOrderValue:  woo.orders_count > 0 ? totalSpent / woo.orders_count : 0,
        ltv:                totalSpent,
        acquisitionSource:  'woocommerce',
    };
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertCustomerIdentity(
    brandId: string,
    customerId: string,
    wooId: number,
    storeUrl: string,
    rawData: Record<string, unknown>
): Promise<void> {
    await supabase
        .from('crm_customer_identities')
        .upsert([{
            brand_id:    brandId,
            customer_id: customerId,
            provider:    CrmStoreProvider.WooCommerce,
            provider_id: String(wooId),
            store_url:   storeUrl,
            raw_data:    rawData,
            synced_at:   new Date().toISOString(),
        }], { onConflict: 'brand_id,provider,provider_id' });
}

async function findOrCreateCustomer(brandId: string, wooCustomer: WooCustomer, storeUrl: string): Promise<string | null> {
    // 1. Check by identity
    const { data: existingIdentity } = await supabase
        .from('crm_customer_identities')
        .select('customer_id')
        .eq('brand_id', brandId)
        .eq('provider', CrmStoreProvider.WooCommerce)
        .eq('provider_id', String(wooCustomer.id))
        .single();
    if (existingIdentity) return existingIdentity.customer_id;

    // 2. Check by email (identity resolution)
    if (wooCustomer.email) {
        const { data: emailMatch } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('brand_id', brandId)
            .eq('email', wooCustomer.email)
            .single();
        if (emailMatch) {
            await upsertCustomerIdentity(brandId, emailMatch.id, wooCustomer.id, storeUrl, wooCustomer as unknown as Record<string, unknown>);
            return emailMatch.id;
        }
    }

    // 3. Create new
    const created = await createCustomer(brandId, normalizeWooCustomer(wooCustomer, brandId));
    if (!created) return null;
    await upsertCustomerIdentity(brandId, created.id, wooCustomer.id, storeUrl, wooCustomer as unknown as Record<string, unknown>);
    return created.id;
}

async function upsertOrder(
    brandId: string,
    customerId: string | null,
    wooOrder: WooOrder,
    storeUrl: string
): Promise<void> {
    const refundTotal = wooOrder.refunds.reduce((s, r) => s + Math.abs(parseFloat(r.total)), 0);
    const orderData = {
        brand_id:         brandId,
        customer_id:      customerId,
        external_id:      wooOrder.number,
        store_source:     CrmStoreProvider.WooCommerce,
        store_url:        storeUrl,
        status:           mapWooOrderStatus(wooOrder.status),
        payment_status:   mapWooPaymentStatus(wooOrder),
        shipping_status:  mapWooShippingStatus(wooOrder),
        currency:         wooOrder.currency,
        subtotal:         parseFloat(wooOrder.subtotal ?? '0'),
        discount_total:   parseFloat(wooOrder.total_discount ?? '0'),
        shipping_total:   parseFloat(wooOrder.shipping_total ?? '0'),
        tax_total:        parseFloat(wooOrder.total_tax ?? '0'),
        total:            parseFloat(wooOrder.total),
        refund_total:     refundTotal,
        payment_method:   wooOrder.payment_method_title || wooOrder.payment_method,
        coupon_codes:     wooOrder.coupon_lines.map(c => c.code),
        notes:            wooOrder.customer_note,
        shipping_address: wooOrder.shipping,
        billing_address:  wooOrder.billing,
        order_date:       wooOrder.date_created,
        paid_at:          wooOrder.date_paid ?? null,
        fulfilled_at:     wooOrder.date_completed ?? null,
        updated_at:       new Date().toISOString(),
    };

    const { data: existing } = await supabase
        .from('crm_orders')
        .select('id')
        .eq('brand_id', brandId)
        .eq('store_source', CrmStoreProvider.WooCommerce)
        .eq('external_id', wooOrder.number)
        .single();

    let orderId: string;
    if (existing) {
        await supabase.from('crm_orders').update(orderData).eq('id', existing.id);
        orderId = existing.id;
    } else {
        const { data: inserted } = await supabase.from('crm_orders').insert([orderData]).select('id').single();
        if (!inserted) return;
        orderId = inserted.id;
    }

    // Upsert line items
    if (wooOrder.line_items.length > 0) {
        await supabase.from('crm_order_items').delete().eq('order_id', orderId);
        await supabase.from('crm_order_items').insert(
            wooOrder.line_items.map(item => ({
                brand_id:     brandId,
                order_id:     orderId,
                product_id:   String(item.product_id),
                product_name: item.name,
                sku:          item.sku,
                quantity:     item.quantity,
                unit_price:   item.price,
                subtotal:     parseFloat(item.subtotal),
                discount:     0,
                total:        parseFloat(item.total),
                image_url:    item.image?.src,
            }))
        );
    }
}

// ── Full Sync ──────────────────────────────────────────────────────────────────

export async function runWooFullSync(
    brandId: string,
    connectionId: string,
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string
): Promise<{ customersProcessed: number; ordersProcessed: number; errors: string[] }> {
    const errors: string[] = [];
    let customersProcessed = 0;
    let ordersProcessed = 0;

    await updateSyncStatus(connectionId, 'running');

    try {
        // ── Sync Customers ────────────────────────────────────────────────────
        let page = 1;
        while (true) {
            const customers = await wooFetch<WooCustomer[]>(
                storeUrl, 'customers', consumerKey, consumerSecret,
                { per_page: 100, page, orderby: 'id', order: 'asc' }
            );
            if (customers.length === 0) break;
            for (const wooCustomer of customers) {
                try {
                    await findOrCreateCustomer(brandId, wooCustomer, storeUrl);
                    customersProcessed++;
                } catch (e) {
                    errors.push(`Customer ${wooCustomer.id}: ${String(e)}`);
                }
            }
            if (customers.length < 100) break;
            page++;
        }

        // ── Sync Orders ───────────────────────────────────────────────────────
        page = 1;
        while (true) {
            const orders = await wooFetch<WooOrder[]>(
                storeUrl, 'orders', consumerKey, consumerSecret,
                { per_page: 100, page, orderby: 'id', order: 'asc' }
            );
            if (orders.length === 0) break;
            for (const wooOrder of orders) {
                try {
                    let customerId: string | null = null;
                    if (wooOrder.customer_id > 0) {
                        // Find linked customer
                        const { data: identity } = await supabase
                            .from('crm_customer_identities')
                            .select('customer_id')
                            .eq('brand_id', brandId)
                            .eq('provider', CrmStoreProvider.WooCommerce)
                            .eq('provider_id', String(wooOrder.customer_id))
                            .single();
                        customerId = identity?.customer_id ?? null;
                    }
                    await upsertOrder(brandId, customerId, wooOrder, storeUrl);
                    ordersProcessed++;
                } catch (e) {
                    errors.push(`Order ${wooOrder.number}: ${String(e)}`);
                }
            }
            if (orders.length < 100) break;
            page++;
        }

        // Update connection stats
        await supabase
            .from('crm_store_connections')
            .update({
                customers_synced: customersProcessed,
                orders_synced:    ordersProcessed,
                last_sync_at:     new Date().toISOString(),
                sync_status:      errors.length === 0 ? 'success' : 'error',
                sync_error:       errors.length > 0 ? errors[0] : null,
                updated_at:       new Date().toISOString(),
            })
            .eq('id', connectionId);

        return { customersProcessed, ordersProcessed, errors };
    } catch (err) {
        const msg = String(err);
        await updateSyncStatus(connectionId, 'error', msg);
        return { customersProcessed, ordersProcessed, errors: [msg, ...errors] };
    }
}

// ── Incremental Sync ──────────────────────────────────────────────────────────

export async function runWooIncrementalSync(
    brandId: string,
    connectionId: string,
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    since: Date
): Promise<void> {
    await updateSyncStatus(connectionId, 'running');
    try {
        const sinceStr = since.toISOString();
        const newCustomers = await wooFetch<WooCustomer[]>(
            storeUrl, 'customers', consumerKey, consumerSecret,
            { per_page: 100, page: 1, after: sinceStr }
        );
        for (const c of newCustomers) {
            await findOrCreateCustomer(brandId, c, storeUrl);
        }
        const updatedOrders = await wooFetch<WooOrder[]>(
            storeUrl, 'orders', consumerKey, consumerSecret,
            { per_page: 100, page: 1, modified_after: sinceStr }
        );
        for (const o of updatedOrders) {
            const { data: identity } = await supabase
                .from('crm_customer_identities')
                .select('customer_id')
                .eq('brand_id', brandId)
                .eq('provider', CrmStoreProvider.WooCommerce)
                .eq('provider_id', String(o.customer_id))
                .single();
            await upsertOrder(brandId, identity?.customer_id ?? null, o, storeUrl);
        }
        await updateSyncStatus(connectionId, 'success');
    } catch (err) {
        await updateSyncStatus(connectionId, 'error', String(err));
    }
}

// ── Webhook Handler ───────────────────────────────────────────────────────────

export interface WooWebhookEvent {
    topic: string;
    payload: Record<string, unknown>;
    brandId: string;
    connectionId: string;
    storeUrl: string;
}

export async function handleWooWebhook(event: WooWebhookEvent): Promise<void> {
    // Log raw event
    await supabase.from('crm_webhook_events').insert([{
        brand_id:      event.brandId,
        connection_id: event.connectionId,
        provider:      CrmStoreProvider.WooCommerce,
        event_type:    event.topic,
        payload:       event.payload,
    }]);

    const { topic, payload, brandId, storeUrl } = event;

    if (topic === 'customer.created' || topic === 'customer.updated') {
        const wooCustomer = payload as unknown as WooCustomer;
        await findOrCreateCustomer(brandId, wooCustomer, storeUrl);

    } else if (topic === 'order.created' || topic === 'order.updated') {
        const wooOrder = payload as unknown as WooOrder;
        const { data: identity } = await supabase
            .from('crm_customer_identities')
            .select('customer_id')
            .eq('brand_id', brandId)
            .eq('provider', CrmStoreProvider.WooCommerce)
            .eq('provider_id', String(wooOrder.customer_id))
            .single();
        await upsertOrder(brandId, identity?.customer_id ?? null, wooOrder, storeUrl);

    } else if (topic === 'refund.created') {
        const refundPayload = payload as { order_id?: number };
        if (refundPayload.order_id) {
            await supabase
                .from('crm_orders')
                .update({ status: CrmOrderStatus.Refunded, payment_status: CrmPaymentStatus.Refunded, updated_at: new Date().toISOString() })
                .eq('brand_id', brandId)
                .eq('store_source', CrmStoreProvider.WooCommerce)
                .eq('external_id', String(refundPayload.order_id));
        }
    }

    // Mark as processed
    await supabase
        .from('crm_webhook_events')
        .update({ processed: true, processed_at: new Date().toISOString() })
        .eq('brand_id', brandId)
        .eq('event_type', topic)
        .eq('processed', false)
        .order('created_at', { ascending: false })
        .limit(1);
}

// ── Connection factory ─────────────────────────────────────────────────────────

export async function connectWooCommerce(
    brandId: string,
    storeUrl: string,
    consumerKey: string,
    consumerSecret: string,
    storeName?: string
): Promise<CrmStoreConnection | null> {
    // Verify credentials by hitting /wp-json/wc/v3/system_status
    try {
        await wooFetch(storeUrl, 'system_status', consumerKey, consumerSecret);
    } catch {
        throw new Error('Invalid WooCommerce credentials or store URL');
    }
    return createStoreConnection(brandId, CrmStoreProvider.WooCommerce, storeUrl, {
        consumerKey, consumerSecret, storeName,
    });
}

// Re-export for convenience
export type { WooCustomer, WooOrder };
