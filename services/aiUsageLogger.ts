/**
 * aiUsageLogger.ts
 * تسجيل كل استدعاء Gemini API في جدول ai_usage_logs
 * يُستخدم للفوترة ومراقبة الاستهلاك وتحليل الأداء
 */

import { supabase } from './supabaseClient';

export type AIFeature =
    | 'content_gen'
    | 'caption_analyze'
    | 'hashtag_suggest'
    | 'analytics_insights'
    | 'brand_profile_analyze'
    | 'ad_creative'
    | 'idea_ops'
    | 'seo_writer'
    | 'image_gen'
    | 'inbox_analyze'
    | 'social_search'
    | 'error_analyze'
    | 'content_consistency'
    | 'quality_check'
    | 'marketing_plan'
    | 'other';

export interface AIUsageParams {
    feature: AIFeature;
    model: string;
    brand_id?: string | null;
    tenant_id?: string | null;
    input_tokens?: number;
    output_tokens?: number;
    prompt_chars?: number;
    latency_ms?: number;
    status?: 'success' | 'error' | 'timeout' | 'quota_exceeded';
    error_message?: string;
    error_code?: string;
    metadata?: Record<string, unknown>;
}

/**
 * يسجّل استدعاء AI واحد — fire-and-forget (لا ينتظر النتيجة)
 * الأخطاء في التسجيل لا توقف تدفق التطبيق
 */
export function logAIUsage(params: AIUsageParams): void {
    const {
        feature,
        model,
        brand_id = null,
        tenant_id = null,
        input_tokens = 0,
        output_tokens = 0,
        prompt_chars = 0,
        latency_ms,
        status = 'success',
        error_message,
        error_code,
        metadata = {},
    } = params;

    // fire-and-forget — لا نستخدم await لأننا لا نريد إبطاء واجهة المستخدم
    supabase
        .from('ai_usage_logs')
        .insert({
            feature,
            model,
            brand_id,
            tenant_id,
            input_tokens,
            output_tokens,
            prompt_chars,
            latency_ms,
            status,
            error_message: error_message ?? null,
            error_code: error_code ?? null,
            metadata,
        })
        .then(({ error }) => {
            if (error) {
                // فقط log في الـ console — لا نرمي exception
                console.warn('[AIUsageLogger] Failed to log usage:', error.message);
            }
        });
}

/**
 * Wrapper مريح لتغليف أي استدعاء AI وتسجيله تلقائياً
 * 
 * @example
 * const result = await trackAICall(
 *   'content_gen',
 *   'gemini-2.5-flash',
 *   brandId,
 *   prompt.length,
 *   () => gemini.generateContent(...)
 * );
 */
export async function trackAICall<T>(
    feature: AIFeature,
    model: string,
    brand_id: string | null,
    prompt_chars: number,
    fn: () => Promise<{ result: T; input_tokens?: number; output_tokens?: number }>
): Promise<T> {
    const start = performance.now();
    try {
        const { result, input_tokens = 0, output_tokens = 0 } = await fn();
        const latency_ms = Math.round(performance.now() - start);

        logAIUsage({
            feature,
            model,
            brand_id,
            prompt_chars,
            input_tokens,
            output_tokens,
            latency_ms,
            status: 'success',
        });

        return result;
    } catch (err: unknown) {
        const latency_ms = Math.round(performance.now() - start);
        const error_message = err instanceof Error ? err.message : String(err);

        // تحديد نوع الخطأ
        let status: AIUsageParams['status'] = 'error';
        if (error_message.includes('quota') || error_message.includes('429')) {
            status = 'quota_exceeded';
        } else if (error_message.includes('timeout') || error_message.includes('deadline')) {
            status = 'timeout';
        }

        logAIUsage({
            feature,
            model,
            brand_id,
            prompt_chars,
            latency_ms,
            status,
            error_message,
        });

        throw err; // أعد رمي الخطأ الأصلي
    }
}
