/**
 * syncService.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Brand-Centric Sync Engine
 *
 * PRINCIPLE: Never read live from external APIs in dashboard screens.
 * Pull → Normalize → Upsert Facts → Views serve the UI.
 *
 * THREE SYNC MODES:
 *   1. Full Initial   — First-time brand connection: pull 90–365 days of history
 *   2. Incremental    — Scheduled (hourly/daily): pull delta since last cursor
 *   3. On-Demand      — User-triggered: immediate refresh of a specific dataset
 *
 * FACT TABLES WRITTEN:
 *   social_post_facts       ← Meta Pages API / IG Media / LinkedIn / X
 *   seo_page_facts          ← Search Console searchAnalytics (page dimension)
 *   seo_query_facts         ← Search Console searchAnalytics (query dimension)
 *   url_inspection_facts    ← Google URL Inspection API
 *   analytics_page_facts    ← GA4 Data API (runReport)
 *   ad_spend_facts          ← Meta Ads API / Google Ads API
 */

import { supabase } from './supabaseClient';
import {
    createSyncJob, updateSyncJob, getOrCreateSyncCursor, advanceSyncCursor,
    updateConnectionStatus,
} from './brandConnectionService';

// ─── Types ────────────────────────────────────────────────────────────────

export type DataType =
    | 'social_posts'
    | 'seo_pages'
    | 'seo_queries'
    | 'url_inspection'
    | 'analytics_pages'
    | 'ad_spend';

export interface SocialPostPayload {
    platform:           string;
    channel_id:         string;
    external_post_id:   string;
    permalink?:         string;
    post_type?:         string;
    caption?:           string;
    media_urls?:        string[];
    thumbnail_url?:     string;
    hashtags?:          string[];
    published_at:       string;
    likes_count?:       number;
    comments_count?:    number;
    shares_count?:      number;
    saves_count?:       number;
    reach?:             number;
    impressions?:       number;
    video_views?:       number;
    engagement_rate?:   number;
    link_clicks?:       number;
    campaign_label?:    string;
    content_pillar?:    string;
}

export interface SeoPagePayload {
    fact_date:      string;     // "YYYY-MM-DD"
    page_url:       string;
    country?:       string;
    device?:        string;
    search_type?:   string;
    clicks:         number;
    impressions:    number;
    ctr:            number;
    position:       number;
}

export interface SeoQueryPayload {
    fact_date:      string;
    query:          string;
    page_url?:      string;
    country?:       string;
    device?:        string;
    search_type?:   string;
    clicks:         number;
    impressions:    number;
    ctr:            number;
    position:       number;
    is_branded?:    boolean;
}

export interface AnalyticsPagePayload {
    fact_date:              string;
    landing_page:           string;
    session_source?:        string;
    session_medium?:        string;
    session_campaign?:      string;
    country?:               string;
    device_category?:       string;
    sessions:               number;
    engaged_sessions:       number;
    new_users?:             number;
    total_users?:           number;
    avg_engagement_time_sec?: number;
    key_events?:            number;
    transactions?:          number;
    revenue?:               number;
}

export interface AdSpendPayload {
    fact_date:          string;
    provider:           string;
    campaign_id?:       string;
    campaign_name?:     string;
    ad_set_id?:         string;
    ad_set_name?:       string;
    ad_id?:             string;
    ad_name?:           string;
    objective?:         string;
    status?:            string;
    impressions?:       number;
    reach?:             number;
    clicks?:            number;
    link_clicks?:       number;
    ctr?:               number;
    spend:              number;
    currency?:          string;
    results?:           number;
    cost_per_result?:   number;
    purchases?:         number;
    purchase_value?:    number;
    roas?:              number;
    leads?:             number;
    cost_per_lead?:     number;
    frequency?:         number;
}

export interface SyncResult {
    jobId:          string;
    dataType:       DataType;
    inserted:       number;
    updated:        number;
    skipped:        number;
    errors:         number;
    durationMs:     number;
}

// ─── Core Sync Orchestrator ───────────────────────────────────────────────

/**
 * Run Full Initial Sync for a newly connected brand.
 * Pulls maximum history (90–365 days depending on provider limits).
 * Called once after a brand connection is registered.
 */
