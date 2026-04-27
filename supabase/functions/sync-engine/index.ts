/**
 * sync-engine Edge Function
 * محرك المزامنة الموحّد لجميع المنصات
 *
 * Triggered by:
 *  - pg_cron (scheduled)
 *  - manual "Sync Now" button (POST /sync-engine with { brand_id, provider, job_type })
 *  - webhook events (after webhook-events processing)
 *
 * Auth: Bearer <CRON_SECRET> for cron | Supabase JWT for manual trigger
 *
 * job_type values:
 *  - 'social_analytics' : Facebook/Instagram/TikTok/YouTube page insights
 *  - 'ga4'              : Google Analytics 4 data
 *  - 'gsc'              : Google Search Console data
 *  - 'orders'           : Shopify / WooCommerce orders
 *  - 'products'         : Shopify / WooCommerce product catalog
 *
 * Pattern:
 *  1. Create sync_job record with idempotency_key
 *  2. Fetch data from external API (cursor-based pagination)
 *  3. Upsert into analytics_snapshots / products / crm_orders
 *  4. Update sync_job.cursor for next run
 *  5. Log to sync_logs
 *  6. Update sync_job.status = 'completed' | 'failed'
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, options: RequestInit, attempt = 0): Promise<Response> {
    const resp = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    if (resp.status === 429 && attempt < BACKOFF_MS.length) {
        const delay = parseInt(resp.headers.get('Retry-After') ?? '0') * 1000 || BACKOFF_MS[attempt];
        await sleep(delay);
        return fetchWithRetry(url, options, attempt + 1);
    }
    return resp;
}

// ── Job helpers ───────────────────────────────────────────────────────────────

async function createJob(brandId: string, provider: string, jobType: string, triggeredBy: string) {
    const today = new Date().toISOString().slice(0, 10);
    const key   = `${brandId}::${provider}::${jobType}::${today}`;

    const { data, error } = await supabase
        .from('sync_jobs')
        .upsert({
            brand_id:        brandId,
            provider,
            job_type:        jobType,
            status:          'running',
            started_at:      new Date().toISOString(),
            triggered_by:    triggeredBy,
            idempotency_key: key,
        }, { onConflict: 'idempotency_key', ignoreDuplicates: false })
        .select('id')
        .single();

    if (error) throw new Error(`Failed to create sync job: ${error.message}`);
    return data.id as string;
}

async function finishJob(jobId: string, status: 'completed' | 'failed' | 'partial', synced: number, failed: number, cursor: string | null, error?: string) {
    await supabase.from('sync_jobs').update({
        status,
        completed_at:    new Date().toISOString(),
        records_synced:  synced,
        records_failed:  failed,
        cursor,
        error_message:   error ?? null,
        updated_at:      new Date().toISOString(),
    }).eq('id', jobId);
}

async function log(jobId: string, level: 'info' | 'warning' | 'error', message: string, data?: unknown) {
    await supabase.from('sync_logs').insert({
        job_id:  jobId,
        level,
        message,
        data: data ?? null,
    });
}

// ── Fetch token for provider ──────────────────────────────────────────────────

async function getToken(brandId: string, provider: string): Promise<{ access: string; refresh: string | null } | null> {
    const { data } = await supabase
        .from('oauth_tokens')
        .select('access_token_enc, refresh_token_enc')
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data?.access_token_enc) return null;

    const access  = await decryptToken(data.access_token_enc);
    const refresh = data.refresh_token_enc ? await decryptToken(data.refresh_token_enc) : null;
    if (!access) return null;
    return { access, refresh };
}

// ── Social Analytics Sync (Facebook / Instagram) ──────────────────────────────

async function syncSocialAnalytics(brandId: string, jobId: string): Promise<{ synced: number; failed: number }> {
    const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, platform, platform_account_id, platform_user_id')
        .eq('brand_id', brandId)
        .in('platform', ['facebook', 'instagram'])
        .eq('sync_status', 'active');

    if (!accounts || accounts.length === 0) {
        await log(jobId, 'info', 'No active Facebook/Instagram accounts to sync');
        return { synced: 0, failed: 0 };
    }

    let synced = 0;
    let failed = 0;
    const sinceDate = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

    for (const account of accounts) {
        const tokens = await getToken(brandId, account.platform);
        if (!tokens) {
            await log(jobId, 'warning', `No valid token for ${account.platform}:${account.platform_account_id}`);
            failed++;
            continue;
        }

        try {
            const pageId  = account.platform_account_id;
            const metrics = account.platform === 'facebook'
                ? 'page_impressions,page_reach,page_engaged_users,page_fans'
                : 'impressions,reach,total_interactions,follower_count';

            const resp = await fetchWithRetry(
                `https://graph.facebook.com/v23.0/${pageId}/insights?metric=${metrics}&period=day&since=${sinceDate}&access_token=${tokens.access}`,
                {},
            );

            if (!resp.ok) {
                const err = await resp.json();
                await log(jobId, 'error', `Insights API error for ${pageId}`, err);
                failed++;
                continue;
            }

            const result = await resp.json();
            const insightData = result.data ?? [];

            const rows = insightData.flatMap((metric: { name: string; values: { value: number; end_time: string }[] }) =>
                metric.values.map((v: { value: number; end_time: string }) => ({
                    brand_id:    brandId,
                    source:      account.platform,
                    account_id:  account.id,
                    date:        v.end_time.slice(0, 10),
                    metric_name: metric.name,
                    value:       v.value ?? 0,
                    metadata:    { platform_account_id: pageId },
                }))
            );

            if (rows.length > 0) {
                const { error: upsertErr } = await supabase
                    .from('analytics_snapshots')
                    .upsert(rows, { onConflict: 'brand_id,source,account_id,date,metric_name', ignoreDuplicates: false });

                if (upsertErr) {
                    await log(jobId, 'warning', `Upsert partial failure for ${pageId}: ${upsertErr.message}`);
                    failed++;
                } else {
                    synced += rows.length;
                    await log(jobId, 'info', `Synced ${rows.length} metric-days for ${account.platform}:${pageId}`);
                }
            }
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown';
            await log(jobId, 'error', `Exception syncing ${account.platform}:${account.platform_account_id}: ${msg}`);
            failed++;
        }
    }

    return { synced, failed };
}

// ── GA4 Sync ──────────────────────────────────────────────────────────────────

async function syncGA4(brandId: string, jobId: string, cursor: string | null): Promise<{ synced: number; failed: number; nextCursor: string | null }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('id, analytics_property_id, access_token_enc, access_token')
        .eq('brand_id', brandId)
        .eq('provider', 'ga4')
        .eq('status', 'connected')
        .maybeSingle();

    if (!connection?.analytics_property_id) {
        await log(jobId, 'info', 'No GA4 property configured');
        return { synced: 0, failed: 0, nextCursor: null };
    }

    const tokens = await getToken(brandId, 'ga4');
    if (!tokens) {
        await log(jobId, 'warning', 'No valid GA4 token');
        return { synced: 0, failed: 0, nextCursor: null };
    }

    const startDate = cursor ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const endDate   = new Date().toISOString().slice(0, 10);
    const propertyId = connection.analytics_property_id;

    try {
        const resp = await fetchWithRetry(
            `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
            {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${tokens.access}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dimensions:  [{ name: 'date' }],
                    metrics: [
                        { name: 'sessions' },
                        { name: 'totalUsers' },
                        { name: 'screenPageViews' },
                        { name: 'bounceRate' },
                        { name: 'averageSessionDuration' },
                        { name: 'conversions' },
                    ],
                    dateRanges: [{ startDate, endDate }],
                    limit: 366,
                }),
            },
        );

        if (!resp.ok) {
            const err = await resp.text();
            await log(jobId, 'error', `GA4 API error: ${resp.status}`, err);
            return { synced: 0, failed: 1, nextCursor: cursor };
        }

        const result = await resp.json();
        const rows = (result.rows ?? []).map((row: { dimensionValues: { value: string }[]; metricValues: { value: string }[] }) => ({
            brand_id:    brandId,
            source:      'ga4',
            account_id:  null,
            date:        row.dimensionValues[0].value.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
            metric_name: 'daily_summary',
            value:       parseInt(row.metricValues[0].value ?? '0'),
            metadata: {
                sessions:                parseInt(row.metricValues[0].value ?? '0'),
                total_users:             parseInt(row.metricValues[1].value ?? '0'),
                page_views:              parseInt(row.metricValues[2].value ?? '0'),
                bounce_rate:             parseFloat(row.metricValues[3].value ?? '0'),
                avg_session_duration:    parseFloat(row.metricValues[4].value ?? '0'),
                conversions:             parseInt(row.metricValues[5].value ?? '0'),
                property_id:             propertyId,
            },
        }));

        if (rows.length > 0) {
            const { error: upsertErr } = await supabase
                .from('analytics_snapshots')
                .upsert(rows, { onConflict: 'brand_id,source,date,metric_name', ignoreDuplicates: false });
            if (upsertErr) {
                await log(jobId, 'error', `GA4 upsert failed: ${upsertErr.message}`);
                return { synced: 0, failed: rows.length, nextCursor: cursor };
            }
        }

        await log(jobId, 'info', `GA4: synced ${rows.length} days`);
        return { synced: rows.length, failed: 0, nextCursor: endDate };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        await log(jobId, 'error', `GA4 exception: ${msg}`);
        return { synced: 0, failed: 1, nextCursor: cursor };
    }
}

// ── GSC Sync ──────────────────────────────────────────────────────────────────

async function syncGSC(brandId: string, jobId: string, cursor: string | null): Promise<{ synced: number; failed: number; nextCursor: string | null }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('search_console_property_id')
        .eq('brand_id', brandId)
        .eq('provider', 'search_console')
        .eq('status', 'connected')
        .maybeSingle();

    if (!connection?.search_console_property_id) {
        await log(jobId, 'info', 'No Search Console property configured');
        return { synced: 0, failed: 0, nextCursor: null };
    }

    const tokens = await getToken(brandId, 'search_console');
    if (!tokens) {
        await log(jobId, 'warning', 'No valid Search Console token');
        return { synced: 0, failed: 0, nextCursor: null };
    }

    const endDate   = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    const startDate = cursor ?? new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const siteUrl   = connection.search_console_property_id;

    try {
        const resp = await fetchWithRetry(
            `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
            {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${tokens.access}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    dimensions:  ['date'],
                    rowLimit:    500,
                }),
            },
        );

        if (!resp.ok) {
            const err = await resp.text();
            await log(jobId, 'error', `GSC API error: ${resp.status}`, err);
            return { synced: 0, failed: 1, nextCursor: cursor };
        }

        const result = await resp.json();
        const rows = (result.rows ?? []).map((row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => ({
            brand_id:    brandId,
            source:      'gsc',
            account_id:  null,
            date:        row.keys[0],
            metric_name: 'daily_summary',
            value:       row.clicks,
            metadata: {
                clicks:      row.clicks,
                impressions: row.impressions,
                ctr:         row.ctr,
                position:    row.position,
                site_url:    siteUrl,
            },
        }));

        if (rows.length > 0) {
            const { error: upsertErr } = await supabase
                .from('analytics_snapshots')
                .upsert(rows, { onConflict: 'brand_id,source,date,metric_name', ignoreDuplicates: false });
            if (upsertErr) {
                await log(jobId, 'error', `GSC upsert failed: ${upsertErr.message}`);
                return { synced: 0, failed: rows.length, nextCursor: cursor };
            }
        }

        await log(jobId, 'info', `GSC: synced ${rows.length} days`);
        return { synced: rows.length, failed: 0, nextCursor: endDate };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        await log(jobId, 'error', `GSC exception: ${msg}`);
        return { synced: 0, failed: 1, nextCursor: cursor };
    }
}

// ── Shopify Orders Sync ───────────────────────────────────────────────────────

async function syncShopifyOrders(brandId: string, jobId: string, cursor: string | null): Promise<{ synced: number; failed: number; nextCursor: string | null }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('metadata')
        .eq('brand_id', brandId)
        .eq('provider', 'shopify')
        .eq('status', 'connected')
        .maybeSingle();

    const meta = connection?.metadata as Record<string, string> | null;
    if (!meta?.shop_domain) {
        await log(jobId, 'info', 'No Shopify store connected');
        return { synced: 0, failed: 0, nextCursor: null };
    }

    const tokens = await getToken(brandId, 'shopify');
    if (!tokens) {
        await log(jobId, 'warning', 'No valid Shopify token');
        return { synced: 0, failed: 0, nextCursor: null };
    }

    const sinceId    = cursor ?? null;
    const shopDomain = meta.shop_domain;
    const limit      = 250;
    const url        = new URL(`https://${shopDomain}/admin/api/2024-07/orders.json`);
    url.searchParams.set('status', 'any');
    url.searchParams.set('limit', String(limit));
    if (sinceId) url.searchParams.set('since_id', sinceId);

    try {
        const resp = await fetchWithRetry(url.toString(), {
            headers: { 'X-Shopify-Access-Token': tokens.access, 'Content-Type': 'application/json' },
        });

        if (!resp.ok) {
            const err = await resp.text();
            await log(jobId, 'error', `Shopify orders API error: ${resp.status}`, err);
            return { synced: 0, failed: 1, nextCursor: cursor };
        }

        const result = await resp.json();
        const orders: Record<string, unknown>[] = result.orders ?? [];

        let synced = 0;
        let failed = 0;
        let lastId: string | null = null;

        for (const order of orders) {
            const orderId = String(order.id);
            lastId = orderId;

            // Upsert customer
            const email       = order.email as string | null;
            const firstName   = (order.billing_address as Record<string, string> | null)?.first_name ?? '';
            const lastName    = (order.billing_address as Record<string, string> | null)?.last_name ?? '';
            const phone       = (order.billing_address as Record<string, string> | null)?.phone ?? null;
            const totalPrice  = parseFloat(String(order.total_price ?? '0'));

            let customerId: string | null = null;
            if (email || phone) {
                const { data: existingCustomer } = await supabase
                    .from('crm_customers')
                    .select('id, total_orders, total_spent')
                    .eq('brand_id', brandId)
                    .eq('email', email ?? '')
                    .maybeSingle();

                if (existingCustomer) {
                    customerId = existingCustomer.id;
                    await supabase.from('crm_customers').update({
                        total_orders: (existingCustomer.total_orders ?? 0) + 1,
                        total_spent:  (parseFloat(String(existingCustomer.total_spent ?? 0)) + totalPrice),
                        last_order_date: order.created_at,
                        lifecycle_stage: 'customer',
                        updated_at: new Date().toISOString(),
                    }).eq('id', customerId);
                } else {
                    const { data: newCust } = await supabase.from('crm_customers').insert({
                        brand_id:           brandId,
                        external_id:        String(order.customer ? (order.customer as Record<string, unknown>).id ?? '' : ''),
                        first_name:         firstName,
                        last_name:          lastName,
                        email:              email,
                        phone:              phone,
                        acquisition_source: 'shopify',
                        acquisition_channel:'shopify',
                        lifecycle_stage:    'customer',
                        total_orders:       1,
                        total_spent:        totalPrice,
                        first_order_date:   order.created_at,
                        last_order_date:    order.created_at,
                    }).select('id').single();
                    customerId = newCust?.id ?? null;
                }
            }

            // Upsert order
            const { error: orderErr } = await supabase.from('crm_orders').upsert({
                brand_id:          brandId,
                customer_id:       customerId,
                external_id:       orderId,
                source_platform:   'shopify',
                order_number:      String(order.order_number ?? orderId),
                status:            String(order.fulfillment_status ?? 'unfulfilled'),
                payment_status:    String(order.financial_status ?? 'pending'),
                total_amount:      totalPrice,
                subtotal_amount:   parseFloat(String(order.subtotal_price ?? '0')),
                currency:          String(order.currency ?? 'SAR'),
                items_count:       Array.isArray(order.line_items) ? (order.line_items as unknown[]).length : 0,
                metadata: {
                    shopify_order_id: orderId,
                    tags:             order.tags,
                    note:             order.note,
                },
                ordered_at:        String(order.created_at),
            }, { onConflict: 'brand_id,source_platform,external_id', ignoreDuplicates: false });

            if (orderErr) failed++;
            else synced++;
        }

        const nextCursor = orders.length === limit ? lastId : null;
        await log(jobId, 'info', `Shopify orders: synced ${synced}, failed ${failed}`);
        return { synced, failed, nextCursor };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        await log(jobId, 'error', `Shopify orders exception: ${msg}`);
        return { synced: 0, failed: 1, nextCursor: cursor };
    }
}

// ── Products Sync (Shopify) ───────────────────────────────────────────────────

async function syncShopifyProducts(brandId: string, jobId: string, cursor: string | null): Promise<{ synced: number; failed: number; nextCursor: string | null }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('metadata')
        .eq('brand_id', brandId)
        .eq('provider', 'shopify')
        .eq('status', 'connected')
        .maybeSingle();

    const meta = connection?.metadata as Record<string, string> | null;
    if (!meta?.shop_domain) return { synced: 0, failed: 0, nextCursor: null };

    const tokens = await getToken(brandId, 'shopify');
    if (!tokens) return { synced: 0, failed: 0, nextCursor: null };

    const shopDomain = meta.shop_domain;
    const url        = new URL(`https://${shopDomain}/admin/api/2024-07/products.json`);
    url.searchParams.set('limit', '250');
    if (cursor) url.searchParams.set('page_info', cursor);

    try {
        const resp = await fetchWithRetry(url.toString(), {
            headers: { 'X-Shopify-Access-Token': tokens.access },
        });
        if (!resp.ok) return { synced: 0, failed: 1, nextCursor: cursor };

        const result  = await resp.json();
        const shopifyProducts: Record<string, unknown>[] = result.products ?? [];

        const rows = shopifyProducts.map(p => ({
            brand_id:            brandId,
            provider:            'shopify',
            external_product_id: String(p.id),
            title:               String(p.title ?? ''),
            description:         String(p.body_html ?? ''),
            price:               parseFloat(String((p.variants as Record<string, unknown>[] | null)?.[0]?.price ?? '0')),
            sku:                 String((p.variants as Record<string, unknown>[] | null)?.[0]?.sku ?? ''),
            stock_quantity:      parseInt(String((p.variants as Record<string, unknown>[] | null)?.[0]?.inventory_quantity ?? '0')),
            status:              p.status === 'active' ? 'active' : 'archived',
            images:              Array.isArray(p.images) ? (p.images as Record<string, unknown>[]).map(img => String(img.src)) : [],
            tags:                String(p.tags ?? '').split(',').map((t: string) => t.trim()).filter(Boolean),
            synced_at:           new Date().toISOString(),
        }));

        const { error: upsertErr } = await supabase
            .from('products')
            .upsert(rows, { onConflict: 'brand_id,provider,external_product_id', ignoreDuplicates: false });

        // Parse next page cursor from Link header
        const linkHeader = resp.headers.get('Link') ?? '';
        const nextMatch  = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
        const nextCursor = nextMatch ? nextMatch[1] : null;

        await log(jobId, 'info', `Shopify products: synced ${rows.length}${upsertErr ? ` (upsert error: ${upsertErr.message})` : ''}`);
        return { synced: upsertErr ? 0 : rows.length, failed: upsertErr ? rows.length : 0, nextCursor };
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        await log(jobId, 'error', `Shopify products exception: ${msg}`);
        return { synced: 0, failed: 1, nextCursor: cursor };
    }
}

// ── Run all scheduled syncs for a brand ───────────────────────────────────────

async function runBrandSyncs(brandId: string) {
    const jobs = [
        { provider: 'facebook',       jobType: 'social_analytics', fn: () => syncSocialAnalytics(brandId, '') },
        { provider: 'ga4',            jobType: 'ga4',              fn: (cursor: string | null) => syncGA4(brandId, '', cursor) },
        { provider: 'search_console', jobType: 'gsc',              fn: (cursor: string | null) => syncGSC(brandId, '', cursor) },
        { provider: 'shopify',        jobType: 'orders',           fn: (cursor: string | null) => syncShopifyOrders(brandId, '', cursor) },
        { provider: 'shopify',        jobType: 'products',         fn: (cursor: string | null) => syncShopifyProducts(brandId, '', cursor) },
    ] as const;

    for (const { provider, jobType, fn } of jobs) {
        try {
            const jobId = await createJob(brandId, provider, jobType, 'scheduled');

            // Get previous cursor
            const { data: prevJob } = await supabase
                .from('sync_jobs')
                .select('cursor')
                .eq('brand_id', brandId)
                .eq('provider', provider)
                .eq('job_type', jobType)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const cursor = prevJob?.cursor ?? null;
            const result = await (fn as (cursor: string | null) => Promise<{ synced: number; failed: number; nextCursor?: string | null }>)(cursor);
            const status = result.failed > 0 && result.synced === 0 ? 'failed' : result.failed > 0 ? 'partial' : 'completed';
            await finishJob(jobId, status, result.synced, result.failed, (result as { nextCursor?: string | null }).nextCursor ?? null);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'unknown';
            console.error(`Brand ${brandId} sync error for ${provider}/${jobType}: ${msg}`);
        }
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    // Auth: CRON_SECRET for scheduled runs, JWT for manual trigger
    const authHeader  = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
    const cronSecret  = Deno.env.get('CRON_SECRET') ?? '';
    const isCron      = cronSecret && authHeader === cronSecret;

    let brandIds: string[] = [];
    let manualJobType: string | null = null;
    let manualProvider: string | null = null;

    if (isCron) {
        // Run all connected brands
        const { data } = await supabase
            .from('brand_connections')
            .select('brand_id')
            .in('status', ['connected'])
            .in('provider', ['facebook', 'instagram', 'ga4', 'search_console', 'shopify']);
        brandIds = [...new Set((data ?? []).map(r => r.brand_id as string))];
    } else {
        // Manual trigger — verify JWT
        const userOrError = await verifyJWT(req, correlationId, corsHeaders);
        if (userOrError instanceof Response) return userOrError;

        let body: { brand_id: string; provider?: string; job_type?: string };
        try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }

        if (!body.brand_id) return new Response(JSON.stringify({ error: 'brand_id required' }), { status: 400, headers: corsHeaders });

        const ownershipError = await assertBrandOwnership(supabase, userOrError.id, body.brand_id, correlationId, corsHeaders);
        if (ownershipError) return ownershipError;

        brandIds        = [body.brand_id];
        manualProvider  = body.provider ?? null;
        manualJobType   = body.job_type ?? null;
    }

    let totalSynced = 0;
    let totalFailed = 0;

    for (const brandId of brandIds) {
        if (manualProvider && manualJobType) {
            // Single targeted sync
            const jobId = await createJob(brandId, manualProvider, manualJobType, 'manual');
            let result: { synced: number; failed: number; nextCursor?: string | null } = { synced: 0, failed: 0 };

            if (manualJobType === 'social_analytics') result = await syncSocialAnalytics(brandId, jobId);
            else if (manualJobType === 'ga4')          result = await syncGA4(brandId, jobId, null);
            else if (manualJobType === 'gsc')          result = await syncGSC(brandId, jobId, null);
            else if (manualJobType === 'orders')       result = await syncShopifyOrders(brandId, jobId, null);
            else if (manualJobType === 'products')     result = await syncShopifyProducts(brandId, jobId, null);

            const status = result.failed > 0 && result.synced === 0 ? 'failed' : result.failed > 0 ? 'partial' : 'completed';
            await finishJob(jobId, status, result.synced, result.failed, result.nextCursor ?? null);
            totalSynced += result.synced;
            totalFailed += result.failed;
        } else {
            await runBrandSyncs(brandId);
        }
    }

    const summary = { correlationId, brands_processed: brandIds.length, total_synced: totalSynced, total_failed: totalFailed };
    console.log(JSON.stringify({ event: 'sync-engine-complete', ...summary }));

    return new Response(JSON.stringify({ ok: true, ...summary }), {
        status:  200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
});
