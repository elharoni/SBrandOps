/**
 * send-reply Edge Function v2
 * Sends a reply via Facebook/Instagram Graph API with full idempotency and audit logging.
 *
 * POST /functions/v1/send-reply
 * Body: {
 *   brand_id: string,
 *   conversation_id: string,
 *   message: string,
 *   reply_mode?: "dm" | "public_comment_reply" | "private_comment_reply" | "ad_comment_reply",
 *   target_external_id?: string,   // comment_id to reply to (prevents wrong-comment guessing)
 *   idempotency_key?: string,       // uuid — prevents double-send on retry/network glitch
 * }
 * Auth: Supabase user JWT
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE    = `https://graph.facebook.com/${GRAPH_VERSION}`;

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
    'Access-Control-Allow-Origin':  '*',
    'Content-Type': 'application/json',
};

type ReplyMode = 'dm' | 'public_comment_reply' | 'private_comment_reply' | 'ad_comment_reply';

// ── Graph API helpers ─────────────────────────────────────────────────────────

async function graphPost(path: string, token: string, body: Record<string, unknown>): Promise<any> {
    const url = `${GRAPH_BASE}/${path}?access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await resp.json();

    if (!resp.ok || data.error) {
        const err = data.error || { message: `HTTP ${resp.status}`, code: resp.status };
        throw Object.assign(new Error(err.message), {
            fbCode:    err.code,
            fbType:    err.type,
            fbSubcode: err.error_subcode,
        });
    }
    return data;
}

// ── Facebook send functions ───────────────────────────────────────────────────

async function sendMessengerReply(
    pageId: string,
    recipientPsid: string,
    message: string,
    token: string,
): Promise<string> {
    const data = await graphPost(`${pageId}/messages`, token, {
        recipient:      { id: recipientPsid },
        messaging_type: 'RESPONSE',
        message:        { text: message },
    });
    return data.message_id ?? data.id ?? '';
}

async function sendFbCommentReply(commentId: string, message: string, token: string): Promise<string> {
    const data = await graphPost(`${commentId}/comments`, token, { message });
    return data.id ?? '';
}

async function sendFbPostComment(postId: string, message: string, token: string): Promise<string> {
    const data = await graphPost(`${postId}/comments`, token, { message });
    return data.id ?? '';
}

// ── Instagram send functions ──────────────────────────────────────────────────

async function sendInstagramDMReply(
    igUserId: string,
    recipientIgsid: string,
    message: string,
    token: string,
): Promise<string> {
    const data = await graphPost(`${igUserId}/messages`, token, {
        recipient:      { id: recipientIgsid },
        messaging_type: 'RESPONSE',
        message:        { text: message },
    });
    return data.message_id ?? data.id ?? '';
}

async function sendInstagramCommentReply(commentId: string, message: string, token: string): Promise<string> {
    const data = await graphPost(`${commentId}/replies`, token, { message });
    return data.id ?? '';
}

async function sendInstagramMediaComment(mediaId: string, message: string, token: string): Promise<string> {
    const data = await graphPost(`${mediaId}/comments`, token, { message });
    return data.id ?? '';
}

// ── Idempotency check ─────────────────────────────────────────────────────────

async function checkIdempotency(brandId: string, key: string): Promise<{ alreadySent: boolean; platformMessageId?: string }> {
    const { data } = await supabase
        .from('inbox_reply_logs')
        .select('status, platform_message_id')
        .eq('brand_id', brandId)
        .eq('idempotency_key', key)
        .maybeSingle();

    if (!data) return { alreadySent: false };
    if (data.status === 'sent') return { alreadySent: true, platformMessageId: data.platform_message_id };
    // pending/failed = allow retry
    return { alreadySent: false };
}

async function logReply(
    brandId: string,
    conversationId: string | null,
    key: string,
    mode: ReplyMode,
    message: string,
    targetExternalId: string | null,
    userId: string,
): Promise<void> {
    await supabase.from('inbox_reply_logs').upsert({
        brand_id:           brandId,
        conversation_id:    conversationId,
        idempotency_key:    key,
        reply_mode:         mode,
        message,
        target_external_id: targetExternalId,
        status:             'pending',
        created_by:         userId,
    }, { onConflict: 'brand_id,idempotency_key', ignoreDuplicates: false });
}

async function markReplyResult(
    brandId: string,
    key: string,
    success: boolean,
    platformMessageId: string,
    replyMethod: string,
    errorCode?: string,
    errorMessage?: string,
): Promise<void> {
    await supabase.from('inbox_reply_logs')
        .update({
            status:              success ? 'sent' : 'failed',
            platform_message_id: platformMessageId || null,
            reply_method:        replyMethod || null,
            error_code:          errorCode || null,
            error_message:       errorMessage || null,
        })
        .eq('brand_id', brandId)
        .eq('idempotency_key', key);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin':  '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
            },
        });
    }

    try {
        // Auth
        const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
        const { data: { user }, error: authErr } = await supabase.auth.getUser(jwt);
        if (authErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: CORS });
        }

        const body = await req.json().catch(() => ({})) as {
            brand_id?:           string;
            conversation_id?:    string;
            message?:            string;
            reply_mode?:         ReplyMode;
            target_external_id?: string;
            idempotency_key?:    string;
        };

        const {
            brand_id,
            conversation_id,
            message,
            reply_mode        = 'dm',
            target_external_id,
            idempotency_key   = crypto.randomUUID(),
        } = body;

        if (!brand_id || !conversation_id || !message?.trim()) {
            return new Response(
                JSON.stringify({ error: 'brand_id, conversation_id, and message are required' }),
                { status: 400, headers: CORS },
            );
        }

        // Verify brand ownership
        const { data: brand } = await supabase
            .from('brands')
            .select('id')
            .eq('id', brand_id)
            .eq('user_id', user.id)
            .single();

        if (!brand) {
            return new Response(JSON.stringify({ error: 'Brand not found or access denied' }), { status: 403, headers: CORS });
        }

        // Idempotency check — return early if already sent successfully
        const idempotencyResult = await checkIdempotency(brand_id, idempotency_key);
        if (idempotencyResult.alreadySent) {
            return new Response(JSON.stringify({
                success:             true,
                platform_message_id: idempotencyResult.platformMessageId,
                reply_method:        'idempotent_cached',
            }), { headers: CORS });
        }

        // Load conversation — supports both UUID (inbox_conversations) and synthetic IDs
        const isLegacyConv = !conversation_id.startsWith('sm::');

        let conv: any = null;
        if (isLegacyConv) {
            const { data, error: convErr } = await supabase
                .from('inbox_conversations')
                .select('id, platform, type, external_id, account_id, user_handle')
                .eq('id', conversation_id)
                .eq('brand_id', brand_id)
                .single();
            if (convErr || !data) {
                return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404, headers: CORS });
            }
            conv = data;
        } else {
            // sm:: synthetic conversations — derive platform from id: sm::<provider>::<threadId>
            const parts = conversation_id.split('::');
            const provider = parts[1] ?? '';
            conv = {
                platform:   provider.charAt(0).toUpperCase() + provider.slice(1),
                type:       'Message',
                external_id: null,
                account_id:  null,
                user_handle: parts[2] ?? null,
            };
        }

        const isInstagram = ['Instagram', 'instagram'].includes(conv.platform);
        const isFacebook  = ['Facebook',  'facebook' ].includes(conv.platform);

        // Get OAuth token
        const providerVariants = isInstagram ? ['Instagram', 'instagram'] : ['Facebook', 'facebook'];
        let tokenRow: any = null;

        if (conv.account_id) {
            const { data } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('brand_id', brand_id)
                .in('provider', providerVariants)
                .eq('provider_account_id', conv.account_id)
                .eq('is_valid', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            tokenRow = data;
        }

        if (!tokenRow) {
            const { data } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('brand_id', brand_id)
                .in('provider', providerVariants)
                .eq('is_valid', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            tokenRow = data;
        }

        if (!tokenRow && isInstagram) {
            const { data } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('brand_id', brand_id)
                .in('provider', ['Facebook', 'facebook'])
                .eq('is_valid', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            tokenRow = data;
        }

        if (!tokenRow) {
            return new Response(
                JSON.stringify({ success: false, error: 'no_token', message: 'لا يوجد توكن صالح — أعد ربط الحساب' }),
                { status: 422, headers: CORS },
            );
        }

        const accessToken = tokenRow.access_token_enc
            ? await decryptToken(tokenRow.access_token_enc)
            : tokenRow.access_token;

        if (!accessToken) {
            return new Response(
                JSON.stringify({ success: false, error: 'no_token', message: 'لا يوجد توكن صالح' }),
                { status: 422, headers: CORS },
            );
        }

        const accountId = conv.account_id || tokenRow.provider_account_id;
        const text      = message.trim();
        let platformMessageId = '';
        let replyMethod       = '';

        // Log the attempt before sending (idempotency anchor)
        await logReply(
            brand_id,
            isLegacyConv ? conversation_id : null,
            idempotency_key,
            reply_mode,
            text,
            target_external_id ?? null,
            user.id,
        );

        try {
            if (isInstagram) {
                if (reply_mode === 'dm' || conv.type === 'Message') {
                    const igsid = conv.user_handle;
                    if (!igsid) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'missing_igsid', message: 'معرّف مستخدم Instagram غير متوفر' }),
                            { status: 422, headers: CORS },
                        );
                    }
                    platformMessageId = await sendInstagramDMReply(accountId, igsid, text, accessToken);
                    replyMethod = 'instagram_dm_api';
                } else {
                    // Comment reply — prefer explicit target_external_id
                    const commentId = target_external_id ?? await resolveLatestCommentId(conversation_id, brand_id, isLegacyConv);

                    if (commentId) {
                        platformMessageId = await sendInstagramCommentReply(commentId, text, accessToken);
                        replyMethod = 'instagram_comment_reply';
                    } else {
                        const match = conv.external_id?.match(/^ig_(?:media_|post_)(.+?)_user_.+$/);
                        if (!match) {
                            return new Response(
                                JSON.stringify({ success: false, error: 'cannot_identify_target', message: 'لا يمكن تحديد التعليق المراد الرد عليه' }),
                                { status: 422, headers: CORS },
                            );
                        }
                        platformMessageId = await sendInstagramMediaComment(match[1], text, accessToken);
                        replyMethod = 'instagram_media_comment_fallback';
                    }
                }
            } else if (isFacebook) {
                if (reply_mode === 'dm' || conv.type === 'Message') {
                    const psid = conv.user_handle;
                    if (!psid) {
                        return new Response(
                            JSON.stringify({ success: false, error: 'missing_psid', message: 'PSID غير متوفر' }),
                            { status: 422, headers: CORS },
                        );
                    }
                    platformMessageId = await sendMessengerReply(accountId, psid, text, accessToken);
                    replyMethod = 'messenger_send_api';
                } else {
                    // Comment reply — prefer explicit target_external_id
                    const commentId = target_external_id ?? await resolveLatestCommentId(conversation_id, brand_id, isLegacyConv);

                    if (commentId) {
                        platformMessageId = await sendFbCommentReply(commentId, text, accessToken);
                        replyMethod = 'facebook_comment_reply';
                    } else {
                        const match = conv.external_id?.match(/^fb_post_(.+?)_user_.+$/);
                        if (!match) {
                            return new Response(
                                JSON.stringify({ success: false, error: 'cannot_identify_target', message: 'لا يمكن تحديد التعليق المراد الرد عليه' }),
                                { status: 422, headers: CORS },
                            );
                        }
                        platformMessageId = await sendFbPostComment(match[1], text, accessToken);
                        replyMethod = 'facebook_post_comment_fallback';
                    }
                }
            } else {
                return new Response(JSON.stringify({
                    success: false,
                    error: 'unsupported_platform',
                    message: `الرد المباشر على ${conv.platform} غير مدعوم بعد`,
                }), { status: 422, headers: CORS });
            }
        } catch (sendErr: any) {
            // Mark log as failed, then rethrow
            await markReplyResult(brand_id, idempotency_key, false, '', '', sendErr.fbCode?.toString(), sendErr.message);
            throw sendErr;
        }

        // Mark log as sent
        await markReplyResult(brand_id, idempotency_key, true, platformMessageId, replyMethod);

        console.log(`[send-reply] ${conv.platform} sent via ${replyMethod}, platform_id=${platformMessageId}`);

        return new Response(JSON.stringify({
            success:             true,
            platform_message_id: platformMessageId,
            reply_method:        replyMethod,
        }), { headers: CORS });

    } catch (err: any) {
        console.error('[send-reply] error:', err.message, err.fbCode, err.fbType);

        const isTokenErr = err.fbType === 'OAuthException' || err.fbCode === 190;
        const errorCode  = isTokenErr
            ? (err.fbCode === 190 ? 'token_expired' : 'permission_denied')
            : 'api_error';

        return new Response(JSON.stringify({
            success: false,
            error:   errorCode,
            message: isTokenErr
                ? 'انتهت صلاحية التوكن أو تم إلغاء الصلاحيات — أعد ربط الحساب'
                : err.message || 'فشل إرسال الرد',
        }), { status: isTokenErr ? 401 : 500, headers: CORS });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveLatestCommentId(
    conversationId: string,
    brandId: string,
    isLegacyConv: boolean,
): Promise<string | null> {
    if (!isLegacyConv) return null;
    const { data } = await supabase
        .from('inbox_messages')
        .select('external_message_id')
        .eq('conversation_id', conversationId)
        .eq('brand_id', brandId)
        .eq('sender', 'user')
        .not('external_message_id', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data?.external_message_id ?? null;
}
