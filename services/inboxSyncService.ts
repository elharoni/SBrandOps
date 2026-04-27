import { supabase } from './supabaseClient';

export interface SyncResult {
    platform: string;
    accountId: string;
    accountName: string;
    conversationsSynced: number;
    messagesSynced: number;
    error?: string;
    errorCode?: string;
}

export interface SyncResponse {
    success: boolean;
    results: SyncResult[];
    totalConversations: number;
    totalMessages: number;
    message: string;
}

export interface SendReplyResult {
    success: boolean;
    platformMessageId?: string;
    replyMethod?: string;
    error?: string;    // 'no_token' | 'token_expired' | 'permission_denied' | 'api_error' | ...
    message?: string;
}

export async function syncInboxFromSocial(
    brandId: string,
    platform: 'facebook' | 'instagram' | 'all' = 'all',
): Promise<SyncResponse> {
    const { data, error } = await supabase.functions.invoke('sync-inbox', {
        body: { brand_id: brandId, platform },
    });

    if (error) {
        throw new Error(error.message || 'فشل الاتصال بخدمة المزامنة');
    }

    return data as SyncResponse;
}

export async function sendInboxReply(
    brandId: string,
    conversationId: string,
    message: string,
    options?: {
        replyMode?: 'dm' | 'public_comment_reply' | 'private_comment_reply' | 'ad_comment_reply';
        targetExternalId?: string;
        idempotencyKey?: string;
    },
): Promise<SendReplyResult> {
    const { data, error } = await supabase.functions.invoke('send-reply', {
        body: {
            brand_id:           brandId,
            conversation_id:    conversationId,
            message,
            reply_mode:         options?.replyMode,
            target_external_id: options?.targetExternalId,
            idempotency_key:    options?.idempotencyKey ?? crypto.randomUUID(),
        },
    });

    if (error) {
        return { success: false, error: 'invoke_error', message: error.message };
    }

    return {
        success:           data?.success ?? false,
        platformMessageId: data?.platform_message_id,
        replyMethod:       data?.reply_method,
        error:             data?.error,
        message:           data?.message,
    };
}
