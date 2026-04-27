/**
 * ads-sync Edge Function
 * يجلب بيانات الحملات الإعلانية اليومية من Meta Ads و Google Ads
 * ويكتبها في جدولَي ad_campaigns و ad_insights
 *
 * Scheduled daily at 05:00 UTC via pg_cron (CRON_SECRET auth)
 * Manual trigger supported (JWT auth + brand_id in body)
 *
 * Providers:
 *  - meta        : Marketing API v23.0 — campaigns, adsets, ads, insights
 *  - google_ads  : Google Ads API v19 — campaigns + metrics
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, options: RequestInit = {}, attempt = 0): Promise<Response> {
    const resp = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
    if (resp.status === 429 && attempt < 4) {
        const delay = parseInt(resp.headers.get('Retry-After') ?? '0') * 1000 || (attempt + 1) * 3000;
        await sleep(delay);
        return fetchWithRetry(url, options, attempt + 1);
    }
    return resp;
}

async function getToken(brandId: string, provider: string): Promise<string | null> {
    const { data } = await supabase
        .from('oauth_tokens')
        .select('access_token_enc')
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (!data?.access_token_enc) return null;
    return decryptToken(data.access_token_enc);
}

// ── Meta Ads Sync ─────────────────────────────────────────────────────────────

async function syncMetaAds(brandId: string): Promise<{ campaigns: number; insights: number; errors: number }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('ad_account_id, metadata')
        .eq('brand_id', brandId)
        .eq('provider', 'meta')
        .eq('status', 'connected')
        .maybeSingle();

    const adAccountId = connection?.ad_account_id ?? (connection?.metadata as Record<string, string> | null)?.ad_account_id;
    if (!adAccountId) return { campaigns: 0, insights: 0, errors: 0 };

    const token = await getToken(brandId, 'meta');
    if (!token) return { campaigns: 0, insights: 0, errors: 0 };

    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const until = new Date().toISOString().slice(0, 10);

    let campaignsCount = 0;
    let insightsCount  = 0;
    let errorsCount    = 0;

    try {
        // ── Campaigns ────────────────────────────────────────────────────────
        const campaignsUrl = `https://graph.facebook.com/v23.0/act_${adAccountId}/campaigns?fields=id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time&limit=100&access_token=${token}`;
        const campResp = await fetchWithRetry(campaignsUrl);

        if (campResp.ok) {
            const campData = await campResp.json();
            const campaigns: Record<string, unknown>[] = campData.data ?? [];

            for (const campaign of campaigns) {
                const { error: upsertErr } = await supabase.from('ad_campaigns').upsert({
                    brand_id:             brandId,
                    provider:             'meta',
                    external_campaign_id: String(campaign.id),
                    name:                 String(campaign.name ?? ''),
                    status:               String(campaign.status ?? 'unknown').toLowerCase(),
                    objective:            String(campaign.objective ?? ''),
                    budget_daily:         campaign.daily_budget ? parseFloat(String(campaign.daily_budget)) / 100 : null,
                    budget_lifetime:      campaign.lifetime_budget ? parseFloat(String(campaign.lifetime_budget)) / 100 : null,
                    budget_currency:      'USD',
                    start_date:           campaign.start_time ? String(campaign.start_time).slice(0, 10) : null,
                    end_date:             campaign.stop_time  ? String(campaign.stop_time).slice(0, 10)  : null,
                    ad_account_id:        adAccountId,
                    synced_at:            new Date().toISOString(),
                    updated_at:           new Date().toISOString(),
                }, { onConflict: 'brand_id,provider,external_campaign_id', ignoreDuplicates: false });

                if (upsertErr) errorsCount++;
                else campaignsCount++;
            }
        }

        // ── Campaign Insights (daily breakdown) ───────────────────────────────
        const insightsUrl = `https://graph.facebook.com/v23.0/act_${adAccountId}/insights?fields=campaign_id,campaign_name,spend,impressions,clicks,reach,actions,action_values,ctr,cpm,cpc&time_increment=1&time_range={"since":"${since}","until":"${until}"}&level=campaign&limit=500&access_token=${token}`;
        const insightsResp = await fetchWithRetry(insightsUrl);

        if (insightsResp.ok) {
            const insightsData = await insightsResp.json();
            const insights: Record<string, unknown>[] = insightsData.data ?? [];

            const insightRows = insights.map(row => {
                const actions      = (row.actions as { action_type: string; value: string }[] | null) ?? [];
                const actionValues = (row.action_values as { action_type: string; value: string }[] | null) ?? [];

                const conversions     = actions.find(a => a.action_type === 'purchase')?.value ?? '0';
                const conversionValue = actionValues.find(a => a.action_type === 'purchase')?.value ?? '0';
                const spend           = parseFloat(String(row.spend ?? '0'));
                const convVal         = parseFloat(conversionValue);

                return {
                    brand_id:           brandId,
                    provider:           'meta',
                    external_object_id: String(row.campaign_id),
                    object_type:        'campaign',
                    date:               String(row.date_start),
                    spend,
                    impressions:        parseInt(String(row.impressions ?? '0')),
                    clicks:             parseInt(String(row.clicks ?? '0')),
                    reach:              parseInt(String(row.reach ?? '0')),
                    conversions:        parseInt(conversions),
                    conversion_value:   convVal,
                    ctr:                parseFloat(String(row.ctr ?? '0')),
                    cpc:                parseFloat(String(row.cpc ?? '0')),
                    cpm:                parseFloat(String(row.cpm ?? '0')),
                    roas:               spend > 0 ? convVal / spend : null,
                    extra_metrics: {
                        campaign_name: row.campaign_name,
                        all_actions:   actions,
                    },
                };
            });

            if (insightRows.length > 0) {
                const { error: upsertErr } = await supabase
                    .from('ad_insights')
                    .upsert(insightRows, { onConflict: 'brand_id,provider,external_object_id,object_type,date', ignoreDuplicates: false });
                if (upsertErr) errorsCount++;
                else insightsCount += insightRows.length;
            }
        }
    } catch (e) {
        console.error(`Meta ads sync error for brand ${brandId}:`, e instanceof Error ? e.message : e);
        errorsCount++;
    }

    return { campaigns: campaignsCount, insights: insightsCount, errors: errorsCount };
}

// ── Google Ads Sync ───────────────────────────────────────────────────────────

async function syncGoogleAds(brandId: string): Promise<{ campaigns: number; insights: number; errors: number }> {
    const { data: connection } = await supabase
        .from('brand_connections')
        .select('ad_account_id, metadata')
        .eq('brand_id', brandId)
        .eq('provider', 'google_ads')
        .eq('status', 'connected')
        .maybeSingle();

    const customerId    = connection?.ad_account_id?.replace(/-/g, '');
    const developerToken = Deno.env.get('GOOGLE_DEVELOPER_TOKEN') ?? '';
    if (!customerId || !developerToken) return { campaigns: 0, insights: 0, errors: 0 };

    const token = await getToken(brandId, 'google_ads');
    if (!token) return { campaigns: 0, insights: 0, errors: 0 };

    let campaignsCount = 0;
    let insightsCount  = 0;
    let errorsCount    = 0;

    const headers = {
        'Authorization':  `Bearer ${token}`,
        'developer-token': developerToken,
        'login-customer-id': customerId,
        'Content-Type':   'application/json',
    };

    try {
        // ── Campaigns ────────────────────────────────────────────────────────
        const campQuery = `
            SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
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
            const campData = await campResp.json();

            for (const row of campData.results ?? []) {
                const c = row.campaign;
                const b = row.campaign_budget;
                const { error: upsertErr } = await supabase.from('ad_campaigns').upsert({
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
                    synced_at:            new Date().toISOString(),
                    updated_at:           new Date().toISOString(),
                }, { onConflict: 'brand_id,provider,external_campaign_id', ignoreDuplicates: false });

                if (upsertErr) errorsCount++;
                else campaignsCount++;
            }
        }

        // ── Insights (last 30 days, daily) ────────────────────────────────────
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
            const insightsData = await insightsResp.json();

            const insightRows = (insightsData.results ?? []).map((row: Record<string, Record<string, string>>) => {
                const spend    = parseInt(row.metrics?.costMicros ?? '0') / 1_000_000;
                const convVal  = parseFloat(row.metrics?.conversionsValue ?? '0');
                const clicks   = parseInt(row.metrics?.clicks ?? '0');
                const impressions = parseInt(row.metrics?.impressions ?? '0');
                const rawDate  = row.segments?.date ?? '';
                const formattedDate = rawDate.length === 8
                    ? `${rawDate.slice(0,4)}-${rawDate.slice(4,6)}-${rawDate.slice(6,8)}`
                    : rawDate;

                return {
                    brand_id:           brandId,
                    provider:           'google_ads',
                    external_object_id: String(row.campaign?.id ?? ''),
                    object_type:        'campaign',
                    date:               formattedDate,
                    spend,
                    impressions,
                    clicks,
                    conversions:        parseFloat(row.metrics?.conversions ?? '0'),
                    conversion_value:   convVal,
                    ctr:                parseFloat(row.metrics?.ctr ?? '0') * 100,
                    cpc:                parseInt(row.metrics?.averageCpc ?? '0') / 1_000_000,
                    cpm:                impressions > 0 ? (spend / impressions) * 1000 : 0,
                    roas:               spend > 0 ? convVal / spend : null,
                    extra_metrics: { campaign_name: row.campaign?.name },
                };
            });

            if (insightRows.length > 0) {
                const { error: upsertErr } = await supabase
                    .from('ad_insights')
                    .upsert(insightRows, { onConflict: 'brand_id,provider,external_object_id,object_type,date', ignoreDuplicates: false });
                if (upsertErr) errorsCount++;
                else insightsCount += insightRows.length;
            }
        }
    } catch (e) {
        console.error(`Google Ads sync error for brand ${brandId}:`, e instanceof Error ? e.message : e);
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
        const { data: metaBrands } = await supabase
            .from('brand_connections')
            .select('brand_id')
            .in('provider', ['meta', 'google_ads'])
            .eq('status', 'connected');
        brandIds = [...new Set((metaBrands ?? []).map(r => r.brand_id as string))];
    } else {
        const userOrError = await verifyJWT(req, correlationId, corsHeaders);
        if (userOrError instanceof Response) return userOrError;

        let body: { brand_id: string };
        try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }
        if (!body.brand_id) return new Response(JSON.stringify({ error: 'brand_id required' }), { status: 400, headers: corsHeaders });

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

        const meta   = metaResult.status   === 'fulfilled' ? metaResult.value   : { campaigns: 0, insights: 0, errors: 1 };
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
