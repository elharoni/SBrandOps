/**
 * Shopify Integration
 * Connects via Admin API (access token from OAuth or private app).
 * Handles: full sync, incremental sync, webhook processing.
 * Normalizes into CRM tables.
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

// ── Shopify Admin API types ────────────────────────────────────────────────────

interface ShopifyCustomer {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone?: string;
    created_at: string;
    updated_at: string;
    orders_count: number;
    total_spent: string;
    verified_email: boolean;
    tags: string;                       // comma-separated
    note?: string;
    accepts_marketing: boolean;
    accepts_marketing_updated_at?: string;
    sms_marketing_consent?: { state: 'subscribed' | 'unsubscribed' | 'not_subscribed' };
    default_address?: ShopifyAddress;
    addresses?: ShopifyAddress[];
}

interface ShopifyAddress {
    id?: number;
    first_name?: string;
    last_name?: string;
    company?: string;
    address1?: string;
    address2?: string;
    city?: string;
    province?: string;
    zip?: string;
    country?: string;
    phone?: string;
    default?: boolean;
}

interface ShopifyOrder {
    id: number;
    name: string;                      // e.g. "#1001"
    order_number: number;
    created_at: string;
    updated_at: string;
    processed_at?: string;
    closed_at?: string;
    cancelled_at?: string;
    financial_status: string;          // pending, authorized, partially_paid, paid, partially_refunded, refunded, voided
    fulfillment_status?: string;       // null, fulfilled, partial, restocked
    currency: string;
    total_price: string;
    subtotal_price: string;
    total_discounts: string;
    total_shipping_price_set?: { shop_money: { amount: string } };
    total_tax: string;
    customer?: { id: number };
    billing_address?: ShopifyAddress;
    shipping_address?: ShopifyAddress;
    payment_gateway_names: string[];
    discount_codes: { code: string }[];
    refunds: { transactions?: { amount: string }[] }[];
    note?: string;
    tags?: string;
    line_items: ShopifyLineItem[];
}

interface ShopifyLineItem {
    id: number;
    product_id?: number;
    title: string;
    sku?: string;
    variant_title?: string;
    quantity: number;
    price: string;
    total_discount: string;
    image?: { src: string };
    product_type?: string;
}

// ── API client ─────────────────────────────────────────────────────────────────

async function shopifyFetch<T>(
    shopDomain: string,
    endpoint: string,
    accessToken: string,
    params: Record<string, string | number> = {}
): Promise<T> {
    const base = shopDomain.replace(/\/$/, '');
    // Ensure domain has https://
    const origin = base.startsWith('http') ? base : `https://${base}`;
    const url = new URL(`${origin}/admin/api/2024-01/${endpoint}.json`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const response = await fetch(url.toString(), {
        headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type':          'application/json',
        },
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Shopify API ${response.status}: ${text}`);
    }
    const json = (await response.json()) as Record<string, T>;
    // Shopify wraps resources: { "customers": [...] }
    const key = Object.keys(json)[0];
    return json[key];
}

// ── Status mappers ────────────────────────────────────────────────────────────

function mapShopifyOrderStatus(order: ShopifyOrder): CrmOrderStatus {
    if (order.cancelled_at)                         return CrmOrderStatus.Cancelled;
    if (order.financial_status === 'refunded')      return CrmOrderStatus.Refunded;
    if (order.fulfillment_status === 'fulfilled')   return CrmOrderStatus.Completed;
    if (['paid', 'partially_paid'].includes(order.financial_status ?? '')) return CrmOrderStatus.Processing;
    if (order.financial_status === 'pending')       return CrmOrderStatus.Pending;
    return CrmOrderStatus.Pending;
}

function mapShopifyPaymentStatus(financialStatus: string): CrmPaymentStatus {
    const map: Record<string, CrmPaymentStatus> = {
        'pending':            CrmPaymentStatus.Pending,
        'authorized':         CrmPaymentStatus.Pending,
        'partially_paid':     CrmPaymentStatus.Pending,
        'paid':               CrmPaymentStatus.Paid,
        'partially_refunded': CrmPaymentStatus.PartiallyRefunded,
        'refunded':           CrmPaymentStatus.Refunded,
        'voided':             CrmPaymentStatus.Failed,
    };
    return map[financialStatus] ?? CrmPaymentStatus.Pending;
}

function mapShopifyShippingStatus(fulfillmentStatus: string | null | undefined): CrmShippingStatus {
    if (!fulfillmentStatus)                return CrmShippingStatus.Pending;
    if (fulfillmentStatus === 'fulfilled') return CrmShippingStatus.Delivered;
    if (fulfillmentStatus === 'partial')   return CrmShippingStatus.Processing;
    if (fulfillmentStatus === 'restocked') return CrmShippingStatus.Returned;
    return CrmShippingStatus.Pending;
}

// ── Customer normalization ────────────────────────────────────────────────────

function normalizeShopifyCustomer(shopify: ShopifyCustomer, brandId: string): Partial<CrmCustomer> {
    const totalSpent = parseFloat(shopify.total_spent ?? '0');
    const tags = shopify.tags ? shopify.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
    const isVip = tags.some(t => t.toLowerCase() === 'vip') || totalSpent > 10000;
    return {
        brandId,
        externalId:         String(shopify.id),
        firstName:          shopify.first_name,
        lastName:           shopify.last_name,
        email:              shopify.email,
        phone:              shopify.phone ?? shopify.default_address?.phone,
        lifecycleStage:     shopify.orders_count === 0 ? CrmLifecycleStage.Lead
                          : shopify.orders_count === 1 ? CrmLifecycleStage.FirstPurchase
                          : isVip                      ? CrmLifecycleStage.VIP
                          : CrmLifecycleStage.Active,
        totalOrders:        shopify.orders_count,
        totalSpent,
        averageOrderValue:  shopify.orders_count > 0 ? totalSpent / shopify.orders_count : 0,
        ltv:                totalSpent,
        marketingConsent:   shopify.accepts_marketing,
        smsConsent:         shopify.sms_marketing_consent?.state === 'subscribed',
        acquisitionSource:  'shopify',
    };
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertShopifyCustomerIdentity(
    brandId: string,
    customerId: string,
    shopifyId: number,
    shopDomain: string,
    rawData: Record<string, unknown>
): Promise<void> {
    await supabase
        .from('crm_customer_identities')
        .upsert([{
            brand_id:    brandId,
            customer_id: customerId,
            provider:    CrmStoreProvider.Shopify,
            provider_id: String(shopifyId),
            store_url:   shopDomain,
            raw_data:    rawData,
            synced_at:   new Date().toISOString(),
        }], { onConflict: 'brand_id,provider,provider_id' });
}

async function findOrCreateShopifyCustomer(
    brandId: string,
    shopifyCustomer: ShopifyCustomer,
    shopDomain: string
): Promise<string | null> {
    // 1. Check existing identity
    const { data: existingIdentity } = await supabase
        .from('crm_customer_identities')
        .select('customer_id')
        .eq('brand_id', brandId)
        .eq('provider', CrmStoreProvider.Shopify)
        .eq('provider_id', String(shopifyCustomer.id))
        .single();
    if (existingIdentity) return existingIdentity.customer_id;

    // 2. Identity resolution: check email
    if (shopifyCustomer.email) {
        const { data: emailMatch } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('brand_id', brandId)
            .eq('email', shopifyCustomer.email)
            .single();
        if (emailMatch) {
            await upsertShopifyCustomerIdentity(brandId, emailMatch.id, shopifyCustomer.id, shopDomain, shopifyCustomer as unknown as Record<string, unknown>);
            return emailMatch.id;
        }
    }

    // 3. Identity resolution: check phone
    const phone = shopifyCustomer.phone ?? shopifyCustomer.default_address?.phone;
    if (phone) {
        const { data: phoneMatch } = await supabase
            .from('crm_customers')
            .select('id')
            .eq('brand_id', brandId)
            .eq('phone', phone)
            .single();
        if (phoneMatch) {
            await upsertShopifyCustomerIdentity(brandId, phoneMatch.id, shopifyCustomer.id, shopDomain, shopifyCustomer as unknown as Record<string, unknown>);
            return phoneMatch.id;
        }
    }

    // 4. Create new
    const created = await createCustomer(brandId, normalizeShopifyCustomer(shopifyCustomer, brandId));
    if (!created) return null;
    await upsertShopifyCustomerIdentity(brandId, created.id, shopifyCustomer.id, shopDomain, shopifyCustomer as unknown as Record<string, unknown>);
    return created.id;
}

async function upsertShopifyOrder(
    brandId: string,
    customerId: string | null,
    shopifyOrder: ShopifyOrder,
    shopDomain: string
): Promise<void> {
    const refundTotal = shopifyOrder.refunds.reduce((s, r) => {
        return s + (r.transactions?.reduce((ts, t) => ts + parseFloat(t.amount), 0) ?? 0);
    }, 0);
    const shippingTotal = parseFloat(
        shopifyOrder.total_shipping_price_set?.shop_money?.amount ?? '0'
    );

    const orderData = {
        brand_id:        brandId,
        customer_id:     customerId,
        external_id:     shopifyOrder.name,
        store_source:    CrmStoreProvider.Shopify,
        store_url:       shopDomain,
        status:          mapShopifyOrderStatus(shopifyOrder),
        payment_status:  mapShopifyPaymentStatus(shopifyOrder.financial_status),
        shipping_status: mapShopifyShippingStatus(shopifyOrder.fulfillment_status),
        currency:        shopifyOrder.currency,
        subtotal:        parseFloat(shopifyOrder.subtotal_price),
        discount_total:  parseFloat(shopifyOrder.total_discounts),
        shipping_total:  shippingTotal,
        tax_total:       parseFloat(shopifyOrder.total_tax),
        total:           parseFloat(shopifyOrder.total_price),
        refund_total:    refundTotal,
        payment_method:  shopifyOrder.payment_gateway_names.join(', ') || null,
        coupon_codes:    shopifyOrder.discount_codes.map(d => d.code),
        notes:           shopifyOrder.note,
        shipping_address: shopifyOrder.shipping_address,
        billing_address:  shopifyOrder.billing_address,
        order_date:      shopifyOrder.created_at,
        paid_at:         shopifyOrder.processed_at ?? null,
        fulfilled_at:    shopifyOrder.closed_at ?? null,
        cancelled_at:    shopifyOrder.cancelled_at ?? null,
        updated_at:      new Date().toISOString(),
    };

    const { data: existing } = await supabase
        .from('crm_orders')
        .select('id')
        .eq('brand_id', brandId)
        .eq('store_source', CrmStoreProvider.Shopify)
        .eq('external_id', shopifyOrder.name)
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
    if (shopifyOrder.line_items.length > 0) {
        await supabase.from('crm_order_items').delete().eq('order_id', orderId);
        await supabase.from('crm_order_items').insert(
            shopifyOrder.line_items.map(item => ({
                brand_id:     brandId,
                order_id:     orderId,
                product_id:   item.product_id ? String(item.product_id) : null,
                product_name: item.title,
                sku:          item.sku,
                variant_name: item.variant_title,
                quantity:     item.quantity,
                unit_price:   parseFloat(item.price),
                subtotal:     item.quantity * parseFloat(item.price),
                discount:     parseFloat(item.total_discount ?? '0'),
                total:        item.quantity * parseFloat(item.price) - parseFloat(item.total_discount ?? '0'),
                image_url:    item.image?.src,
                category:     item.product_type,
            }))
        );
    }
}

// ── Full Sync ──────────────────────────────────────────────────────────────────

export async function runShopifyFullSync(
    brandId: string,
    connectionId: string,
    shopDomain: string,
    accessToken: string
): Promise<{ customersProcessed: number; ordersProcessed: number; errors: string[] }> {
    const errors: string[] = [];
    let customersProcessed = 0;
    let ordersProcessed = 0;

    await updateSyncStatus(connectionId, 'running');

    try {
        // ── Sync Customers ────────────────────────────────────────────────────
        let sinceId: number | undefined;
        while (true) {
            const params: Record<string, string | number> = { limit: 250, order: 'id asc' };
            if (sinceId) params.since_id = sinceId;
            const customers = await shopifyFetch<ShopifyCustomer[]>(shopDomain, 'customers', accessToken, params);
            if (!Array.isArray(customers) || customers.length === 0) break;
            for (const sc of customers) {
                try {
                    await findOrCreateShopifyCustomer(brandId, sc, shopDomain);
                    customersProcessed++;
                } catch (e) {
                    errors.push(`Customer ${sc.id}: ${String(e)}`);
                }
            }
            if (customers.length < 250) break;
            sinceId = customers[customers.length - 1].id;
        }

        // ── Sync Orders ───────────────────────────────────────────────────────
        sinceId = undefined;
        while (true) {
            const params: Record<string, string | number> = { limit: 250, order: 'id asc', status: 'any' };
            if (sinceId) params.since_id = sinceId;
            const orders = await shopifyFetch<ShopifyOrder[]>(shopDomain, 'orders', accessToken, params);
            if (!Array.isArray(orders) || orders.length === 0) break;
            for (const so of orders) {
                try {
                    let customerId: string | null = null;
                    if (so.customer?.id) {
                        const { data: identity } = await supabase
                            .from('crm_customer_identities')
                            .select('customer_id')
                            .eq('brand_id', brandId)
                            .eq('provider', CrmStoreProvider.Shopify)
                            .eq('provider_id', String(so.customer.id))
                            .single();
                        customerId = identity?.customer_id ?? null;
                    }
                    await upsertShopifyOrder(brandId, customerId, so, shopDomain);
                    ordersProcessed++;
                } catch (e) {
                    errors.push(`Order ${so.name}: ${String(e)}`);
                }
            }
            if (orders.length < 250) break;
            sinceId = orders[orders.length - 1].id;
        }

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

export async function runShopifyIncrementalSync(
    brandId: string,
    connectionId: string,
    shopDomain: string,
    accessToken: string,
    since: Date
): Promise<void> {
    await updateSyncStatus(connectionId, 'running');
    try {
        const sinceStr = since.toISOString();
        const newCustomers = await shopifyFetch<ShopifyCustomer[]>(
            shopDomain, 'customers', accessToken,
            { limit: 250, updated_at_min: sinceStr }
        );
        if (Array.isArray(newCustomers)) {
            for (const c of newCustomers) {
                await findOrCreateShopifyCustomer(brandId, c, shopDomain);
            }
        }
        const updatedOrders = await shopifyFetch<ShopifyOrder[]>(
            shopDomain, 'orders', accessToken,
            { limit: 250, updated_at_min: sinceStr, status: 'any' }
        );
        if (Array.isArray(updatedOrders)) {
            for (const o of updatedOrders) {
                const { data: identity } = await supabase
                    .from('crm_customer_identities')
                    .select('customer_id')
                    .eq('brand_id', brandId)
                    .eq('provider', CrmStoreProvider.Shopify)
                    .eq('provider_id', String(o.customer?.id ?? 0))
                    .single();
                await upsertShopifyOrder(brandId, identity?.customer_id ?? null, o, shopDomain);
            }
        }
        await updateSyncStatus(connectionId, 'success');
    } catch (err) {
        await updateSyncStatus(connectionId, 'error', String(err));
    }
}

// ── Webhook Handler ───────────────────────────────────────────────────────────

export interface ShopifyWebhookEvent {
    topic: string;
    payload: Record<string, unknown>;
    brandId: string;
    connectionId: string;
    shopDomain: string;
}

export async function handleShopifyWebhook(event: ShopifyWebhookEvent): Promise<void> {
    await supabase.from('crm_webhook_events').insert([{
        brand_id:      event.brandId,
        connection_id: event.connectionId,
        provider:      CrmStoreProvider.Shopify,
        event_type:    event.topic,
        payload:       event.payload,
    }]);

    const { topic, payload, brandId, shopDomain } = event;

    if (topic === 'customers/create' || topic === 'customers/update') {
        const sc = payload as unknown as ShopifyCustomer;
        await findOrCreateShopifyCustomer(brandId, sc, shopDomain);

    } else if (topic === 'orders/create' || topic === 'orders/updated') {
        const so = payload as unknown as ShopifyOrder;
        let customerId: string | null = null;
        if (so.customer?.id) {
            const { data: identity } = await supabase
                .from('crm_customer_identities')
                .select('customer_id')
                .eq('brand_id', brandId)
                .eq('provider', CrmStoreProvider.Shopify)
                .eq('provider_id', String(so.customer.id))
                .single();
            customerId = identity?.customer_id ?? null;
        }
        await upsertShopifyOrder(brandId, customerId, so, shopDomain);

    } else if (topic === 'refunds/create') {
        const refundPayload = payload as { order_id?: number };
        if (refundPayload.order_id) {
            // Find the order by any matching external_id that contains the order id
            const { data: orders } = await supabase
                .from('crm_orders')
                .select('id')
                .eq('brand_id', brandId)
                .eq('store_source', CrmStoreProvider.Shopify)
                .ilike('external_id', `%${refundPayload.order_id}%`);
            if (orders?.length) {
                await supabase
                    .from('crm_orders')
                    .update({ payment_status: CrmPaymentStatus.Refunded, updated_at: new Date().toISOString() })
                    .in('id', orders.map(o => o.id));
            }
        }
    }
}

// ── OAuth helpers ─────────────────────────────────────────────────────────────

/** Build OAuth authorization URL (step 1 of Shopify OAuth) */
export function buildShopifyOAuthUrl(
    shopDomain: string,
    apiKey: string,
    redirectUri: string,
    scopes: string[],
    state: string
): string {
    const shop = shopDomain.replace(/\/$/, '').replace(/^https?:\/\//, '');
    const params = new URLSearchParams({
        client_id:    apiKey,
        scope:        scopes.join(','),
        redirect_uri: redirectUri,
        state,
    });
    return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

/** Exchange auth code for access token (step 2 of Shopify OAuth) */
export async function exchangeShopifyCode(
    shopDomain: string,
    apiKey: string,
    apiSecret: string,
    code: string
): Promise<{ accessToken: string; scope: string }> {
    const shop = shopDomain.replace(/\/$/, '').replace(/^https?:\/\//, '');
    const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    });
    if (!response.ok) throw new Error(`Shopify OAuth exchange failed: ${response.status}`);
    const json = await response.json() as { access_token: string; scope: string };
    return { accessToken: json.access_token, scope: json.scope };
}

/** Create connection after OAuth */
export async function connectShopify(
    brandId: string,
    shopDomain: string,
    accessToken: string,
    storeName?: string
): Promise<CrmStoreConnection | null> {
    // Verify by fetching shop info
    try {
        await shopifyFetch(shopDomain, 'shop', accessToken);
    } catch {
        throw new Error('Invalid Shopify access token or shop domain');
    }
    return createStoreConnection(brandId, CrmStoreProvider.Shopify, shopDomain, {
        accessToken, storeName,
    });
}

// Re-export types
export type { ShopifyCustomer, ShopifyOrder };