export async function runFullInitialSync(
    brandId:        string,
    connectionId:   string,
    dataTypes:      DataType[]
): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const dataType of dataTypes) {
        const result = await runSyncForDataType(
            brandId, connectionId, dataType, 'full_initial',
            getInitialSyncDateRange(dataType)
        );
        results.push(result);
    }

    // Mark connection as healthy after successful initial sync
    await updateConnectionStatus(connectionId, {
        status:         'connected',
        sync_health:    'healthy',
        last_error:     null,
    });

    return results;
}

/**
 * Run Incremental Sync — pull only delta since last cursor.
 * Called by scheduler (every 1–6 hours depending on provider).
 */
export async function runIncrementalSync(
    brandId:        string,
    connectionId:   string,
    dataType:       DataType
): Promise<SyncResult> {
    const cursor = await getOrCreateSyncCursor(brandId, connectionId, dataType);
    const fromDate = cursor.last_synced_date ?? getInitialSyncDateRange(dataType).from;
    const toDate = today();

    return runSyncForDataType(
        brandId, connectionId, dataType, 'incremental',
        { from: fromDate, to: toDate }
    );
}

/**
 * Run On-Demand Sync — user manually triggered refresh.
 * Always pulls last 30 days regardless of cursor position.
 */
export async function runOnDemandSync(
    brandId:        string,
    connectionId:   string,
    dataType:       DataType
): Promise<SyncResult> {
    const from = daysAgo(30);
    return runSyncForDataType(
        brandId, connectionId, dataType, 'on_demand',
        { from, to: today() }
    );
}

// ─── Internal Sync Dispatcher ─────────────────────────────────────────────

async function runSyncForDataType(
    brandId:        string,
    connectionId:   string,
    dataType:       DataType,
    jobType:        'full_initial' | 'incremental' | 'on_demand',
    dateRange:      { from: string; to: string }
): Promise<SyncResult> {
    const t0 = Date.now();
    const job = await createSyncJob(brandId, connectionId, dataType, jobType, dateRange);
    const cursor = await getOrCreateSyncCursor(brandId, connectionId, dataType);

    await updateSyncJob(job.id, { status: 'running', started_at: new Date().toISOString() });
    await advanceSyncCursor(cursor.id, { status: 'running' });

    const counters = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

    try {
        // In production: each data type calls its specific API adapter.
        // Here we expose the write functions so adapters can call them directly.
        // Pattern: Adapter fetches → calls writeXxxFacts() → updates cursor per batch.
        console.info(`[SyncService] ${jobType} sync started`, { brandId, connectionId, dataType, dateRange });

        // Advance cursor on success
        await advanceSyncCursor(cursor.id, {
            last_synced_date:   dateRange.to,
            next_page_token:    null,
            status:             'completed',
            error:              null,
        });

        await updateSyncJob(job.id, {
            status:             'completed',
            records_fetched:    counters.inserted + counters.updated + counters.skipped,
            records_inserted:   counters.inserted,
            records_updated:    counters.updated,
            records_skipped:    counters.skipped,
            records_errored:    counters.errors,
            completed_at:       new Date().toISOString(),
        });

    } catch (err: any) {
        const errMsg = err?.message ?? String(err);
        console.error(`[SyncService] ${dataType} sync failed`, errMsg);

        await advanceSyncCursor(cursor.id, { status: 'failed', error: errMsg });
        await updateSyncJob(job.id, {
            status:         'failed',
            error_message:  errMsg,
            completed_at:   new Date().toISOString(),
        });
        await updateConnectionStatus(connectionId, {
            status:         'error',
            sync_health:    'failing',
            last_error:     errMsg,
        });

        counters.errors++;
    }

    return {
        jobId:      job.id,
        dataType,
        inserted:   counters.inserted,
        updated:    counters.updated,
        skipped:    counters.skipped,
        errors:     counters.errors,
        durationMs: Date.now() - t0,
    };
}

// ─── Fact Writers (called by API adapters) ────────────────────────────────

/**
 * Upsert social post facts (historical + recent).
 * Source: Meta Graph API, IG Media API, LinkedIn UGC, X Timeline
 */
