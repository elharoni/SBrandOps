/**
 * ai-proxy Edge Function
 * Server-side proxy for Gemini/OpenAI AI routes, including Brand Hub file analysis.
 * Reads the API key from the DB — never exposes it to the client.
 *
 * Security:
 * - Requires valid Supabase JWT (Authorization: Bearer <token>)
 * - CORS restricted to FRONTEND_ORIGIN
 * - Request body limited to 8 MB
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

const BRAND_FILE_ANALYSIS_MODEL = Deno.env.get('OPENAI_FILE_ANALYSIS_MODEL') ?? 'gpt-4o';
const BRAND_FILE_ANALYSIS_FALLBACK_MODEL = Deno.env.get('OPENAI_FILE_ANALYSIS_FALLBACK_MODEL') ?? 'gpt-4o-mini';
const BRAND_FILE_ANALYSIS_TIMEOUT_MS = Number(Deno.env.get('OPENAI_FILE_ANALYSIS_TIMEOUT_MS') ?? 45_000);
const MAX_BRAND_FILE_DOCUMENTS = 8;
const MAX_BRAND_FILE_ANALYSIS_BYTES = 7 * 1024 * 1024;
const MAX_BRAND_TEXT_CHARS = 120_000;
const SUPPORTED_BRAND_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
]);

const BRAND_FILE_ANALYSIS_PROMPT = [
  'You are a senior brand strategist and marketing intelligence analyst inside SBrandOps.',
  'Analyze the uploaded brand file and extract practical, structured brand intelligence.',
  'The output will be saved into Brand Hub and used later for content planning, ads, SEO, inbox replies, workflow automation, and analytics.',
  'Return strict JSON only.',
  'If information is missing, do not invent it; put it in missing_information.',
  'Support Arabic and English files.',
  'Preserve brand meaning, tone, market context, and commercial logic.',
].join(' ');

const BRAND_FILE_ANALYSIS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'brand_summary',
    'brand_identity',
    'marketing_intelligence',
    'content_system',
    'business_notes',
    'source_file',
  ],
  properties: {
    brand_summary: {
      type: 'object',
      additionalProperties: false,
      required: [
        'brand_name',
        'business_type',
        'industry',
        'market',
        'target_audience',
        'positioning',
        'core_offer',
        'main_value_proposition',
      ],
      properties: {
        brand_name: { type: 'string' },
        business_type: { type: 'string' },
        industry: { type: 'string' },
        market: { type: 'string' },
        target_audience: { type: 'array', items: { type: 'string' } },
        positioning: { type: 'string' },
        core_offer: { type: 'string' },
        main_value_proposition: { type: 'string' },
      },
    },
    brand_identity: {
      type: 'object',
      additionalProperties: false,
      required: [
        'mission',
        'vision',
        'values',
        'personality',
        'tone_of_voice',
        'visual_direction',
        'colors',
        'typography',
        'logo_notes',
      ],
      properties: {
        mission: { type: 'string' },
        vision: { type: 'string' },
        values: { type: 'array', items: { type: 'string' } },
        personality: { type: 'array', items: { type: 'string' } },
        tone_of_voice: { type: 'string' },
        visual_direction: { type: 'string' },
        colors: { type: 'array', items: { type: 'string' } },
        typography: { type: 'array', items: { type: 'string' } },
        logo_notes: { type: 'string' },
      },
    },
    marketing_intelligence: {
      type: 'object',
      additionalProperties: false,
      required: [
        'main_products_or_services',
        'customer_pain_points',
        'customer_desires',
        'competitive_advantages',
        'proof_points',
        'objections',
        'content_angles',
        'ad_angles',
      ],
      properties: {
        main_products_or_services: { type: 'array', items: { type: 'string' } },
        customer_pain_points: { type: 'array', items: { type: 'string' } },
        customer_desires: { type: 'array', items: { type: 'string' } },
        competitive_advantages: { type: 'array', items: { type: 'string' } },
        proof_points: { type: 'array', items: { type: 'string' } },
        objections: { type: 'array', items: { type: 'string' } },
        content_angles: { type: 'array', items: { type: 'string' } },
        ad_angles: { type: 'array', items: { type: 'string' } },
      },
    },
    content_system: {
      type: 'object',
      additionalProperties: false,
      required: [
        'recommended_content_pillars',
        'suggested_hooks',
        'caption_style',
        'cta_suggestions',
        'do',
        'dont',
      ],
      properties: {
        recommended_content_pillars: { type: 'array', items: { type: 'string' } },
        suggested_hooks: { type: 'array', items: { type: 'string' } },
        caption_style: { type: 'string' },
        cta_suggestions: { type: 'array', items: { type: 'string' } },
        do: { type: 'array', items: { type: 'string' } },
        dont: { type: 'array', items: { type: 'string' } },
      },
    },
    business_notes: {
      type: 'object',
      additionalProperties: false,
      required: [
        'missing_information',
        'risks_or_inconsistencies',
        'recommended_next_questions',
        'confidence_score',
      ],
      properties: {
        missing_information: { type: 'array', items: { type: 'string' } },
        risks_or_inconsistencies: { type: 'array', items: { type: 'string' } },
        recommended_next_questions: { type: 'array', items: { type: 'string' } },
        confidence_score: { type: 'number' },
      },
    },
    source_file: {
      type: 'object',
      additionalProperties: false,
      required: [
        'file_name',
        'file_type',
        'detected_language',
        'analysis_provider',
        'model',
      ],
      properties: {
        file_name: { type: 'string' },
        file_type: { type: 'string' },
        detected_language: { type: 'string' },
        analysis_provider: { type: 'string', enum: ['openai'] },
        model: { type: 'string' },
      },
    },
  },
} as const;

type BrandAnalysisDocumentPayload = {
  file_name: string;
  file_type: string;
  mime_type: string;
  size_bytes: number;
  base64_data?: string;
  text_content?: string;
};

// ── Config ────────────────────────────────────────────────────────────────────

// Default daily cap per user: 100,000 tokens (~200 average requests).
// Override per-deployment with AI_DAILY_TOKEN_LIMIT env var.
const DAILY_TOKEN_LIMIT = Number(Deno.env.get('AI_DAILY_TOKEN_LIMIT') ?? 100_000);

// Default daily cap per brand: 30,000 tokens. Override with AI_BRAND_DAILY_TOKEN_LIMIT env var.
const BRAND_DAILY_TOKEN_LIMIT = Number(Deno.env.get('AI_BRAND_DAILY_TOKEN_LIMIT') ?? 30_000);

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

async function checkBrandDailySpendCap(brandId: string): Promise<{ exceeded: boolean; used: number }> {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('ai_usage_logs')
    .select('input_tokens, output_tokens')
    .eq('brand_id', brandId)
    .gte('created_at', todayStart.toISOString());

  if (error) return { exceeded: false, used: 0 };

  const used = (data ?? []).reduce(
    (sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
    0,
  );

  return { exceeded: used >= BRAND_DAILY_TOKEN_LIMIT, used };
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
async function getOpenAIApiKey(service?: 'image' | 'video'): Promise<string | null> {
  if (service) {
    const { data: specific } = await supabase
      .from('ai_provider_keys')
      .select('key_value')
      .eq('provider', `openai-${service}`)
      .eq('is_active', true)
      .maybeSingle();
    if (specific?.key_value) return specific.key_value;
  }

  const { data } = await supabase
    .from('ai_provider_keys')
    .select('key_value')
    .eq('provider', 'openai')
    .eq('is_active', true)
    .maybeSingle();
  return data?.key_value ?? Deno.env.get('OPENAI_API_KEY') ?? null;
}

async function assertBrandAccess(brandId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('brands')
    .select('id')
    .eq('id', brandId)
    .eq('user_id', userId)
    .maybeSingle();

  return !error && !!data;
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map((item) => asTrimmedString(item))
      .filter(Boolean),
  ));
}

function clampConfidenceScore(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function trimTextForModel(value: string): string {
  if (value.length <= MAX_BRAND_TEXT_CHARS) return value;
  return `${value.slice(0, MAX_BRAND_TEXT_CHARS)}\n\n[Truncated due to upload length limits]`;
}

function buildSourceFileDefaults(
  documents: BrandAnalysisDocumentPayload[],
  model: string,
): {
  file_name: string;
  file_type: string;
  detected_language: string;
  analysis_provider: 'openai';
  model: string;
} {
  return {
    file_name: documents.length === 1 ? documents[0].file_name : 'multiple files',
    file_type: documents.length === 1 ? documents[0].mime_type : 'mixed',
    detected_language: '',
    analysis_provider: 'openai',
    model,
  };
}

function normalizeBrandFileAnalysis(
  value: unknown,
  documents: BrandAnalysisDocumentPayload[],
  model: string,
) {
  const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const brandSummary = typeof raw.brand_summary === 'object' && raw.brand_summary !== null
    ? raw.brand_summary as Record<string, unknown>
    : {};
  const brandIdentity = typeof raw.brand_identity === 'object' && raw.brand_identity !== null
    ? raw.brand_identity as Record<string, unknown>
    : {};
  const marketing = typeof raw.marketing_intelligence === 'object' && raw.marketing_intelligence !== null
    ? raw.marketing_intelligence as Record<string, unknown>
    : {};
  const contentSystem = typeof raw.content_system === 'object' && raw.content_system !== null
    ? raw.content_system as Record<string, unknown>
    : {};
  const businessNotes = typeof raw.business_notes === 'object' && raw.business_notes !== null
    ? raw.business_notes as Record<string, unknown>
    : {};
  const sourceFile = typeof raw.source_file === 'object' && raw.source_file !== null
    ? raw.source_file as Record<string, unknown>
    : {};
  const defaults = buildSourceFileDefaults(documents, model);

  return {
    brand_summary: {
      brand_name: asTrimmedString(brandSummary.brand_name),
      business_type: asTrimmedString(brandSummary.business_type),
      industry: asTrimmedString(brandSummary.industry),
      market: asTrimmedString(brandSummary.market),
      target_audience: asStringArray(brandSummary.target_audience),
      positioning: asTrimmedString(brandSummary.positioning),
      core_offer: asTrimmedString(brandSummary.core_offer),
      main_value_proposition: asTrimmedString(brandSummary.main_value_proposition),
    },
    brand_identity: {
      mission: asTrimmedString(brandIdentity.mission),
      vision: asTrimmedString(brandIdentity.vision),
      values: asStringArray(brandIdentity.values),
      personality: asStringArray(brandIdentity.personality),
      tone_of_voice: asTrimmedString(brandIdentity.tone_of_voice),
      visual_direction: asTrimmedString(brandIdentity.visual_direction),
      colors: asStringArray(brandIdentity.colors),
      typography: asStringArray(brandIdentity.typography),
      logo_notes: asTrimmedString(brandIdentity.logo_notes),
    },
    marketing_intelligence: {
      main_products_or_services: asStringArray(marketing.main_products_or_services),
      customer_pain_points: asStringArray(marketing.customer_pain_points),
      customer_desires: asStringArray(marketing.customer_desires),
      competitive_advantages: asStringArray(marketing.competitive_advantages),
      proof_points: asStringArray(marketing.proof_points),
      objections: asStringArray(marketing.objections),
      content_angles: asStringArray(marketing.content_angles),
      ad_angles: asStringArray(marketing.ad_angles),
    },
    content_system: {
      recommended_content_pillars: asStringArray(contentSystem.recommended_content_pillars),
      suggested_hooks: asStringArray(contentSystem.suggested_hooks),
      caption_style: asTrimmedString(contentSystem.caption_style),
      cta_suggestions: asStringArray(contentSystem.cta_suggestions),
      do: asStringArray(contentSystem.do),
      dont: asStringArray(contentSystem.dont),
    },
    business_notes: {
      missing_information: asStringArray(businessNotes.missing_information),
      risks_or_inconsistencies: asStringArray(businessNotes.risks_or_inconsistencies),
      recommended_next_questions: asStringArray(businessNotes.recommended_next_questions),
      confidence_score: clampConfidenceScore(businessNotes.confidence_score),
    },
    source_file: {
      file_name: asTrimmedString(sourceFile.file_name) || defaults.file_name,
      file_type: asTrimmedString(sourceFile.file_type) || defaults.file_type,
      detected_language: asTrimmedString(sourceFile.detected_language),
      analysis_provider: 'openai',
      model,
    },
  };
}

function extractOpenAIOutputText(data: Record<string, unknown>): string {
  if (typeof data.output_text === 'string' && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) return '';

  for (const item of data.output) {
    if (!item || typeof item !== 'object') continue;
    const message = item as Record<string, unknown>;
    if (!Array.isArray(message.content)) continue;

    for (const contentItem of message.content) {
      if (!contentItem || typeof contentItem !== 'object') continue;
      const content = contentItem as Record<string, unknown>;
      if (typeof content.text === 'string' && content.text.trim()) {
        return content.text.trim();
      }
    }
  }

  return '';
}

function validateBrandAnalysisDocuments(documents: unknown): BrandAnalysisDocumentPayload[] {
  if (!Array.isArray(documents) || documents.length === 0) {
    throw new Error('Upload at least one supported file before starting analysis.');
  }
  if (documents.length > MAX_BRAND_FILE_DOCUMENTS) {
    throw new Error(`Too many files. Analyze up to ${MAX_BRAND_FILE_DOCUMENTS} files at a time.`);
  }

  let totalBytes = 0;

  return documents.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Invalid file payload at index ${index}.`);
    }

    const doc = item as Record<string, unknown>;
    const file_name = asTrimmedString(doc.file_name);
    const file_type = asTrimmedString(doc.file_type);
    const mime_type = asTrimmedString(doc.mime_type || doc.file_type);
    const size_bytes = typeof doc.size_bytes === 'number' ? doc.size_bytes : Number(doc.size_bytes ?? 0);
    const base64_data = asTrimmedString(doc.base64_data);
    const text_content = asTrimmedString(doc.text_content);

    if (!file_name) throw new Error('Each file must include a file name.');
    if (!mime_type || !SUPPORTED_BRAND_FILE_MIME_TYPES.has(mime_type)) {
      throw new Error(`Unsupported file type: ${mime_type || file_type || 'unknown'}`);
    }
    if (!Number.isFinite(size_bytes) || size_bytes <= 0) {
      throw new Error(`The file "${file_name}" is empty.`);
    }
    if (!base64_data && !text_content) {
      throw new Error(`The file "${file_name}" does not include readable content.`);
    }

    totalBytes += size_bytes;
    if (totalBytes > MAX_BRAND_FILE_ANALYSIS_BYTES) {
      throw new Error('The selected files are too large to analyze together. Reduce the file count or upload smaller files.');
    }

    return {
      file_name,
      file_type: file_type || mime_type,
      mime_type,
      size_bytes,
      ...(base64_data ? { base64_data } : {}),
      ...(text_content ? { text_content } : {}),
    };
  });
}

function buildBrandAnalysisInput(documents: BrandAnalysisDocumentPayload[]) {
  const content: Array<Record<string, unknown>> = [];

  for (const doc of documents) {
    if (doc.base64_data) {
      // OpenAI Responses API requires full data URI format
      const fileData = doc.base64_data.startsWith('data:')
        ? doc.base64_data
        : `data:${doc.mime_type};base64,${doc.base64_data}`;
      content.push({
        type: 'input_file',
        filename: doc.file_name,
        file_data: fileData,
      });
      content.push({
        type: 'input_text',
        text: `File metadata\nname: ${doc.file_name}\nmime_type: ${doc.mime_type}\nsize_bytes: ${doc.size_bytes}`,
      });
    }

    if (doc.text_content) {
      content.push({
        type: 'input_text',
        text: [
          `File name: ${doc.file_name}`,
          `Mime type: ${doc.mime_type}`,
          `Size bytes: ${doc.size_bytes}`,
          'Content:',
          trimTextForModel(doc.text_content),
        ].join('\n'),
      });
    }
  }

  content.push({
    type: 'input_text',
    text: [
      'Analyze all provided files together as one brand intelligence package.',
      'Return only valid JSON that matches the provided schema.',
      'If a fact is missing, add it to business_notes.missing_information instead of guessing.',
      'Use "multiple files" for source_file.file_name and "mixed" for source_file.file_type when more than one file is provided.',
      'Set source_file.analysis_provider to "openai".',
      'Set source_file.model to the exact model used for this response.',
      'Use ISO-like language tags when possible, such as "ar", "en", or "ar,en".',
    ].join('\n'),
  });

  return [{ role: 'user', content }];
}

async function runOpenAIBrandFileAnalysis(
  apiKey: string,
  model: string,
  documents: BrandAnalysisDocumentPayload[],
): Promise<{
  analysis: ReturnType<typeof normalizeBrandFileAnalysis>;
  usage: { input_tokens: number; output_tokens: number };
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRAND_FILE_ANALYSIS_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        store: false,
        instructions: BRAND_FILE_ANALYSIS_PROMPT,
        input: buildBrandAnalysisInput(documents),
        text: {
          format: {
            type: 'json_schema',
            name: 'brand_file_analysis',
            strict: true,
            schema: BRAND_FILE_ANALYSIS_SCHEMA,
          },
        },
        metadata: {
          task: 'brand_file_analysis',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `OpenAI Responses API error ${res.status}`);
    }

    const data = await res.json() as Record<string, unknown>;
    const outputText = extractOpenAIOutputText(data);
    if (!outputText) {
      throw new Error('OpenAI did not return any JSON output for brand file analysis.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new Error('OpenAI returned invalid JSON for brand file analysis.');
    }

    return {
      analysis: normalizeBrandFileAnalysis(parsed, documents, model),
      usage: {
        input_tokens: Number((data.usage as Record<string, unknown> | undefined)?.input_tokens ?? 0),
        output_tokens: Number((data.usage as Record<string, unknown> | undefined)?.output_tokens ?? 0),
      },
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('OpenAI file analysis timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function handleOpenAIBrandFileAnalysis(
  apiKey: string,
  requestedModel: unknown,
  documents: BrandAnalysisDocumentPayload[],
  correlationId: string,
): Promise<{
  analysis: ReturnType<typeof normalizeBrandFileAnalysis>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
  fallbackUsed: boolean;
}> {
  const primaryModel = asTrimmedString(requestedModel) || BRAND_FILE_ANALYSIS_MODEL;
  const fallbackModel = BRAND_FILE_ANALYSIS_FALLBACK_MODEL;
  const candidateModels = primaryModel === fallbackModel
    ? [primaryModel]
    : [primaryModel, fallbackModel];

  let lastError: Error | null = null;

  for (let index = 0; index < candidateModels.length; index += 1) {
    const model = candidateModels[index];
    try {
      const result = await runOpenAIBrandFileAnalysis(apiKey, model, documents);
      return {
        ...result,
        model,
        fallbackUsed: index > 0,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (index < candidateModels.length - 1) {
        console.warn(JSON.stringify({
          correlationId,
          event: 'brand-file-analysis-primary-failed',
          model,
          fallbackModel: candidateModels[index + 1],
          error: lastError.message,
        }));
      }
    }
  }

  throw lastError ?? new Error('Brand file analysis failed.');
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
  // Gemini 2.5+ thinking models return thought parts before the response part.
  // Skip parts with thought:true to get the actual text/JSON response.
  const parts: Array<{ text?: string; thought?: boolean }> = data.candidates?.[0]?.content?.parts ?? [];
  const responsePart = parts.find(p => !p.thought) ?? parts[0] ?? {};
  const text = responsePart?.text ?? '';
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
  const isGptImage1 = model === 'gpt-image-1';

  // Each model has different supported sizes
  const sizeMap = isGptImage1
    ? { '1:1': '1024x1024', '16:9': '1536x1024', '4:3': '1536x1024', '9:16': '1024x1536', '3:4': '1024x1536' }
    : { '1:1': '1024x1024', '16:9': '1792x1024', '4:3': '1792x1024', '9:16': '1024x1792', '3:4': '1024x1792' };

  const size = (sizeMap as Record<string, string>)[aspectRatio] ?? '1024x1024';

  const requestBody: Record<string, unknown> = { model, prompt, size };

  if (isGptImage1) {
    requestBody.quality = 'high';
    requestBody.output_format = 'png';
    requestBody.n = count;
  } else {
    // dall-e-3 / dall-e-2: b64_json response, n must be 1 for dall-e-3
    requestBody.response_format = 'b64_json';
    requestBody.n = model === 'dall-e-3' ? 1 : Math.min(count, 10);
    if (model === 'dall-e-3') requestBody.quality = 'hd';
  }

  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `OpenAI image API error ${res.status}`);
  }

  const data = await res.json();
  const mimeType = isGptImage1 ? 'image/png' : 'image/png';
  return (data.data ?? [])
    .map((item: { b64_json?: string; url?: string }) => {
      if (item.b64_json) return `data:${mimeType};base64,${item.b64_json}`;
      if (item.url) return item.url;
      return null;
    })
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

  // Fast-reject via header before reading the body (well-behaved clients).
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError('Request body too large', 413, correlationId, corsHeaders);
  }

  try {
    // Byte-level enforcement — catches clients that omit or lie about content-length.
    const rawBody = await req.arrayBuffer();
    if (rawBody.byteLength > MAX_BODY_BYTES) {
      return jsonError('Request body too large', 413, correlationId, corsHeaders);
    }
    const body = JSON.parse(new TextDecoder().decode(rawBody));
    const {
      mode = 'text',        // 'text' | 'image'
      model,
      prompt,
      contents,
      schema,
      feature,
      task,
      provider,
      brand_id,
      documents,
      // image-specific
      count = 1,
      aspect_ratio = '1:1',
    } = body;

    if (!model && mode !== 'brand-file-analysis') {
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

    // ── Per-brand daily spend cap ─────────────────────────────────────────
    if (brand_id) {
      const brandCap = await checkBrandDailySpendCap(brand_id);
      if (brandCap.exceeded) {
        console.warn(JSON.stringify({
          correlationId,
          event: 'ai-brand-spend-cap-exceeded',
          userId: userOrError.id,
          brandId: brand_id,
          tokensUsedToday: brandCap.used,
          limit: BRAND_DAILY_TOKEN_LIMIT,
        }));
        return jsonError(
          `Brand daily AI limit reached (${brandCap.used.toLocaleString()} / ${BRAND_DAILY_TOKEN_LIMIT.toLocaleString()} tokens). Try again tomorrow.`,
          429,
          correlationId,
          corsHeaders,
        );
      }
    }

    if (mode === 'brand-file-analysis') {
      const openaiKey = await getOpenAIApiKey();
      if (!openaiKey) {
        return jsonError('OPENAI_API_KEY is missing for Brand Hub file analysis.', 503, correlationId, corsHeaders);
      }
      if (provider && provider !== 'openai') {
        return jsonError(`Unsupported provider for brand file analysis: ${provider}`, 400, correlationId, corsHeaders);
      }
      if (brand_id) {
        const brandAllowed = await assertBrandAccess(String(brand_id), userOrError.id);
        if (!brandAllowed) {
          return jsonError('Brand not found or access denied', 403, correlationId, corsHeaders);
        }
      }

      try {
        const parsedDocuments = validateBrandAnalysisDocuments(documents);
        const result = await handleOpenAIBrandFileAnalysis(openaiKey, model, parsedDocuments, correlationId);
        const featureName = typeof task === 'string' && task.trim()
          ? task.trim()
          : 'brand_file_analysis';

        supabase.from('ai_usage_logs').insert({
          user_id: userOrError.id,
          brand_id: brand_id ?? null,
          feature: featureName,
          model: result.model,
          prompt_chars: 0,
          input_tokens: result.usage.input_tokens,
          output_tokens: result.usage.output_tokens,
        }).then(() => { /* fire-and-forget */ }).catch(() => { /* non-fatal */ });

        return new Response(JSON.stringify({
          analysis: result.analysis,
          provider: 'openai',
          model: result.model,
          fallbackUsed: result.fallbackUsed,
        }), {
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
        const message = error instanceof Error ? error.message : 'Brand file analysis failed.';
        console.warn(JSON.stringify({
          correlationId,
          event: 'brand-file-analysis-error',
          error: message,
        }));

        if (
          message.includes('Upload at least one supported file') ||
          message.includes('Unsupported file type') ||
          message.includes('empty') ||
          message.includes('too large') ||
          message.includes('readable content') ||
          message.includes('invalid JSON') ||
          message.includes('timed out')
        ) {
          const status = message.includes('timed out')
            ? 504
            : message.includes('invalid JSON')
            ? 502
            : 400;
          return jsonError(message, status, correlationId, corsHeaders);
        }
        throw error;
      }
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
