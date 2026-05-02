/**
 * webhooks-meta Edge Function
 *
 * Receives and verifies Meta webhook events (Graph API subscriptions).
 *
 * Setup required in Meta App Dashboard:
 *   Callback URL : https://{project}.supabase.co/functions/v1/webhooks-meta
 *   Verify Token : WEBHOOK_META_VERIFY_TOKEN env var
 *   Subscribed fields: ad_review_status_updated, account_update
 *
 * Security:
 *   - GET  : hub.challenge handshake using WEBHOOK_META_VERIFY_TOKEN
 *   - POST : HMAC-SHA256 verification using FACEBOOK_APP_SECRET
 *             Signature in header: X-Hub-Signature-256: sha256=<hex>
 *
 * Event handling (M1 scope):
 *   - ad_review_status_updated (disapproval) → mark ad_ads.internal_status='error'
 *   - account_update (account disabled)      → mark ad_account.connection_health='degraded'
 *
 * All events are deduplicated via webhook_events.event_id (UNIQUE per provider).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── HMAC-SHA256 verification ──────────────────────────────────────────────────

async function verifySignature(rawBody: string, signature: string | null): Promise<boolean> {
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    if (!appSecret || !signature) return false;

    const expected = signature.replace(/^sha256=/, '');
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(appSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody));
    const hexSig = Array.from(new Uint8Array(sig))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Constant-time comparison
    if (hexSig.length !== expected.length) return false;
    let mismatch = 0;
    for (let i = 0; i < hexSig.length; i++) {
        mismatch |= hexSig.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
}

// ── Deduplication ─────────────────────────────────────────────────────────────

async function isDuplicate(provider: string, eventId: string): Promise<boolean> {
    const { data } = await supabase
        .from('webhook_events')
        .select('id')
        .eq('provider', provider)
        .eq('event_id', eventId)
        .maybeSingle();
    return !!data;
}

// ── Ad disapproval handler ────────────────────────────────────────────────────

interface DisapprovalEntry {
    ad_id:        string;
    adset_id?:    string;
    campaign_id?: string;
    reason?:      string;
    review_status?: string;
}

async function handleAdDisapproval(entry: DisapprovalEntry): Promise<void> {
    const externalAdId = entry.ad_id;
    if (!externalAdId) return;

    // Mark the specific ad as errored
    const { data: adRow } = await supabase
        .from('ad_ads')
        .select('id, brand_id')
        .eq('external_id', externalAdId)
        .maybeSingle();

    if (!adRow) return;

    const reason = entry.reason ?? entry.review_status ?? 'Meta disapproved this ad';

    await supabase
        .from('ad_ads')
        .update({
            internal_status: 'error',
            error_message:   reason,
            updated_at:      new Date().toISOString(),
        })
        .eq('id', adRow.id);

    // Audit log
    await supabase.from('ads_audit_log').insert({
        brand_id:    adRow.brand_id,
        entity_type: 'ad',
        entity_id:   adRow.id,
        action:      'status_changed',
        actor_type:  'system',
        actor_id:    'webhooks-meta',
        before_state: { internal_status: 'live' },
        after_state:  { internal_status: 'error', error_message: reason },
    });
}

// ── Account disabled handler ──────────────────────────────────────────────────

async function handleAccountUpdate(payload: Record<string, unknown>): Promise<void> {
    const eventType = String(payload.event ?? '');
    if (!eventType.includes('ACCOUNT_DISABLED') && !eventType.includes('ACCOUNT_SUSPENDED')) return;

    const accountId = String(payload.uid ?? payload.user_id ?? '');
    if (!accountId) return;

    // Mark ad account as degraded
    await supabase
        .from('ad_accounts')
        .update({
            connection_health: 'degraded',
            updated_at:        new Date().toISOString(),
        })
        .eq('external_id', accountId)
        .eq('provider', 'meta');
}

// ── Event router ─────────────────────────────────────────────────────────────

async function processEvent(
    eventType:  string,
    entry:      Record<string, unknown>,
    eventId:    string,
): Promise<void> {
    switch (eventType) {
        case 'ad_review_status_updated':
        case 'adgroup_review_status_updated':
            await handleAdDisapproval(entry as unknown as DisapprovalEntry);
            break;
        case 'account_update':
            await handleAccountUpdate(entry);
            break;
        default:
            break;
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    // ── GET — hub.challenge verification (Meta subscription setup) ────────────
    if (req.method === 'GET') {
        const url    = new URL(req.url);
        const mode   = url.searchParams.get('hub.mode');
        const token  = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        const verifyToken = Deno.env.get('WEBHOOK_META_VERIFY_TOKEN');
        if (mode === 'subscribe' && token === verifyToken && challenge) {
            return new Response(challenge, { status: 200 });
        }
        return new Response('Forbidden', { status: 403 });
    }

    // ── POST — incoming event ─────────────────────────────────────────────────
    if (req.method === 'POST') {
        const rawBody   = await req.text();
        const signature = req.headers.get('X-Hub-Signature-256');

        // 1. Verify HMAC signature
        const valid = await verifySignature(rawBody, signature);
        if (!valid) {
            console.warn('[webhooks-meta] Invalid signature — rejecting request');
            return new Response('Forbidden', { status: 403 });
        }

        let body: Record<string, unknown>;
        try {
            body = JSON.parse(rawBody);
        } catch {
            return new Response('Bad Request', { status: 400 });
        }

        const object  = String(body.object ?? '');
        const entries = (body.entry ?? []) as Record<string, unknown>[];

        // 2. Process each entry
        for (const entry of entries) {
            const changes = (entry.changes ?? []) as { field: string; value: Record<string, unknown> }[];

            for (const change of changes) {
                const eventType = change.field;
                const value     = change.value ?? {};
                const eventId   = String(value.event_time ?? Date.now()) + '_' + String(value.ad_id ?? value.uid ?? Math.random());

                // 3. Deduplicate
                if (await isDuplicate('meta', eventId)) continue;

                // 4. Write to webhook_events (before processing — idempotency guard)
                const { error: insertErr } = await supabase.from('webhook_events').insert({
                    provider:   'meta',
                    event_type: eventType,
                    event_id:   eventId,
                    payload:    { object, ...value },
                    processed:  false,
                    received_at: new Date().toISOString(),
                });

                if (insertErr?.code === '23505') continue; // duplicate key — already processed by a concurrent request

                // 5. Process
                try {
                    await processEvent(eventType, value, eventId);

                    // Mark as processed
                    await supabase
                        .from('webhook_events')
                        .update({ processed: true, processed_at: new Date().toISOString() })
                        .eq('provider', 'meta')
                        .eq('event_id', eventId);
                } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    console.error(`[webhooks-meta] processEvent error type=${eventType}:`, msg);

                    await supabase
                        .from('webhook_events')
                        .update({ error_message: msg })
                        .eq('provider', 'meta')
                        .eq('event_id', eventId);
                }
            }
        }

        // Meta requires 200 OK within 20s — always return fast
        return new Response('OK', { status: 200 });
    }

    return new Response('Method Not Allowed', { status: 405 });
});