export async function writeSocialPostFacts(
    brandId:        string,
    connectionId:   string,
    socialAccountId: string | null,
    posts:          SocialPostPayload[]
): Promise<{ inserted: number; updated: number; skipped: number }> {
    if (!posts.length) return { inserted: 0, updated: 0, skipped: 0 };

    const rows = posts.map(p => ({
        brand_id:           brandId,
        connection_id:      connectionId,
        social_account_id:  socialAccountId,
        platform:           p.platform,
        channel_id:         p.channel_id,
        external_post_id:   p.external_post_id,
        permalink:          p.permalink ?? null,
        post_type:          p.post_type ?? null,
        caption:            p.caption ?? null,
        media_urls:         p.media_urls ?? null,
        thumbnail_url:      p.thumbnail_url ?? null,
        hashtags:           p.hashtags ?? null,
        published_at:       p.published_at,
        likes_count:        p.likes_count ?? 0,
        comments_count:     p.comments_count ?? 0,
        shares_count:       p.shares_count ?? 0,
        saves_count:        p.saves_count ?? 0,
        reach:              p.reach ?? 0,
        impressions:        p.impressions ?? 0,
        video_views:        p.video_views ?? 0,
        engagement_rate:    p.engagement_rate ?? null,
        link_clicks:        p.link_clicks ?? 0,
        campaign_label:     p.campaign_label ?? null,
        content_pillar:     p.content_pillar ?? null,
        pulled_at:          new Date().toISOString(),
        last_refreshed_at:  new Date().toISOString(),
    }));

    const BATCH = 100;
    let inserted = 0, updated = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error, count } = await supabase
            .from('social_post_facts')
            .upsert(batch, {
                onConflict: 'brand_id,platform,external_post_id',
                ignoreDuplicates: false,
            });
        if (error) throw new Error(`writeSocialPostFacts batch ${i}: ${error.message}`);
        inserted += count ?? batch.length;
    }

    return { inserted, updated: 0, skipped: 0 };
}

/**
 * Upsert SEO page facts from Search Console searchAnalytics API.
 */
export async function writeSeoPageFacts(
    brandId:        string,
    connectionId:   string,
    searchConsolePropertyId: string | null,
    rows:           SeoPagePayload[]
): Promise<{ inserted: number; skipped: number }> {
    if (!rows.length) return { inserted: 0, skipped: 0 };

    const records = rows.map(r => ({
        brand_id:                   brandId,
        connection_id:              connectionId,
        search_console_property_id: searchConsolePropertyId,
        fact_date:                  r.fact_date,
        page_url:                   r.page_url,
        country:                    r.country ?? null,
        device:                     r.device ?? null,
        search_type:                r.search_type ?? 'web',
        clicks:                     r.clicks,
        impressions:                r.impressions,
        ctr:                        r.ctr,
        position:                   r.position,
        opportunity_score:          r.impressions * (1 - r.ctr),
        pulled_at:                  new Date().toISOString(),
    }));

    const BATCH = 200;
    let inserted = 0;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await supabase
            .from('seo_page_facts')
            .upsert(batch, {
                onConflict: 'brand_id,fact_date,page_url,country,device,search_type',
                ignoreDuplicates: false,
            });
        if (error) throw new Error(`writeSeoPageFacts batch ${i}: ${error.message}`);
        inserted += batch.length;
    }

    return { inserted, skipped: 0 };
}

/**
 * Upsert SEO query facts from Search Console searchAnalytics API.
 */
export async function writeSeoQueryFacts(
    brandId:        string,
    connectionId:   string,
    searchConsolePropertyId: string | null,
    rows:           SeoQueryPayload[]
): Promise<{ inserted: number; skipped: number }> {
    if (!rows.length) return { inserted: 0, skipped: 0 };

    const records = rows.map(r => ({
        brand_id:                   brandId,
        connection_id:              connectionId,
        search_console_property_id: searchConsolePropertyId,
        fact_date:                  r.fact_date,
        query:                      r.query,
        page_url:                   r.page_url ?? null,
        country:                    r.country ?? null,
        device:                     r.device ?? null,
        search_type:                r.search_type ?? 'web',
        clicks:                     r.clicks,
        impressions:                r.impressions,
        ctr:                        r.ctr,
        position:                   r.position,
        is_branded:                 r.is_branded ?? false,
        pulled_at:                  new Date().toISOString(),
    }));

    const BATCH = 200;
    let inserted = 0;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await supabase
            .from('seo_query_facts')
            .upsert(batch, {
                onConflict: 'brand_id,fact_date,query,page_url,country,device,search_type',
                ignoreDuplicates: false,
            });
        if (error) throw new Error(`writeSeoQueryFacts batch ${i}: ${error.message}`);
        inserted += batch.length;
    }

    return { inserted, skipped: 0 };
}

