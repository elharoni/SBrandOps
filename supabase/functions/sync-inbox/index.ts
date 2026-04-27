/**
 * sync-inbox Edge Function
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches historical conversations + messages from Facebook & Instagram
 * and stores them in inbox_conversations / inbox_messages tables.
 *
 * Invoke:  POST /functions/v1/sync-inbox
 * Body:    { brand_id: string, days_back?: number, platform?: 'facebook'|'instagram'|'all' }
 * Auth:    Supabase user JWT (Authorization: Bearer <jwt>)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE    = `https://graph.facebook.com/${GRAPH_VERSION}`;

// ── Supabase client with service-role key (needed to read oauth_tokens) ───────
const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface SyncResult {
    platform: string;
    accountId: string;
    accountName: string;
    conversationsSynced: number;
    messagesSynced: number;
    error?: string;
    errorCode?: string;
    debug?: string;
}

interface GraphConversation {
    id: string;
    updated_time: string;
    participants?: { data: GraphParticipant[] };
    messages?: { data: GraphMessage[]; paging?: { next?: string } };
}

interface GraphParticipant {
    id: string;
    name?: string;
    email?: string;
    username?: string;
    profile_pic?: string;
}

interface GraphMessage {
    id: string;
    message: string;
    from?: { id: string; name?: string };
    created_time: string;
}

// ── Graph API helpers ─────────────────────────────────────────────────────────

async function graphGet(path: string, token: string, params: Record<string, string> = {}): Promise<any> {
    const url = new URL(`${GRAPH_BASE}/${path}`);
    url.searchParams.set('access_token', token);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const resp = await fetch(url.toString());
    const data = await resp.json();

    if (!resp.ok || data.error) {
        const err = data.error || { message: `HTTP ${resp.status}`, code: resp.status };
        throw Object.assign(new Error(err.message), { fbCode: err.code, fbType: err.type });
    }
    return data;
}

// Paginate through all conversations (up to 10 pages = ~250 conversations)
async function fetchAllConversations(
    pageId: string,
    token: string,
    platform: 'facebook' | 'instagram',
    since?: string,
): Promise<GraphConversation[]> {
    const all: GraphConversation[] = [];
    const params: Record<string, string> = {
        fields: 'id,updated_time,participants{id,name,email,username,profile_pic},messages.limit(25){id,message,from,created_time}',
        limit: '25',
    };
    if (platform === 'instagram') params.platform = 'instagram';
    if (since) params.since = since;

    let data = await graphGet(`${pageId}/conversations`, token, params);
    let page = 0;

    while (data?.data?.length && page < 10) {
        all.push(...data.data);
        if (!data.paging?.next) break;

        const next = new URL(data.paging.next);
        next.searchParams.delete('access_token');
        const path = next.pathname.replace(`/${GRAPH_VERSION}/`, '');
        const nextParams: Record<string, string> = {};
        next.searchParams.forEach((v, k) => { nextParams[k] = v; });

        try {
            data = await graphGet(path, token, nextParams);
        } catch { break; }
        page++;
    }
    return all;
}

// ── Upsert helpers ────────────────────────────────────────────────────────────

async function upsertConversation(
    brandId: string,
    platform: 'Facebook' | 'Instagram',
    conv: GraphConversation,
    pageId: string,
    pageName: string,
    type: 'Message' | 'Comment' = 'Message',
): Promise<{ convId: string; isNew: boolean } | null> {
    // Find the non-page participant (the customer)
    const participants = conv.participants?.data ?? [];
    const customer = participants.find(p => p.id !== pageId) ?? participants[0];
    if (!customer) return null;

    const lastMsg = conv.messages?.data?.[0];
    const row = {
        brand_id:         brandId,
        platform:         platform,
        type:             type,
        external_id:      conv.id,
        user_name:        customer.name || customer.username || `User ${customer.id.slice(-6)}`,
        user_handle:      customer.username || customer.id,
        user_avatar_url:  customer.profile_pic || null,
        last_message_text: lastMsg?.message ?? '',
        last_message_at:  conv.updated_time,
        is_read:          false,
        account_name:     pageName,
        account_id:       pageId,
    };

    const { data, error } = await supabase
        .from('inbox_conversations')
        .upsert([row], { onConflict: 'brand_id,platform,external_id', ignoreDuplicates: false })
        .select('id')
        .single();

    if (error) {
        console.error('[sync-inbox] upsertConversation:', error.message);
        return null;
    }
    return { convId: data.id, isNew: true };
}

async function upsertMessages(
    brandId: string,
    convId: string,
    messages: GraphMessage[],
    pageId: string,
): Promise<number> {
    if (!messages.length) return 0;

    const rows = messages.map(m => ({
        conversation_id:     convId,
        brand_id:            brandId,
        sender:              m.from?.id === pageId ? 'agent' : 'user',
        text:                m.message || '',
        sent_at:             m.created_time,
        external_message_id: m.id || null,
    }));

    // Deduplicate by external_message_id when available, fall back to sent_at
    const externalIds = rows.map(r => r.external_message_id).filter(Boolean) as string[];
    const timestamps  = rows.map(r => r.sent_at);

    const [{ data: existingByExtId }, { data: existingByTs }] = await Promise.all([
        externalIds.length
            ? supabase.from('inbox_messages').select('external_message_id').eq('conversation_id', convId).in('external_message_id', externalIds)
            : Promise.resolve({ data: [] }),
        supabase.from('inbox_messages').select('sent_at').eq('conversation_id', convId).in('sent_at', timestamps),
    ]);

    const seenExtIds = new Set((existingByExtId || []).map((r: any) => r.external_message_id).filter(Boolean));
    const seenTs     = new Set((existingByTs    || []).map((r: any) => r.sent_at));
    const newRows    = rows.filter(r =>
        (r.external_message_id ? !seenExtIds.has(r.external_message_id) : true) &&
        !seenTs.has(r.sent_at)
    );

    if (!newRows.length) return 0;

    const { error } = await supabase.from('inbox_messages').insert(newRows);
    if (error) {
        console.error('[sync-inbox] upsertMessages:', error.message);
        return 0;
    }
    return newRows.length;
}

// ── Facebook post-comment sync ────────────────────────────────────────────────
// Groups comments by commenter: one conversation per (post × commenter)
async function syncFacebookPostComments(
    brandId: string,
    pageId: string,
    accessToken: string,
    pageName: string,
): Promise<{ conversationsSynced: number; messagesSynced: number }> {
    let conversationsSynced = 0;
    let messagesSynced = 0;
    const since = Math.floor(Date.now() / 1000) - 90 * 24 * 60 * 60; // 90 days

    try {
        const feed = await graphGet(`${pageId}/feed`, accessToken, {
            fields: 'id,message,created_time,comments.limit(100){id,message,from,created_time}',
            limit: '25',
            since: String(since),
        });

        for (const post of (feed?.data ?? [])) {
            const comments: GraphMessage[] = (post.comments?.data ?? []).filter(
                (c: any) => c.from?.id && c.from.id !== pageId
            );
            if (!comments.length) continue;

            // Group comments by commenter
            const byCommenter = new Map<string, { id: string; name: string; comments: GraphMessage[] }>();
            for (const comment of comments) {
                const uid = comment.from!.id;
                if (!byCommenter.has(uid)) {
                    byCommenter.set(uid, { id: uid, name: comment.from?.name ?? uid, comments: [] });
                }
                byCommenter.get(uid)!.comments.push(comment);
            }

            for (const [commenterId, info] of byCommenter) {
                const sorted = [...info.comments].sort(
                    (a, b) => new Date(a.created_time).getTime() - new Date(b.created_time).getTime()
                );
                const lastComment = sorted.at(-1)!;

                const fakeConv: GraphConversation = {
                    id: `fb_post_${post.id}_user_${commenterId}`,
                    updated_time: lastComment.created_time,
                    participants: { data: [{ id: commenterId, name: info.name }] },
                    messages: { data: sorted },
                };

                const res = await upsertConversation(brandId, 'Facebook', fakeConv, pageId, pageName, 'Comment');
                if (!res) continue;
                conversationsSynced++;
                messagesSynced += await upsertMessages(brandId, res.convId, sorted, pageId);
            }
        }
    } catch (err: any) {
        console.warn('[sync-inbox] post-comments error:', err.message);
    }

    return { conversationsSynced, messagesSynced };
}

// ── Platform sync functions ───────────────────────────────────────────────────

async function syncFacebook(
    brandId: string,
    tokenRow: any,
): Promise<SyncResult> {
    const result: SyncResult = {
        platform: 'Facebook',
        accountId: tokenRow.provider_account_id,
        accountName: tokenRow.provider_name || tokenRow.provider_account_id,
        conversationsSynced: 0,
        messagesSynced: 0,
    };

    const accessToken = tokenRow.access_token_enc
        ? await decryptToken(tokenRow.access_token_enc)
        : tokenRow.access_token;

    if (!accessToken) {
        result.error = 'لا يوجد توكن صالح';
        result.errorCode = 'no_token';
        return result;
    }

    try {
        const pageId = tokenRow.provider_account_id;

        // Verify token/page by calling /me first
        let verifiedPageId = pageId;
        try {
            const meData = await graphGet('me', accessToken, { fields: 'id,name' });
            console.log(`[sync-inbox] token identity: id=${meData.id} name=${meData.name}`);
            // If stored id is a user id (not page id), try to get the page token via /me/accounts
            if (meData.id !== pageId) {
                console.log(`[sync-inbox] stored id ${pageId} != token identity ${meData.id}, trying as page id directly`);
            }
        } catch (verifyErr: any) {
            console.warn('[sync-inbox] /me check failed:', verifyErr.message);
        }

        const conversations = await fetchAllConversations(pageId, accessToken, 'facebook');
        console.log(`[sync-inbox] Facebook conversations fetched: ${conversations.length} for page ${pageId}`);

        // Sync Messenger DMs
        for (const conv of conversations) {
            const res = await upsertConversation(brandId, 'Facebook', conv, pageId, result.accountName, 'Message');
            if (!res) continue;
            result.conversationsSynced++;
            const messages = conv.messages?.data ?? [];
            result.messagesSynced += await upsertMessages(brandId, res.convId, messages, pageId);
        }

        // Sync post comments (groups by commenter per post)
        const commentSync = await syncFacebookPostComments(brandId, pageId, accessToken, result.accountName);
        result.conversationsSynced += commentSync.conversationsSynced;
        result.messagesSynced     += commentSync.messagesSynced;

        if (result.conversationsSynced === 0) {
            result.debug = `لا توجد رسائل Messenger ولا تعليقات على البوستات في آخر 90 يوم للصفحة ${pageId}.`;
        }

        return result;
    } catch (err: any) {
        result.error = err.message;
        result.errorCode = err.fbType === 'OAuthException'
            ? 'permission_denied'
            : err.fbCode === 190
            ? 'token_expired'
            : 'api_error';
        return result;
    }
}

async function syncInstagram(
    brandId: string,
    tokenRow: any,
): Promise<SyncResult> {
    const result: SyncResult = {
        platform: 'Instagram',
        accountId: tokenRow.provider_account_id,
        accountName: tokenRow.provider_name || tokenRow.provider_account_id,
        conversationsSynced: 0,
        messagesSynced: 0,
    };

    const accessToken = tokenRow.access_token_enc
        ? await decryptToken(tokenRow.access_token_enc)
        : tokenRow.access_token;

    if (!accessToken) {
        result.error = 'لا يوجد توكن صالح';
        result.errorCode = 'no_token';
        return result;
    }

    try {
        const igUserId = tokenRow.provider_account_id;
        const conversations = await fetchAllConversations(igUserId, accessToken, 'instagram');

        for (const conv of conversations) {
            const res = await upsertConversation(brandId, 'Instagram', conv, igUserId, result.accountName);
            if (!res) continue;
            result.conversationsSynced++;

            const messages = conv.messages?.data ?? [];
            result.messagesSynced += await upsertMessages(brandId, res.convId, messages, igUserId);
        }

        return result;
    } catch (err: any) {
        result.error = err.message;
        result.errorCode = err.fbType === 'OAuthException'
            ? 'permission_denied'
            : err.fbCode === 190
            ? 'token_expired'
            : 'api_error';
        return result;
    }
}

// ── Main Handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin':  '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        });
    }

    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
    };

    try {
        // Verify caller is an authenticated Supabase user
        const authHeader = req.headers.get('Authorization') || '';
        const jwt = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);
        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const body = await req.json().catch(() => ({}));
        const { brand_id, platform: requestedPlatform = 'all' } = body as {
            brand_id?: string;
            platform?: 'facebook' | 'instagram' | 'all';
        };

        if (!brand_id) {
            return new Response(JSON.stringify({ error: 'brand_id is required' }), { status: 400, headers: corsHeaders });
        }

        // Verify user owns this brand
        const { data: brand } = await supabase
            .from('brands')
            .select('id')
            .eq('id', brand_id)
            .eq('user_id', user.id)
            .single();

        if (!brand) {
            return new Response(JSON.stringify({ error: 'Brand not found or access denied' }), { status: 403, headers: corsHeaders });
        }

        // Get OAuth tokens for facebook / instagram
        // oauth_tokens.provider is stored as capitalized SocialPlatform enum value ('Facebook'/'Instagram')
        const providers = requestedPlatform === 'all'
            ? ['Facebook', 'Instagram', 'facebook', 'instagram']  // cover both cases
            : [requestedPlatform, requestedPlatform.charAt(0).toUpperCase() + requestedPlatform.slice(1)];

        const { data: tokens, error: tokenErr } = await supabase
            .from('oauth_tokens')
            .select('*')
            .eq('brand_id', brand_id)
            .in('provider', providers)
            .eq('is_valid', true);

        if (tokenErr) {
            return new Response(JSON.stringify({ error: tokenErr.message }), { status: 500, headers: corsHeaders });
        }

        if (!tokens || tokens.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                message: 'لا توجد حسابات Facebook/Instagram متصلة لهذا البراند',
                results: [],
                totalConversations: 0,
                totalMessages: 0,
            }), { headers: corsHeaders });
        }

        // Run sync for each token
        const results: SyncResult[] = [];

        for (const token of tokens) {
            let syncResult: SyncResult;
            const providerLower = token.provider?.toLowerCase();
            if (providerLower === 'facebook') {
                syncResult = await syncFacebook(brand_id, token);
            } else if (providerLower === 'instagram') {
                syncResult = await syncInstagram(brand_id, token);
            } else {
                continue;
            }
            results.push(syncResult);
        }

        const totalConversations = results.reduce((s, r) => s + r.conversationsSynced, 0);
        const totalMessages      = results.reduce((s, r) => s + r.messagesSynced, 0);
        const hasErrors          = results.some(r => r.error);

        return new Response(JSON.stringify({
            success: !hasErrors || totalConversations > 0,
            results,
            totalConversations,
            totalMessages,
            message: hasErrors && totalConversations === 0
                ? 'فشل جلب الرسائل — تحقق من الصلاحيات'
                : `تم جلب ${totalConversations} محادثة و ${totalMessages} رسالة`,
        }), { headers: corsHeaders });

    } catch (err: any) {
        console.error('[sync-inbox] unhandled error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
            status: 500,
            headers: corsHeaders,
        });
    }
});
