/**
 * Analytics Aggregator Edge Function
 * تجميع بيانات التحليلات من جميع المنصات
 *
 * Triggered by: pg_cron every 6 hours
 * SELECT cron.schedule('analytics-sync', '0 */6 * * *', 'SELECT net.http_post(...)');
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── Facebook / Instagram Insights ───────────────────────────────────────────
async function syncFacebookInsights(brandId: string, account: any): Promise<void> {
    const token = account.access_token;
    if (!token) return;

    try {
        const fields = 'impressions,reach,post_impressions,page_fans,page_fan_adds,engaged_users';
        const since = Math.floor(Date.now() / 1000) - 86400 * 7; // last 7 days

        const res = await fetch(
            `https://graph.facebook.com/v19.0/${account.platform_account_id}/insights?metric=${fields}&period=day&since=${since}&access_token=${token}`,
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message ?? 'FB Insights error');

        // Store in analytics_snapshots table
        for (const metric of data.data ?? []) {
            for (const value of metric.values ?? []) {
                await supabase.from('analytics_snapshots').upsert({
                    brand_id: brandId,
                    platform: account.platform,
                    account_id: account.id,
                    metric_name: metric.name,
                    metric_value: typeof value.value === 'number' ? value.value : JSON.stringify(value.value),
                    period_start: value.end_time,
                    recorded_at: new Date().toISOString(),
                }, { onConflict: 'brand_id,platform,metric_name,period_start' });
            }
        }
        console.log(`[analytics] Synced Facebook insights for brand ${brandId}`);
    } catch (err: any) {
        console.error(`[analytics] FB insights error:`, err.message);
    }
}

async function syncInstagramInsights(brandId: string, account: any): Promise<void> {
    const token = account.access_token;
    if (!token) return;

    try {
        const fields = 'follower_count,impressions,reach,profile_views';
        const res = await fetch(
            `https://graph.facebook.com/v19.0/${account.platform_account_id}/insights?metric=${fields}&period=day&access_token=${token}`,
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message ?? 'IG Insights error');

        for (const metric of data.data ?? []) {
            for (const value of metric.values ?? []) {
                await supabase.from('analytics_snapshots').upsert({
                    brand_id: brandId,
                    platform: 'Instagram',
                    account_id: account.id,
                    metric_name: metric.name,
                    metric_value: typeof value.value === 'number' ? value.value : JSON.stringify(value.value),
                    period_start: value.end_time,
                    recorded_at: new Date().toISOString(),
                }, { onConflict: 'brand_id,platform,metric_name,period_start' });
            }
        }
        console.log(`[analytics] Synced Instagram insights for brand ${brandId}`);
    } catch (err: any) {
        console.error(`[analytics] IG insights error:`, err.message);
    }
}

async function syncLinkedInAnalytics(brandId: string, account: any): Promise<void> {
    const token = account.access_token;
    if (!token) return;

    try {
        const end = Date.now();
        const start = end - 86400_000 * 7;

        const res = await fetch(
            `https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${account.platform_account_id}&timeIntervals.timeGranularityType=DAY&timeIntervals.start=${start}&timeIntervals.end=${end}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'LinkedIn Analytics error');

        for (const stat of data.elements ?? []) {
            await supabase.from('analytics_snapshots').upsert({
                brand_id: brandId,
                platform: 'LinkedIn',
                account_id: account.id,
                metric_name: 'engagement',
                metric_value: stat.totalShareStatistics?.engagement ?? 0,
                period_start: new Date(stat.timeRange?.start ?? Date.now()).toISOString(),
                recorded_at: new Date().toISOString(),
            }, { onConflict: 'brand_id,platform,metric_name,period_start' });
        }
        console.log(`[analytics] Synced LinkedIn analytics for brand ${brandId}`);
    } catch (err: any) {
        console.error(`[analytics] LinkedIn error:`, err.message);
    }
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (_req: Request) => {
    // Get all brands with connected accounts
    const { data: accounts, error } = await supabase
        .from('social_accounts')
        .select('id, brand_id, platform, platform_account_id, access_token')
        .eq('status', 'Connected')
        .not('access_token', 'is', null);

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    const synced: string[] = [];
    const failed: string[] = [];

    for (const account of accounts ?? []) {
        try {
            switch (account.platform) {
                case 'Facebook':
                    await syncFacebookInsights(account.brand_id, account);
                    break;
                case 'Instagram':
                    await syncInstagramInsights(account.brand_id, account);
                    break;
                case 'LinkedIn':
                    await syncLinkedInAnalytics(account.brand_id, account);
                    break;
                default:
                    console.log(`[analytics] Platform ${account.platform} not yet supported`);
            }
            synced.push(account.id);
        } catch (err: any) {
            console.error(`[analytics] Failed for account ${account.id}:`, err);
            failed.push(account.id);
        }
    }

    return new Response(
        JSON.stringify({ synced: synced.length, failed: failed.length }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
});