/**
 * Upsert URL inspection snapshots from Google URL Inspection API.
 */
export async function writeUrlInspectionFacts(
    brandId:        string,
    connectionId:   string,
    searchConsolePropertyId: string | null,
    inspections:    Array<{
        url:                    string;
        verdict?:               string;
        index_status?:          string;
        coverage_state?:        string;
        canonical_url?:         string;
        user_canonical_url?:    string;
        last_crawl_time?:       string;
        crawl_allowed?:         boolean;
        page_fetch_state?:      string;
        rich_result_types?:     string[];
        mobile_usability?:      string;
        raw_response?:          Record<string, unknown>;
    }>
): Promise<{ inserted: number }> {
    if (!inspections.length) return { inserted: 0 };

    const today_str = today();
    const records = inspections.map(r => ({
        brand_id:                   brandId,
        connection_id:              connectionId,
        search_console_property_id: searchConsolePropertyId,
        url:                        r.url,
        inspection_date:            today_str,
        verdict:                    r.verdict ?? null,
        index_status:               r.index_status ?? null,
        coverage_state:             r.coverage_state ?? null,
        canonical_url:              r.canonical_url ?? null,
        user_canonical_url:         r.user_canonical_url ?? null,
        last_crawl_time:            r.last_crawl_time ?? null,
        crawl_allowed:              r.crawl_allowed ?? null,
        page_fetch_state:           r.page_fetch_state ?? null,
        rich_result_types:          r.rich_result_types ?? null,
        mobile_usability:           r.mobile_usability ?? null,
        raw_response:               r.raw_response ?? {},
        pulled_at:                  new Date().toISOString(),
    }));

    const { error } = await supabase
        .from('url_inspection_facts')
        .upsert(records, {
            onConflict: 'brand_id,url,inspection_date',
            ignoreDuplicates: false,
        });
    if (error) throw new Error(`writeUrlInspectionFacts: ${error.message}`);
    return { inserted: records.length };
}

/**
 * Upsert GA4 analytics page facts from Google Analytics Data API (runReport).
 */
export async function writeAnalyticsPageFacts(
    brandId:            string,
    connectionId:       string,
    analyticsPropertyId: string | null,
    rows:               AnalyticsPagePayload[]
): Promise<{ inserted: number; skipped: number }> {
    if (!rows.length) return { inserted: 0, skipped: 0 };

    const records = rows.map(r => ({
        brand_id:               brandId,
        connection_id:          connectionId,
        analytics_property_id:  analyticsPropertyId,
        fact_date:              r.fact_date,
        landing_page:           r.landing_page,
        session_source:         r.session_source ?? null,
        session_medium:         r.session_medium ?? null,
        session_campaign:       r.session_campaign ?? null,
        country:                r.country ?? null,
        device_category:        r.device_category ?? null,
        sessions:               r.sessions,
        engaged_sessions:       r.engaged_sessions,
        bounced_sessions:       Math.max(0, r.sessions - r.engaged_sessions),
        new_users:              r.new_users ?? 0,
        total_users:            r.total_users ?? r.sessions,
        avg_engagement_time_sec: r.avg_engagement_time_sec ?? null,
        key_events:             r.key_events ?? 0,
        transactions:           r.transactions ?? 0,
        revenue:                r.revenue ?? 0,
        pulled_at:              new Date().toISOString(),
    }));

    const BATCH = 200;
    let inserted = 0;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await supabase
            .from('analytics_page_facts')
            .upsert(batch, {
                onConflict: 'brand_id,fact_date,landing_page,session_source,session_medium,country,device_category',
                ignoreDuplicates: false,
            });
        if (error) throw new Error(`writeAnalyticsPageFacts batch ${i}: ${error.message}`);
        inserted += batch.length;
    }

    return { inserted, skipped: 0 };
}

