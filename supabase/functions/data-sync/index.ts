/**
 * Data Sync Cron Edge Function
 * Scheduled by pg_cron (e.g., every 12 hours)
 * Scans active brand_connections and pulls data from 3rd party APIs (Google Ads, GA4)
 * Upserts facts directly into ad_spend_facts, analytics_page_facts, etc.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const GOOGLE_DEVELOPER_TOKEN = Deno.env.get('GOOGLE_DEVELOPER_TOKEN') || '';

// Format date YYYY-MM-DD
function parseGoogleDate(dateStr: string): string {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    if (dateStr.length === 8) { // YYYYMMDD
        return `${dateStr.substring(0,4)}-${dateStr.substring(4,6)}-${dateStr.substring(6,8)}`;
    }
    return dateStr;
}

/**
 * GOOGLE ADS ADAPTER
 */
async function syncGoogleAds(connection: any) {
    const { brand_id, id: connection_id, access_token, ad_account_id } = connection;
    if (!access_token || !ad_account_id) return { success: false, reason: 'Missing credentials' };

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

        const resp = await fetch(`https://googleads.googleapis.com/v19/customers/${ad_account_id}/googleAds:search`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'developer-token': GOOGLE_DEVELOPER_TOKEN,
                'login-customer-id': ad_account_id,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query })
        });

        const data = await resp.json();

        if (!resp.ok) {
            throw new Error(data.error?.message || 'Google Ads API error');
        }

        const facts = (data.results || []).map((row: any) => {
            const cost = Number(row.metrics?.costMicros || 0) / 1000000;
            const impressions = Number(row.metrics?.impressions || 0);
            const clicks = Number(row.metrics?.clicks || 0);
            const purchases = Number(row.metrics?.conversions || 0);
            const purchase_value = Number(row.metrics?.conversionsValue || 0);

            return {
                brand_id,
                connection_id,
                ad_account_id,
                fact_date: row.segments.date,
                provider: 'google_ads',
                campaign_id: row.campaign?.id,
                campaign_name: row.campaign?.name,
                ad_id: row.campaign?.id, // using campaign level for now
                impressions,
                clicks,
                spend: cost,
                purchases,
                purchase_value,
                roas: cost > 0 ? (purchase_value / cost) : null,
                pulled_at: new Date().toISOString()
            };
        });

        if (facts.length > 0) {
            const { error } = await supabase.from('ad_spend_facts').upsert(facts, {
                onConflict: 'brand_id,provider,fact_date,ad_id',
                ignoreDuplicates: false
            });
            if (error) throw error;
        }

        return { success: true, count: facts.length };
    } catch (error: any) {
        return { success: false, reason: error.message };
    }
}

/**
 * GOOGLE ANALYTICS 4 (GA4) ADAPTER
 */
async function syncGa4(connection: any) {
    const { brand_id, id: connection_id, access_token, analytics_property_id } = connection;
    if (!access_token || !analytics_property_id) return { success: false, reason: 'Missing credentials' };

    try {
        const payload = {
            dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
            dimensions: [
                { name: 'date' },
                { name: 'landingPagePlusQueryString' }
            ],
            metrics: [
                { name: 'sessions' },
                { name: 'engagedSessions' },
                { name: 'newUsers' },
                { name: 'purchaseRevenue' }
            ]
        };

        const resp = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${analytics_property_id}:runReport`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await resp.json();

        if (!resp.ok) {
            throw new Error(data.error?.message || 'GA4 API error');
        }

        const facts = (data.rows || []).map((row: any) => {
            return {
                brand_id,
                connection_id,
                analytics_property_id,
                fact_date: parseGoogleDate(row.dimensionValues[0]?.value),
                landing_page: row.dimensionValues[1]?.value,
                sessions: Number(row.metricValues[0]?.value || 0),
                engaged_sessions: Number(row.metricValues[1]?.value || 0),
                new_users: Number(row.metricValues[2]?.value || 0),
                revenue: Number(row.metricValues[3]?.value || 0),
                pulled_at: new Date().toISOString()
            };
        });

        if (facts.length > 0) {
            const { error } = await supabase.from('analytics_page_facts').upsert(facts, {
                onConflict: 'brand_id,fact_date,landing_page,session_source,session_medium,country,device_category',
                ignoreDuplicates: false
            });
            if (error) throw error;
        }

        return { success: true, count: facts.length };
    } catch (error: any) {
        return { success: false, reason: error.message };
    }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
    // Determine scope of sync: we can pass specific brand_id, or just sync all
    const url = new URL(req.url);
    const specificBrandId = url.searchParams.get('brand_id');

    let query = supabase
        .from('brand_connections')
        .select('*')
        .in('provider', ['google_ads', 'ga4'])
        .eq('status', 'connected');

    if (specificBrandId) {
        query = query.eq('brand_id', specificBrandId);
    }

    const { data: connections, error } = await query;

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const results = { google_ads: 0, ga4: 0, failures: 0 };
    const thresholdDate = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(); // 12 hours ago

    for (const conn of connections || []) {
        // Skip if recently synced (unless forced by UI)
        if (conn.last_sync_at && conn.last_sync_at > thresholdDate && !specificBrandId) {
            continue;
        }

        let result;
        if (conn.provider === 'google_ads') {
            result = await syncGoogleAds(conn);
        } else if (conn.provider === 'ga4') {
            result = await syncGa4(conn);
        }

        const now = new Date().toISOString();
        if (result && result.success) {
            // Update connection status
            await supabase.from('brand_connections').update({
                last_sync_at: now,
                last_successful_sync_at: now,
                sync_health: 'healthy',
                error_count: 0,
                last_error: null
            }).eq('id', conn.id);

            if (conn.provider === 'google_ads') results.google_ads++;
            if (conn.provider === 'ga4') results.ga4++;

        } else if (result && !result.success) {
            // Update connection with error
            const newErrorCount = (conn.error_count || 0) + 1;
            const newStatus = newErrorCount > 3 ? 'needs_reauth' : 'connected';

            await supabase.from('brand_connections').update({
                last_sync_at: now,
                sync_health: 'failing',
                error_count: newErrorCount,
                status: newStatus,
                last_error: result.reason,
                last_error_at: now
            }).eq('id', conn.id);

            results.failures++;
            console.error(`[DataSync] Failed for connection ${conn.id}: ${result.reason}`);
        }
    }

    return new Response(
        JSON.stringify({
            message: 'Sync completed',
            ...results
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
});
