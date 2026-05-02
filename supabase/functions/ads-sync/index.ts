/**
 * ads-sync Edge Function
 *
 * Pulls campaign / adset / ad data + insights from Meta Ads and Google Ads,
 * writes to ad_campaigns, ad_adsets, ad_ads, ad_insights.
 * Also parses Meta X-Business-Use-Case-Usage headers and upserts rate_limit_states.
 *
 * Triggers:
 *  - pg_cron daily at 05:00 UTC   → Authorization: Bearer {CRON_SECRET}
 *  - Manual POST by operator      → Authorization: Bearer {supabase_jwt}
 *    Body: { brand_id: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptTokenWithLog } from '../_shared/tokens.ts';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_API_VER = 'v23.0';

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, options: RequestInit = {}, attempt = 0): Promise<Response> {
    const resp = await fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
    if (resp.status === 429 && attempt < 4) {
        const delay = parseInt(resp.headers.get('Retry-After') ?? '0') * 1000 || (attempt + 1) * 4000;
        await sleep(delay);
        return fetchWithRetry(url, options, attempt + 1);
    }
    return resp;
}

// ── Rate-limit header parser ──────────────────────────────────────────────────
// Parses X-Business-Use-Case-Usage and upserts rate_limit_states per bucket.

interface BucketState {
    call_count: number;
    total_cputime: number;
    total_time: number;
    type: string;
    estimated_time_to_regain_access: number;
}

async function updateRateLimitState(resp: Response, adAccountUuid: string): Promise<void> {
    const header = resp.headers.get('X-Business-Use-Case-Usage');
    if (!header || !adAccountUuid) return;

    try {
        const parsed: Record<string, BucketState[]> = JSON.parse(header);
        const rows: Record<string, unknown>[] = [];

        for (const [, buckets] of Object.entries(parsed)) {
            for (const b of buckets) {
                rows.push({
                    ad_account_id:                   adAccountUuid,
                    bucket:                          b.type ?? 'ad_account',
                    call_count_pct:                  b.call_count ?? 0,
                    total_cputime_pct:               b.total_cputime ?? 0,
                    total_time_pct:                  b.total_time ?? 0,
                    type:                            b.type ?? null,
                    estimated_time_to_regain_access: b.estimated_time_to_regain_access ?? null,
                    observed_at:                     new Date().toISOString(),
                });
            }
        }

        if (rows.length > 0) {
            await supabase
                .from('rate_limit_states')
                .upsert(rows, { onConflict: 'ad_account_id,bucket' });
        }
    } catch {
        // Non-blocking — never fail the sync because of rate-limit parse error
    }
}

// ── Token lookup ──────────────────────────────────────────────────────────────

async function getToken(brandId: string, provider: string): Promise<{ token: string; tokenId: string } | null> {
    const { data } = await supabase
        .from('oauth_tokens')
        .select('id, access_token_enc')
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data?.access_token_enc) return null;

    const token = await decryptTokenWithLog(
        data.access_token_enc,
        data.id,
        brandId,
        'ads_sync',
        'ads-sync',
    );

    return token ? { token, tokenId: data.id } : null;
}

// ── Meta Ads Sync ─────────────────────────────────────────────────────────────

async function syncMetaAds(
    brandId: string,
): Promise<{ campaigns: number; adsets: number; ads: number; insights: number; errors: number }> {
    // Read from the new ad_accounts table (replaces brand_connections)
    const { data: adAccount } = await supabase
        .from('ad_accounts')
        .select('id, external_id')
        .eq('brand_id', brandId)
        .eq('provider', 'meta')
        .eq('meta_connected', true)
        .neq('connection_health', 'disconnected')
        .maybeSingle();

    if (!adAccount?.external_id) return { campaigns: 0, adsets: 0, ads: 0, insights: 0, errors: 0 };

    const tokenData = await getToken(brandId, 'meta_ads');
    if (!tokenData) return { campaigns: 0, adsets: 0, ads: 0, insights: 0, errors: 0 };

    const { token, tokenId: _tokenId } = tokenData;
    const adAccountId    = adAccount.external_id.replace(/^act_/, '');
    const adAccountUuid  = adAccount.id;
    const since          = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const until          = new Date().toISOString().slice(0, 10);

    let campaignsCount = 0;
    let adsetsCount    = 0;
    let adsCount       = 0;
    let insightsCount  = 0;
    let errorsCount    = 0;

    // ── 1. Campaigns ──────────────────────────────────────────────────────────
    try {
        const url = `https://graph.facebook.com/${FB_API_VER}/act_${adAccountId}/campaigns`
            + `?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time`
            + `&limit=100&access_token=${encodeURIComponent(token)}`;
        const resp = await fetchWithRetry(url);
        await updateRateLimitState(resp, adAccountUuid);

        if (resp.ok) {
            const { data: campaigns = [] } = await resp.json();

            for (const c of campaigns as Record<string, unknown>[]) {
                const { error } = await supabase.from('ad_campaigns').upsert({
                    brand_id:             brandId,
                    provider:             'meta',
                    external_campaign_id: String(c.id),
                    name:                 String(c.name ?? ''),
                    status:               String(c.status ?? 'unknown').toLowerCase(),
                    objective:            String(c.objective ?? ''),
                    budget_daily:         c.daily_budget    ? parseFloat(String(c.daily_budget))    / 100 : null,
                    budget_lifetime:      c.lifetime_budget ? parseFloat(String(c.lifetime_budget)) / 100 : null,
                    budget_currency:      'USD',
                    start_date:           c.start_time ? String(c.start_time).slice(0, 10) : null,
                    end_date:             c.stop_time  ? String(c.stop_time).slice(0, 10)  : null,
                    ad_account_id:        adAccountId,
                    ad_account_uuid:      adAccountUuid,
                    internal_status:      'live',
                    synced_at:            new Date().toISOString(),
                    updated_at:           new Date().toISOString(),
                }, { onConflict: 'brand_id,provider,external_campaign_id' });

                error ? errorsCount++ : campaignsCount++;
            }
        }
    } catch (e) {
        console.error(`[ads-sync] Meta campaigns error brand=${brandId}`, (e as Error).message);
        errorsCount++;
    }

    // ── 2. Adsets ─────────────────────────────────────────────────────────────
    try {
        const url = `https://graph.facebook.com/${FB_API_VER}/act_${adAccountId}/adsets`
            + `?fields=id,name,campaign_id,status,daily_budget,lifetime_budget,bid_strategy,`
            + `targeting,optimization_goal,billing_event,start_time,end_time`
            + `&limit=200&access_token=${encodeURIComponent(token)}`;
        const resp = await fetchWithRetry(url);
        await updateRateLimitState(resp, adAccountUuid);

        if (resp.ok) {
            const { data: adsets = [] } = await resp.json();

            for (const s of adsets as Record<string, unknown>[]) {
                // Resolve our internal campaign UUID from external campaign ID
                const { data: campRow } = await supabase
                    .from('ad_campaigns')
                    .select('id')
                    .eq('brand_id', brandId)
                    .eq('external_campaign_id', String(s.campaign_id))
                    .maybeSingle();

                if (!campRow?.id) continue;

                const { error } = await supabase.from('ad_adsets').upsert({
                    brand_id:        brandId,
                    campaign_id:     campRow.id,
                    ad_account_uuid: adAccountUuid,
                    external_id:     String(s.id),
                    name:            String(s.name ?? ''),
                    status:          String(s.status ?? 'active').toLowerCase(),
                    internal_status: 'live',
                    daily_budget:    s.daily_budget    ? parseFloat(String(s.daily_budget))    / 100 : null,
                    lifetime_budget: s.lifetime_budget ? parseFloat(String(s.lifetime_budget)) / 100 : null,
                    bid_strategy:    s.bid_strategy    ? String(s.bid_strategy)                      : null,
                    targeting:       typeof s.targeting === 'object' ? s.targeting : {},
                    optimization_goal: s.optimization_goal ? String(s.optimization_goal) : null,
                    billing_event:   s.billing_event   ? String(s.billing_event)                     : null,
                    start_time:      s.start_time      ? String(s.start_time)                        : null,
                    end_time:        s.end_time        ? String(s.end_time)                          : null,
                    synced_at:       new Date().toISOString(),
                    updated_at:      new Date().toISOString(),
                }, { onConflict: 'brand_id,external_id' });

                error ? errorsCount++ : adsetsCount++;
            }
        }
    } catch (e) {
        console.error(`[ads-sync] Meta adsets error brand=${brandId}`, (e as Error).message);
        errorsCount++;
    }

    // ── 3. Ads ────────────────────────────────────────────────────────────────
    try {
        const url = `https://graph.facebook.com/${FB_API_VER}/act_${adAccountId}/ads`
            + `?fields=id,name,adset_id,status,creative`
            + `&limit=300&access_token=${encodeURIComponent(token)}`;
        const resp = await fetchWithRetry(url);
        await updateRateLimitState(resp, adAccountUuid);

        if (resp.ok) {
            const { data: ads = [] } = await resp.json();

            for (const a of ads as Record<string, unknown>[]) {
                // Resolve our internal adset UUID
                const { data: adsetRow } = await supabase
                    .from('ad_adsets')
                    .select('id')
                    .eq('brand_id', brandId)
                    .eq('external_id', String(a.adset_id))
                    .maybeSingle();

                if (!adsetRow?.id) continue;

                const { error } = await supabase.from('ad_ads').upsert({
                    brand_id:        brandId,
                    adset_id:        adsetRow.id,
                    external_id:     String(a.id),
                    name:            String(a.name ?? ''),
                    status:          String(a.status ?? 'active').toLowerCase(),
                    internal_status: 'live',
                    synced_at:       new Date().toISOString(),
                    updated_at:      new Date().toISOString(),
                }, { onConflict: 'brand_id,external_id' });

                error ? errorsCount++ : adsCount++;
            }
        }
    } catch (e) {
        console.error(`[ads-sync] Meta ads error brand=${brandId}`, (e as Error).message);
        errorsCount++;
    }

    // ── 4. Insights — campaign, adset, ad levels ──────────────────────────────
    for (const level of ['campaign', 'adset', 'ad'] as const) {
        try {
            const url = `https://graph.facebook.com/${FB_API_VER}/act_${adAccountId}/insights`
                + `?fields=${level}_id,${level}_name,spend,impressions,clicks,reach,`
                + `actions,action_values,ctr,cpm,cpc,frequency`
                + `&time_increment=1`
                + `&time_range={"since":"${since}","until":"${until}"}`
                + `&level=${level}`
                + `&limit=500`
                + `&access_token=${encodeURIComponent(token)}`;
            const resp = await fetchWithRetry(url);
            await updateRateLimitState(resp, adAccountUuid);

            if (!resp.ok) continue;

            const { data: rows = [] } = await resp.json();

            const insightRows = (rows as Record<string, unknown>[]).map(row => {
                const actions      = (row.actions      as { action_type: string; value: string }[] | null) ?? [];
                const actionValues = (row.action_values as { action_type: string; value: string }[] | null) ?? [];

                const conversions    = actions.find(a => a.action_type === 'purchase')?.value ?? '0';
                const conversionValue = actionValues.find(a => a.action_type === 'purchase')?.value ?? '0';
                const spend          = parseFloat(String(row.spend ?? '0'));
                const convVal        = parseFloat(conversionValue);
                const externalId     = String(row[`${level}_id`] ?? '');
                const impressions    = parseInt(String(row.impressions ?? '0'));

                return {
                    brand_id:           brandId,
                    provider:           'meta',
                    external_object_id: externalId,
                    object_type:        level,
                    date:               String(row.date_start),
                    spend,
                    impressions,
                    clicks:             parseInt(String(row.clicks ?? '0')),
                    reach:              parseInt(String(row.reach ?? '0')),
                    conversions:        parseInt(conversions),
                    conversion_value:   convVal,
                    ctr:                parseFloat(String(row.ctr ?? '0')),
                    cpc:                parseFloat(String(row.cpc ?? '0')),
                    cpm:                parseFloat(String(row.cpm ?? '0')),
                    cpa:                spend > 0 && parseInt(conversions) > 0
                                            ? spend / parseInt(conversions)
                                            : null,
                    roas:               spend > 0 ? convVal / spend : null,
                    extra_metrics: {
                        [`${level}_name`]: row[`${level}_name`],
                        frequency:         row.frequency ?? null,
                        all_actions:       actions,
                    },
                };
            });

            if (insightRows.length > 0) {
                const { error } = await supabase
                    .from('ad_insights')
                    .upsert(insightRows, {
                        onConflict: 'brand_id,provider,external_object_id,object_type,date',
                    });
                if (error) errorsCount++;
                else insightsCount += insightRows.length;
            }
        } catch (e) {
            console.error(`[ads-sync] Meta insights(${level}) error brand=${brandId}`, (e as Error).message);
            errorsCount++;
        }
    }

    return { campaigns: campaignsCount, adsets: adsetsCount, ads: adsCount, insights: insightsCount, errors: errorsCount };
}

// ── Google Ads Sync ───────────────────────────────────────────────────────────

async function syncGoogleAds(
    brandId: string,
): Promise<{ campaigns: number; insights: number; errors: number }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('ad_account_id, metadata')
        .eq('brand_id', brandId)
        .eq('provider', 'google_ads')
        .eq('status', 'connected')
        .maybeSingle();

    const customerId     = connection?.ad_account_id?.replace(/-/g, '');
    const developerToken = Deno.env.get('GOOGLE_DEVELOPER_TOKEN') ?? '';
    if (!customerId || !developerToken) return { campaigns: 0, insights: 0, errors: 0 };

    const tokenData = await getToken(brandId, 'google_ads');
    if (!tokenData) return { campaigns: 0, insights: 0, errors: 0 };

    const { token } = tokenData;
    let campaignsCount = 0;
    let insightsCount  = 0;
    let errorsCount    = 0;

    const headers = {
        'Authorization':     `Bearer ${token}`,
        'developer-token':   developerToken,
        'login-customer-id': customerId,
        'Content-Type':      'application/json',
    };

    try {
        const campQuery = `
            SELECT campaign.id, campaign.name, campaign.status,
                   campaign.advertising_channel_type,
                   campaign.start_date, campaign.end_date,
                   campaign_budget.amount_micros
            FROM campaign
            WHERE campaign.status != 'REMOVED'
            LIMIT 500
        `;

        const campResp = await fetchWithRetry(
            `https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`,
            { method: 'POST', headers, body: JSON.stringify({ query: campQuery }) },
        );

        if (campResp.ok) {
            const { results = [] } = await campResp.json();
            for (const row of results as Record<string, Record<string, string>>[]) {
                const c = row.campaign;
                const b = row.campaign_budget;
                const { error } = await supabase.from('ad_campaigns').upsert({
                    brand_id:             brandId,
                    provider:             'google_ads',
                    external_campaign_id: String(c.id),
                    name:                 String(c.name ?? ''),
                    status:               String(c.status ?? 'unknown').toLowerCase(),
                    objective:            String(c.advertisingChannelType ?? ''),
                    budget_daily:         b?.amountMicros ? parseInt(b.amountMicros) / 1_000_000 : null,
                    budget_currency:      'USD',
                    start_date:           c.startDate ?? null,
                    end_date:             c.endDate   ?? null,
                    ad_account_id:        customerId,
                    internal_status:      'live',
                    synced_at:            new Date().toISOString(),
                    updated_at:           new Date().toISOString(),
                }, { onConflict: 'brand_id,provider,external_campaign_id' });

                error ? errorsCount++ : campaignsCount++;
            }
        }

        const insightsQuery = `
            SELECT campaign.id, campaign.name,
                   metrics.cost_micros, metrics.impressions, metrics.clicks,
                   metrics.conversions, metrics.conversions_value,
                   metrics.ctr, metrics.average_cpc,
                   segments.date
            FROM campaign
            WHERE segments.date DURING LAST_30_DAYS
              AND campaign.status != 'REMOVED'
            ORDER BY segments.date DESC
            LIMIT 3000
        `;

        const insightsResp = await fetchWithRetry(
            `https://googleads.googleapis.com/v19/customers/${customerId}/googleAds:search`,
            { method: 'POST', headers, body: JSON.stringify({ query: insightsQuery }) },
        );

        if (insightsResp.ok) {
            const { results: iResults = [] } = await insightsResp.json();

            const insightRows = (iResults as Record<string, Record<string, string>>[]).map(row => {
                const spend   = parseInt(row.metrics?.costMicros ?? '0') / 1_000_000;
                const convVal = parseFloat(row.metrics?.conversionsValue ?? '0');
                const conv    = parseFloat(row.metrics?.conversions ?? '0');
                const clicks  = parseInt(row.metrics?.clicks ?? '0');
                const impr    = parseInt(row.metrics?.impressions ?? '0');
                const rawDate = row.segments?.date ?? '';
                const date    = rawDate.length === 8
                    ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`
                    : rawDate;

                return {
                    brand_id:           brandId,
                    provider:           'google_ads',
                    external_object_id: String(row.campaign?.id ?? ''),
                    object_type:        'campaign',
                    date,
                    spend,
                    impressions:        impr,
                    clicks,
                    conversions:        conv,
                    conversion_value:   convVal,
                    ctr:                parseFloat(row.metrics?.ctr ?? '0') * 100,
                    cpc:                parseInt(row.metrics?.averageCpc ?? '0') / 1_000_000,
                    cpm:                impr > 0 ? (spend / impr) * 1000 : 0,
                    cpa:                spend > 0 && conv > 0 ? spend / conv : null,
                    roas:               spend > 0 ? convVal / spend : null,
                    extra_metrics:      { campaign_name: row.campaign?.name },
                };
            });

            if (insightRows.length > 0) {
                const { error } = await supabase
                    .from('ad_insights')
                    .upsert(insightRows, { onConflict: 'brand_id,provider,external_object_id,object_type,date' });
                if (error) errorsCount++;
                else insightsCount += insightRows.length;
            }
        }
    } catch (e) {
        console.error(`[ads-sync] Google error brand=${brandId}`, (e as Error).message);
        errorsCount++;
    }

    return { campaigns: campaignsCount, insights: insightsCount, errors: errorsCount };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const isCron     = cronSecret && authHeader === cronSecret;

    let brandIds: string[] = [];

    if (isCron) {
        // Pull all brands with an active Meta or Google Ads connection
        const { data: metaBrands } = await supabase
            .from('ad_accounts')
            .select('brand_id')
            .eq('meta_connected', true)
            .neq('connection_health', 'disconnected');
        const { data: googleBrands } = await supabase
            .from('brand_connections')
            .select('brand_id')
            .eq('provider', 'google_ads')
            .eq('status', 'connected');

        brandIds = [
            ...new Set([
                ...(metaBrands  ?? []).map(r => r.brand_id as string),
                ...(googleBrands ?? []).map(r => r.brand_id as string),
            ]),
        ];
    } else {
        const userOrError = await verifyJWT(req, correlationId, corsHeaders);
        if (userOrError instanceof Response) return userOrError;

        let body: { brand_id: string };
        try { body = await req.json(); }
        catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }

        if (!body.brand_id) {
            return new Response(JSON.stringify({ error: 'brand_id required' }), { status: 400, headers: corsHeaders });
        }

        const ownershipError = await assertBrandOwnership(supabase, userOrError.id, body.brand_id, correlationId, corsHeaders);
        if (ownershipError) return ownershipError;

        brandIds = [body.brand_id];
    }

    const results = [];

    for (const brandId of brandIds) {
        const [metaResult, googleResult] = await Promise.allSettled([
            syncMetaAds(brandId),
            syncGoogleAds(brandId),
        ]);

        const meta   = metaResult.status   === 'fulfilled' ? metaResult.value   : { campaigns: 0, adsets: 0, ads: 0, insights: 0, errors: 1 };
        const google = googleResult.status === 'fulfilled' ? googleResult.value : { campaigns: 0, insights: 0, errors: 1 };

        results.push({ brand_id: brandId, meta, google });

        console.log(JSON.stringify({
            correlationId,
            event:    'ads-synced',
            brand_id: brandId,
            meta,
            google,
        }));
    }

    return new Response(JSON.stringify({ ok: true, correlationId, results }), {
        status:  200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
