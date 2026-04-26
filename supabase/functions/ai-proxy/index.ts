/**
 * ai-proxy Edge Function
 * Server-side proxy for Gemini AI text and image generation.
 * Reads the API key from the DB — never exposes it to the client.
 *
 * Security:
 * - Requires valid Supabase JWT (Authorization: Bearer <token>)
 * - CORS restricted to FRONTEND_ORIGIN
 * - Request body limited to 256 KB
 * - Model allowlist enforced
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_BODY_BYTES = 8 * 1024 * 1024; // 8 MB — covers PDF/DOCX brand documents

const ALLOWED_TEXT_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
]);

const ALLOWED_IMAGE_MODELS = new Set([
  'imagen-4.0-generate-001',
  'imagen-3.0-generate-002',
]);

const ALLOWED_GEMINI_IMAGE_MODELS = new Set([
  'gemini-2.0-flash-exp',
  'gemini-2.0-flash',
]);

const ALLOWED_OPENAI_IMAGE_MODELS = new Set([
  'gpt-image-1',
  'dall-e-3',
  'dall-e-2',
]);

// ── Config ────────────────────────────────────────────────────────────────────

// Default daily cap per user: 100,000 tokens (~200 average requests).
// Override per-deployment with AI_DAILY_TOKEN_LIMIT env var.
const DAILY_TOKEN_LIMIT = Number(Deno.env.get('AI_DAILY_TOKEN_LIMIT') ?? 100_000);

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonError(msg: string, status: number, correlationId: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
  });
}

async function checkTenantTrial(userId: string): Promise<{ blocked: boolean; reason: string }> {
  const { data } = await supabase
    .from('tenants')
    .select('status, trial_ends_at')
    .eq('owner_id', userId)
    .maybeSingle();

  if (!data) return { blocked: false, reason: '' };
  if (data.status === 'suspended' || data.status === 'cancelled') {
    return { blocked: true, reason: 'Account is suspended. Please contact support.' };
  }
  if (data.status === 'trial' && data.trial_ends_at && new Date(data.trial_ends_at) < new Date()) {
    return { blocked: true, reason: 'Your trial has expired. Please upgrade to continue using AI features.' };
  }
  return { blocked: false, reason: '' };
}

async function checkDailySpendCap(userId: string): Promise<{ exceeded: boolean; used: number }> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('input_tokens, output_tokens')
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString());

  if (error) return { exceeded: false, used: 0 }; // fail open — don't block on DB error

  const used = (data ?? []).reduce(
    (sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
    0,
  );

  return { exceeded: used >= DAILY_TOKEN_LIMIT, used };
}

// Looks up service-specific key first (e.g. 'gemini-design'), falls back to generic 'gemini'
async function getGeminiApiKey(service: 'content' | 'design' | 'video' = 'content'): Promise<string | null> {
  const { data: specific } = await supabase
    .from('ai_provider_keys')
    .select('key_value')
    .eq('provider', `gemini-${service}`)
    .eq('is_active', true)
    .maybeSingle();
  if (specific?.key_value) return specific.key_value;

  const { data } = await supabase
    .from('ai_provider_keys')
    .select('key_value')
    .eq('provider', 'gemini')
    .eq('is_active', true)
    .maybeSingle();
  return data?.key_value ?? Deno.env.get('GEMINI_API_KEY') ?? null;
}

// Looks up service-specific key first (e.g. 'openai-image'), falls back to generic 'openai'
async function getOpenAIApiKey(service: 'image' | 'video' = 'image'): Promise<string | null> {
  const { data: specific } = await supabase
    .from('ai_provider_keys')
    .select('key_value')
    .eq('provider', `openai-${service}`)
    .eq('is_active', true)
    .maybeSingle();
  if (specific?.key_value) return specific.key_value;

  const { data } = await supabase
    .from('ai_provider_keys')
    .select('key_value')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .maybeSingle();
  return data?.key_value ?? Deno.env.get('OPENAI_API_KEY') ?? null;
}

// ── Text generation ───────────────────────────────────────────────────────────

async function handleTextGeneration(
  apiKey: string,
  model: string,
  prompt: string | undefined,
  contents: unknown[] | undefined,
  schema: unknown | undefined,
): Promise<{ text: string; usageMetadata: Record<string, number> }> {
  const geminiContents = contents ?? [{ parts: [{ text: String(prompt) }] }];
  const body: Record<string, unknown> = { contents: geminiContents };

  if (schema) {
    body.generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: schema,
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Gemini API error ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const usageMetadata: Record<string, number> = data.usageMetadata ?? {};
  return { text, usageMetadata };
}

// ── Image generation (Imagen) ─────────────────────────────────────────────────

async function handleImageGeneration(
  apiKey: string,
  model: string,
  prompt: string,
  count: number,
  aspectRatio: string,
): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      instances: [{ prompt }],
      parameters: {
        sampleCount: count,
        aspectRatio,
        outputMimeType: 'image/jpeg',
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Imagen API error ${res.status}`);
  }

  const data = await res.json();
  return (data.predictions ?? [])
    .map((p: { bytesBase64Encoded?: string }) =>
      p.bytesBase64Encoded ? `data:image/jpeg;base64,${p.bytesBase64Encoded}` : null,
    )
    .filter(Boolean) as string[];
}

// ── Image generation (Gemini native — supports Arabic text in image) ──────────

async function handleGeminiImageGeneration(
  apiKey: string,
  model: string,
  prompt: string,
  count: number,
): Promise<string[]> {
  const results: string[] = [];
  for (let i = 0; i < count; i++) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['image', 'text'] },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Gemini image API error ${res.status}`);
    }

    const data = await res.json();
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        results.push(`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`);
        break;
      }
    }
  }
  return results;
}

// ── Image generation (OpenAI gpt-image-1) ────────────────────────────────────

async function handleOpenAIImageGeneration(
  apiKey: string,
  model: string,
  prompt: string,
  count: number,
  aspectRatio: string,
): Promise<string[]> {
  // Map aspect ratio to supported OpenAI sizes
  const sizeMap: Record<string, string> = {
    '1:1':  '1024x1024',
    '16:9': '1536x1024',
    '4:3':  '1536x1024',
    '9:16': '1024x1536',
    '3:4':  '1024x1536',
  };
  const size = sizeMap[aspectRatio] ?? '1024x1024';

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: count,
      size,
      quality: 'high',
      output_format: 'png',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI image API error ${res.status}`);
  }

  const data = await res.json();
  return (data.data ?? [])
    .map((item: { b64_json?: string }) =>
      item.b64_json ? `data:image/png;base64,${item.b64_json}` : null,
    )
    .filter(Boolean) as string[];
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const userOrError = await verifyJWT(req, correlationId, corsHeaders);
  if (userOrError instanceof Response) return userOrError;

  if (req.method !== 'POST') {
    return jsonError('Method Not Allowed', 405, correlationId, corsHeaders);
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError('Request body too large', 413, correlationId, corsHeaders);
  }

  try {
    const body = await req.json();
    const {
      mode = 'text',        // 'text' | 'image'
      model,
      prompt,
      contents,
      schema,
      feature,
      brand_id,
      // image-specific
      count = 1,
      aspect_ratio = '1:1',
    } = body;

    if (!model) {
      return jsonError('model is required', 400, correlationId, corsHeaders);
    }

    // ── Trial / account status check ──────────────────────────────────────
    const { blocked, reason } = await checkTenantTrial(userOrError.id);
    if (blocked) {
      return jsonError(reason, 403, correlationId, corsHeaders);
    }

    // ── Daily spend cap check ─────────────────────────────────────────────
    const { exceeded, used } = await checkDailySpendCap(userOrError.id);
    if (exceeded) {
      console.warn(JSON.stringify({
        correlationId,
        event: 'ai-spend-cap-exceeded',
        userId: userOrError.id,
        tokensUsedToday: used,
        limit: DAILY_TOKEN_LIMIT,
      }));
      return jsonError(
        `Daily AI usage limit reached (${used.toLocaleString()} / ${DAILY_TOKEN_LIMIT.toLocaleString()} tokens). Try again tomorrow.`,
        429,
        correlationId,
        corsHeaders,
      );
    }

    if (mode === 'openai-image') {
      const openaiKey = await getOpenAIApiKey('image');
      if (!openaiKey) {
        return jsonError('No active OpenAI image API key configured', 503, correlationId, corsHeaders);
      }
      const mdl = model ?? 'gpt-image-1';
      if (!ALLOWED_OPENAI_IMAGE_MODELS.has(mdl)) {
        return jsonError(`OpenAI image model not allowed: ${mdl}`, 400, correlationId, corsHeaders);
      }
      if (!prompt) {
        return jsonError('prompt is required for image generation', 400, correlationId, corsHeaders);
      }
      const clampedCount = Math.min(Math.max(1, Number(count)), 4);
      const images = await handleOpenAIImageGeneration(openaiKey, mdl, String(prompt), clampedCount, aspect_ratio);
      return new Response(JSON.stringify({ images }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    if (mode === 'image') {
      const apiKey = await getGeminiApiKey('design');
      if (!apiKey) return jsonError('No active Gemini design API key configured', 503, correlationId, corsHeaders);
      if (!ALLOWED_IMAGE_MODELS.has(model)) return jsonError(`Image model not allowed: ${model}`, 400, correlationId, corsHeaders);
      if (!prompt) return jsonError('prompt is required for image generation', 400, correlationId, corsHeaders);
      const clampedCount = Math.min(Math.max(1, Number(count)), 4);
      const images = await handleImageGeneration(apiKey, model, String(prompt), clampedCount, aspect_ratio);
      return new Response(JSON.stringify({ images }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId, 'X-Tokens-Used-Today': String(used), 'X-Tokens-Limit-Today': String(DAILY_TOKEN_LIMIT) },
      });
    }

    if (mode === 'gemini-image') {
      const apiKey = await getGeminiApiKey('design');
      if (!apiKey) return jsonError('No active Gemini design API key configured', 503, correlationId, corsHeaders);
      if (!ALLOWED_GEMINI_IMAGE_MODELS.has(model)) return jsonError(`Gemini image model not allowed: ${model}`, 400, correlationId, corsHeaders);
      if (!prompt) return jsonError('prompt is required for image generation', 400, correlationId, corsHeaders);
      const clampedCount = Math.min(Math.max(1, Number(count)), 4);
      const images = await handleGeminiImageGeneration(apiKey, model, String(prompt), clampedCount);
      return new Response(JSON.stringify({ images }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId, 'X-Tokens-Used-Today': String(used), 'X-Tokens-Limit-Today': String(DAILY_TOKEN_LIMIT) },
      });
    }

    // Default: text generation
    const apiKey = await getGeminiApiKey('content');
    if (!apiKey) return jsonError('No active Gemini content API key configured', 503, correlationId, corsHeaders);
    if (!ALLOWED_TEXT_MODELS.has(model)) {
      return jsonError(`Text model not allowed: ${model}`, 400, correlationId, corsHeaders);
    }
    if (!prompt && !contents) {
      return jsonError('prompt or contents is required', 400, correlationId, corsHeaders);
    }

    const { text, usageMetadata } = await handleTextGeneration(apiKey, model, prompt, contents, schema);

    // Log usage (non-fatal)
    if (feature) {
      const promptChars = prompt
        ? String(prompt).length
        : JSON.stringify(contents ?? '').length;

      supabase.from('ai_usage_logs').insert({
        user_id: userOrError.id,
        brand_id: brand_id ?? null,
        feature,
        model,
        prompt_chars: promptChars,
        input_tokens: usageMetadata.promptTokenCount ?? 0,
        output_tokens: usageMetadata.candidatesTokenCount ?? 0,
      }).then(() => { /* fire-and-forget */ }).catch(() => { /* non-fatal */ });
    }

    return new Response(JSON.stringify({ text, usageMetadata }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
        'X-Tokens-Used-Today': String(used),
        'X-Tokens-Limit-Today': String(DAILY_TOKEN_LIMIT),
      },
    });

  } catch (error) {
    console.error(JSON.stringify({
      correlationId,
      event: 'ai-proxy-error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }));
    return jsonError(
      error instanceof Error ? error.message : 'Server error',
      500,
      correlationId,
      corsHeaders,
    );
  }
});
