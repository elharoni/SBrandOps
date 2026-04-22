// services/aiProviderKeysService.ts — AI Provider API Keys Management
import { supabase } from './supabaseClient';
import { AIProviderKey, AIProvider } from '../types';

function mapRowToKey(row: any): AIProviderKey {
    return {
        id: row.id,
        provider: row.provider as AIProvider,
        name: row.name,
        keyMasked: row.key_masked,
        isActive: row.is_active,
        createdAt: row.created_at,
        lastTestedAt: row.last_tested_at ?? null,
        testStatus: row.test_status ?? 'untested',
    };
}

export async function getAIProviderKeys(): Promise<AIProviderKey[]> {
    const { data, error } = await supabase
        .from('ai_provider_keys')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('getAIProviderKeys error:', error);
        return [];
    }
    return (data || []).map(mapRowToKey);
}

export async function createAIProviderKey(
    provider: AIProvider,
    name: string,
    apiKey: string
): Promise<AIProviderKey> {
    const keyMasked = apiKey.slice(0, 6) + '...' + apiKey.slice(-4);

    const { data, error } = await supabase
        .from('ai_provider_keys')
        .insert({
            provider,
            name,
            key_value: apiKey,
            key_masked: keyMasked,
            is_active: false,
            test_status: 'untested',
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapRowToKey(data);
}

export async function deleteAIProviderKey(id: string): Promise<void> {
    const { error } = await supabase
        .from('ai_provider_keys')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
}

export async function setActiveProviderKey(
    provider: AIProvider,
    keyId: string
): Promise<void> {
    // Deactivate all keys for this provider first
    const { error: deactivateError } = await supabase
        .from('ai_provider_keys')
        .update({ is_active: false })
        .eq('provider', provider);

    if (deactivateError) throw new Error(deactivateError.message);

    // Activate the selected key
    const { error: activateError } = await supabase
        .from('ai_provider_keys')
        .update({ is_active: true })
        .eq('id', keyId);

    if (activateError) throw new Error(activateError.message);
}

export async function testAIProviderKey(id: string): Promise<'ok' | 'failed'> {
    // Fetch the key value for testing
    const { data, error } = await supabase
        .from('ai_provider_keys')
        .select('key_value, provider')
        .eq('id', id)
        .single();

    if (error || !data) throw new Error('Key not found');

    let testResult: 'ok' | 'failed' = 'failed';

    try {
        if (data.provider === 'gemini') {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models?key=${data.key_value}`,
                { signal: AbortSignal.timeout(8000) }
            );
            testResult = res.ok ? 'ok' : 'failed';
        } else if (data.provider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/models', {
                headers: { Authorization: `Bearer ${data.key_value}` },
                signal: AbortSignal.timeout(8000),
            });
            testResult = res.ok ? 'ok' : 'failed';
        } else if (data.provider === 'anthropic') {
            const res = await fetch('https://api.anthropic.com/v1/models', {
                headers: {
                    'x-api-key': data.key_value,
                    'anthropic-version': '2023-06-01',
                },
                signal: AbortSignal.timeout(8000),
            });
            testResult = res.ok ? 'ok' : 'failed';
        } else {
            testResult = 'ok'; // assume ok for other providers
        }
    } catch {
        testResult = 'failed';
    }

    await supabase
        .from('ai_provider_keys')
        .update({
            test_status: testResult,
            last_tested_at: new Date().toISOString(),
        })
        .eq('id', id);

    return testResult;
}
