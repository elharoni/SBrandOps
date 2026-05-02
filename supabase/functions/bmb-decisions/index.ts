/**
 * bmb-decisions Edge Function — M3 Decisions Engine
 *
 * Analyzes active campaigns against CPA targets and automation policy,
 * calls Gemini 2.5 Pro to generate structured KILL/SCALE/DUPLICATE/REFRESH
 * proposals, deduplicates against existing pending decisions, and inserts
 * into ad_decisions.
 *
 * Body:    { brand_id: string }
 * Response: { decisions: RawDecision[], run_id: string | null, inserted: number }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BMB_MODEL   = 'gemini-2.5-pro';
const BMB_TIMEOUT = 90_000;

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

// ── Types ─────────────────────────────────────────────────────────────────────

type DecisionType = 'scale' | 'kill' | 'duplicate' | 'refresh' | 'review' | 'hold';

interface RawDecision {
    target_type:        'campaign';
    target_id:          string;
    target_name:        string;
    decision_type:      DecisionType;
    reasoning:          string;
    supporting_metrics: {
        cpa?:            number | null;
        target_cpa?:     number | null;
        cpa_multiplier?: number | null;
        frequency?:      number | null;
        ctr_drop_pct?:   number | null;
        spend?:          number | null;
        conversions?:    number | null;
    };
    scale_percent?: number | null;
    source_id?:     string | null;
}

// ── Context loader ────────────────────────────────────────────────────────────

async function loadDecisionContext(brandId: string) {
    const since7d = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

    const [brandRes, targetsRes, policyRes, campaignsRes, insightsRes] = await Promise.all([
        supabase.from('brands')
            .select('name, industry, country')
            .eq('id', brandId)
            .maybeSingle(),

        supabase.from('cpa_targets')
            .select('funnel_layer, target_cpa, currency')
            .eq('brand_id', brandId),

        supabase.from('automation_policies')
            .select('kill_cpa_multiplier, monthly_budget')
            .eq('brand_id', brandId)
            .maybeSingle(),

        supabase.from('ad_campaigns')
            .select('id, name, funnel_layer, status, internal_status, external_campaign_id, budget_daily')
            .eq('brand_id', brandId)
            .in('internal_status', ['live', 'paused', 'draft'])
            .order('created_at', { ascending: false })
            .limit(20),

        supabase.from('ad_insights')
            .select('external_object_id, date, spend, conversions, impressions, clicks')
            .eq('brand_id', brandId)
            .eq('object_type', 'campaign')
            .gte('date', since7d),
    ]);

    const cpaMap: Record<string, number> = {};
    let currency = 'EGP';
    for (const t of targetsRes.data ?? []) {
        cpaMap[t.funnel_layer] = Number(t.target_cpa);
        currency = t.currency ?? currency;
    }

    const killMultiplier = Number(policyRes.data?.kill_cpa_multiplier ?? 2.0);

    // Aggregate 7-day insights per external campaign id
    const insightAgg: Record<string, { spend: number; conversions: number; impressions: number; clicks: number }> = {};
    for (const r of insightsRes.data ?? []) {
        const k = r.external_object_id;
        if (!insightAgg[k]) insightAgg[k] = { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
        insightAgg[k].spend       += Number(r.spend ?? 0);
        insightAgg[k].conversions += Number(r.conversions ?? 0);
        insightAgg[k].impressions += Number(r.impressions ?? 0);
        insightAgg[k].clicks      += Number(r.clicks ?? 0);
    }

    const campaigns = (campaignsRes.data ?? []).map(c => {
        const agg  = insightAgg[c.external_campaign_id ?? ''] ?? { spend: 0, conversions: 0, impressions: 0, clicks: 0 };
        const cpa7d      = agg.spend > 0 && agg.conversions > 0 ? agg.spend / agg.conversions : null;
        const ctr7d      = agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : null;
        const targetCpa  = cpaMap[c.funnel_layer ?? 'tofu'] ?? null;
        const multiplier = cpa7d && targetCpa ? cpa7d / targetCpa : null;

        return {
            id:            c.id as string,
            name:          c.name as string,
            layer:         (c.funnel_layer ?? 'tofu') as string,
            status:        (c.internal_status ?? c.status ?? 'live') as string,
            spend7d:       agg.spend,
            conversions7d: agg.conversions,
            cpa7d,
            ctr7d,
            targetCpa,
            cpaMultiplier: multiplier,
            killThreshold: targetCpa ? targetCpa * killMultiplier : null,
        };
    });

    return {
        brand:          { name: brandRes.data?.name ?? 'البراند', industry: brandRes.data?.industry ?? null, country: brandRes.data?.country ?? null },
        currency,
        killMultiplier,
        campaigns,
    };
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildDecisionsPrompt(ctx: Awaited<ReturnType<typeof loadDecisionContext>>): string {
    const cur = ctx.currency;

    const lines: string[] = [
        `أنت البيير — محلل ميديا بايينج متخصص لبراند ${ctx.brand.name}${ctx.brand.country ? ` في ${ctx.brand.country}` : ''}.`,
        'مهمتك: تحليل أداء الحملات وتقديم مقترحات قرارات موضوعية بصيغة JSON array فقط — بدون أي نص خارجه.',
        '',
        `معامل الإيقاف (KILL): CPA أعلى من ${ctx.killMultiplier}x فوق هدف CPA.`,
        '',
        '## الحملات (آخر 7 أيام):',
    ];

    if (ctx.campaigns.length === 0) {
        lines.push('لا توجد حملات نشطة.');
    } else {
        for (const c of ctx.campaigns) {
            lines.push(`### UUID: ${c.id}`);
            lines.push(`الاسم: ${c.name} | الطبقة: ${c.layer.toUpperCase()} | الحالة: ${c.status}`);
            lines.push(`الإنفاق 7 أيام: ${c.spend7d.toFixed(0)} ${cur}`);
            lines.push(`التحويلات: ${c.conversions7d}`);
            lines.push(`CPA الفعلي: ${c.cpa7d != null ? c.cpa7d.toFixed(1) + ' ' + cur : 'لا تحويلات'}`);
            lines.push(`CPA المستهدف: ${c.targetCpa != null ? c.targetCpa.toFixed(0) + ' ' + cur : 'غير محدد'}`);
            lines.push(`مضاعف CPA: ${c.cpaMultiplier != null ? c.cpaMultiplier.toFixed(2) + 'x' : 'N/A'}`);
            lines.push(`CTR: ${c.ctr7d != null ? c.ctr7d.toFixed(2) + '%' : 'N/A'}`);
            lines.push('');
        }
    }

    lines.push(
        '## قواعد القرارات:',
        `- KILL: CPA > ${ctx.killMultiplier}x الهدف مع إنفاق > 200 ${cur}.`,
        '- SCALE: CPA ≤ 0.8x الهدف مع تحويلات ≥ 3. اقترح scale_percent بين 10-50.',
        '- DUPLICATE: حملة ممتازة (CPA ≤ 0.7x) يمكن نسخها لطبقة قمع مختلفة.',
        '- REFRESH: CTR < 1% أو لا تحويلات مع إنفاق > 300 — الإبداع يحتاج تجديد.',
        '- REVIEW: بيانات غير كافية (إنفاق < 100) أو وضع غير واضح.',
        '- HOLD: أداء مقبول (0.8x ≤ CPA ≤ 1.2x الهدف)، لا تغيير مطلوب.',
        '',
        '## تعليمات:',
        '- أصدر قراراً واحداً لكل حملة (لا تُكرر نفس الحملة).',
        '- استخدم UUID الحملة الفعلي في target_id بالضبط.',
        '- اكتب reasoning باللغة العربية، جملة أو جملتين فقط.',
        '- ضع القيم الفعلية في supporting_metrics من البيانات أعلاه.',
        '',
        '## صيغة الإخراج — JSON array فقط:',
        JSON.stringify([
            {
                target_type:        'campaign',
                target_id:          '<campaign UUID>',
                target_name:        '<اسم الحملة>',
                decision_type:      'kill|scale|duplicate|refresh|review|hold',
                reasoning:          '<سبب القرار بالعربية>',
                supporting_metrics: {
                    cpa:            null,
                    target_cpa:     null,
                    cpa_multiplier: null,
                    frequency:      null,
                    ctr_drop_pct:   null,
                    spend:          null,
                    conversions:    null,
                },
                scale_percent: null,
                source_id:     null,
            },
        ], null, 2),
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

    let brand_id: string;
    try {
        const body = await req.json();
        brand_id   = String(body.brand_id ?? '').trim();
    } catch {
        return jsonError('Invalid JSON body', 400, correlationId, corsHeaders);
    }

    if (!brand_id) return jsonError('brand_id is required', 400, correlationId, corsHeaders);

    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, brand_id, correlationId, corsHeaders);
    if (ownershipError) return ownershipError;

    const [apiKey, ctx] = await Promise.all([
        getGeminiApiKey(),
        loadDecisionContext(brand_id),
    ]);

    if (!apiKey) return jsonError('No active Gemini API key', 503, correlationId, corsHeaders);
    if (ctx.campaigns.length === 0) {
        return new Response(JSON.stringify({ decisions: [], run_id: null, inserted: 0 }), {
            status:  200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const prompt = buildDecisionsPrompt(ctx);

    // Create bmb_run audit record
    let runId: string | null = null;
    try {
        const { data } = await supabase.from('bmb_runs').insert({
            brand_id,
            run_type: 'on_demand',
            trigger:  'operator',
            status:   'running',
            input:    { campaigns_count: ctx.campaigns.length },
            model:    BMB_MODEL,
        }).select('id').single();
        runId = data?.id ?? null;
    } catch { /* non-fatal */ }

    const startMs = Date.now();

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${BMB_MODEL}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  AbortSignal.timeout(BMB_TIMEOUT),
            body:    JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature:      0.1,
                    maxOutputTokens:  4096,
                    responseMimeType: 'application/json',
                },
            }),
        });

        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error((errData as { error?: { message?: string } })?.error?.message ?? `Gemini ${res.status}`);
        }

        const geminiData = await res.json();
        const rawText    = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
        const usage      = (geminiData.usageMetadata ?? {}) as Record<string, number>;
        const latency    = Date.now() - startMs;

        // Parse & validate decisions
        let rawDecisions: RawDecision[] = [];
        try {
            const parsed = JSON.parse(rawText);
            rawDecisions = Array.isArray(parsed) ? parsed : [];
        } catch { rawDecisions = []; }

        const VALID_TYPES   = new Set<string>(['scale', 'kill', 'duplicate', 'refresh', 'review', 'hold']);
        const campaignIdSet = new Set(ctx.campaigns.map(c => c.id));

        const validDecisions = rawDecisions.filter(d =>
            d &&
            typeof d === 'object' &&
            d.target_type === 'campaign' &&
            VALID_TYPES.has(d.decision_type) &&
            typeof d.target_id === 'string' &&
            campaignIdSet.has(d.target_id) &&
            typeof d.reasoning === 'string' &&
            d.reasoning.length > 0,
        );

        // Load existing pending decisions to deduplicate (one query, in-memory check)
        const { data: existingPending } = await supabase
            .from('ad_decisions')
            .select('target_id, decision_type')
            .eq('brand_id', brand_id)
            .eq('status', 'pending');

        const existingSet = new Set(
            (existingPending ?? []).map((d: { target_id: string; decision_type: string }) => `${d.target_id}:${d.decision_type}`),
        );

        // Insert new unique decisions
        let insertedCount = 0;
        const insertedDecisions: RawDecision[] = [];
        for (const d of validDecisions) {
            const key = `${d.target_id}:${d.decision_type}`;
            if (existingSet.has(key)) continue;

            const { error: insertErr } = await supabase.from('ad_decisions').insert({
                brand_id,
                bmb_run_id:         runId,
                target_type:        'campaign',
                target_id:          d.target_id,
                decision_type:      d.decision_type,
                status:             'pending',
                reasoning:          d.reasoning,
                supporting_metrics: d.supporting_metrics ?? {},
                scale_percent:      d.scale_percent   ?? null,
                source_id:          d.source_id       ?? null,
            });

            if (!insertErr) {
                insertedCount++;
                insertedDecisions.push(d);
                existingSet.add(key);
            }
        }

        // Update bmb_run record
        if (runId) {
            supabase.from('bmb_runs').update({
                status:        'completed',
                output:        { decisions_count: insertedCount, total_generated: validDecisions.length },
                tool_calls:    insertedDecisions,
                input_tokens:  usage.promptTokenCount     ?? null,
                output_tokens: usage.candidatesTokenCount ?? null,
                latency_ms:    latency,
                completed_at:  new Date().toISOString(),
            }).eq('id', runId).then(() => {}).catch(() => {});
        }

        console.log(JSON.stringify({
            correlationId,
            event:     'bmb-decisions-ok',
            brandId:   brand_id,
            generated: validDecisions.length,
            inserted:  insertedCount,
            latencyMs: latency,
        }));

        return new Response(JSON.stringify({
            decisions: insertedDecisions,
            run_id:    runId,
            inserted:  insertedCount,
        }), {
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
            }).eq('id', runId).then(() => {}).catch(() => {});
        }

        console.error(JSON.stringify({ correlationId, event: 'bmb-decisions-error', error: msg }));
        return jsonError(msg, 502, correlationId, corsHeaders);
    }
});
