/**
 * meta-ads-connect Edge Function
 *
 * Called by the frontend AFTER the user selects an ad account from the
 * meta-ads-oauth popup. Receives the raw access token + account selections,
 * encrypts the token, saves the ad_accounts row, and creates default
 * automation_policy + cpa_targets rows if they don't exist yet.
 *
 * POST /meta-ads-connect
 * Body: {
 *   brand_id:        string   (UUID)
 *   access_token:    string   (plain-text — stored encrypted, never logged)
 *   ad_account_id:   string   (e.g. "act_123456789")
 *   ad_account_name: string
 *   currency:        string
 *   page_id?:        string
 *   ig_account_id?:  string
 *   pixel_id?:       string
 * }
 *
 * DELETE /meta-ads-connect
 * Body: { brand_id: string }
 * — Disconnects: nulls token_ref, sets connection_health = 'disconnected', audit log
 *
 * Response: { ad_account_uuid: string, message: string }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';
import { encryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_GRAPH_VER = 'v23.0';

// ── Verify the token works before saving ─────────────────────────────────────

async function verifyMetaToken(token: string, adAccountId: string): Promise<{
    businessId?: string;
    timezone?: string;
    currency?: string;
    name?: string;
} | null> {
    try {
        // Strip "act_" prefix if present — Meta returns it in some endpoints
        const cleanId = adAccountId.replace(/^act_/, '');
        const resp = await fetch(
            `https://graph.facebook.com/${FB_GRAPH_VER}/act_${cleanId}?fields=name,currency,timezone_name,business&access_token=${encodeURIComponent(token)}`,
            { signal: AbortSignal.timeout(8000) },
        );
        if (!resp.ok) return null;
        const data = await resp.json();
        if (data.error) return null;
        return {
            businessId: data.business?.id,
            timezone:   data.timezone_name,
            currency:   data.currency,
            name:       data.name,
        };
    } catch {
        return null;
    }
}

// ── Write audit log row ───────────────────────────────────────────────────────

async function writeAuditLog(
    brandId: string,
    entityId: string,
    action: 'connected' | 'disconnected',
    actorId: string,
    afterState: Record<string, unknown>,
): Promise<void> {
    await supabase.from('ads_audit_log').insert({
        brand_id:    brandId,
        entity_type: 'ad_account',
        entity_id:   entityId,
        action,
        actor_type:  'operator',
        actor_id:    actorId,
        after_state: afterState,
        mode_at_time: 'manual', // default at connection time
    });
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const origin = req.headers.get('origin');
    const cors   = buildCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
    }

    // Auth
    const user = await verifyJWT(req, undefined, cors);
    if (user instanceof Response) return user;

    const body = await req.json().catch(() => ({}));
    const { brand_id: brandId } = body;

    const ownershipErr = await assertBrandOwnership(supabase, user.id, brandId, undefined, cors);
    if (ownershipErr) return ownershipErr;

    // ── POST — connect ────────────────────────────────────────────────────────
    if (req.method === 'POST') {
        const {
            access_token:    accessToken,
            ad_account_id:   rawAdAccountId,
            ad_account_name: adAccountName,
            currency,
            page_id:         pageId,
            ig_account_id:   igAccountId,
            pixel_id:        pixelId,
        } = body as Record<string, string>;

        if (!accessToken || !rawAdAccountId) {
            return new Response(
                JSON.stringify({ error: 'access_token and ad_account_id are required' }),
                { status: 400, headers: { 'Content-Type': 'application/json', ...cors } },
            );
        }

        // Normalize ad account ID — always store with "act_" prefix
        const adAccountId = rawAdAccountId.startsWith('act_')
            ? rawAdAccountId
            : `act_${rawAdAccountId}`;

        // 1. Verify the token is functional before saving anything
        const metaInfo = await verifyMetaToken(accessToken, adAccountId);
        if (!metaInfo) {
            return new Response(
                JSON.stringify({ error: 'Could not verify Meta token — the token may be invalid or the ad account inaccessible.' }),
                { status: 422, headers: { 'Content-Type': 'application/json', ...cors } },
            );
        }

        // 2. Encrypt + save to oauth_tokens
        const encryptedToken = await encryptToken(accessToken);
        if (!encryptedToken) {
            return new Response(
                JSON.stringify({ error: 'Token encryption failed' }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
            );
        }

        const { data: tokenRow, error: tokenErr } = await supabase
            .from('oauth_tokens')
            .insert({
                brand_id:         brandId,
                provider:         'meta_ads',
                access_token_enc: encryptedToken,
                is_valid:         true,
                scopes_granted:   ['ads_read', 'ads_management', 'business_management', 'pages_show_list', 'instagram_basic'],
                key_version:      1,
            })
            .select('id')
            .single();

        if (tokenErr || !tokenRow) {
            console.error(JSON.stringify({ event: 'meta-ads-connect:token-insert-error', error: tokenErr?.message, brandId }));
            return new Response(
                JSON.stringify({ error: 'Failed to save token' }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
            );
        }

        // 3. Upsert ad_accounts row
        const { data: adAccountRow, error: acctErr } = await supabase
            .from('ad_accounts')
            .upsert({
                brand_id:          brandId,
                provider:          'meta',
                external_id:       adAccountId,
                name:              adAccountName || metaInfo.name || adAccountId,
                currency:          currency || metaInfo.currency || 'EGP',
                timezone_name:     metaInfo.timezone || 'Africa/Cairo',
                business_id:       metaInfo.businessId || null,
                page_id:           pageId || null,
                ig_account_id:     igAccountId || null,
                pixel_id:          pixelId || null,
                token_ref:         tokenRow.id,
                connection_health: 'healthy',
                meta_connected:    true,
                connected_at:      new Date().toISOString(),
                last_verified_at:  new Date().toISOString(),
                updated_at:        new Date().toISOString(),
            }, { onConflict: 'brand_id,provider' })
            .select('id')
            .single();

        if (acctErr || !adAccountRow) {
            console.error(JSON.stringify({ event: 'meta-ads-connect:account-upsert-error', error: acctErr?.message, brandId }));
            return new Response(
                JSON.stringify({ error: 'Failed to save ad account' }),
                { status: 500, headers: { 'Content-Type': 'application/json', ...cors } },
            );
        }

        // 4. Create default automation_policy if not exists
        await supabase
            .from('automation_policies')
            .upsert({ brand_id: brandId, mode: 'manual', updated_by: user.id }, { onConflict: 'brand_id', ignoreDuplicates: true });

        // 5. Write audit log
        await writeAuditLog(brandId, adAccountRow.id, 'connected', user.id, {
            external_id:  adAccountId,
            name:         adAccountName,
            currency:     currency || metaInfo.currency,
            business_id:  metaInfo.businessId,
            page_id:      pageId,
        });

        return new Response(
            JSON.stringify({ ad_account_uuid: adAccountRow.id, message: 'Meta Ads connected successfully' }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...cors } },
        );
    }

    // ── DELETE — disconnect ───────────────────────────────────────────────────
    if (req.method === 'DELETE') {
        // Fetch existing ad account to get token_ref
        const { data: existing } = await supabase
            .from('ad_accounts')
            .select('id, token_ref, external_id, name')
            .eq('brand_id', brandId)
            .eq('provider', 'meta')
            .maybeSingle();

        if (!existing) {
            return new Response(
                JSON.stringify({ error: 'No Meta Ads connection found for this brand' }),
                { status: 404, headers: { 'Content-Type': 'application/json', ...cors } },
            );
        }

        // Mark token invalid
        if (existing.token_ref) {
            await supabase
                .from('oauth_tokens')
                .update({ is_valid: false })
                .eq('id', existing.token_ref);
        }

        // Mark ad account disconnected
        await supabase
            .from('ad_accounts')
            .update({
                connection_health: 'disconnected',
                meta_connected:    false,
                token_ref:         null,
                updated_at:        new Date().toISOString(),
            })
            .eq('id', existing.id);

        // Write audit log
        await writeAuditLog(brandId, existing.id, 'disconnected', user.id, {
            external_id: existing.external_id,
            name:        existing.name,
        });

        return new Response(
            JSON.stringify({ message: 'Meta Ads disconnected' }),
            { status: 200, headers: { 'Content-Type': 'application/json', ...cors } },
        );
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...cors },
    });
});