/**
 * Upsert ad spend facts from Meta Ads API / Google Ads API.
 * Keyed on: brand_id + provider + fact_date + ad_id
 */
export async function writeAdSpendFacts(
    brandId:        string,
    connectionId:   string,
    adAccountId:    string | null,
    rows:           AdSpendPayload[]
): Promise<{ inserted: number; updated: number }> {
    if (!rows.length) return { inserted: 0, updated: 0 };

    const records = rows.map(r => ({
        brand_id:           brandId,
        connection_id:      connectionId,
        ad_account_id:      adAccountId,
        fact_date:          r.fact_date,
        provider:           r.provider,
        campaign_id:        r.campaign_id ?? null,
        campaign_name:      r.campaign_name ?? null,
        ad_set_id:          r.ad_set_id ?? null,
        ad_set_name:        r.ad_set_name ?? null,
        ad_id:              r.ad_id ?? null,
        ad_name:            r.ad_name ?? null,
        objective:          r.objective ?? null,
        status:             r.status ?? null,
        impressions:        r.impressions ?? 0,
        reach:              r.reach ?? 0,
        clicks:             r.clicks ?? 0,
        link_clicks:        r.link_clicks ?? 0,
        ctr:                r.ctr ?? null,
        spend:              r.spend,
        currency:           r.currency ?? 'USD',
        results:            r.results ?? 0,
        cost_per_result:    r.cost_per_result ?? null,
        purchases:          r.purchases ?? 0,
        purchase_value:     r.purchase_value ?? 0,
        roas:               r.roas ?? (r.purchase_value && r.spend ? r.purchase_value / r.spend : null),
        leads:              r.leads ?? 0,
        cost_per_lead:      r.cost_per_lead ?? null,
        frequency:          r.frequency ?? null,
        pulled_at:          new Date().toISOString(),
    }));

    const BATCH = 100;
    let inserted = 0;

    for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        const { error } = await supabase
            .from('ad_spend_facts')
            .upsert(batch, {
                onConflict: 'brand_id,provider,fact_date,ad_id',
                ignoreDuplicates: false,
            });
        if (error) throw new Error(`writeAdSpendFacts batch ${i}: ${error.message}`);
        inserted += batch.length;
    }

    return { inserted, updated: 0 };
}

// ─── Read Helpers (for UI — no live API calls) ────────────────────────────

/**
 * Get social post history for a brand (historical calendar).
 * Source: social_post_facts — no live API.
 */
export async function getSocialPostHistory(
    brandId:    string,
    platform?:  string,
    from?:      string,
    to?:        string,
    limit       = 100
): Promise<Record<string, unknown>[]> {
    let q = supabase
        .from('social_post_facts')
        .select('id, platform, channel_id, post_type, caption, media_urls, published_at, day_of_week, hour_of_day, likes_count, comments_count, shares_count, reach, impressions, engagement_rate, content_pillar, campaign_label')
        .eq('brand_id', brandId)
        .eq('is_deleted', false)
        .order('published_at', { ascending: false })
        .limit(limit);

    if (platform) q = q.eq('platform', platform);
    if (from)     q = q.gte('published_at', from);
    if (to)       q = q.lte('published_at', to);

    const { data, error } = await q;
    if (error) throw new Error(`getSocialPostHistory: ${error.message}`);
    return data ?? [];
}

/**
 * Get top SEO pages for a brand (last N days).
 * Source: seo_page_facts — no live API.
 */
export async function getTopSeoPages(
    brandId:    string,
    days        = 30,
    limit       = 50
): Promise<Record<string, unknown>[]> {
    const from = daysAgo(days);
    const { data, error } = await supabase
        .from('seo_page_facts')
        .select('page_url, clicks, impressions, ctr, position, fact_date')
        .eq('brand_id', brandId)
        .gte('fact_date', from)
        .order('clicks', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`getTopSeoPages: ${error.message}`);
    return data ?? [];
}

/**
 * Get top SEO queries for a brand (last N days).
 * Source: seo_query_facts — no live API.
 */
