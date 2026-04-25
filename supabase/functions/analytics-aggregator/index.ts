// Analytics Aggregator Edge Function
// تجميع بيانات التحليلات من جميع المنصات
//
// Triggered by: pg_cron every 6 hours  OR  user JWT for on-demand sync
// cron expression: 0 every-6-hours * * *

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ─── Token resolution ─────────────────────────────────────────────────────────
// Tokens are stored encrypted in oauth_tokens.access_token_enc.
// social_accounts.access_token is always NULL (cleared for security).
async function resolveToken(socialAccountId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('oauth_tokens')
        .select('access_token_enc')
        .eq('social_account_id', socialAccountId)
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error || !data?.access_token_enc) return null;

    try {
        return await decryptToken(data.access_token_enc);
    } catch {
        return null;
    }
}

// ─── Facebook / Instagram Insights ───────────────────────────────────────────
async function syncFacebookInsights(brandId: string, account: any): Promise<void> {
    const token = await resolveToken(account.id);
    if (!token) {
        console.warn(`[analytics] No valid token for Facebook account ${account.id} — skipping`);
        return;
    }

    try {
        const metrics = 'impressions,reach,post_impressions,page_fans,page_fan_adds,engaged_users';
        const since = Math.floor(Date.now() / 1000) - 86400 * 7; // last 7 days

        const res = await fetch(
            `https://graph.facebook.com/v19.0/${account.platform_account_id}/insights?metric=${metrics}&period=day&since=${since}&access_token=${token}`,
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message ?? 'FB Insights error');

        let latestFans: number | null = null;

        for (const metric of data.data ?? []) {
            for (const value of metric.values ?? []) {
                const numericValue = typeof value.value === 'number' ? value.value : null;

                await supabase.from('analytics_snapshots').upsert({
                    brand_id: brandId,
                    platform: account.platform,
                    account_id: account.id,
                    metric_name: metric.name,
                    metric_value: numericValue ?? JSON.stringify(value.value),
                    period_start: value.end_time,
                    recorded_at: new Date().toISOString(),
                }, { onConflict: 'brand_id,platform,metric_name,period_start' });

                // Track the most recent page_fans value to update followers_count
                if (metric.name === 'page_fans' && numericValue !== null) {
                    latestFans = numericValue;
                }
            }
        }

        // Update followers_count in social_accounts with the real value
        if (latestFans !== null) {
            await supabase
                .from('social_accounts')
                .update({ followers_count: latestFans, last_synced_at: new Date().toISOString() })
                .eq('id', account.id);

            await supabase.from('follower_history').insert({
                brand_id: brandId,
                platform: account.platform,
                followers_count: latestFans,
                recorded_at: new Date().toISOString(),
            }).onConflict?.() ?? null; // ignore unique conflicts
        }

        console.log(`[analytics] Synced Facebook insights for brand ${brandId}, account ${account.id}`);
    } catch (err: any) {
        console.error(`[analytics] FB insights error for account ${account.id}:`, err.message);
    }
}

async function syncInstagramInsights(brandId: string, account: any): Promise<void> {
    const token = await resolveToken(account.id);
    if (!token) {
        console.warn(`[analytics] No valid token for Instagram account ${account.id} — skipping`);
        return;
    }

    try {
        const metrics = 'follower_count,impressions,reach,profile_views';
        const res = await fetch(
            `https://graph.facebook.com/v19.0/${account.platform_account_id}/insights?metric=${metrics}&period=day&access_token=${token}`,
        );
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error?.message ?? 'IG Insights error');

        let latestFollowers: number | null = null;

        for (const metric of data.data ?? []) {
            for (const value of metric.values ?? []) {
                const numericValue = typeof value.value === 'number' ? value.value : null;

                await supabase.from('analytics_snapshots').upsert({
                    brand_id: brandId,
                    platform: 'Instagram',
                    account_id: account.id,
                    metric_name: metric.name,
                    metric_value: numericValue ?? JSON.stringify(value.value),
                    period_start: value.end_time,
                    recorded_at: new Date().toISOString(),
                }, { onConflict: 'brand_id,platform,metric_name,period_start' });

                if (metric.name === 'follower_count' && numericValue !== null) {
                    latestFollowers = numericValue;
                }
            }
        }

        // Fallback: fetch follower_count directly from IG profile if insights didn't return it
        if (latestFollowers === null) {
            const profileRes = await fetch(
                `https://graph.facebook.com/v19.0/${account.platform_account_id}?fields=followers_count&access_token=${token}`,
            );
            const profileData = await profileRes.json();
            if (!profileData.error && typeof profileData.followers_count === 'number') {
                latestFollowers = profileData.followers_count;
            }
        }

        if (latestFollowers !== null) {
            await supabase
                .from('social_accounts')
                .update({ followers_count: latestFollowers, last_synced_at: new Date().toISOString() })
                .eq('id', account.id);

            await supabase.from('follower_history').insert({
                brand_id: brandId,
                platform: 'Instagram',
                followers_count: latestFollowers,
                recorded_at: new Date().toISOString(),
            });
        }

        console.log(`[analytics] Synced Instagram insights for brand ${brandId}, account ${account.id}`);
    } catch (err: any) {
        console.error(`[analytics] IG insights error for account ${account.id}:`, err.message);
    }
}

async function syncLinkedInAnalytics(brandId: string, account: any): Promise<void> {
    const token = await resolveToken(account.id);
    if (!token) {
        console.warn(`[analytics] No valid token for LinkedIn account ${account.id} — skipping`);
        return;
    }

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

// ─── Sync logic (shared between cron + on-demand) ─────────────────────────────
async function syncBrandAccounts(brandId?: string): Promise<{ synced: number; failed: number }> {
    let query = supabase
        .from('social_accounts')
        .select('id, brand_id, platform, platform_account_id')
        .eq('status', 'Connected');

    if (brandId) {
        query = query.eq('brand_id', brandId);
    }

    const { data: accounts, error } = await query;

    if (error) {
        throw new Error(error.message);
    }

    let synced = 0;
    let failed = 0;

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
            synced++;
        } catch (err: any) {
            console.error(`[analytics] Failed for account ${account.id}:`, err);
            failed++;
        }
    }

    return { synced, failed };
}

// ─── Auth guard (cron-only path) ─────────────────────────────────────────────
function isCronAuthorized(req: Request): boolean {
    const expected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!expected) return false;
    const bearer = req.headers.get('Authorization')?.replace('Bearer ', '');
    return bearer === expected;
}

// ─── Main Handler ──────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
    const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    function json(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    // ── Cron path: service role key in Authorization header ───────────────────
    if (isCronAuthorized(req)) {
        try {
            const result = await syncBrandAccounts();
            return json(result);
        } catch (err: any) {
            return json({ error: err.message }, 500);
        }
    }

    // ── On-demand path: user JWT + brand ownership check ─────────────────────
    const correlationId = crypto.randomUUID();
    const userOrError = await verifyJWT(req, correlationId, corsHeaders);
    if (userOrError instanceof Response) return userOrError;

    let brandId: string | undefined;
    try {
        const body = await req.json() as { brand_id?: string };
        brandId = body.brand_id;
    } catch {
        // no body — sync all brands for this user (not supported, require brand_id)
    }

    if (!brandId) {
        return json({ error: 'brand_id is required for on-demand sync' }, 400);
    }

    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, brandId, correlationId, corsHeaders);
    if (ownershipError) return ownershipError;

    try {
        const result = await syncBrandAccounts(brandId);
        return json({ ok: true, ...result });
    } catch (err: any) {
        return json({ error: err.message }, 500);
    }
});
