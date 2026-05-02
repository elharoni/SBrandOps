/**
 * bmb-agent Edge Function — M2 Skeleton
 *
 * The Brand Media Buyer (البيير) AI agent.
 * Accepts a chat message + conversation history, loads brand + campaign context,
 * builds a system prompt, calls Gemini 2.5 Flash, and logs to bmb_runs.
 *
 * Body:    { brand_id: string, message: string, history?: GeminiContent[] }
 * Response: { reply: string, run_id: string | null }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BMB_MODEL     = 'gemini-2.5-flash';
const BMB_TIMEOUT   = 60_000;
const MAX_BODY_BYTES = 64 * 1024; // 64 KB — chat messages only

function jsonError(msg: string, status: number, correlationId: string, corsHeaders: Record<string, string>): Response {
    return new Response(JSON.stringify({ error: msg }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
}

async function getGeminiApiKey(): Promise<string | null> {
    const { data } = await supabase
        .from('ai_provider_keys')
        .select('key_value')
        .eq('provider', 'gemini')
        .eq('is_active', true)
        .maybeSingle();
    return data?.key_value ?? Deno.env.get('GEMINI_API_KEY') ?? null;
}

// ── Brand context loader ──────────────────────────────────────────────────────

interface BrandContext {
    name:       string;
    industry:   string | null;
    country:    string | null;
    cpaTargets: { tofu: number | null; mofu: number | null; bofu: number | null; currency: string };
    campaigns:  { name: string; layer: string; status: string; spend7d: number; cpa7d: number | null }[];
}

async function loadBrandContext(brandId: string): Promise<BrandContext> {
    const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    const [brandRes, targetsRes, campaignsRes, insightsRes] = await Promise.all([
        supabase.from('brands')
            .select('name, industry, country')
            .eq('id', brandId)
            .maybeSingle(),

        supabase.from('cpa_targets')
            .select('funnel_layer, target_cpa, currency')
            .eq('brand_id', brandId),

        supabase.from('ad_campaigns')
            .select('id, name, funnel_layer, status, internal_status, external_campaign_id')
            .eq('brand_id', brandId)
            .neq('internal_status', 'killed')
            .order('created_at', { ascending: false })
            .limit(12),

        supabase.from('ad_insights')
            .select('external_object_id, spend, conversions')
            .eq('brand_id', brandId)
            .eq('object_type', 'campaign')
            .gte('date', since7d),
    ]);

    // CPA target map
    const cpaMap: Record<string, number> = {};
    let currency = 'EGP';
    for (const t of targetsRes.data ?? []) {
        cpaMap[t.funnel_layer] = Number(t.target_cpa);
        currency = t.currency ?? 'EGP';
    }

    // Aggregate insights by external_campaign_id
    const insightAgg: Record<string, { spend: number; conversions: number }> = {};
    for (const r of insightsRes.data ?? []) {
        const key = r.external_object_id;
        if (!insightAgg[key]) insightAgg[key] = { spend: 0, conversions: 0 };
        insightAgg[key].spend       += Number(r.spend       ?? 0);
        insightAgg[key].conversions += Number(r.conversions ?? 0);
    }

    const campaigns = (campaignsRes.data ?? []).map(c => {
        const agg  = insightAgg[c.external_campaign_id ?? ''] ?? { spend: 0, conversions: 0 };
        const cpa7d = agg.spend > 0 && agg.conversions > 0 ? agg.spend / agg.conversions : null;
        return {
            name:    c.name,
            layer:   c.funnel_layer ?? 'tofu',
            status:  c.internal_status ?? c.status ?? 'unknown',
            spend7d: agg.spend,
            cpa7d,
        };
    });

    return {
        name:     brandRes.data?.name     ?? 'البراند',
        industry: brandRes.data?.industry ?? null,
        country:  brandRes.data?.country  ?? null,
        cpaTargets: {
            tofu: cpaMap['tofu'] ?? null,
            mofu: cpaMap['mofu'] ?? null,
            bofu: cpaMap['bofu'] ?? null,
            currency,
        },
        campaigns,
    };
}

// ── System prompt builder ─────────────────────────────────────────────────────

function buildSystemPrompt(ctx: BrandContext): string {
    const cur = ctx.cpaTargets.currency;
    const fmtCpa = (v: number | null) => v != null ? `${v.toFixed(0)} ${cur}` : 'غير محدد';

    const lines: string[] = [
        'أنت البيير — وكيل ذكاء اصطناعي متخصص في الميديا بايينج والإعلانات الرقمية.',
        'أنت تعمل داخل منصة SBrandOps لإدارة حملات Meta Ads.',
        '',
        '## معلومات البراند',
        `- الاسم: ${ctx.name}`,
    ];
    if (ctx.industry) lines.push(`- الصناعة: ${ctx.industry}`);
    if (ctx.country)  lines.push(`- السوق: ${ctx.country}`);
    lines.push(
        '',
        `## أهداف CPA (${cur})`,
        `- TOFU (توعية):  ${fmtCpa(ctx.cpaTargets.tofu)}`,
        `- MOFU (تفاعل):  ${fmtCpa(ctx.cpaTargets.mofu)}`,
        `- BOFU (تحويل): ${fmtCpa(ctx.cpaTargets.bofu)}`,
        '',
    );

    if (ctx.campaigns.length > 0) {
        lines.push('## الحملات النشطة (آخر 7 أيام)');
        for (const c of ctx.campaigns) {
            const cpa = c.cpa7d != null ? `${c.cpa7d.toFixed(0)} ${cur}` : 'لا تحويلات';
            lines.push(`- [${c.layer.toUpperCase()}] ${c.name} | ${c.status} | إنفاق: ${c.spend7d.toFixed(0)} ${cur} | CPA: ${cpa}`);
        }
        lines.push('');
    } else {
        lines.push('## الحملات: لا توجد حملات نشطة حاليًا\n');
    }

    lines.push(
        '## تعليمات',
        '- رد دائمًا باللغة العربية.',
        '- قدم تحليلات دقيقة وقابلة للتنفيذ بناءً على البيانات المتوفرة.',
        '- عند اقتراح قرارات (Scale / Kill / Duplicate / Refresh)، اذكر السبب والمقاييس التي تستند إليها.',
        '- إذا لم تتوفر بيانات كافية، اطلب معلومات إضافية بدلاً من الاستنتاج.',
        '- لا تخترع أرقامًا أو معلومات غير موجودة في السياق.',
    );

    return lines.join('\n');
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    const userOrError = await verifyJWT(req, correlationId, corsHeaders);
    if (userOrError instanceof Response) return userOrError;

    if (req.method !== 'POST') return jsonError('Method Not Allowed', 405, correlationId, corsHeaders);

    // Body size guard
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) return jsonError('Request too large', 413, correlationId, corsHeaders);

    let brand_id: string;
    let message:  string;
    let history:  { role: string; parts: { text: string }[] }[];

    try {
        const rawBody = await req.arrayBuffer();
        if (rawBody.byteLength > MAX_BODY_BYTES) return jsonError('Request too large', 413, correlationId, corsHeaders);
        const body = JSON.parse(new TextDecoder().decode(rawBody));
        brand_id = String(body.brand_id ?? '').trim();
        message  = String(body.message  ?? '').trim();
        history  = Array.isArray(body.history) ? body.history : [];
    } catch {
        return jsonError('Invalid JSON body', 400, correlationId, corsHeaders);
    }

    if (!brand_id) return jsonError('brand_id is required', 400, correlationId, corsHeaders);
    if (!message)  return jsonError('message is required',  400, correlationId, corsHeaders);

    // Assert brand membership
    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, brand_id, correlationId, corsHeaders);
    if (ownershipError) return ownershipError;

    // Load API key + brand context in parallel
    const [apiKey, ctx] = await Promise.all([
        getGeminiApiKey(),
        loadBrandContext(brand_id),
    ]);

    if (!apiKey) return jsonError('No active Gemini API key configured', 503, correlationId, corsHeaders);

    const systemPrompt = buildSystemPrompt(ctx);

    // Create bmb_run record (best-effort — don't fail if insert fails)
    let runId: string | null = null;
    try {
        const { data: runRow } = await supabase.from('bmb_runs').insert({
            brand_id,
            run_type: 'on_demand',
            trigger:  'operator',
            status:   'running',
            input:    { message, history_length: history.length },
            model:    BMB_MODEL,
        }).select('id').single();
        runId = runRow?.id ?? null;
    } catch { /* non-fatal */ }

    const startMs = Date.now();

    try {
        const contents = [
            ...history.map(h => ({ role: h.role, parts: h.parts })),
            { role: 'user', parts: [{ text: message }] },
        ];

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${BMB_MODEL}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  AbortSignal.timeout(BMB_TIMEOUT),
            body:    JSON.stringify({
                systemInstruction: { parts: [{ text: systemPrompt }] },
                contents,
                generationConfig: {
                    temperature:      0.3,
                    maxOutputTokens:  2048,
                },
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error((errData as { error?: { message?: string } })?.error?.message ?? `Gemini error ${res.status}`);
        }

        const data    = await res.json();
        const reply   = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
        const usage   = (data.usageMetadata ?? {}) as Record<string, number>;
        const latency = Date.now() - startMs;

        if (runId) {
            supabase.from('bmb_runs').update({
                status:        'completed',
                output:        { reply: reply.slice(0, 8000) },
                input_tokens:  usage.promptTokenCount      ?? null,
                output_tokens: usage.candidatesTokenCount  ?? null,
                latency_ms:    latency,
                completed_at:  new Date().toISOString(),
            }).eq('id', runId).then(() => {/* fire-and-forget */}).catch(() => {/* non-fatal */});
        }

        console.log(JSON.stringify({
            correlationId,
            event:     'bmb-agent-ok',
            brandId:   brand_id,
            model:     BMB_MODEL,
            latencyMs: latency,
            inputTok:  usage.promptTokenCount     ?? 0,
            outputTok: usage.candidatesTokenCount ?? 0,
        }));

        return new Response(JSON.stringify({ reply, run_id: runId }), {
            status:  200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
        });

    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';

        if (runId) {
            supabase.from('bmb_runs').update({
                status:        'failed',
                error_message: msg,
                completed_at:  new Date().toISOString(),
            }).eq('id', runId).then(() => {/* fire-and-forget */}).catch(() => {/* non-fatal */});
        }

        console.error(JSON.stringify({ correlationId, event: 'bmb-agent-error', error: msg }));
        return jsonError(msg, 502, correlationId, corsHeaders);
    }
});