export async function getTopSeoQueries(
    brandId:    string,
    days        = 30,
    limit       = 100
): Promise<Record<string, unknown>[]> {
    const from = daysAgo(days);
    const { data, error } = await supabase
        .from('seo_query_facts')
        .select('query, page_url, clicks, impressions, ctr, position, is_branded, fact_date')
        .eq('brand_id', brandId)
        .gte('fact_date', from)
        .order('clicks', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`getTopSeoQueries: ${error.message}`);
    return data ?? [];
}

/**
 * Get URL indexing issues for a brand.
 * Source: url_inspection_facts — no live API.
 */
export async function getIndexingIssues(brandId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
        .from('url_inspection_facts')
        .select('url, verdict, index_status, coverage_state, canonical_url, last_crawl_time, inspection_date')
        .eq('brand_id', brandId)
        .neq('verdict', 'PASS')
        .order('inspection_date', { ascending: false });
    if (error) throw new Error(`getIndexingIssues: ${error.message}`);
    return data ?? [];
}

/**
 * Get ads performance summary for a brand (last N days).
 * Source: ad_spend_facts — no live API.
 * Returns ROAS, CPA, spend, revenue by provider.
 */
export async function getAdsPerformanceSummary(
    brandId:    string,
    days        = 30
): Promise<{
    provider:       string;
    total_spend:    number;
    total_revenue:  number;
    roas:           number;
    cpa:            number;
    total_clicks:   number;
    impressions:    number;
    purchases:      number;
}[]> {
    const from = daysAgo(days);
    const { data, error } = await supabase
        .from('ad_spend_facts')
        .select('provider, spend, purchase_value, clicks, link_clicks, impressions, purchases')
        .eq('brand_id', brandId)
        .gte('fact_date', from);
    if (error) throw new Error(`getAdsPerformanceSummary: ${error.message}`);

    // Aggregate by provider
    const map: Record<string, any> = {};
    for (const row of data ?? []) {
        if (!map[row.provider]) {
            map[row.provider] = { provider: row.provider, total_spend: 0, total_revenue: 0, total_clicks: 0, impressions: 0, purchases: 0 };
        }
        const p = map[row.provider];
        p.total_spend   += row.spend          ?? 0;
        p.total_revenue += row.purchase_value ?? 0;
        p.total_clicks  += row.link_clicks    ?? row.clicks ?? 0;
        p.impressions   += row.impressions    ?? 0;
        p.purchases     += row.purchases      ?? 0;
    }

    return Object.values(map).map(p => ({
        ...p,
        roas: p.total_spend > 0 ? +(p.total_revenue / p.total_spend).toFixed(2)   : 0,
        cpa:  p.purchases   > 0 ? +(p.total_spend   / p.purchases).toFixed(2)     : 0,
    }));
}

/**
 * Get GA4 landing page summary (last N days).
 * Source: analytics_page_facts — no live API.
 */
export async function getAnalyticsPageSummary(
    brandId:    string,
    days        = 30,
    limit       = 50
): Promise<Record<string, unknown>[]> {
    const from = daysAgo(days);
    const { data, error } = await supabase
        .from('analytics_page_facts')
        .select('landing_page, sessions, engaged_sessions, key_events, revenue, fact_date')
        .eq('brand_id', brandId)
        .gte('fact_date', from)
        .order('sessions', { ascending: false })
        .limit(limit);
    if (error) throw new Error(`getAnalyticsPageSummary: ${error.message}`);
    return data ?? [];
}

// ─── Date helpers ─────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().split('T')[0];
}

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}

/**
 * Returns the recommended initial sync date range per provider / data type.
 * Respects API limits: Search Console = 16 months, Meta = 2 years, GA4 = custom.
 */
function getInitialSyncDateRange(dataType: DataType): { from: string; to: string } {
    const rangeMap: Record<DataType, number> = {
        social_posts:   365,    // 1 year of post history
        seo_pages:      365,    // Search Console allows up to 16 months
        seo_queries:    180,    // 6 months of query data (volume can be huge)
        url_inspection: 0,      // Always current snapshot
        analytics_pages: 365,  // 1 year of GA4 data
        ad_spend:       180,    // 6 months of ad spend history
    };
    const days = rangeMap[dataType] ?? 90;
    return { from: daysAgo(days), to: today() };
}
