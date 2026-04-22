/**
 * Shared helper for calling the ai-proxy Edge Function.
 * All AI calls must go through this instead of calling Gemini directly from the browser.
 */

import { supabase } from './supabaseClient';

export type ProxyTextParams = {
    model: string;
    prompt?: string;
    contents?: unknown;
    schema?: unknown;
    feature?: string;
    brand_id?: string | null;
};

export type ProxyTextResponse = {
    text: string;
    usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number };
};

/** Thrown when the ai-proxy returns 403 (trial expired / suspended) or 429 (daily cap). */
export class AIQuotaError extends Error {
    constructor(
        public readonly quotaType: 'trial_expired' | 'daily_cap' | 'suspended',
        message: string,
    ) {
        super(message);
        this.name = 'AIQuotaError';
    }
}

export async function callAIProxy(params: ProxyTextParams): Promise<ProxyTextResponse> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body: params });
    if (error) {
        const msg = (error as any).message ?? 'AI proxy error';
        const status = (error as any).status ?? (error as any).context?.status;
        if (status === 403) {
            const lower = msg.toLowerCase();
            const quotaType = lower.includes('suspend') ? 'suspended' : 'trial_expired';
            throw new AIQuotaError(quotaType, msg);
        }
        if (status === 429) throw new AIQuotaError('daily_cap', msg);
        throw new Error(msg);
    }
    if (!data) throw new Error('Empty response from AI proxy');
    return data as ProxyTextResponse;
}

export const Type = {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    ARRAY: 'ARRAY',
    BOOLEAN: 'BOOLEAN',
} as const;
