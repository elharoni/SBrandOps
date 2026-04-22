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

export async function callAIProxy(params: ProxyTextParams): Promise<ProxyTextResponse> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body: params });
    if (error) throw new Error(error.message ?? 'AI proxy error');
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
