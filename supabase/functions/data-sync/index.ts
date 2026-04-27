/**
 * Data Sync Edge Function
 * Syncs GA4, Search Console, and Google Ads data into fact tables.
 * Scheduled: pg_cron every 6 hours (migration 035)
 * On-demand: POST with service role key + optional ?brand_id=
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const GOOGLE_DEVELOPER_TOKEN = Deno.env.get('GOOGLE_DEVELOPER_TOKEN') || '';

function parseGoogleDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
}

async function resolveToken(connection: any): Promise<string | null> {
    if (connection.access_token_enc) {
        try {
            return await decryptToken(connection.access_token_enc);
        } catch {
            // fall through to plaintext (legacy rows before encryption migration)
        }
    }
    return connection.access_token || null;
}

async function recordSyncJob(
    brandId: string,
    provider: string,
    status: 'success' | 'failed',
    recordsSynced: number,
    errorMessage?: string,
): Promise<void> {
    await supabase.from('analytics_sync_jobs').insert({
        brand_id: brandId,
        provider,
        status,
        finished_at: new Date().toISOString(),
        records_synced: recordsSynced,
        error_message: errorMessage ?? null,
    });
}

// ─── Google Ads ───────────────────────────────────────────────────────────────
async function syncGoogleAds(connection: any): Promise<{ success: boolean; count?: number; reason?: string }> {
    const { brand_id, id: connection_id, ad_account_id } = connection;
    const access_token = await resolveToken(connection);

    if (!access_token || !ad_account_id) {
        return { success: false, reason: 'Missing access token or ad_account_id' };
    }

    try {
        const query = `
            SELECT
              campaign.id,
              campaign.name,
              metrics.impressions,
              metrics.clicks,
              metrics.cost_micros,
              metrics.conversions,
              metrics.conversions_value,
              segments.date
            FROM campaign
            WHERE segments.date DURING LAST_7_DAYS
        `;

        const resp = await fetch(
            `https://googleads.googleapis.com/v19/customers/${ad_account_id}/googleAds:search`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'developer-token': GOOGLE_DEVELOPER_TOKEN,
                    'login-customer-id': ad_account_id,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            },
        );

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error?.message || 'Google Ads API error');

        const facts = (data.results || []).map((row: any) => {
            const cost = Number(row.metrics?.costMicros || 0) / 1_000_000;
            const impressions = Number(row.metrics?.impressions || 0);
            const clicks = Number(row.metrics?.clicks || 0);
            const conversions = Number(row.metrics?.conversions || 0);
            const purchaseValue = Number(row.metrics?.conversionsValue || 0);

            return {
                brand_id,
                connection_id,
                provider: 'google_ads',
                campaign_id: String(row.campaign?.id || ''),
                ad_account_id,
                campaign_name: row.campaign?.name || '',
                fact_date: parseGoogleDate(row.segments?.date || ''),
                impressions,
                clicks,
                spend: cost,
                ctr: impressions > 0 ? clicks / impressions : 0,
                cpc: clicks > 0 ? cost / clicks : null,
                cpm: impressions > 0 ? (cost / impressions) * 1000 : null,
                conversions,
                roas: cost > 0 ? purchaseValue / cost : null,
                cpa: conversions > 0 ? cost / conversions : null,
                pulled_at: new Date().toISOString(),
            };
        });

        if (facts.length > 0) {
            const { error } = await supabase.from('ad_campaign_facts').upsert(facts, {
                onConflict: 'brand_id,provider,fact_date,campaign_id',
                ignoreDuplicates: false,
            });
            if (error) throw error;
        }

        await recordSyncJob(brand_id, 'google_ads', 'success', facts.length);
        return { success: true, count: facts.length };
    } catch (err: any) {
        await recordSyncJob(brand_id, 'google_ads', 'failed', 0, err.message);
        return { success: false, reason: err.message };
    }
}

// ─── GA4 ──────────────────────────────────────────────────────────────────────
async function syncGa4(connection: any): Promise<{ success: boolean; count?: number; reason?: string }> {
    const { brand_id, id: connection_id, analytics_property_id } = connection;
    const access_token = await resolveToken(connection);

    if (!access_token || !analytics_property_id) {
        return { success: false, reason: 'Missing access token or analytics_property_id' };
    }

    try {
        const payload = {
            dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
            dimensions: [
                { name: 'date' },
                { name: 'landingPagePlusQueryString' },
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'engagedSessions' },
                { name: 'newUsers' },
                { name: 'bounceRate' },
                { name: 'keyEvents' },
                { name: 'transactions' },
                { name: 'purchaseRevenue' },
                { name: 'averageSessionDuration' },
            ],
        };

        const resp = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${analytics_property_id}:runReport`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${access_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            },
        );

        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error?.message || 'GA4 API error');

        const facts = (data.rows || []).map((row: any) => {
            const sessions = Number(row.metricValues[0]?.value || 0);
            const engagedSessions = Number(row.metricValues[1]?.value || 0);
            const newUsers = Number(row.metricValues[2]?.value || 0);
            const bounceRate = Number(row.metricValues[3]?.value || 0);
            const keyEvents = Number(row.metricValues[4]?.value || 0);
            const transactions = Number(row.metricValues[5]?.value || 0);
            const revenue = Number(row.metricValues[6]?.value || 0);
            const avgEngagementTimeSec = Number(row.metricValues[7]?.value || 0);

            return {
                brand_id,
                connection_id,
                analytics_property_id,
                fact_date: parseGoogleDate(row.dimensionValues[0]?.value || ''),
                landing_page: row.dimensionValues[1]?.value || '',
                sessions,
                engaged_sessions: engagedSessions,
                bounced_sessions: Math.round(sessions * bounceRate),
                new_users: newUsers,
                key_events: keyEvents,
                transactions,
                revenue,
                avg_engagement_time_sec: avgEngagementTimeSec,
                pulled_at: new Date().toISOString(),
            };
        });

        if (facts.length > 0) {
            const { error } = await supabase.from('analytics_page_facts').upsert(facts, {
                onConflict: 'brand_id,connection_id,fact_date,landing_page',
                ignoreDuplicates: false,
            });
            if (error) throw error;
        }

        await recordSyncJob(brand_id, 'ga4', 'success', facts.length);
        return { success: true, count: facts.length };
    } catch (err: any) {
        await recordSyncJob(brand_id, 'ga4', 'failed', 0, err.message);
        return { success: false, reason: err.message };
    }
}

// ─── Search Console ───────────────────────────────────────────────────────────
async function syncSearchConsole(connection: any): Promise<{ success: boolean; count?: number; reason?: string }> {
    const { brand_id, id: connection_id, search_console_property_id, external_account_name } = connection;
    const access_token = await resolveToken(connection);
    const siteUrl = search_console_property_id || external_account_name;

    if (!access_token || !siteUrl) {
        return { success: false, reason: 'Missing access token or site URL' };
    }

    try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmtDate = (d: Date) => d.toISOString().split('T')[0];
        const ROW_LIMIT = 1000;

        let startRow = 0;
        const allFacts: any[] = [];

        while (true) {
            const resp = await fetch(
                `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        startDate: fmtDate(startDate),
                        endDate: fmtDate(endDate),
                        dimensions: ['date', 'page', 'query'],
                        rowLimit: ROW_LIMIT,
                        startRow,
                    }),
                },
            );

            const data = await resp.json();
            if (!resp.ok) throw new Error(data.error?.message || 'Search Console API error');

            const rows: any[] = data.rows || [];
            for (const row of rows) {
                const [date, pageUrl, query] = row.keys || [];
                allFacts.push({
                    brand_id,
                    connection_id,
                    search_console_property_id: siteUrl,
                    fact_date: date,
                    page_url: pageUrl || '',
                    query: query || '',
                    clicks: Math.round(row.clicks || 0),
                    impressions: Math.round(row.impressions || 0),
                    ctr: row.ctr || 0,
                    position: row.position || 0,
                    pulled_at: new Date().toISOString(),
                });
            }

            if (rows.length < ROW_LIMIT) break;
            startRow += ROW_LIMIT;
        }

        if (allFacts.length > 0) {
            for (let i = 0; i < allFacts.length; i += 500) {
                const { error } = await supabase.from('seo_page_facts').upsert(allFacts.slice(i, i + 500), {
                    onConflict: 'brand_id,connection_id,fact_date,page_url,query',
                    ignoreDuplicates: false,
                });
                if (error) throw error;
            }
        }

        await recordSyncJob(brand_id, 'search_console', 'success', allFacts.length);
        return { success: true, count: allFacts.length };
    } catch (err: any) {
        await recordSyncJob(brand_id, 'search_console', 'failed', 0, err.message);
        return { success: false, reason: err.message };
    }
}

// ─── Meta Ads ─────────────────────────────────────────────────────────────────
async function syncMetaAds(connection: any): Promise<{ success: boolean; count?: number; reason?: string }> {
    const { brand_id, id: connection_id, external_account_id: adAccountId } = connection;
    const access_token = await resolveToken(connection);

    if (!access_token || !adAccountId) {
        return { success: false, reason: 'Missing access token or ad account ID' };
    }

    try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        const fmtDate = (d: Date) => d.toISOString().split('T')[0];

        const fields = 'campaign_id,campaign_name,impressions,reach,clicks,spend,ctr,cpc,cpm,actions,action_values,purchase_roas';
        const timeRange = JSON.stringify({ since: fmtDate(startDate), until: fmtDate(endDate) });
        const apiUrl = `https://graph.facebook.com/v23.0/${encodeURIComponent(adAccountId)}/insights?fields=${encodeURIComponent(fields)}&time_range=${encodeURIComponent(timeRange)}&level=campaign&time_increment=1&access_token=${encodeURIComponent(access_token)}`;

        const resp = await fetch(apiUrl);
        const data = await resp.json();
        if (!resp.ok || data.error) throw new Error(data.error?.message || 'Meta Marketing API error');

        const facts = (data.data || []).map((row: any) => {
            const spend = Number(row.spend || 0);
            const impressions = Number(row.impressions || 0);
            const reach = Number(row.reach || 0);
            const clicks = Number(row.clicks || 0);

            // Extract purchase conversions from actions array
            const actions: any[] = row.actions || [];
            const actionValues: any[] = row.action_values || [];
            const purchaseAction = actions.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase');
            const conversions = purchaseAction ? Number(purchaseAction.value || 0) : 0;

            const purchaseValue = actionValues.find((a: any) => a.action_type === 'offsite_conversion.fb_pixel_purchase' || a.action_type === 'purchase');
            const revenue = purchaseValue ? Number(purchaseValue.value || 0) : 0;

            const purchaseRoasArr: any[] = row.purchase_roas || [];
            const roas = purchaseRoasArr[0] ? Number(purchaseRoasArr[0].value || 0) : (spend > 0 && revenue > 0 ? revenue / spend : null);

            return {
                brand_id,
                connection_id,
                provider: 'meta_ads',
                campaign_id: String(row.campaign_id || ''),
                ad_account_id: adAccountId,
                campaign_name: row.campaign_name || '',
                fact_date: row.date_start || fmtDate(startDate),
                impressions,
                reach,
                clicks,
                spend,
                ctr: Number(row.ctr || 0) / 100, // Meta returns as percentage (e.g. 1.23 = 1.23%)
                cpc: Number(row.cpc || 0) || null,
                cpm: Number(row.cpm || 0) || null,
                conversions,
                roas: roas || null,
                cpa: conversions > 0 ? spend / conversions : null,
                pulled_at: new Date().toISOString(),
            };
        });

        if (facts.length > 0) {
            const { error } = await supabase.from('ad_campaign_facts').upsert(facts, {
                onConflict: 'brand_id,provider,fact_date,campaign_id',
                ignoreDuplicates: false,
            });
            if (error) throw error;
        }

        await recordSyncJob(brand_id, 'meta_ads', 'success', facts.length);
        return { success: true, count: facts.length };
    } catch (err: any) {
        await recordSyncJob(brand_id, 'meta_ads', 'failed', 0, err.message);
        return { success: false, reason: err.message };
    }
}

// ─── Auth guard ───────────────────────────────────────────────────────────────
function isCronAuthorized(req: Request): boolean {
    const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!expected) return false;
    return req.headers.get('Authorization')?.replace('Bearer ', '') === expected;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
    if (!isCronAuthorized(req)) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const url = new URL(req.url);
    const specificBrandId = url.searchParams.get('brand_id');

    let query = supabase
        .from('brand_connections')
        .select('*')
        .in('provider', ['google_ads', 'meta_ads', 'ga4', 'search_console'])
        .eq('status', 'connected');

    if (specificBrandId) {
        query = query.eq('brand_id', specificBrandId);
    }

    const { data: connections, error } = await query;
    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const results = { google_ads: 0, meta_ads: 0, ga4: 0, search_console: 0, failures: 0 };
    const thresholdDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    for (const conn of connections || []) {
        // Skip recently synced connections unless this is an on-demand run for a specific brand
        if (conn.last_sync_at && conn.last_sync_at > thresholdDate && !specificBrandId) {
            continue;
        }

        let result: { success: boolean; count?: number; reason?: string } | undefined;

        if (conn.provider === 'google_ads') result = await syncGoogleAds(conn);
        else if (conn.provider === 'meta_ads') result = await syncMetaAds(conn);
        else if (conn.provider === 'ga4') result = await syncGa4(conn);
        else if (conn.provider === 'search_console') result = await syncSearchConsole(conn);

        const now = new Date().toISOString();

        if (result?.success) {
            await supabase.from('brand_connections').update({
                last_sync_at: now,
                last_successful_sync_at: now,
                sync_health: 'healthy',
                error_count: 0,
                last_error: null,
            }).eq('id', conn.id);

            if (conn.provider === 'google_ads') results.google_ads++;
            else if (conn.provider === 'meta_ads') results.meta_ads++;
            else if (conn.provider === 'ga4') results.ga4++;
            else if (conn.provider === 'search_console') results.search_console++;
        } else if (result && !result.success) {
            const newErrorCount = (conn.error_count || 0) + 1;
            await supabase.from('brand_connections').update({
                last_sync_at: now,
                sync_health: 'failing',
                error_count: newErrorCount,
                status: newErrorCount > 3 ? 'needs_reauth' : 'connected',
                last_error: result.reason,
                last_error_at: now,
            }).eq('id', conn.id);

            results.failures++;
            console.error(`[data-sync] Failed for connection ${conn.id} (${conn.provider}): ${result.reason}`);
        }
    }

    return new Response(
        JSON.stringify({ message: 'Sync completed', ...results }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
});
